// app/api/tickets/host/events/[id]/checkers/[checkerId]/route.ts
// Host: deactivate a checker. Bumping sessionVersion signs out any open door session.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fail, requireHost, writeAudit } from '../../../../_lib'

export async function DELETE(request: NextRequest, { params }: { params: { id: string; checkerId: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    const event = await prisma.ticketEvent.findFirst({ where: { id: params.id, hostId: host.userId }, select: { id: true } })
    if (!event) return fail('Event not found', 404)

    const ok = await prisma.$transaction(async tx => {
      const res = await tx.eventChecker.updateMany({
        where: { id: params.checkerId, eventId: event.id },
        data: { isActive: false, sessionVersion: { increment: 1 } },
      })
      if (res.count !== 1) return false
      await writeAudit(tx, host.userId, 'TICKET_CHECKER_DEACTIVATED', event.id, undefined, { checkerId: params.checkerId })
      return true
    })
    if (!ok) return fail('Checker not found', 404)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('host checker deactivate error:', error)
    return fail('Could not deactivate the checker', 500)
  }
}
