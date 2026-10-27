import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  })
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      where: { sellerId: user.id },
      include: {
        // Vendors only see the buyer's username (the label on the parcel).
        buyer: { select: { id: true, username: true } },
        rider: { select: { name: true, phone: true } },
        product: {
          select: {
            id: true,
            name: true,
            images: true,
            price: true,
            landmark: true,
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            variantData: true,
            quantity: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const safe = orders.map(({ deliveryHostel, deliveryRoom, deliveryPhone, ...order }) => ({
      ...order,
      buyer: { id: order.buyer.id, name: order.buyer.username ?? 'Buyer', username: order.buyer.username },
    }))

    return jsonResponse({ success: true, orders: safe, count: safe.length })
  } catch (error) {
    console.error('Error fetching sales orders:', error)
    return jsonResponse({ error: 'Failed to fetch sales orders', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}