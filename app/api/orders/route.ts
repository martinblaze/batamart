// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { notifyOrderPlaced } from '@/lib/notification'
import { getDeliveryFee } from '@/lib/delivery/pricing'

export const dynamic = 'force-dynamic'

// GET — fetch the current user's orders
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      where: { buyerId: user.id },
      include: {
        product: {
          select: {
            id:     true,
            name:   true,
            images: true,
            price:  true,
          },
        },
        seller: {
          select: {
            id:            true,
            name:          true,
            email:         true,
            phone:         true,
            profilePhoto:  true,
            avgRating:     true,
            trustLevel:    true,
          },
        },
        rider: {
          select: {
            id:    true,
            name:  true,
            phone: true,
          },
        },
        productReviews: {
          select: {
            id:        true,
            rating:    true,
            comment:   true,
            createdAt: true,
          },
        },
        reviews: {
          select: {
            id:        true,
            type:      true,
            rating:    true,
            comment:   true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedOrders = orders.map(order => ({
      ...order,
      // ── Include orderNote so variant display works on the orders page ──
      orderNote: order.orderNote ?? null,
      deliveryAddress: `${order.deliveryHostel}, Room ${order.deliveryRoom}${order.deliveryLandmark ? `, ${order.deliveryLandmark}` : ''}`,
      isPaid: order.status === 'COMPLETED',
    }))

    return NextResponse.json({ orders: formattedOrders })
  } catch (error) {
    console.error('Fetch orders error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

// POST — create a single-product order
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { productId, quantity } = body

    if (!productId || !quantity || typeof quantity !== 'number' || quantity < 1) {
      return NextResponse.json({ error: 'productId and a positive quantity are required' }, { status: 400 })
    }

    const pickupProduct = await prisma.product.findUnique({
      where: { id: productId },
      select: { landmark: true },
    })
    const deliveryFee = await getDeliveryFee(user.universityId, pickupProduct?.landmark, user.landmark)

    // ── Atomic transaction: check stock AND create order in one DB round-trip ─
    // Without this, two simultaneous requests for the last item in stock both
    // pass the stock check and both create an order — overselling the product.
    // Using $transaction with a select-for-update pattern via Prisma's atomic
    // decrement and a conditional where clause prevents this race condition.
    let order: Awaited<ReturnType<typeof prisma.order.create>>

    try {
      order = await prisma.$transaction(async (tx) => {
        // Decrement stock atomically — only if enough stock exists.
        // If quantity would go negative the update returns 0 rows (Prisma throws).
        const updatedProduct = await tx.product.update({
          where: {
            id:       productId,
            isActive: true,
            quantity: { gte: quantity }, // guard: only proceed if stock is sufficient
          },
          data: { quantity: { decrement: quantity } },
        })

        // Can't buy own product
        if (updatedProduct.sellerId === user.id) {
          throw new Error('SELF_PURCHASE')
        }

        const totalAmount = updatedProduct.price * quantity + deliveryFee
        const orderNumber = `BATAMART-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`

        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            buyerId:            user.id,
            sellerId:           updatedProduct.sellerId,
            productId:          updatedProduct.id,
            totalAmount,
            deliveryFee,
            platformCommission: updatedProduct.price * 0.05,
            quantity,
            productPrice:       updatedProduct.price,
            deliveryHostel:     user.hostelName   ?? '',
            deliveryRoom:       user.roomNumber   ?? '',
            deliveryLandmark:   user.landmark     ?? '',
            deliveryPhone:      user.phone        ?? '',
          },
        })

        // If stock just hit zero, deactivate the listing automatically
        if (updatedProduct.quantity - quantity <= 0) {
          await tx.product.update({
            where: { id: productId },
            data:  { isActive: false },
          })
        }

        return newOrder
      }, { timeout: 15000, maxWait: 20000 })
    } catch (txError: any) {
      if (txError?.message === 'SELF_PURCHASE') {
        return NextResponse.json({ error: 'Cannot buy your own product' }, { status: 400 })
      }
      // Prisma P2025 = record not found — means stock was insufficient or product inactive
      if (txError?.code === 'P2025') {
        return NextResponse.json({ error: 'Product is unavailable or out of stock' }, { status: 400 })
      }
      throw txError
    }

    // Fire notification non-blocking — never delay the response
    notifyOrderPlaced(order.id, user.id, order.sellerId, order.orderNumber, '')
      .catch(err => console.error('Order notification failed:', err))

    return NextResponse.json({ success: true, order })
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}