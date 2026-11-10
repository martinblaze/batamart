// lib/notify/unsubscribe.ts
// Signed one-click unsubscribe links for marketing email. The token is an HMAC
// of the user id with JWT_SECRET, so it needs no storage and cannot be forged.

import { createHmac, timingSafeEqual } from 'crypto'

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://batamart.com').replace(/\/$/, '')

function sign(userId: string): string | null {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  return createHmac('sha256', secret).update(`unsub:${userId}`).digest('base64url')
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = sign(userId)
  if (!expected || !token) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** null when JWT_SECRET is missing (the email then goes without the link). */
export function buildUnsubscribeUrl(userId: string): string | null {
  const t = sign(userId)
  if (!t) return null
  return `${APP_URL}/api/notifications/unsubscribe?u=${encodeURIComponent(userId)}&t=${t}`
}

/** Headers that make Gmail/Yahoo show a native Unsubscribe button. */
export function unsubscribeHeaders(userId: string): Record<string, string> | undefined {
  const url = buildUnsubscribeUrl(userId)
  if (!url) return undefined
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
