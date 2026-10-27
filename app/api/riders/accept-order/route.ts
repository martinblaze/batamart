// app/api/riders/accept-order/route.ts
// Legacy batch entry point (older app builds): claims every open order of a
// batch through the same order-level claim the web dashboard uses.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { RIDER_SHARE_PERCENT } from '@/lib/delivery/commission'
import { claimPickupOrders } from '@/lib/delivery/claim'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { batchId, orderIds } = await request.json()
    let ids: string[] = Array.isArray(orderIds) ? orderIds.filter(Boolean) : []

    if (ids.length === 0) {
      if (!batchId) return NextResponse.json({ error: 'Batch ID or order IDs required' }, { status: 400 })
      const batchOrders = await prisma.order.findMany({
        where: { batchId, riderId: null, status: { in: ['PENDING', 'PROCESSING'] } },
        select: { id: true },
      })
      ids = batchOrders.map(o => o.id)
      if (ids.length === 0) {
        return NextResponse.json({ error: 'Batch is no longer available' }, { status: 409 })
      }
    }

    const result = await claimPickupOrders({ id: user.id, name: user.name ?? null, universityId: user.universityId ?? null }, ids)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, blockReason: result.blockReason }, { status: result.status })
    }

    const claimed = await prisma.order.findMany({
      where: { id: { in: result.claimedIds } },
      select: { deliveryFee: true },
    })
    const riderFee = claimed.reduce((sum, o) => sum + Math.round(o.deliveryFee * RIDER_SHARE_PERCENT), 0)

    const batch = batchId
      ? await prisma.deliveryBatch.findUnique({
          where: { id: batchId },
          include: {
            buyer: { select: { name: true, phone: true, hostelName: true, roomNumber: true, landmark: true } },
            orders: {
              include: {
                product: { select: { name: true, images: true, hostelName: true, estimatedWeightKg: true, dimensionsCm: true } },
                seller: { select: { name: true, phone: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      : null

    return NextResponse.json({
      success: true,
      message: `${result.claimedIds.length} order${result.claimedIds.length > 1 ? 's' : ''} to pick up.`,
      riderFee,
      orderCount: result.claimedIds.length,
      claimedIds: result.claimedIds,
      skipped: result.skipped,
      batchNumber: batch?.batchNumber,
      batch,
    })
  } catch (error) {
    console.error('Accept batch error:', error)
    return NextResponse.json({ error: 'Failed to accept batch' }, { status: 500 })
  }
}
