export type CredoFeeConfig = {
  percent: number
  flat: number
  cap: number
  flatWaivedBelow: number
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getCredoFeeConfig(): CredoFeeConfig {
  return {
    percent: readNumberEnv('CREDO_FEE_PERCENT', 0.015),
    flat: readNumberEnv('CREDO_FEE_FLAT', 100),
    cap: readNumberEnv('CREDO_FEE_CAP', 2100),
    flatWaivedBelow: readNumberEnv('CREDO_FEE_FLAT_WAIVED_BELOW', 2000),
  }
}

export function credoFeePerOrder(orderAmount: number): number {
  if (!Number.isFinite(orderAmount) || orderAmount <= 0) return 0

  const config = getCredoFeeConfig()
  const percentageFee = Math.round(orderAmount * config.percent)
  const fee = orderAmount < config.flatWaivedBelow ? percentageFee : percentageFee + config.flat

  return Math.min(fee, config.cap)
}
