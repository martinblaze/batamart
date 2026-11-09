// app/api/tickets/host/events/route.ts
// Host: list my events, create a new one (always starts PENDING_REVIEW).
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { adminIds, notifyMany } from '@/lib/notify/dispatch'
import { normalizeUsername } from '@/lib/username'
import { checkEmailAllowed } from '@/lib/tickets/email-guard'
import { generateLinkToken, sha256Hex } from '@/lib/tickets/codes'
import { sendCheckerInvite } from '@/lib/tickets/host-mail'
import { MAX_CHECKERS_PER_EVENT, MAX_UNIQUE_SELLERS_PER_EVENT } from '@/lib/tickets/config'
import {
  fail, requireHost, safeJson, writeAudit, zodMessage, tierCreateSchema, tierProblem,
  duplicateTierName, MAX_TIERS, noControlChars,
} from '../_lib'
import { hit } from '@/lib/tickets/buyer'

export async function GET(request: NextRequest) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    const events = await prisma.ticketEvent.findMany({
      where: { hostId: host.userId },
      orderBy: { startsAt: 'desc' },
      take: 100,
      select: {
        id: true, name: true, venue: true, status: true, startsAt: true, flyerUrl: true, reviewNote: true,
        tiers: { select: { capacity: true, sold: true, isActive: true } },
      },
    })
    const money = events.length
      ? await prisma.ticketPurchase.groupBy({
          by: ['eventId'],
          where: { eventId: { in: events.map(e => e.id) }, status: 'PAID' },
          _sum: { subtotal: true, hostAmount: true },
        })
      : []
    const byEvent = new Map(money.map(m => [m.eventId, m._sum]))

    return NextResponse.json({
      events: events.map(e => ({
        id: e.id,
        name: e.name,
        venue: e.venue,
        status: e.status,
        startsAt: e.startsAt,
        flyerUrl: e.flyerUrl,
        reviewNote: e.status === 'REJECTED' ? e.reviewNote : null,
        ticketsSold: e.tiers.reduce((s, t) => s + t.sold, 0),
        capacity: e.tiers.filter(t => t.isActive).reduce((s, t) => s + t.capacity, 0),
        revenue: byEvent.get(e.id)?.subtotal ?? 0,
        earnings: byEvent.get(e.id)?.hostAmount ?? 0,
      })),
    })
  } catch (error) {
    console.error('host events list error:', error)
    return fail('Could not load your events', 500)
  }
}

const dateStr = z.string().refine(s => !Number.isNaN(Date.parse(s)), 'Invalid date')

const createSchema = z.object({
  name: z.string().trim().min(3).max(120).refine(noControlChars, 'Invalid characters'),
  description: z.string().trim().max(2000).optional().or(z.literal('').transform(() => undefined)),
  venue: z.string().trim().min(2).max(150).refine(noControlChars, 'Invalid characters'),
  address: z.string().trim().max(250).optional().or(z.literal('').transform(() => undefined)),
  startsAt: dateStr,
  endsAt: dateStr.optional().or(z.literal('').transform(() => undefined)),
  flyerUrl: z.string().url().max(500).refine(u => /^https:\/\/res\.cloudinary\.com\//.test(u), 'Upload the flyer through BataMart'),
  allowResale: z.boolean().default(true),
  tiers: z.array(tierCreateSchema).min(1, 'Add at least one ticket type').max(MAX_TIERS),
  checkerEmails: z.array(z.string()).max(MAX_CHECKERS_PER_EVENT).optional(),
  sellerUsernames: z.array(z.string()).max(MAX_UNIQUE_SELLERS_PER_EVENT).optional(),
}).strict()

export async function POST(request: NextRequest) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    // Creating events sends invite emails to arbitrary addresses: cap it per host.
    if (!(await hit(`ticket-event-create:${host.userId}`, 10, 24 * 3_600_000))) {
      return fail('You are creating events too quickly. Try again later.', 429)
    }

    const parsed = createSchema.safeParse(await safeJson(request))
    if (!parsed.success) return fail(zodMessage(parsed.error))
    const d = parsed.data

    const startsAt = new Date(d.startsAt)
    const endsAt = d.endsAt ? new Date(d.endsAt) : null
    if (startsAt.getTime() <= Date.now()) return fail('The event must start in the future.')
    if (endsAt && endsAt <= startsAt) return fail('The end time must be after the start time.')

    const dup = duplicateTierName(d.tiers.map(t => t.name))
    if (dup) return fail(`Two ticket types are named "${dup}". Give each a different name.`)
    for (const t of d.tiers) {
      const p = tierProblem(t)
      if (p) return fail(p)
    }

    // Unique sellers: every username must exist. No silent skips.
    const wantedNames = Array.from(new Set((d.sellerUsernames ?? []).map(u => normalizeUsername(u.replace(/^@/, ''))).filter(Boolean)))
    if (wantedNames.length > MAX_UNIQUE_SELLERS_PER_EVENT) return fail(`You can name up to ${MAX_UNIQUE_SELLERS_PER_EVENT} unique sellers.`)
    if (wantedNames.includes(host.username)) return fail('You cannot name yourself as a unique seller.')
    let sellerUsers: { id: string; username: string | null }[] = []
    if (wantedNames.length) {
      sellerUsers = await prisma.user.findMany({
        where: { username: { in: wantedNames }, isDeleted: false, isSuspended: false },
        select: { id: true, username: true },
      })
      const found = new Set(sellerUsers.map(u => u.username))
      const missing = wantedNames.filter(n => !found.has(n))
      if (missing.length) return fail(`No active user with the username: ${missing.map(m => '@' + m).join(', ')}`, 400, 'UNKNOWN_USERNAME')
    }

    // Checkers: real receiving emails only.
    const wantedEmails = Array.from(new Set((d.checkerEmails ?? []).map(e => e.trim().toLowerCase()).filter(Boolean)))
    if (wantedEmails.length > MAX_CHECKERS_PER_EVENT) return fail(`You can add up to ${MAX_CHECKERS_PER_EVENT} checkers.`)
    const checks = await Promise.all(wantedEmails.map(e => checkEmailAllowed(e)))
    for (let i = 0; i < checks.length; i++) {
      const c = checks[i]
      if (!c.ok) return fail(`${wantedEmails[i]}: ${(c as { reason: string }).reason}`)
    }
    const checkers = wantedEmails.map(email => {
      const token = generateLinkToken()
      return { email, token, tokenHash: sha256Hex(token) }
    })

    const event = await prisma.$transaction(async tx => {
      const created = await tx.ticketEvent.create({
        data: {
          hostId: host.userId,
          name: d.name,
          description: d.description ?? null,
          venue: d.venue,
          address: d.address ?? null,
          startsAt,
          endsAt,
          flyerUrl: d.flyerUrl,
          allowResale: d.allowResale,
          status: 'PENDING_REVIEW',
          tiers: {
            create: d.tiers.map((t, i) => ({
              name: t.name,
              description: t.description ?? null,
              imageUrl: t.imageUrl ?? null,
              price: t.price,
              capacity: t.capacity,
              randomCommissionPct: t.randomCommissionPct,
              uniqueCommissionPct: t.uniqueCommissionPct,
              saleStartsAt: t.saleStartsAt ? new Date(t.saleStartsAt) : null,
              saleEndsAt: t.saleEndsAt ? new Date(t.saleEndsAt) : null,
              sortOrder: i,
            })),
          },
          checkers: { create: checkers.map(c => ({ email: c.email, tokenHash: c.tokenHash })) },
          sellers: { create: sellerUsers.map(u => ({ userId: u.id })) },
        },
        select: { id: true, name: true, venue: true, startsAt: true },
      })
      await writeAudit(tx, host.userId, 'TICKET_EVENT_CREATED', created.id, undefined, {
        name: d.name, tiers: d.tiers.length, checkers: checkers.length, uniqueSellers: sellerUsers.length,
      })
      return created
    })

    // After commit: checker invites and the admin heads-up. Failures here never undo the event.
    const emailFailures: string[] = []
    await Promise.all(checkers.map(async c => {
      const ok = await sendCheckerInvite({ to: c.email, token: c.token, event, hostName: host.name })
      if (!ok) emailFailures.push(c.email)
    }))
    try {
      const admins = await adminIds()
      await notifyMany(admins, () => ({
        category: 'transactional',
        type: 'ORDER_UPDATE',
        title: 'Event waiting for review',
        message: `${host.name} submitted "${event.name}".`,
        url: '/admin/events',
        dedupeKey: `ticket-event-review:${event.id}`,
        bypassLimits: true,
      }))
    } catch {
      console.error('notify admins (new ticket event) failed')
    }

    return NextResponse.json({ id: event.id, status: 'PENDING_REVIEW', checkerEmailFailures: emailFailures })
  } catch (error: any) {
    if (error?.code === 'P2002') return fail('Two items clash (same ticket name or checker email).', 409)
    console.error('host event create error:', error)
    return fail('Could not create the event', 500)
  }
}
