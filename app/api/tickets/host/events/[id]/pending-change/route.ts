// app/api/tickets/host/events/[id]/pending-change/route.ts
// Host: withdraw a flyer/description change that is still waiting for admin approval.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fail, requireHost, writeAudit } from '../../../_lib'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    const event = await prisma.ticketEvent.findFirst({
      where: { id: params.id, hostId: host.userId },
      select: { id: true, pendingFlyerUrl: true, pendingDescription: true, pendingChangeAt: true },
    })
    if (!event) return fail('Event not found', 404)
    if (!event.pendingChangeAt) return NextResponse.json({ ok: true, changed: false })

    const res = await prisma.ticketEvent.updateMany({
      where: { id: event.id, hostId: host.userId, pendingChangeAt: { not: null } },
      data: { pendingFlyerUrl: null, pendingDescription: null, pendingChangeAt: null },
    })
    if (res.count === 1) {
      await writeAudit(prisma, host.userId, 'TICKET_EVENT_CHANGE_CANCELLED', event.id,
        { flyerUrl: event.pendingFlyerUrl, description: event.pendingDescription }, undefined)
    }
    return NextResponse.json({ ok: true, changed: res.count === 1 })
  } catch (error) {
    console.error('host cancel pending change error:', error)
    return fail('Could not cancel the change', 500)
  }
}
