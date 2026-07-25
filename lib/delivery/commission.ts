// lib/delivery/commission.ts
// Splits a (now zone-priced, variable) delivery fee between rider, referrer
// and platform.
//
// Rider:     70% of the delivery fee.
// Referrer:  ₦120 flat, only if the buyer was referred — paid separately by
//            lib/referral/processReferralReward.ts, which already tracks the
//            per-referrer daily cap and batch idempotency.
// Platform:  30% of the delivery fee (gross). The referrer's ₦120 is netted
//            out of the platform's take at the revenue-reporting layer
//            (see app/api/admin/revenue/route.ts: netAllTime subtracts
//            referralPaidOut), not by shrinking Order.platformCommission —
//            that field stays a straightforward gross figure per order.

export const RIDER_SHARE_PERCENT = 0.7
export const PLATFORM_SHARE_PERCENT = 0.3
export const REFERRAL_FLAT_BONUS = 120

export function calculateDeliveryCommission(deliveryFee: number) {
  const riderShare = Math.round(deliveryFee * RIDER_SHARE_PERCENT * 100) / 100
  const platformShare = Math.round(deliveryFee * PLATFORM_SHARE_PERCENT * 100) / 100

  return {
    deliveryFee,
    riderShare,
    platformShare,
    referralBonus: REFERRAL_FLAT_BONUS,
  }
}
