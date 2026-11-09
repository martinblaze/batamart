'use client'

// A small "Events & tickets" rail for the marketplace home. Renders nothing when
// there are no events on sale, so it never shows an empty shelf.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Ticket } from 'lucide-react'
import { formatDay, naira } from '@/components/tickets/ticket-format'

interface Card { id: string; name: string; startsAt: string; flyerUrl: string | null; fromPrice: number | null; soldOut: boolean }

export default function EventsShelf() {
  const [events, setEvents] = useState<Card[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/tickets/events')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && Array.isArray(d?.events)) setEvents(d.events.slice(0, 8)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (events.length === 0) return null

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="ui-eyebrow min-w-0 flex-1">
          <Ticket className="h-3.5 w-3.5" strokeWidth={2} />
          Events &amp; tickets
        </p>
        <Link href="/events" className="group flex flex-shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
          See all <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className="ui-rail -mx-1 px-1 pb-1">
        {events.map(ev => {
          const d = formatDay(ev.startsAt)
          return (
            <Link
              key={ev.id}
              href={`/events/${ev.id}`}
              className="group w-32 flex-shrink-0 overflow-hidden border border-border bg-card transition-colors duration-300 hover:border-ink/20 sm:w-40"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-surface">
                {ev.flyerUrl
                  ? <img src={ev.flyerUrl} alt={ev.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                  : <div className="flex h-full w-full items-center justify-center"><Ticket className="h-8 w-8 text-ink-muted" strokeWidth={1.25} /></div>}
                <span className="absolute left-2 top-2 border border-border bg-card px-2 py-1 text-center font-mono text-[10px] uppercase leading-none tracking-[0.1em] text-ink">
                  {d.day} {d.month}
                </span>
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 text-xs font-medium leading-snug text-ink">{ev.name}</p>
                <p className="ui-figure mt-1.5 text-sm text-ink">
                  {ev.soldOut ? 'Sold out' : ev.fromPrice != null ? naira(ev.fromPrice) : ''}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
