import { prisma } from '@/lib/prisma'
import { createNotification, notifyAccountSuspended } from '@/lib/notification'

const OVERSIZED_REASON = 'Item Too Large For Motorcycle Delivery'

export function getSuspensionWindow(strikeCount: number): { days: number | null; reason: string } {
  if (strikeCount === 2) return { days: 3, reason: 'Temporary suspension for repeated oversized listings' }
  if (strikeCount === 3) return { days: 14, reason: 'Extended suspension for repeated oversized listings' }
  if (strikeCount >= 4) return { days: null, reason: 'Permanent suspension for repeated oversized listings' }
  return { days: 0, reason: 'Oversized listing warning issued' }
}

export async function applyOversizedDecline(params: { orderId: string; riderId: string; proofImageUrl?: string | null }) {
  const now = new Date()
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      include: { buyer: true, product: true, payment: true },
    })
    if (!order) throw new Error('ORDER_NOT_FOUND')
    if (order.riderId !== params.riderId) throw new Error('NOT_ASSIGNED_RIDER')
    if (order.status === 'CANCELLED') throw new Error('ORDER_ALREADY_CANCELLED')

    const existingLog = await tx.oversizedDeclineLog.findFirst({ where: { orderId: order.id, riderId: params.riderId } })
    if (existingLog?.refundIssued) throw new Error('DUPLICATE_DECLINE')

    const refundAmount = Number(order.totalAmount) - Number(order.deliveryFee)
    const buyerBal = Number(order.buyer.availableBalance ?? 0)
    await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', oversizedCancellationReason: OVERSIZED_REASON } })
    await tx.payment.updateMany({
      where: { orderId: order.id, status: { not: 'REFUNDED' } },
      data: { status: 'REFUNDED', refundedAt: now, refundAmount, refundReason: 'Oversized item declined by rider' },
    })
    await tx.user.update({ where: { id: order.buyerId }, data: { availableBalance: { increment: refundAmount } } })
    await tx.transaction.create({
      data: {
        userId: order.buyerId,
        type: 'CREDIT',
        amount: refundAmount,
        description: `Refund for oversized item (Order #${order.orderNumber})`,
        reference: `${order.orderNumber}-OVERSIZED-REFUND`,
        balanceBefore: buyerBal,
        balanceAfter: buyerBal + refundAmount,
      },
    })

    const strikeCount = (await tx.sellerStrike.count({ where: { sellerId: order.sellerId } })) + 1
    const suspension = getSuspensionWindow(strikeCount)
    const suspensionExpiry = suspension.days === null ? null : suspension.days > 0 ? new Date(now.getTime() + suspension.days * 86400000) : null
    await tx.sellerStrike.create({
      data: {
        sellerId: order.sellerId,
        productId: order.productId,
        orderId: order.id,
        strikeCount,
        reason: OVERSIZED_REASON,
        suspensionReason: suspension.reason,
        suspensionExpiry,
      },
    })
    if (strikeCount >= 2) {
      await tx.user.update({
        where: { id: order.sellerId },
        data: { isSuspended: true, suspendedUntil: suspension.days === null ? null : suspensionExpiry, suspensionReason: suspension.reason },
      })
    }
    await tx.product.update({ where: { id: order.productId }, data: { isActive: strikeCount === 1 ? false : undefined, moderationStatus: 'PENDING' } })
    await tx.oversizedDeclineLog.upsert({
      where: { orderId_riderId: { orderId: order.id, riderId: params.riderId } },
      update: { reason: OVERSIZED_REASON, proofImageUrl: params.proofImageUrl || null, refundIssued: true, refundAmount, deliveryFeeKept: Number(order.deliveryFee) },
      create: { orderId: order.id, productId: order.productId, sellerId: order.sellerId, riderId: params.riderId, buyerId: order.buyerId, reason: OVERSIZED_REASON, proofImageUrl: params.proofImageUrl || null, refundIssued: true, refundAmount, deliveryFeeKept: Number(order.deliveryFee) },
    })

    return { order, strikeCount, suspension, suspensionExpiry, refundAmount }
  })

  await Promise.allSettled([
    createNotification({ userId: result.order.buyerId, type: 'OVERSIZED_REFUND_ISSUED', title: 'Order Refunded to Wallet', message: `Order #${result.order.orderNumber} was cancelled as oversized. Product payment has been refunded to your wallet.`, orderId: result.order.id, productId: result.order.productId }),
    createNotification({ userId: result.order.sellerId, type: 'SELLER_STRIKE_ISSUED', title: 'Oversized Listing Reported', message: `Order #${result.order.orderNumber} was cancelled by rider as oversized. Listing moved under review.`, orderId: result.order.id, productId: result.order.productId, metadata: { strikeCount: result.strikeCount } }),
    createNotification({ userId: result.order.riderId!, type: 'OVERSIZED_DECLINED', title: 'Oversized Decline Recorded', message: `Order #${result.order.orderNumber} has been cancelled safely.`, orderId: result.order.id, productId: result.order.productId }),
  ])
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  await Promise.allSettled(
    admins.map((a) =>
      createNotification({
        userId: a.id,
        type: 'PRODUCT_UNDER_REVIEW',
        title: 'Oversized Product Under Review',
        message: `Order #${result.order.orderNumber} was declined as oversized. Product requires moderation.`,
        orderId: result.order.id,
        productId: result.order.productId,
      })
    )
  )

  if (result.strikeCount >= 2) {
    await notifyAccountSuspended(result.order.sellerId, result.suspension.days === null ? null : result.suspensionExpiry, result.suspension.reason)
  }

  return result
}
