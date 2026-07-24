// app/api/riders/accept-order/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { batchId } = await request.json()

    if (!batchId) {
      return NextResponse.json({ error: 'Batch ID required' }, { status: 400 })
    }

    // ── Block if rider has a pending dispute pickup ───────────────────────
    const pendingDisputePickup = await prisma.order.findFirst({
      where: {
        riderId:    user.id,
        isDisputed: true,
        status:     'RIDER_ASSIGNED',
        dispute: {
          resolution: '__AWAITING_PICKUP__',
        },
      },
      select: { orderNumber: true },
    })

    if (pendingDisputePickup) {
      return NextResponse.json({
        error:       `You have a pending dispute pickup (Order #${pendingDisputePickup.orderNumber}). Complete that return first.`,
        blockReason: 'DISPUTE_PICKUP_PENDING',
      }, { status: 400 })
    }

    // ── Block if rider already has an active batch ────────────────────────
    const activeBatch = await prisma.deliveryBatch.findFirst({
      where: {
        riderId: user.id,
        status:  { in: ['RIDER_ASSIGNED', 'IN_PROGRESS'] },
      },
      select: { batchNumber: true },
    })

    if (activeBatch) {
      return NextResponse.json({
        error:       `You still have an active batch (${activeBatch.batchNumber}). Complete it first.`,
        blockReason: 'ACTIVE_DELIVERY',
      }, { status: 400 })
    }

    // ── Fetch the batch with all its orders ───────────────────────────────
    const batch = await prisma.deliveryBatch.findUnique({
      where:   { id: batchId },
      include: {
        orders: {
          select: {
            id:          true,
            orderNumber: true,
            status:      true,
            buyerId:     true,
            sellerId:    true,
            product:     { select: { name: true } },
          },
        },
        buyer: { select: { universityId: true } },
      },
    })

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Race condition: another rider accepted between the findFirst check and here
    if (batch.riderId) {
      return NextResponse.json({ error: 'Batch already assigned to another rider' }, { status: 409 })
    }

    if (batch.status !== 'PENDING') {
      return NextResponse.json({ error: 'Batch is no longer available' }, { status: 409 })
    }

    // ── University cross-check ────────────────────────────────────────────
    if (user.universityId && batch.buyer.universityId !== user.universityId) {
      return NextResponse.json(
        { error: 'This batch is outside your campus area.' },
        { status: 403 }
      )
    }

    // ── Seller acceptance gate ─────────────────────────────────────────────
    // Riders can see and get notified about a batch as soon as it's placed,
    // but can't claim it until every seller in it has accepted their order
    // (PENDING -> PROCESSING via app/api/orders/[id]/route.ts) — otherwise a
    // rider could be sent to collect from a seller who hasn't even started.
    const notYetAccepted = batch.orders.filter(o => o.status === 'PENDING')
    if (notYetAccepted.length > 0) {
      return NextResponse.json({
        error: `Waiting on ${notYetAccepted.length} seller${notYetAccepted.length > 1 ? 's' : ''} to accept this order. Try again shortly.`,
        blockReason: 'AWAITING_SELLER_ACCEPTANCE',
      }, { status: 409 })
    }

    const riderSharePerOrder = 560
    const totalRiderEscrow   = riderSharePerOrder * batch.orders.length

    // ── Atomic assignment ─────────────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      // Claim batch only if still unassigned and pending (race-safe).
      const claim = await tx.deliveryBatch.updateMany({
        where: {
          id: batchId,
          riderId: null,
          status: 'PENDING',
        },
        data: {
          riderId: user.id,
          status:  'RIDER_ASSIGNED',
        },
      })
      if (claim.count !== 1) {
        throw new Error('BATCH_ALREADY_CLAIMED')
      }

      // Assign rider to every order in the batch + flip to RIDER_ASSIGNED.
      // Orders reach here via PROCESSING (seller-accepted) — see
      // app/api/riders/available-orders/route.ts, which only surfaces
      // batches where every order has already left PENDING.
      await tx.order.updateMany({
        where: { batchId, riderId: null, status: 'PROCESSING' },
        data:  {
          riderId:         user.id,
          status:          'RIDER_ASSIGNED',
          riderAssignedAt: new Date(),
        },
      })

      await tx.auditLog.createMany({
        data: batch.orders.map(order => ({
          userId: user.id,
          action: 'RIDER_TRACKING_STARTED',
          entityType: 'ORDER_TRACKING',
          entityId: order.id,
          newValue: {
            status: 'RIDER_ASSIGNED',
            batchId,
            orderNumber: order.orderNumber,
            note: 'Rider accepted delivery batch',
          },
        })),
      })

      // Escrow the full rider share for all orders at once
      const rider = await tx.user.findUnique({
        where:  { id: user.id },
        select: { pendingBalance: true },
      })
      const balBefore = Number(rider?.pendingBalance ?? 0)

      await tx.user.update({
        where: { id: user.id },
        data:  { pendingBalance: { increment: totalRiderEscrow } },
      })

      await tx.transaction.create({
        data: {
          userId:        user.id,
          type:          'ESCROW',
          amount:        totalRiderEscrow,
          description:   `Escrow for batch: ${batch.batchNumber} (${batch.orders.length} order${batch.orders.length > 1 ? 's' : ''})`,
          reference:     `${batch.batchNumber}-RIDER-ESCROW`,
          balanceBefore: balBefore,
          balanceAfter:  balBefore + totalRiderEscrow,
        },
      })
    }, { timeout: 15000, maxWait: 20000 })

    // ── Notify buyer + sellers (fire-and-forget) ──────────────────────────
    const refreshedBatch = await prisma.deliveryBatch.findUnique({
      where: { id: batchId },
      include: {
        buyer: {
          select: {
            name: true,
            phone: true,
            hostelName: true,
            roomNumber: true,
            landmark: true,
          },
        },
        orders: {
          include: {
            product: {
              select: { name: true, images: true, hostelName: true, estimatedWeightKg: true, dimensionsCm: true },
            },
            seller: {
              select: { name: true, phone: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    Promise.allSettled(
      batch.orders.map(order =>
        import('@/lib/notification')
          .then(({ notifyRiderAssigned }) =>
            notifyRiderAssigned(
              order.id,
              order.buyerId,
              order.sellerId,
              user.id,
              user.name,
              order.orderNumber
            )
          )
          .catch(err => console.error(`Rider-assigned notification failed for ${order.orderNumber}:`, err))
      )
    )

    return NextResponse.json({
      success:   true,
      message:   `Batch accepted! ${batch.orders.length} order${batch.orders.length > 1 ? 's' : ''} to pick up.`,
      riderFee:  totalRiderEscrow,
      batchNumber: batch.batchNumber,
      orderCount: batch.orders.length,
      batch: refreshedBatch,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'BATCH_ALREADY_CLAIMED') {
      return NextResponse.json({ error: 'Batch already assigned to another rider' }, { status: 409 })
    }
    console.error('Accept batch error:', error)
    return NextResponse.json({
      error:   'Failed to accept batch',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
