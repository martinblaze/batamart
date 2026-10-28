export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notification'
import { notifyOrderCancelledRefund } from '@/lib/notify/events'
import { reverseSellerEscrow } from '@/lib/escrow'

// Cancels an order the vendor cannot supply, refunds the buyer in full to
// their wallet, releases the vendor's escrow, and puts the stock back. The
// order row is kept (status CANCELLED) rather than deleted: money moved, and
// the audit trail has to survive.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' && body.reason.trim()
      ? body.reason.trim().slice(0, 200)
      : 'Product not available'

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
        include: { items: true, buyer: { select: { availableBalance: true } } },
      })
      if (!order) throw new Error('ORDER_NOT_FOUND')
      if (!['PENDING', 'PROCESSING'].includes(order.status)) throw new Error('NOT_CANCELLABLE')

      // Atomic flip so a double click cannot refund twice.
      const flip = await tx.order.updateMany({
        where: { id: order.id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'CANCELLED' },
      })
      if (flip.count !== 1) throw new Error('NOT_CANCELLABLE')

      const refund = Number(order.totalAmount)
      const buyerBefore = Number(order.buyer.availableBalance ?? 0)
      await tx.user.update({
        where: { id: order.buyerId },
        data: { availableBalance: { increment: refund } },
      })
      await tx.transaction.create({
        data: {
          userId: order.buyerId,
          type: 'CREDIT',
          amount: refund,
          description: `Refund: ${reason} (Order #${order.orderNumber})`,
          reference: `${order.orderNumber}-CANCEL-REFUND`,
          balanceBefore: buyerBefore,
          balanceAfter: buyerBefore + refund,
        },
      })
      await tx.payment.updateMany({
        where: { orderId: order.id, status: { not: 'REFUNDED' } },
        data: { status: 'REFUNDED', refundedAt: new Date(), refundAmount: refund, refundReason: reason },
      })

      // Give back the escrow that was held for the vendor at checkout.
      await reverseSellerEscrow(tx, order)

      // Restore stock.
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          })
        }
        await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity }, isActive: true },
        })
      }

      return { order, refund }
    })

    await Promise.all([
      notifyOrderCancelledRefund(result.order, reason, result.refund),
      createNotification({
        userId: result.order.sellerId,
        type: 'ORDER_CANCELLED',
        title: 'Order cancelled',
        message: `Order #${result.order.orderNumber} was cancelled: ${reason}.`,
        orderId: result.order.id,
      }),
    ])

    return NextResponse.json({ success: true, refunded: result.refund })
  } catch (error: any) {
    if (error?.message === 'ORDER_NOT_FOUND') return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (error?.message === 'NOT_CANCELLABLE') {
      return NextResponse.json({ error: 'This order can no longer be cancelled here' }, { status: 409 })
    }
    console.error('order-intake cancel error:', error)
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 })
  }
}
