export function credoFeePerOrder(orderAmount: number): number {
  if (!Number.isFinite(orderAmount) || orderAmount <= 0) return 0

  const percentageFee = Math.round(orderAmount * 0.015)
  const fee = orderAmount < 2000 ? percentageFee : percentageFee + 100

  return Math.min(fee, 2100)
}