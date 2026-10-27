// app/api/admin/hub/route.ts
// Sorting room: every parcel on its way to, or sitting in, the hub.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveDeliveryDate, lagosDayKey, parseReadyDays } from '@/lib/delivery/schedule'

export async function GET(request: NextRequest) {
  try {
    const username = (new URL(request.url).searchParams.get('username') || '').trim().toLowerCase().replace(/^@/, '')

    const orders = await prisma.order.findMany({
      where: {
        status: { in: ['RIDER_ASSIGNED', 'PICKED_UP', 'AT_HUB', 'PACKED'] },
        isDisputed: false,
        ...(username ? { buyer: { username: { contains: username } } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        deferredUntil: true,
        bagLabel: true,
        deliveryLandmark: true,
        buyer: { select: { username: true } },
        seller: { select: { name: true } },
        rider: { select: { name: true } },
        product: { select: { name: true, deliveryEstimate: true } },
        items: { select: { quantity: true, product: { select: { name: true, deliveryEstimate: true } } } },
      },
    })

    const rows = orders.map(o => {
      const items = o.items.length > 0
        ? o.items.map(i => ({ name: i.product.name, quantity: i.quantity, estimate: i.product.deliveryEstimate }))
        : [{ name: o.product.name, quantity: 1, estimate: o.product.deliveryEstimate }]
      const readyDays = Math.max(0, ...items.map(i => parseReadyDays(i.estimate)))
      const deliveryDate = getEffectiveDeliveryDate(o, readyDays)
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        username: o.buyer.username,
        vendor: o.seller.name,
        rider: o.rider?.name ?? null,
        area: (o.deliveryLandmark || 'Unspecified').trim(),
        bagLabel: o.bagLabel,
        items: items.map(i => `${i.name} x${i.quantity}`),
        deliveryDate: deliveryDate.toISOString(),
        dayKey: lagosDayKey(deliveryDate),
      }
    })

    return NextResponse.json({ orders: rows })
  } catch (error) {
    console.error('hub list error:', error)
    return NextResponse.json({ error: 'Failed to load the sorting room' }, { status: 500 })
  }
}
