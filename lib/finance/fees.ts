// Flutterwave Nigeria pricing (https://flutterwave.com/ng/pricing, confirmed via
// https://flutterwave.com/ng/support/pricing/pricing-for-receiving-payment and the
// April 2025 fee-increase notice):
//   Collections (cards, bank transfer, USSD, etc.): 2% per transaction
//     (1.4% transaction fee + 0.6% platform fee), capped at ₦2,000 per transaction.
//   Payouts / transfers (withdrawals) to Nigerian banks: flat fee by tier —
//     ≤ ₦5,000 → ₦10, ₦5,001–₦50,000 → ₦25, > ₦50,000 → ₦50.
//   Flutterwave also applies 7.5% VAT on top of transaction fees per Nigerian
//   regulation — not baked into the numbers below since Flutterwave's own
//   dashboard reporting already nets this out; revisit if your settlement
//   reports don't match.
export type FlutterwaveFeeConfig = {
  percent: number
  cap: number
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getFlutterwaveFeeConfig(): FlutterwaveFeeConfig {
  return {
    percent: readNumberEnv('FLUTTERWAVE_FEE_PERCENT', 0.02),
    cap: readNumberEnv('FLUTTERWAVE_FEE_CAP', 2000),
  }
}

export function flutterwaveFeePerOrder(orderAmount: number): number {
  if (!Number.isFinite(orderAmount) || orderAmount <= 0) return 0

  const config = getFlutterwaveFeeConfig()
  const fee = orderAmount * config.percent

  return Math.min(fee, config.cap)
}

// Flutterwave transfer (payout) fee tiers — flat fee per transfer, not a percentage.
export function getFlutterwaveTransferFeeTiers(): { max: number; fee: number }[] {
  return [
    { max: readNumberEnv('FLUTTERWAVE_TRANSFER_TIER1_MAX', 5_000), fee: readNumberEnv('FLUTTERWAVE_TRANSFER_TIER1_FEE', 10) },
    { max: readNumberEnv('FLUTTERWAVE_TRANSFER_TIER2_MAX', 50_000), fee: readNumberEnv('FLUTTERWAVE_TRANSFER_TIER2_FEE', 25) },
    { max: Infinity, fee: readNumberEnv('FLUTTERWAVE_TRANSFER_TIER3_FEE', 50) },
  ]
}

export function flutterwaveTransferFee(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const tiers = getFlutterwaveTransferFeeTiers()
  const tier = tiers.find((t) => amount <= t.max)
  return tier ? tier.fee : tiers[tiers.length - 1].fee
}
