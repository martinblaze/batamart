export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getEffectiveDeliveryDate, parseReadyDays } from '@/lib/delivery/schedule'

const DAY_MS = 24 * 60 * 60 * 1000

// Orders still waiting on the vendor: the admin phones each vendor to confirm
// when the product will actually be ready (see /admin/order-intake).
export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      orderBy: { createdAt: 'desc' },
      take: 150,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        deferredUntil: true,
        buyer: { select: { username: true } },
        seller: { select: { name: true, phone: true, hostelName: true, landmark: true } },
        product: { select: { name: true, deliveryEstimate: true } },
        items: {
          select: { quantity: true, product: { select: { name: true, deliveryEstimate: true } } },
        },
      },
    })

    const rows = orders.map(order => {
      const products = order.items.length > 0
        ? order.items.map(i => ({ name: i.product.name, quantity: i.quantity, estimate: i.product.deliveryEstimate }))
        : [{ name: order.product.name, quantity: 1, estimate: order.product.deliveryEstimate }]
      const readyDays = Math.max(0, ...products.map(p => parseReadyDays(p.estimate)))
      const readyOn = new Date(order.createdAt.getTime() + readyDays * DAY_MS)
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        placedAt: order.createdAt,
        buyerUsername: order.buyer.username,
        seller: order.seller,
        products,
        readyDays,
        readyOn,
        deliveryDate: getEffectiveDeliveryDate(order, readyDays),
      }
    })

    return NextResponse.json({ orders: rows })
  } catch (error) {
    console.error('order-intake error:', error)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
}
