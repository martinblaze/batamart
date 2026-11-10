// lib/tickets/purge.ts — server-only.
// Once an event has been over for TICKET_PURGE_AFTER_HOURS, its Ticket rows are deleted.
// KEPT: TicketEvent, TicketTier, TicketPurchase (payment records), TicketScan (door log, ticketId set null),
// TicketTransfer (history, ticketId set null; it snapshots eventId and ticketCode), wallet money, AuditLog.
// Run from the daily cron. Idempotent: an event with no Ticket rows left is not selected again.

import { prisma } from '@/lib/prisma'
import { DEFAULT_EVENT_LENGTH_HOURS } from '@/lib/tickets/buyer'
import { TICKET_PURGE_AFTER_HOURS } from '@/lib/tickets/config'

const HOUR = 3_600_000
const BATCH = 500
const EVENTS_PER_RUN = 50

export interface PurgeCounts {
  events: number
  tickets: number
  checkedIn: number
  unused: number
}

export async function purgeEndedEventTickets(
  now: Date = new Date(),
  opts: { deadline?: number } = {},
): Promise<PurgeCounts> {
  const counts: PurgeCounts = { events: 0, tickets: 0, checkedIn: 0, unused: 0 }
  const outOfTime = () => !!opts.deadline && Date.now() > opts.deadline

  // Over for the purge delay: endsAt (or startsAt + default length when there is no end) is older than the cutoff.
  const cutoff = new Date(now.getTime() - TICKET_PURGE_AFTER_HOURS * HOUR)
  const noEndCutoff = new Date(cutoff.getTime() - DEFAULT_EVENT_LENGTH_HOURS * HOUR)
  const events = await prisma.ticketEvent.findMany({
    where: {
      tickets: { some: {} },
      OR: [
        { endsAt: { lt: cutoff } },
        { endsAt: null, startsAt: { lt: noEndCutoff } },
      ],
    },
    select: { id: true, hostId: true },
    orderBy: { startsAt: 'asc' },
    take: EVENTS_PER_RUN,
  })

  for (const ev of events) {
    if (outOfTime()) break
    let tickets = 0
    let checkedIn = 0
    let unused = 0
    while (!outOfTime()) {
      const batch = await prisma.ticket.findMany({
        where: { eventId: ev.id },
        select: { id: true, status: true },
        orderBy: { id: 'asc' },
        take: BATCH,
      })
      if (batch.length === 0) break
      const ids = batch.map(t => t.id)
      const res = await prisma.ticket.deleteMany({ where: { id: { in: ids }, eventId: ev.id } })
      // Count what we actually removed (a concurrent run may have taken some).
      if (res.count === batch.length) {
        tickets += batch.length
        for (const t of batch) {
          if (t.status === 'CHECKED_IN') checkedIn++
          else if (t.status === 'VALID') unused++
        }
      } else {
        tickets += res.count
      }
    }
    if (tickets === 0) continue
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'TICKET_EVENT_TICKETS_PURGED',
        entityType: 'TicketEvent',
        entityId: ev.id,
        newValue: { tickets, checkedIn, unused, purgeAfterHours: TICKET_PURGE_AFTER_HOURS },
      },
    })
    counts.events++
    counts.tickets += tickets
    counts.checkedIn += checkedIn
    counts.unused += unused
  }
  return counts
}
