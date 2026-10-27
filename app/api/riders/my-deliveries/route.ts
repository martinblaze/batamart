// app/api/riders/my-deliveries/route.ts
// Legacy list used by the Flutter rider app: this rider's active orders,
// grouped per original checkout (batch). Covers both legs now: pickups they
// claimed and packed bags they took from the hub. The buyer's address and
// phone are only included once the rider is on the delivery leg.
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

    const orders = await prisma.order.findMany({
      where: {
        OR: [
          { riderId: user.id, status: { in: ['RIDER_ASSIGNED', 'PICKED_UP'] } },
          { deliveryRiderId: user.id, status: 'ON_THE_WAY' },
          // Dispute return legs keep the old single-rider flow.
          { riderId: user.id, isDisputed: true, status: { in: ['ON_THE_WAY'] } },
        ],
      },
      include: {
        batch: { select: { id: true, batchNumber: true, status: true } },
        buyer: { select: { name: true, username: true, phone: true, hostelName: true, roomNumber: true, landmark: true } },
        product: {
          select: { name: true, images: true, hostelName: true, estimatedWeightKg: true, dimensionsCm: true, campaignTag: true },
        },
        seller: { select: { name: true, phone: true } },
        dispute: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const batches = new Map<string, any>()
    for (const order of orders) {
      const onDeliveryLeg = order.status === 'ON_THE_WAY'
      const { batch, buyer, deliveryHostel, deliveryRoom, deliveryPhone, ...rest } = order
      const safeOrder = {
        ...rest,
        deliveryHostel: onDeliveryLeg || order.isDisputed ? deliveryHostel : '',
        deliveryRoom: onDeliveryLeg || order.isDisputed ? deliveryRoom : '',
        deliveryPhone: onDeliveryLeg || order.isDisputed ? deliveryPhone : '',
        buyerUsername: buyer.username,
      }
      const key = batch?.id ?? order.id
      if (!batches.has(key)) {
        batches.set(key, {
          id: key,
          batchNumber: batch?.batchNumber ?? null,
          status: batch?.status ?? 'IN_PROGRESS',
          buyer: onDeliveryLeg || order.isDisputed
            ? { name: buyer.name, phone: buyer.phone, hostelName: buyer.hostelName, roomNumber: buyer.roomNumber, landmark: buyer.landmark }
            : { name: buyer.username, phone: null, hostelName: null, roomNumber: null, landmark: null },
          orders: [],
        })
      }
      batches.get(key).orders.push(safeOrder)
    }

    return NextResponse.json({ batches: Array.from(batches.values()) })
  } catch (error) {
    console.error('my-deliveries error:', error)
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 })
  }
}
