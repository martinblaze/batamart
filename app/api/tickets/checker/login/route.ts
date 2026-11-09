// POST /api/tickets/checker/login  { token, email } -> { sessionToken, event }
// GET  /api/tickets/checker/login?token=  -> { event: { name, venue, startsAt } } (so the sign-in step can name the event)
// DELETE -> clears the cookie (sign out)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sha256Hex } from '@/lib/tickets/codes'
import { issueCheckerSession } from '@/lib/tickets/checker-session'
import { CHECKER_SESSION_HOURS } from '@/lib/tickets/config'
import { checkRateLimitDistributed, incrementRateLimit, getIpKey } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 15 * 60 * 1000
const IP_MAX = 30
const TOKEN_MAX = 12
const GENERIC = 'This link or email is not valid. Use the email address this link was sent to.'

function clientIp(request: NextRequest) {
  return getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
}

async function limited(keys: Array<[string, number]>) {
  for (const [key, max] of keys) {
    const r = await checkRateLimitDistributed(key, max, WINDOW_MS, { requireDistributedInProduction: true })
    if (!r.allowed) return r
  }
  for (const [key] of keys) await incrementRateLimit(key, WINDOW_MS)
  return null
}

function tooMany(retryAfterSecs: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Please wait a few minutes and try again.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfterSecs)) } },
  )
}

const eventSelect = { id: true, name: true, venue: true, startsAt: true, status: true } as const

function statusProblem(status: string): string | null {
  if (status === 'ACTIVE') return null
  if (status === 'PAUSED') return 'This event is paused right now. Check-in will open again when the host or BataMart resumes it.'
  return 'Check-in is not available for this event.'
}

export async function GET(request: NextRequest) {
  try {
    const token = (request.nextUrl.searchParams.get('token') ?? '').trim()
    const hash = sha256Hex(token || 'none')
    const rl = await limited([[`checker-info:ip:${clientIp(request)}`, IP_MAX * 2], [`checker-info:tok:${hash}`, TOKEN_MAX * 2]])
    if (rl) return tooMany(rl.retryAfterSecs)

    const row = token.length >= 16 && token.length <= 200
      ? await prisma.eventChecker.findUnique({ where: { tokenHash: hash }, select: { isActive: true, event: { select: eventSelect } } })
      : null
    if (!row || !row.isActive) return NextResponse.json({ error: 'This check-in link is not valid.' }, { status: 404 })
    return NextResponse.json({
      event: { name: row.event.name, venue: row.event.venue, startsAt: row.event.startsAt },
      notice: statusProblem(row.event.status),
    })
  } catch (e) {
    console.error('[checker/login GET]', e instanceof Error ? e.message : 'error')
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any = null
    try { body = await request.json() } catch { /* handled below */ }
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!token || !email || token.length > 200 || email.length > 254) {
      return NextResponse.json({ error: GENERIC }, { status: 400 })
    }
    const hash = sha256Hex(token)

    const rl = await limited([[`checker-login:ip:${clientIp(request)}`, IP_MAX], [`checker-login:tok:${hash}`, TOKEN_MAX]])
    if (rl) return tooMany(rl.retryAfterSecs)

    const row = await prisma.eventChecker.findUnique({
      where: { tokenHash: hash },
      select: { id: true, eventId: true, email: true, isActive: true, sessionVersion: true, event: { select: eventSelect } },
    })
    // Same answer for unknown token, deactivated checker and wrong email.
    if (!row || !row.isActive || row.email.trim().toLowerCase() !== email) {
      return NextResponse.json({ error: GENERIC }, { status: 401 })
    }
    const problem = statusProblem(row.event.status)
    if (problem) return NextResponse.json({ error: problem, code: 'EVENT_NOT_ACTIVE' }, { status: 403 })

    const sessionToken = await issueCheckerSession({ id: row.id, eventId: row.eventId, sessionVersion: row.sessionVersion })
    await prisma.eventChecker.update({ where: { id: row.id }, data: { lastLoginAt: new Date() } })

    const res = NextResponse.json({
      sessionToken,
      event: { id: row.event.id, name: row.event.name, venue: row.event.venue, startsAt: row.event.startsAt },
    })
    res.cookies.set('checkerToken', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: CHECKER_SESSION_HOURS * 3600,
    })
    return res
  } catch (e) {
    console.error('[checker/login POST]', e instanceof Error ? e.message : 'error')
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('checkerToken', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}
