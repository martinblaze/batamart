// POST /api/tickets/checker/scan { qr } -> { result, message, ticket? }
// Scope (eventId) comes ONLY from the checker session. Every attempt is logged.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCheckerFromRequest } from '@/lib/tickets/checker-session'
import { parseQrText, verifyQr } from '@/lib/tickets/qr'
import { eventEndMs } from '@/lib/tickets/buyer'
import { TICKET_PURGE_AFTER_HOURS } from '@/lib/tickets/config'
import { checkRateLimitDistributed, incrementRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

type ScanResult = 'OK' | 'ALREADY_USED' | 'INVALID' | 'WRONG_EVENT' | 'STALE' | 'VOID'

const MESSAGES: Record<ScanResult, string> = {
  OK: 'Checked in',
  ALREADY_USED: 'This ticket has already been used',
  INVALID: 'Not a valid BataMart ticket code',
  WRONG_EVENT: 'This ticket is not for this event',
  STALE: 'This code has expired. Ask them to refresh the ticket page and show it again',
  VOID: 'This ticket has been cancelled',
}

function maskEmailLocal(email: string) {
  const local = (email.split('@')[0] || '').trim()
  if (!local) return 'Guest'
  return local.slice(0, Math.min(2, local.length)) + '***'
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getCheckerFromRequest(request)
    if (!ctx) return NextResponse.json({ error: 'Please sign in again.', code: 'UNAUTHENTICATED' }, { status: 401 })
    const eventId = ctx.checker.eventId
    const checkerId = ctx.checker.id

    const rlKey = `ticket-scan:${checkerId}`
    const rl = await checkRateLimitDistributed(rlKey, 120, 60_000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Scanning too fast. Wait a moment.' }, { status: 429, headers: { 'Retry-After': String(Math.max(1, rl.retryAfterSecs)) } })
    }
    await incrementRateLimit(rlKey, 60_000)

    if (ctx.event.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: ctx.event.status === 'PAUSED' ? 'This event is paused. Check-in is closed for now.' : 'Check-in is not available for this event.', code: 'EVENT_NOT_ACTIVE' },
        { status: 403 },
      )
    }

    // Past the purge point the tickets are being deleted; do not race the purge.
    if (Date.now() > eventEndMs(ctx.event) + TICKET_PURGE_AFTER_HOURS * 3_600_000) {
      return NextResponse.json({ error: 'This event has ended.', code: 'EVENT_ENDED' }, { status: 403 })
    }

    let body: any = null
    try { body = await request.json() } catch { /* treated as garbage below */ }
    const qr = typeof body?.qr === 'string' ? body.qr.slice(0, 200) : ''

    const log = (result: ScanResult, extra: { ticketId?: string | null; ticketCode?: string | null; holderName?: string | null; tierName?: string | null } = {}) =>
      prisma.ticketScan.create({
        data: {
          eventId, checkerId, result,
          ticketId: extra.ticketId ?? null,
          ticketCode: extra.ticketCode ?? null,
          holderName: extra.holderName ?? null,
          tierName: extra.tierName ?? null,
        },
        select: { id: true },
      })
    const reply = (result: ScanResult, ticket?: { code: string; tierName: string; holder: string; checkedInAt: Date | null }) =>
      NextResponse.json({ result, message: MESSAGES[result], ...(ticket ? { ticket } : {}) })

    const parsed = parseQrText(qr)
    if (!parsed) {
      await log('INVALID')
      return reply('INVALID')
    }

    const ticket = await prisma.ticket.findUnique({
      where: { code: parsed.code },
      select: {
        id: true, code: true, eventId: true, secret: true, status: true, checkedInAt: true, ownerEmail: true,
        owner: { select: { username: true } },
        tier: { select: { name: true } },
      },
    })
    if (!ticket) {
      await log('INVALID')
      return reply('INVALID')
    }
    if (ticket.eventId !== eventId) {
      // Nothing about the other event is logged or returned.
      await log('WRONG_EVENT')
      return reply('WRONG_EVENT')
    }

    const holder = ticket.owner?.username?.trim() || maskEmailLocal(ticket.ownerEmail)
    const tierName = ticket.tier.name
    const base = { ticketId: ticket.id, ticketCode: ticket.code, holderName: holder, tierName }

    const check = await verifyQr(ticket.secret, parsed, Date.now())
    if (check !== 'OK') {
      await log(check, base)
      return reply(check) // no ticket details for a code that did not verify
    }

    if (ticket.status === 'VOID') {
      await log('VOID', base)
      return reply('VOID')
    }
    if (ticket.status === 'CHECKED_IN') {
      await log('ALREADY_USED', base)
      return reply('ALREADY_USED', { code: ticket.code, tierName, holder, checkedInAt: ticket.checkedInAt })
    }

    const now = new Date()
    const { count } = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: 'VALID', eventId },
      data: { status: 'CHECKED_IN', checkedInAt: now, checkedInById: checkerId },
    })
    if (count === 1) {
      await log('OK', base)
      return reply('OK', { code: ticket.code, tierName, holder, checkedInAt: now })
    }

    // Lost a race (or it was voided/transferred in between): re-read and answer truthfully.
    const fresh = await prisma.ticket.findFirst({ where: { id: ticket.id, eventId }, select: { status: true, checkedInAt: true } })
    if (fresh?.status === 'VOID') {
      await log('VOID', base)
      return reply('VOID')
    }
    await log('ALREADY_USED', base)
    return reply('ALREADY_USED', { code: ticket.code, tierName, holder, checkedInAt: fresh?.checkedInAt ?? null })
  } catch (e) {
    console.error('[checker/scan]', e instanceof Error ? e.message : 'error')
    return NextResponse.json({ error: 'Something went wrong. Scan again.' }, { status: 500 })
  }
}
