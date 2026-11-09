// app/api/tickets/host/events/[id]/checkers/route.ts
// Host: add a door checker. Emails them a personal sign-in link; only its hash is stored.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkEmailAllowed } from '@/lib/tickets/email-guard'
import { generateLinkToken, sha256Hex } from '@/lib/tickets/codes'
import { sendCheckerInvite } from '@/lib/tickets/host-mail'
import { MAX_CHECKERS_PER_EVENT } from '@/lib/tickets/config'
import { hit } from '@/lib/tickets/buyer'
import { fail, requireHost, safeJson, writeAudit, zodMessage } from '../../../_lib'

const schema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  name: z.string().trim().max(60).optional().or(z.literal('').transform(() => undefined)),
}).strict()

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    if (!(await hit(`ticket-checker-mail:${host.userId}`, 30, 3_600_000))) {
      return fail('Too many invites. Try again in a while.', 429)
    }
    const parsed = schema.safeParse(await safeJson(request))
    if (!parsed.success) return fail(zodMessage(parsed.error))

    const event = await prisma.ticketEvent.findFirst({
      where: { id: params.id, hostId: host.userId },
      select: { id: true, name: true, venue: true, startsAt: true, status: true },
    })
    if (!event) return fail('Event not found', 404)
    if (event.status === 'CANCELLED') return fail('This event is cancelled.', 409)

    const check = await checkEmailAllowed(parsed.data.email)
    if (!check.ok) return fail((check as { reason: string }).reason)

    const count = await prisma.eventChecker.count({ where: { eventId: event.id } })
    if (count >= MAX_CHECKERS_PER_EVENT) return fail(`You can add up to ${MAX_CHECKERS_PER_EVENT} checkers.`)

    const existing = await prisma.eventChecker.findUnique({
      where: { eventId_email: { eventId: event.id, email: check.email } },
      select: { id: true },
    })
    if (existing) return fail('That email is already a checker for this event. Use "Resend link" instead.', 409)

    const token = generateLinkToken()
    const checker = await prisma.$transaction(async tx => {
      const c = await tx.eventChecker.create({
        data: { eventId: event.id, email: check.email, name: parsed.data.name ?? null, tokenHash: sha256Hex(token) },
        select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true },
      })
      await writeAudit(tx, host.userId, 'TICKET_CHECKER_ADDED', event.id, undefined, { checkerId: c.id, email: c.email })
      return c
    })

    const emailSent = await sendCheckerInvite({ to: checker.email, name: checker.name, token, event, hostName: host.name })
    return NextResponse.json({ checker: { ...checker, scanCount: 0, okCount: 0 }, emailSent })
  } catch (error: any) {
    if (error?.code === 'P2002') return fail('That email is already a checker for this event.', 409)
    console.error('host checker add error:', error)
    return fail('Could not add the checker', 500)
  }
}
