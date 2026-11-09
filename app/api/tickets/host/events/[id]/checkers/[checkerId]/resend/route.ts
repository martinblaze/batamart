// app/api/tickets/host/events/[id]/checkers/[checkerId]/resend/route.ts
// Host: send a checker a fresh link. The old link and any signed-in session stop working.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateLinkToken, sha256Hex } from '@/lib/tickets/codes'
import { sendCheckerInvite } from '@/lib/tickets/host-mail'
import { hit } from '@/lib/tickets/buyer'
import { fail, requireHost, writeAudit } from '../../../../../_lib'

export async function POST(request: NextRequest, { params }: { params: { id: string; checkerId: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    if (!(await hit(`ticket-checker-mail:${host.userId}`, 30, 3_600_000))) {
      return fail('Too many invites. Try again in a while.', 429)
    }
    const event = await prisma.ticketEvent.findFirst({
      where: { id: params.id, hostId: host.userId },
      select: { id: true, name: true, venue: true, startsAt: true, status: true },
    })
    if (!event) return fail('Event not found', 404)
    if (event.status === 'CANCELLED') return fail('This event is cancelled.', 409)

    const token = generateLinkToken()
    const res = await prisma.$transaction(async tx => {
      const updated = await tx.eventChecker.updateMany({
        where: { id: params.checkerId, eventId: event.id },
        data: { tokenHash: sha256Hex(token), sessionVersion: { increment: 1 }, isActive: true },
      })
      if (updated.count !== 1) return null
      const c = await tx.eventChecker.findUnique({ where: { id: params.checkerId }, select: { id: true, email: true, name: true } })
      await writeAudit(tx, host.userId, 'TICKET_CHECKER_LINK_RESENT', event.id, undefined, { checkerId: params.checkerId })
      return c
    })
    if (!res) return fail('Checker not found', 404)

    const emailSent = await sendCheckerInvite({ to: res.email, name: res.name, token, event, hostName: host.name, resend: true })
    return NextResponse.json({ ok: true, emailSent })
  } catch (error) {
    console.error('host checker resend error:', error)
    return fail('Could not resend the link', 500)
  }
}
