// app/api/riders/available-orders/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { getOrderDeliveryDate, parseReadyDays } from '@/lib/delivery/schedule'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.universityId) {
      return NextResponse.json({ batches: [], disputePickups: [] })
    }

    // ── Available batches ──────────────────────────────────────────────────
    // A batch is visible to riders as soon as it's PENDING (payment done) —
    // riders should see and get notified about a job immediately. Whether
    // they can actually ACCEPT it yet (i.e. every seller in the batch has
    // confirmed) is gated separately in app/api/riders/accept-order/route.ts;
    // each order's `status` here (PENDING vs PROCESSING) is what the rider
    // dashboard uses to show a "waiting for seller" state per batch.
    const batches = await prisma.deliveryBatch.findMany({
      where: {
        status:       'PENDING',
        riderId:      null,
        universityId: user.universityId,
      },
      include: {
        buyer: {
          select: {
            name:      true,
            phone:     true,
            hostelName: true,
            roomNumber: true,
            landmark:  true,
          },
        },
        orders: {
          include: {
            product: {
              select: { name: true, images: true, hostelName: true, landmark: true, estimatedWeightKg: true, dimensionsCm: true, campaignTag: true, deliveryEstimate: true },
            },
            seller: {
              select: { name: true, phone: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // ── Dispute pickup jobs assigned to this rider ─────────────────────────
    const disputePickups = await prisma.order.findMany({
      where: {
        riderId:    user.id,
        isDisputed: true,
        status:     { in: ['RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'] },
        dispute: {
          resolution: {
            in: [
              '__AWAITING_PICKUP__',
              '__SELLER_FAULT_AWAITING_PICKUP__',
              '__RETURN_PICKED_UP__',
              '__RETURN_ON_THE_WAY__',
              '__RETURN_DELIVERED_TO_SELLER__',
            ],
          },
        },
      },
      include: {
        product: true,
        seller:  {
          select: {
            name: true,
            phone: true,
            hostelName: true,
            roomNumber: true,
            landmark: true,
          },
        },
        buyer:   { select: { name: true, phone: true } },
        dispute: {
          select: {
            id:            true,
            reason:        true,
            pickupAddress: true,
          },
        },
      },
    })

    // Soonest delivery day first, then oldest order first within a day.
    const scheduledBatches = batches
      .map(batch => {
        const readyDays = Math.max(0, ...batch.orders.map(o => parseReadyDays(o.product?.deliveryEstimate)))
        const scheduled = getOrderDeliveryDate(batch.createdAt, readyDays)
        return {
          ...batch,
          scheduledFor: scheduled.toISOString(),
          canAcceptNow: Date.now() >= scheduled.getTime(),
        }
      })
      .sort((a, b) =>
        a.scheduledFor === b.scheduledFor
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : a.scheduledFor < b.scheduledFor ? -1 : 1,
      )

    return NextResponse.json({ batches: scheduledBatches, disputePickups })
  } catch (error) {
    console.error('available-orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
