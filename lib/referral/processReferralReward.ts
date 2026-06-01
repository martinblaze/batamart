// lib/referral/processReferralReward.ts
// Called inside the confirm-delivery transaction when an order completes.
// Returns silently on any error so it never blocks the main order flow.
//
// BATCH BEHAVIOUR:
//   When an order belongs to a DeliveryBatch, referral reward scales
//   with delivery units in that batch:
//     reward = N120 x number_of_orders_in_batch
//   Since each seller-order carries one N800 delivery fee, this means
//   "pay referrer from every N800 delivery unit", even in batch.
//   DeliveryBatch.referralPaid remains the atomic idempotency gate.

import { Prisma } from '@prisma/client'

// Referral reward = N120 per delivery unit.
// Only paid if the order had a rider (delivery orders only).
const REFERRAL_DELIVERY_REWARD = 120

// Max reward units per referrer in a rolling 24h window.
// 10 units = N1,200/day maximum.
const DAILY_REWARD_UNIT_CAP = 10
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Must be called inside an existing prisma.$transaction(tx => ...) block.
 */
export async function processReferralReward(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string
    orderNumber: string
    orderAmount: number
    buyerId: string
    hasRider: boolean
    batchId?: string
  }
) {
  const { orderId, orderNumber, buyerId, hasRider, batchId } = params

  if (!hasRider) return

  let rewardUnits = 1

  if (batchId) {
    const batch = await tx.deliveryBatch.findUnique({
      where: { id: batchId },
      select: {
        referralPaid: true,
        orders: { select: { id: true } },
      },
    })

    if (!batch || batch.referralPaid) return
    rewardUnits = Math.max(1, batch.orders.length)

    await tx.deliveryBatch.update({
      where: { id: batchId },
      data: { referralPaid: true },
    })
  } else {
    const existing = await tx.referralReward.findUnique({
      where: { orderId },
      select: { id: true },
    })
    if (existing) return
  }

  const buyer = await tx.user.findUnique({
    where: { id: buyerId },
    select: { referredById: true, email: true },
  })
  if (!buyer?.referredById) return

  // Safety check: buyer cannot be their own referrer
  if (buyer.referredById === buyerId) {
    console.warn(`[FRAUD] Buyer ${buyerId} (${buyer.email}) has referredById pointing to themselves!`)
    return
  }

  const referrer = await tx.user.findUnique({
    where: { id: buyer.referredById },
    select: { id: true, availableBalance: true, email: true },
  })
  if (!referrer) return

  // Log referral reward processing for audit trail
  console.log(`[REFERRAL] Processing reward: Buyer ${buyer.email} → Referrer ${referrer.email}`)

  const rewardsInWindow = await tx.referralReward.aggregate({
    where: {
      referrerId: referrer.id,
      createdAt: { gte: new Date(Date.now() - ROLLING_WINDOW_MS) },
    },
    _sum: { amount: true },
  })

  const amountInWindow = Number(rewardsInWindow._sum.amount ?? 0)
  const unitsUsedInWindow = Math.floor(amountInWindow / REFERRAL_DELIVERY_REWARD)
  const unitsRemaining = Math.max(0, DAILY_REWARD_UNIT_CAP - unitsUsedInWindow)
  if (unitsRemaining <= 0) {
    console.log(
      `[referral] cap hit for ${referrer.id}: ${unitsUsedInWindow}/${DAILY_REWARD_UNIT_CAP} units in 24h`
    )
    return
  }

  const unitsToPay = Math.min(rewardUnits, unitsRemaining)
  const referralRewardAmount = REFERRAL_DELIVERY_REWARD * unitsToPay

  const balanceBefore = Number(referrer.availableBalance)
  const balanceAfter = balanceBefore + referralRewardAmount

  await tx.referralReward.create({
    data: {
      referrerId: referrer.id,
      referredUserId: buyerId,
      orderId,
      amount: referralRewardAmount,
    },
  })

  await tx.user.update({
    where: { id: referrer.id },
    data: { availableBalance: { increment: referralRewardAmount } },
  })

  await tx.transaction.create({
    data: {
      userId: referrer.id,
      type: 'REFERRAL_REWARD',
      amount: referralRewardAmount,
      description: batchId
        ? `Referral reward - batch delivery x${unitsToPay} unit(s) (order #${orderNumber})`
        : `Referral reward - delivery cut from order #${orderNumber}`,
      reference: `${orderNumber}-REFERRAL`,
      balanceBefore,
      balanceAfter,
    },
  })

  await tx.notification.create({
    data: {
      userId: referrer.id,
      type: 'REFERRAL_REWARD',
      title: 'Referral Reward',
      message: batchId
        ? `You earned N${referralRewardAmount} referral reward from batch delivery (${unitsToPay} unit${unitsToPay > 1 ? 's' : ''}).`
        : `You earned N${referralRewardAmount} delivery reward from order #${orderNumber}.`,
      orderId,
      metadata: JSON.stringify({
        reward: referralRewardAmount,
        units: unitsToPay,
        orderNumber,
        batchId,
      }),
    },
  })
}
