'use client'

import Link from 'next/link'
import { CalendarDays, CheckCircle2, ChevronRight, Ban, Ticket as TicketIcon } from 'lucide-react'
import { eventIsOver, formatWhen } from '@/components/tickets/ticket-format'

export interface MyTicket {
  id: string
  code: string
  status: 'VALID' | 'CHECKED_IN' | 'VOID'
  checkedInAt: string | null
  purchaseId: string
  tierName: string
  event: { id: string; name: string; venue: string; startsAt: string; endsAt: string | null; flyerUrl: string | null; status: string }
}

export function ticketIsUpcoming(t: MyTicket): boolean {
  return t.status === 'VALID' && t.event.status !== 'CANCELLED' && !eventIsOver(t.event.startsAt, t.event.endsAt)
}

function StatusPill({ t }: { t: MyTicket }) {
  const base = 'inline-flex items-center gap-1 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em]'
  if (t.status === 'CHECKED_IN') return <span className={`${base} border-success/40 bg-success/10 text-success`}><CheckCircle2 className="h-3 w-3" /> Checked in</span>
  if (t.status === 'VOID') return <span className={`${base} border-danger/40 bg-danger/10 text-danger`}><Ban className="h-3 w-3" /> Void</span>
  if (t.event.status === 'CANCELLED') return <span className={`${base} border-danger/40 bg-danger/10 text-danger`}><Ban className="h-3 w-3" /> Cancelled</span>
  if (eventIsOver(t.event.startsAt, t.event.endsAt)) return <span className={`${base} border-border bg-surface text-ink-muted`}>Ended</span>
  return <span className={`${base} border-primary/40 bg-primary/10 text-primary`}>Valid</span>
}

export default function TicketRow({ ticket }: { ticket: MyTicket }) {
  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="group flex items-center gap-4 border border-border bg-card p-3 transition-colors duration-300 hover:border-ink/20"
    >
      <div className="h-20 w-16 flex-shrink-0 overflow-hidden bg-surface">
        {ticket.event.flyerUrl
          ? <img src={ticket.event.flyerUrl} alt="" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center"><TicketIcon className="h-6 w-6 text-ink-muted" strokeWidth={1.25} /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-semibold text-ink">{ticket.event.name}</p>
        <p className="mt-0.5 text-xs text-ink-secondary">{ticket.tierName} · <span className="font-mono">{ticket.code}</span></p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted"><CalendarDays className="h-3.5 w-3.5 flex-shrink-0" />{formatWhen(ticket.event.startsAt)}</p>
        <div className="mt-2"><StatusPill t={ticket} /></div>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-muted transition-transform duration-300 group-hover:translate-x-0.5" />
    </Link>
  )
}
