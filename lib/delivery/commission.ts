// lib/delivery/commission.ts
// Splits a (now zone-priced, variable) delivery fee between rider, referrer
// and platform.
//
// Rider:    70% of the delivery fee.
// Platform: 30% of the delivery fee, plus 5% of the product subtotal in
//            calculateFees. Referral credits are recorded separately by
//            lib/referral/processReferralReward.ts and subtracted from
//            platform earnings in the revenue report.

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
