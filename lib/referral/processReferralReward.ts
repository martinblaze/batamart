// lib/referral/processReferralReward.ts
// Called inside the confirm-delivery transaction when an order completes.
//
// RULES:
//   - One order = one vendor = one delivery fee (checkout groups a cart by
//     seller), so the referrer earns REFERRAL_DELIVERY_REWARD per completed
//     order, not per product. Two items from the same vendor are one order and
//     pay once; items from different vendors are separate orders and pay each.
//   - Paid at the moment that order's rider share is released (this runs right
//     after it in confirm-delivery), and only if the order had a rider.
//   - No cap on how much a referrer can earn.
//   - ReferralReward.orderId is unique, so each order can only ever pay once.

import { Prisma } from '@prisma/client'

const REFERRAL_DELIVERY_REWARD = 120

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

  // Legacy: batches completed before per-order payout were paid up front for
  // every order in the batch (flagged referralPaid). Don't pay those twice.
  if (batchId) {
    const batch = await tx.deliveryBatch.findUnique({
      where: { id: batchId },
      select: { referralPaid: true },
    })
    if (batch?.referralPaid) return
  }

  const existing = await tx.referralReward.findUnique({
    where: { orderId },
    select: { id: true },
  })
  if (existing) return

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

  const referralRewardAmount = REFERRAL_DELIVERY_REWARD

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
      description: `Referral reward - delivery cut from order #${orderNumber}`,
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
      message: `You earned N${referralRewardAmount} delivery reward from order #${orderNumber}.`,
      orderId,
      metadata: JSON.stringify({
        reward: referralRewardAmount,
        orderNumber,
        batchId,
      }),
    },
  })
}
