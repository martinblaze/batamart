// app/api/riders/deliveries/route.ts
// The rider's Deliveries tab: packed bags waiting at the hub (available) and
// the parcels this rider is out delivering (mine), both grouped by area.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { RIDER_SHARE_PERCENT } from '@/lib/delivery/commission'
import { lagosDayKey } from '@/lib/delivery/schedule'

const select = {
  id: true,
  orderNumber: true,
  status: true,
  deliveryFee: true,
  packedAt: true,
  bagLabel: true,
  deliveryHostel: true,
  deliveryRoom: true,
  deliveryLandmark: true,
  deliveryPhone: true,
  orderNote: true,
  buyer: { select: { name: true, username: true } },
  product: { select: { name: true } },
  items: { select: { quantity: true, product: { select: { name: true } } } },
} as const

type Row = Awaited<ReturnType<typeof prisma.order.findMany<{ select: typeof select }>>>[number]

function shape(o: Row) {
  const items = o.items.length > 0
    ? o.items.map(i => `${i.product.name} x${i.quantity}`)
    : [o.product.name]
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    username: o.buyer.username,
    buyerName: o.buyer.name,
    phone: o.deliveryPhone,
    hostel: o.deliveryHostel,
    room: o.deliveryRoom,
    landmark: o.deliveryLandmark,
    note: o.orderNote,
    earn: Math.round(o.deliveryFee * RIDER_SHARE_PERCENT),
    items,
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [packed, mine] = await Promise.all([
      user.universityId
        ? prisma.order.findMany({
            where: { status: 'PACKED', deliveryRiderId: null, buyer: { universityId: user.universityId } },
            select,
            orderBy: { packedAt: 'asc' },
            take: 400,
          })
        : Promise.resolve([] as Row[]),
      prisma.order.findMany({
        where: { status: 'ON_THE_WAY', deliveryRiderId: user.id },
        select,
        orderBy: { packedAt: 'asc' },
      }),
    ])

    // Bags: same bag name packed for the same delivery day travel together.
    const bagMap = new Map<string, { bag: string; day: string; earn: number; count: number; orderIds: string[]; areas: string[] }>()
    for (const o of packed) {
      const bag = (o.bagLabel || o.deliveryLandmark || 'General').trim()
      const day = o.packedAt ? lagosDayKey(o.packedAt) : ''
      const key = `${bag}|${day}`
      const entry = bagMap.get(key) ?? { bag, day, earn: 0, count: 0, orderIds: [], areas: [] }
      entry.earn += Math.round(o.deliveryFee * RIDER_SHARE_PERCENT)
      entry.count += 1
      entry.orderIds.push(o.id)
      const area = (o.deliveryLandmark || '').trim()
      if (area && !entry.areas.includes(area)) entry.areas.push(area)
      bagMap.set(key, entry)
    }

    const areaMap = new Map<string, ReturnType<typeof shape>[]>()
    for (const o of mine) {
      const area = (o.deliveryLandmark || 'Other').trim()
      if (!areaMap.has(area)) areaMap.set(area, [])
      areaMap.get(area)!.push(shape(o))
    }

    return NextResponse.json({
      bags: Array.from(bagMap.values()),
      mine: Array.from(areaMap.entries()).map(([area, orders]) => ({ area, orders })),
    })
  } catch (error) {
    console.error('rider deliveries error:', error)
    return NextResponse.json({ error: 'Failed to load deliveries' }, { status: 500 })
  }
}
