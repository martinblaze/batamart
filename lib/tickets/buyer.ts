// lib/tickets/buyer.ts — server-only helpers shared by the buyer-side ticket routes.

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimitDistributed, incrementRateLimit, getIpKey } from '@/lib/security/rate-limit'
import { TicketError } from '@/lib/tickets/purchase'

/** An event with no end time is treated as over this long after it starts. */
export const DEFAULT_EVENT_LENGTH_HOURS = 12

export function eventEndMs(e: { startsAt: Date; endsAt: Date | null }): number {
  return e.endsAt ? e.endsAt.getTime() : e.startsAt.getTime() + DEFAULT_EVENT_LENGTH_HOURS * 3_600_000
}

export const isEventOver = (e: { startsAt: Date; endsAt: Date | null }) => Date.now() > eventEndMs(e)

export const clientIp = (req: NextRequest) =>
  getIpKey(req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'))

/** Check and count one hit. Returns true if the caller may proceed. */
export async function hit(key: string, max: number, windowMs: number): Promise<boolean> {
  const r = await checkRateLimitDistributed(key, max, windowMs, { requireDistributedInProduction: true })
  if (!r.allowed) return false
  await incrementRateLimit(key, windowMs)
  return true
}

export const noStore = { 'Cache-Control': 'private, no-store, max-age=0' }

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore })
}

export function fail(err: unknown, fallback = 'Something went wrong') {
  if (err instanceof TicketError) return json({ error: err.message, code: err.code }, err.status)
  console.error('tickets route error:', err)
  return json({ error: fallback }, 500)
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`
}

/** "Chidi O." — first name and last initial only. */
export function shortName(full: string | null | undefined): string {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Someone'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}
