// lib/tickets/money.ts
// How one ticket price is split. All amounts are whole naira so there is never a
// rounding gap: fee + commission + host === unit price, always.

import { PLATFORM_FEE_PCT, MAX_COMMISSION_PCT } from '@/lib/tickets/config'

export interface TicketSplit {
  unitPrice: number
  quantity: number
  /** Per ticket. */
  unit: { fee: number; commission: number; host: number }
  subtotal: number
  platformFee: number
  commission: number
  hostAmount: number
}

export function clampCommissionPct(pct: unknown): number {
  const n = Math.floor(Number(pct))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(n, MAX_COMMISSION_PCT)
}

export function splitTicketMoney(unitPrice: number, quantity: number, commissionPct: number): TicketSplit {
  if (!Number.isInteger(unitPrice) || unitPrice < 1) throw new Error('Invalid ticket price')
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Invalid quantity')
  const fee = Math.round((unitPrice * PLATFORM_FEE_PCT) / 100)
  const commission = Math.floor((unitPrice * clampCommissionPct(commissionPct)) / 100)
  const host = unitPrice - fee - commission
  if (host < 0) throw new Error('Commission is too high for this price')
  return {
    unitPrice,
    quantity,
    unit: { fee, commission, host },
    subtotal: unitPrice * quantity,
    platformFee: fee * quantity,
    commission: commission * quantity,
    hostAmount: host * quantity,
  }
}

export const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
