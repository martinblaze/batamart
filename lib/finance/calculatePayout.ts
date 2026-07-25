// lib/finance/calculatePayout.ts
import { RIDER_SHARE_PERCENT, PLATFORM_SHARE_PERCENT, REFERRAL_FLAT_BONUS } from '@/lib/delivery/commission'

export function calculatePayout(subtotal: number, deliveryFee: number) {
  const PLATFORM_RATE = 0.05

  const platformFeeFromProducts = subtotal * PLATFORM_RATE
  const sellerShare             = subtotal - platformFeeFromProducts
  const riderShare              = Math.round(deliveryFee * RIDER_SHARE_PERCENT * 100) / 100
  const referralDeliveryCut     = REFERRAL_FLAT_BONUS   // goes to referrer if applicable
  const platformDeliveryCut     = Math.round(deliveryFee * PLATFORM_SHARE_PERCENT * 100) / 100
  const platformTotal           = platformFeeFromProducts + platformDeliveryCut
  const totalAmount             = subtotal + deliveryFee

  return {
    subtotal,
    deliveryFee,
    totalAmount,
    sellerShare,
    riderShare,
    referralDeliveryCut,
    platformTotal,
    // legacy field names kept for compatibility
    platformFee: platformFeeFromProducts,
  }
}