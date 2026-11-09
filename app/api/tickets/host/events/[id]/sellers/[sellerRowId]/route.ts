// app/api/tickets/host/events/[id]/sellers/[sellerRowId]/route.ts
// Host: stop treating a user as a unique seller. Past sales keep their recorded kind.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fail, requireHost, writeAudit } from '../../../../_lib'

export async function DELETE(request: NextRequest, { params }: { params: { id: string; sellerRowId: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    const event = await prisma.ticketEvent.findFirst({ where: { id: params.id, hostId: host.userId }, select: { id: true } })
    if (!event) return fail('Event not found', 404)

    const ok = await prisma.$transaction(async tx => {
      const row = await tx.eventSeller.findFirst({ where: { id: params.sellerRowId, eventId: event.id }, select: { id: true, userId: true } })
      if (!row) return false
      const res = await tx.eventSeller.deleteMany({ where: { id: row.id, eventId: event.id } })
      if (res.count !== 1) return false
      await writeAudit(tx, host.userId, 'TICKET_SELLER_REMOVED', event.id, { userId: row.userId }, undefined)
      return true
    })
    if (!ok) return fail('Seller not found', 404)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('host seller remove error:', error)
    return fail('Could not remove the seller', 500)
  }
}
