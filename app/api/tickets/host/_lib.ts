// app/api/tickets/host/_lib.ts — shared by the host routes only (not a route itself).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import {
  MAX_COMMISSION_PCT, MAX_TICKET_PRICE, MIN_TICKET_PRICE, MAX_TIERS_PER_EVENT,
} from '@/lib/tickets/config'

export const fail = (error: string, status = 400, code?: string) =>
  NextResponse.json(code ? { error, code } : { error }, { status })

export interface HostCtx {
  userId: string
  name: string
  username: string
}

/**
 * Gate for every host route: signed in, a seller, with a username.
 * State-changing requests must be JSON and same-origin (bearer clients exempt).
 */
export async function requireHost(request: NextRequest): Promise<HostCtx | NextResponse> {
  if (request.method !== 'GET') {
    const jsonErr = request.method === 'DELETE' ? null : enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr
  }
  const user = await getUserFromRequest(request)
  if (!user) return fail('Unauthorized', 401)
  if (user.isSuspended) return fail('Your account is suspended.', 403)
  if (user.role !== 'SELLER') return fail('Only sellers can host events. Become a seller first.', 403, 'NOT_SELLER')
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } })
  if (!row?.username) return fail('Set a username in your profile before hosting an event.', 400, 'USERNAME_REQUIRED')
  return { userId: user.id, name: user.name, username: row.username }
}

/** Loads the event only if this user hosts it. Everything else is a 404 so ids cannot be probed. */
export async function ownedEvent(eventId: string, hostId: string) {
  return prisma.ticketEvent.findFirst({
    where: { id: eventId, hostId },
    select: { id: true, name: true, venue: true, startsAt: true, status: true },
  })
}

export async function safeJson(request: NextRequest): Promise<unknown> {
  try { return await request.json() } catch { return null }
}

export async function writeAudit(
  db: { auditLog: { create: (args: any) => Promise<unknown> } },
  userId: string,
  action: string,
  eventId: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  await db.auditLog.create({
    data: {
      userId,
      action,
      entityType: 'TicketEvent',
      entityId: eventId,
      oldValue: oldValue === undefined ? undefined : (oldValue as any),
      newValue: newValue === undefined ? undefined : (newValue as any),
    },
  })
}

// ── Input schemas ─────────────────────────────────────────────────────────────
const cloudinaryUrl = z.string().url().max(500).refine(u => /^https:\/\/res\.cloudinary\.com\//.test(u), 'Upload the image through BataMart')
const dateStr = z.string().refine(s => !Number.isNaN(Date.parse(s)), 'Invalid date')
const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v)

const pct = z.number().int().min(0).max(MAX_COMMISSION_PCT)

/** No control characters (CR/LF would reach email subjects). */
export const noControlChars = (s: string) => !/[\u0000-\u001f\u007f]/.test(s)

export const tierFields = {
  name: z.string().trim().min(1).max(40).refine(noControlChars, 'Invalid characters'),
  description: z.preprocess(emptyToUndef, z.string().trim().max(200).optional()),
  imageUrl: z.preprocess(emptyToUndef, cloudinaryUrl.optional()),
  price: z.number().int().min(MIN_TICKET_PRICE).max(MAX_TICKET_PRICE),
  capacity: z.number().int().min(1).max(100_000),
  randomCommissionPct: pct,
  uniqueCommissionPct: pct,
  saleStartsAt: z.preprocess(emptyToUndef, dateStr.optional()),
  saleEndsAt: z.preprocess(emptyToUndef, dateStr.optional()),
}

export const tierCreateSchema = z.object(tierFields).strict()

export const emailList = z.array(z.string().trim().toLowerCase().email().max(254)).max(30)

/** Cross-field checks shared by create and edit. Returns an error message or null. */
export function tierProblem(t: { name?: string; saleStartsAt?: string; saleEndsAt?: string }, eventStart?: Date | null): string | null {
  const s = t.saleStartsAt ? new Date(t.saleStartsAt) : null
  const e = t.saleEndsAt ? new Date(t.saleEndsAt) : null
  if (s && e && e <= s) return `${t.name}: sales must close after they open.`
  return null
}

export function duplicateTierName(names: string[]): string | null {
  const seen = new Set<string>()
  for (const n of names) {
    const k = n.trim().toLowerCase()
    if (seen.has(k)) return n
    seen.add(k)
  }
  return null
}

export const MAX_TIERS = MAX_TIERS_PER_EVENT

export function zodMessage(err: z.ZodError): string {
  const issue = err.issues[0]
  const path = issue.path.length ? issue.path.join(' > ') + ': ' : ''
  return `${path}${issue.message}`
}
