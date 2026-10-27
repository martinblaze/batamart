// app/api/admin/hub/action/route.ts
// receive: parcel physically arrived (rider brought it)  -> AT_HUB ("Sorting")
// pack:    parcel put into an area bag                   -> PACKED
// unpack:  take it back out of its bag                   -> AT_HUB
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyAtHub, notifyPacked } from '@/lib/notify/events'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body?.action as 'receive' | 'pack' | 'unpack'
    const orderIds: string[] = Array.isArray(body?.orderIds) ? body.orderIds.filter((x: unknown) => typeof x === 'string').slice(0, 200) : []
    const bagLabel = typeof body?.bagLabel === 'string' ? body.bagLabel.trim().slice(0, 40) : ''

    if (!['receive', 'pack', 'unpack'].includes(action) || orderIds.length === 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, orderNumber: true, status: true, buyerId: true, deliveryLandmark: true, pickedUpAt: true },
    })

    const now = new Date()
    let changed = 0
    const notify: { buyerId: string; orderId: string; orderNumber: string; title: string; message: string }[] = []

    for (const o of orders) {
      if (action === 'receive' && (o.status === 'RIDER_ASSIGNED' || o.status === 'PICKED_UP')) {
        const res = await prisma.order.updateMany({
          where: { id: o.id, status: o.status },
          data: { status: 'AT_HUB', hubReceivedAt: now, ...(o.pickedUpAt ? {} : { pickedUpAt: now }) },
        })
        if (res.count) {
          changed++
          notify.push({ buyerId: o.buyerId, orderId: o.id, orderNumber: o.orderNumber, title: 'At our hub', message: `Your order #${o.orderNumber} has reached our sorting hub and is being checked.` })
        }
      } else if (action === 'pack' && o.status === 'AT_HUB') {
        const res = await prisma.order.updateMany({
          where: { id: o.id, status: 'AT_HUB' },
          data: { status: 'PACKED', packedAt: now, bagLabel: bagLabel || (o.deliveryLandmark || 'General').trim() },
        })
        if (res.count) {
          changed++
          notify.push({ buyerId: o.buyerId, orderId: o.id, orderNumber: o.orderNumber, title: 'Packed for delivery', message: `Your order #${o.orderNumber} is packed and waiting for a rider.` })
        }
      } else if (action === 'unpack' && o.status === 'PACKED') {
        const res = await prisma.order.updateMany({
          where: { id: o.id, status: 'PACKED' },
          data: { status: 'AT_HUB', packedAt: null, bagLabel: null },
        })
        if (res.count) changed++
      }
    }

    await Promise.allSettled(
      notify.map(n => {
        const order = { id: n.orderId, orderNumber: n.orderNumber, buyerId: n.buyerId }
        return action === 'receive' ? notifyAtHub(order) : notifyPacked(order)
      }),
    )

    return NextResponse.json({ success: true, changed })
  } catch (error) {
    console.error('hub action error:', error)
    return NextResponse.json({ error: 'Failed to update the sorting room' }, { status: 500 })
  }
}
