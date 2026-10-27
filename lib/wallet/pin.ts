// lib/wallet/pin.ts
// Wallet PIN check for spending (the same PIN that guards withdrawals).
// A user who never set a PIN can still spend their balance on orders; once a
// PIN exists it is required, with the same lockout rules as withdrawals.

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const MAX_PIN_ATTEMPTS = 5
const PIN_LOCK_DURATION = 15 * 60 * 1000

export type PinCheck = { ok: boolean; status?: number; error?: string; code?: string }

export async function verifySpendPin(userId: string, pin: string | undefined): Promise<PinCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { withdrawalPin: true, withdrawalPinAttempts: true, withdrawalPinLockedUntil: true },
  })
  if (!user) return { ok: false, status: 404, error: 'User not found' }
  if (!user.withdrawalPin) return { ok: true }

  if (!pin || !/^\d{6}$/.test(pin)) {
    return { ok: false, status: 403, error: 'Enter your 6-digit wallet PIN', code: 'PIN_REQUIRED' }
  }
  if (user.withdrawalPinLockedUntil && user.withdrawalPinLockedUntil > new Date()) {
    const minutes = Math.ceil((user.withdrawalPinLockedUntil.getTime() - Date.now()) / 60000)
    return { ok: false, status: 429, error: `Too many failed attempts. PIN locked for ${minutes} more minute${minutes !== 1 ? 's' : ''}.` }
  }

  if (!(await bcrypt.compare(pin, user.withdrawalPin))) {
    const attempts = (user.withdrawalPinAttempts ?? 0) + 1
    const lock = attempts >= MAX_PIN_ATTEMPTS
    await prisma.user.update({
      where: { id: userId },
      data: {
        withdrawalPinAttempts: attempts,
        withdrawalPinLockedUntil: lock ? new Date(Date.now() + PIN_LOCK_DURATION) : null,
      },
    })
    const left = Math.max(0, MAX_PIN_ATTEMPTS - attempts)
    return {
      ok: false,
      status: 401,
      error: lock ? 'Too many failed attempts. PIN locked for 15 minutes.' : `Incorrect PIN. ${left} attempt${left !== 1 ? 's' : ''} remaining.`,
      code: 'PIN_INVALID',
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { withdrawalPinAttempts: 0, withdrawalPinLockedUntil: null } })
  return { ok: true }
}
