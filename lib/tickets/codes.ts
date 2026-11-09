// lib/tickets/codes.ts — server-only ids and tokens.
import { randomBytes, createHash } from 'crypto'

// No 0/O/1/I so a code read out loud at the door is not misheard.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateTicketCode(): string {
  const bytes = randomBytes(8)
  let out = 'BT-'
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % 32]
  return out
}

/** 256-bit key the QR is signed with. */
export const generateTicketSecret = () => randomBytes(32).toString('hex')

/** Unguessable token for emailed links (guest ticket access, checker sign-in). */
export const generateLinkToken = () => randomBytes(24).toString('base64url')

export const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex')

export const generatePurchaseReference = () => `TKT-${Date.now()}-${randomBytes(4).toString('hex')}`
