import prisma from '@/lib/prisma'

export const DISPUTE_WINDOW_HOURS = 48
export const DISPUTE_WINDOW_MS = DISPUTE_WINDOW_HOURS * 60 * 60 * 1000

function getSellerShareFromOrder(order: {
  totalAmount: number
  platformCommission: number
  riderId: string | null
}) {
  const subtotal = order.totalAmount - (order.riderId ? 800 : 0)
  return Math.max(0, subtotal - order.platformCommission)
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
      totalAmount: true,
      platformCommission: true,
      riderId: true,
      status: true,
    },
  })

  if (!releasableOrders.length) {
    return { releasedCount: 0, releasedAmount: 0 }
  }

  let releasedCount = 0
  let releasedAmount = 0

  for (const order of releasableOrders) {
    const sellerShare = getSellerShareFromOrder(order)
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
      totalAmount: true,
      platformCommission: true,
      riderId: true,
      status: true,
    },
  })
  if (!order) return { released: false, amount: 0 }

  const amount = getSellerShareFromOrder(order)
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
