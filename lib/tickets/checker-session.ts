// lib/tickets/checker-session.ts — server-only.
// Door checkers are not BataMart users. They get an emailed link
// (/checkin/<token>), confirm the invited email on that page, and receive a
// session limited to ONE event. Everything a checker can do is scoped by the
// eventId in this session, never by anything the client sends.

import { SignJWT, jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { CHECKER_SESSION_HOURS } from '@/lib/tickets/config'

const secretKey = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(s)
}

export async function issueCheckerSession(checker: { id: string; eventId: string; sessionVersion: number }): Promise<string> {
  return new SignJWT({ typ: 'checker', checkerId: checker.id, eventId: checker.eventId, v: checker.sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${CHECKER_SESSION_HOURS}h`)
    .sign(secretKey())
}

export interface CheckerContext {
  checker: { id: string; eventId: string; email: string; name: string | null }
  event: { id: string; name: string; venue: string; startsAt: Date; status: string }
}

/** Reads the checker token from `Authorization: Bearer` or the `checkerToken` cookie. */
export async function getCheckerFromRequest(request: Request): Promise<CheckerContext | null> {
  const auth = request.headers.get('authorization')
  let token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    const cookie = request.headers.get('cookie') ?? ''
    for (const part of cookie.split(';')) {
      const [k, ...v] = part.trim().split('=')
      if (k === 'checkerToken') { token = decodeURIComponent(v.join('=')); break }
    }
  }
  if (!token) return null

  let payload: any
  try {
    payload = (await jwtVerify(token, secretKey())).payload
  } catch {
    return null
  }
  if (payload?.typ !== 'checker' || typeof payload.checkerId !== 'string') return null

  const row = await prisma.eventChecker.findUnique({
    where: { id: payload.checkerId },
    select: {
      id: true, eventId: true, email: true, name: true, isActive: true, sessionVersion: true,
      event: { select: { id: true, name: true, venue: true, startsAt: true, status: true } },
    },
  })
  if (!row || !row.isActive || row.sessionVersion !== payload.v || row.eventId !== payload.eventId) return null
  return {
    checker: { id: row.id, eventId: row.eventId, email: row.email, name: row.name },
    event: row.event,
  }
}
