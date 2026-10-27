// app/api/riders/pickups/route.ts
// The rider's Pickups tab: orders to collect from vendors, grouped by the
// vendor's area. Buyers are identified by username only here, because the
// parcel is labelled with it and the buyer's address isn't needed until the
// delivery stage.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { RIDER_SHARE_PERCENT } from '@/lib/delivery/commission'
import { getEffectiveDeliveryDate, parseReadyDays } from '@/lib/delivery/schedule'

const select = {
  id: true,
  orderNumber: true,
  status: true,
  deliveryFee: true,
  createdAt: true,
  deferredUntil: true,
  orderNote: true,
  buyer: { select: { username: true } },
  seller: { select: { name: true, phone: true, hostelName: true, roomNumber: true, landmark: true } },
  product: { select: { name: true, images: true, landmark: true, hostelName: true, deliveryEstimate: true, estimatedWeightKg: true } },
  items: { select: { quantity: true, product: { select: { name: true, images: true, deliveryEstimate: true } } } },
} as const

type Row = Awaited<ReturnType<typeof prisma.order.findMany<{ select: typeof select }>>>[number]

function shape(order: Row) {
  const items = order.items.length > 0
    ? order.items.map(i => ({ name: i.product.name, quantity: i.quantity, image: i.product.images?.[0] ?? null, estimate: i.product.deliveryEstimate }))
    : [{ name: order.product.name, quantity: 1, image: order.product.images?.[0] ?? null, estimate: order.product.deliveryEstimate }]
  const readyDays = Math.max(0, ...items.map(i => parseReadyDays(i.estimate)))
  const deliveryDate = getEffectiveDeliveryDate(order, readyDays)
  const area = (order.product.landmark || order.seller.landmark || order.seller.hostelName || 'Other').trim()
  return {
    area,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      username: order.buyer.username,
      note: order.orderNote,
      earn: Math.round(order.deliveryFee * RIDER_SHARE_PERCENT),
      deliveryDate: deliveryDate.toISOString(),
      canTakeNow: Date.now() >= deliveryDate.getTime(),
      vendor: {
        name: order.seller.name,
        phone: order.seller.phone,
        hostel: order.seller.hostelName || order.product.hostelName,
        room: order.seller.roomNumber,
        landmark: order.seller.landmark,
      },
      items: items.map(i => ({ name: i.name, quantity: i.quantity, image: i.image })),
    },
  }
}

function group(rows: Row[]) {
  const map = new Map<string, ReturnType<typeof shape>['order'][]>()
  for (const row of rows) {
    const { area, order } = shape(row)
    if (!map.has(area)) map.set(area, [])
    map.get(area)!.push(order)
  }
  return Array.from(map.entries())
    .map(([area, orders]) => ({
      area,
      orders: orders.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)),
      claimable: orders.filter(o => o.canTakeNow && ['PENDING', 'PROCESSING'].includes(o.status)).length,
    }))
    .sort((a, b) => b.orders.length - a.orders.length)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [open, mine] = await Promise.all([
      user.universityId
        ? prisma.order.findMany({
            where: {
              riderId: null,
              status: { in: ['PENDING', 'PROCESSING'] },
              isDisputed: false,
              buyer: { universityId: user.universityId },
            },
            select,
            orderBy: { createdAt: 'asc' },
            take: 300,
          })
        : Promise.resolve([] as Row[]),
      prisma.order.findMany({
        where: { riderId: user.id, status: { in: ['RIDER_ASSIGNED', 'PICKED_UP'] }, isDisputed: false },
        select,
        orderBy: { createdAt: 'asc' },
      }),
    ])

    return NextResponse.json({ available: group(open), mine: group(mine) })
  } catch (error) {
    console.error('rider pickups error:', error)
    return NextResponse.json({ error: 'Failed to load pickups' }, { status: 500 })
  }
}
