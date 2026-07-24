// app/api/riders/available-orders/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

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
    // A batch is available when:
    //   • status is PENDING (no rider yet)
    //   • riderId is null
    //   • all orders inside belong to the rider's campus
    //   • every order inside has been accepted by its seller (PROCESSING) —
    //     a rider shouldn't be sent to collect from a seller who hasn't even
    //     started preparing yet. See app/api/orders/[id]/route.ts for the
    //     seller-accept transition.
    const batches = await prisma.deliveryBatch.findMany({
      where: {
        status:       'PENDING',
        riderId:      null,
        universityId: user.universityId,
        orders:       { none: { status: 'PENDING' } },
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
              select: { name: true, images: true, hostelName: true, estimatedWeightKg: true, dimensionsCm: true },
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

    return NextResponse.json({ batches, disputePickups })
  } catch (error) {
    console.error('available-orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
