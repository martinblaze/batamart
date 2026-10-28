import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

export const DISPUTE_WINDOW_HOURS = 48
export const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_HOURS * 60 * 60 * 1000

type Db = Prisma.TransactionClient | typeof prisma

/**
 * What was really put into the seller's escrow for this order: the amount of
 * the SELLER-ESCROW ledger row written at checkout. Everything that settles an
 * order (payout, cancel, refund) must use this one figure. It used to be
 * recomputed from platformCommission, which also contains the platform's cut of
 * the delivery fee, so sellers were paid that much too little and the same
 * amount stayed locked in escrow forever.
 */
export async function getHeldSellerEscrow(
  db: Db,
  order: { orderNumber: string; productPrice: number },
): Promise<number> {
  const row = await db.transaction.findFirst({
    where: { type: 'ESCROW', reference: `${order.orderNumber}-SELLER-ESCROW` },
    select: { amount: true },
  })
  if (row) return Number(row.amount)
  // No ledger row (very old orders): product price less the 5% platform fee.
  return Math.round(order.productPrice * 0.95 * 100) / 100
}

/**
 * Takes an order's held money back out of the seller's escrow. Call this
 * wherever the buyer is refunded, so the seller's locked balance and the
 * buyer's refund always move together. Never takes the balance below zero.
 */
export async function reverseSellerEscrow(
  tx: Prisma.TransactionClient,
  order: { orderNumber: string; productPrice: number; sellerId: string },
): Promise<number> {
  const held = await getHeldSellerEscrow(tx, order)
  const seller = await tx.user.findUnique({ where: { id: order.sellerId }, select: { pendingBalance: true } })
  const amount = Math.min(held, Math.max(0, Number(seller?.pendingBalance ?? 0)))
  if (amount > 0) {
    await tx.user.update({ where: { id: order.sellerId }, data: { pendingBalance: { decrement: amount } } })
  }
  return amount
}

export function getDisputeDeadline(deliveredAt: Date) {
  return new Date(deliveredAt.getTime() + DISPUTE_WINDOW_MS)
}

export async function releaseMaturedSellerEscrowForUser(sellerId: string) {
  const maturedBefore = new Date(Date.now() - DISPUTE_WINDOW_MS)

  const releasableOrders = await prisma.order.findMany({
    where: {
      sellerId,
      isPaid: true,
      isDisputed: false,
      status: { in: ['DELIVERED', 'COMPLETED'] },
      deliveredAt: { not: null, lte: maturedBefore },
      dispute: null,
    },
    select: {
      id: true,
      orderNumber: true,
      productPrice: true,
      status: true,
    },
  })

  if (!releasableOrders.length) {
    return { releasedCount: 0, releasedAmount: 0 }
  }

  let releasedCount = 0
  let releasedAmount = 0

  for (const order of releasableOrders) {
    const sellerShare = await getHeldSellerEscrow(prisma, order)
    if (sellerShare <= 0) continue

    const releaseRef = `${order.orderNumber}-SELLER-RELEASE-${DISPUTE_WINDOW_HOURS}H`

    await prisma.$transaction(async (tx) => {
      const already = await tx.transaction.findFirst({
        where: { reference: releaseRef, userId: sellerId },
        select: { id: true },
      })
      if (already) return

      const seller = await tx.user.findUnique({
        where: { id: sellerId },
        select: { availableBalance: true },
      })
      if (!seller) return

      const before = Number(seller.availableBalance ?? 0)

      await tx.user.update({
        where: { id: sellerId },
        data: {
          pendingBalance: { decrement: sellerShare },
          availableBalance: { increment: sellerShare },
        },
      })

      await tx.transaction.create({
        data: {
          userId: sellerId,
          type: 'CREDIT',
          amount: sellerShare,
          description: `Escrow release after ${DISPUTE_WINDOW_HOURS}-hour dispute window (Order: ${order.orderNumber})`,
          reference: releaseRef,
          balanceBefore: before,
          balanceAfter: before + sellerShare,
        },
      })

      if (order.status !== 'COMPLETED') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
      }
    })

    releasedCount += 1
    releasedAmount += sellerShare
  }

  return { releasedCount, releasedAmount }
}

export async function releaseSellerEscrowForOrder(orderId: string, sellerId: string, note: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      productPrice: true,
      status: true,
    },
  })
  if (!order) return { released: false, amount: 0 }

  const amount = await getHeldSellerEscrow(prisma, order)
  if (amount <= 0) return { released: false, amount: 0 }

  const releaseRef = `${order.orderNumber}-SELLER-RELEASE-ADMIN`

  let released = false

  await prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: { reference: releaseRef, userId: sellerId },
      select: { id: true },
    })
    if (existing) return

    const seller = await tx.user.findUnique({
      where: { id: sellerId },
      select: { availableBalance: true },
    })
    if (!seller) return

    const before = Number(seller.availableBalance ?? 0)

    await tx.user.update({
      where: { id: sellerId },
      data: {
        pendingBalance: { decrement: amount },
        availableBalance: { increment: amount },
      },
    })

    await tx.transaction.create({
      data: {
        userId: sellerId,
        type: 'CREDIT',
        amount,
        description: note,
        reference: releaseRef,
        balanceBefore: before,
        balanceAfter: before + amount,
      },
    })

    if (order.status !== 'COMPLETED') {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    }

    released = true
  })

  return { released, amount }
}
