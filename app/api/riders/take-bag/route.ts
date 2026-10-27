// app/api/riders/take-bag/route.ts
// A delivery rider takes a packed bag from the hub. The buyer is then told
// the order is on its way and can follow the rider on the map; the buyer, not
// the rider, marks it delivered.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { notifyOutForDelivery } from '@/lib/notify/events'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const orderIds: string[] = Array.isArray(body?.orderIds) ? body.orderIds.filter((x: unknown) => typeof x === 'string').slice(0, 100) : []
    if (orderIds.length === 0) return NextResponse.json({ error: 'No bag selected' }, { status: 400 })

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, status: 'PACKED', deliveryRiderId: null },
      select: { id: true, orderNumber: true, buyerId: true, buyer: { select: { universityId: true } } },
    })
    const mine = orders.filter(o => !user.universityId || o.buyer.universityId === user.universityId)

    const taken: typeof mine = []
    for (const o of mine) {
      const res = await prisma.order.updateMany({
        where: { id: o.id, status: 'PACKED', deliveryRiderId: null },
        data: { status: 'ON_THE_WAY', deliveryRiderId: user.id },
      })
      if (res.count === 1) taken.push(o)
    }

    if (taken.length === 0) {
      return NextResponse.json({ error: 'This bag was just taken by another rider' }, { status: 409 })
    }

    await prisma.auditLog.createMany({
      data: taken.map(o => ({
        userId: user.id,
        action: 'RIDER_STATUS_CHECKPOINT',
        entityType: 'ORDER_TRACKING',
        entityId: o.id,
        newValue: { status: 'ON_THE_WAY', orderNumber: o.orderNumber, note: 'Delivery rider took the bag' },
      })),
    })

    await Promise.allSettled(
      taken.map(o => notifyOutForDelivery({ id: o.id, orderNumber: o.orderNumber, buyerId: o.buyerId }, user.name || 'Your rider')),
    )

    return NextResponse.json({ success: true, taken: taken.length })
  } catch (error) {
    console.error('take-bag error:', error)
    return NextResponse.json({ error: 'Failed to take the bag' }, { status: 500 })
  }
}
