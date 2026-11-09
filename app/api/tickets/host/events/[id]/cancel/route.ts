// app/api/tickets/host/events/[id]/cancel/route.ts
// Host: cancel an event. No refunds. Needs an explicit { confirm: true }.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { notifyTicketHolders } from '@/lib/tickets/host-mail'
import { fail, requireHost, safeJson, writeAudit, zodMessage } from '../../../_lib'

const schema = z.object({ confirm: z.literal(true) }).strict()

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    const parsed = schema.safeParse(await safeJson(request))
    if (!parsed.success) return fail(parsed.error.issues[0]?.path.length ? zodMessage(parsed.error) : 'Confirmation is required to cancel an event.', 400, 'CONFIRM_REQUIRED')

    const event = await prisma.ticketEvent.findFirst({ where: { id: params.id, hostId: host.userId }, select: { id: true, name: true, status: true } })
    if (!event) return fail('Event not found', 404)
    if (event.status === 'CANCELLED') return fail('This event is already cancelled.', 409)

    const done = await prisma.$transaction(async tx => {
      const res = await tx.ticketEvent.updateMany({
        where: { id: event.id, hostId: host.userId, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' },
      })
      if (res.count !== 1) return false
      await writeAudit(tx, host.userId, 'TICKET_EVENT_CANCELLED', event.id, { status: event.status }, { status: 'CANCELLED', refunds: false })
      return true
    })
    if (!done) return fail('This event is already cancelled.', 409)

    await notifyTicketHolders(event.id, {
      title: `Cancelled: ${event.name}`,
      heading: 'This event was cancelled',
      message: `The host cancelled "${event.name}". Tickets can no longer be used. BataMart does not issue refunds for cancelled events, so please contact the host about your ticket.`,
      dedupeKey: `ticket-event-cancelled:${event.id}`,
    })
    return NextResponse.json({ ok: true, status: 'CANCELLED' })
  } catch (error) {
    console.error('host event cancel error:', error)
    return fail('Could not cancel the event', 500)
  }
}
