'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Ticket, MapPin, CalendarDays } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface EventCard {
  id: string; name: string; venue: string; startsAt: string
  flyerUrl?: string | null; fromPrice: number; soldOut: boolean
}

const naira = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

/** Events this seller is reselling. Renders nothing when there are none or the request fails. */
export default function SellerTicketsSection({ sellerId }: { sellerId: string }) {
  const [events, setEvents] = useState<EventCard[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tickets/events?sellerId=${encodeURIComponent(sellerId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && Array.isArray(d?.events)) setEvents(d.events) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [sellerId])

  if (events.length === 0) return null

  return (
    <section className="mb-12 sm:mb-16">
      <div className="border-b border-border pb-5">
        <p className="ui-eyebrow mb-3 max-w-[14rem]">Tickets</p>
        <h2 className="text-[clamp(1.25rem,2.4vw,1.6rem)] leading-tight text-ink">Event tickets</h2>
        <p className="ui-mono ui-mono-sm mt-2 text-ink-muted">
          {events.length} event{events.length !== 1 ? 's' : ''} on sale
        </p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}?ref=${encodeURIComponent(sellerId)}`}
            className="group flex gap-3 border border-border bg-card p-3 transition-colors hover:border-ink/30"
          >
            {e.flyerUrl ? (
              <img src={e.flyerUrl} alt="" loading="lazy" className="h-20 w-20 flex-shrink-0 object-cover" />
            ) : (
              <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center bg-surface">
                <Ticket className="h-6 w-6 text-ink-muted" strokeWidth={1.5} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-1 text-sm font-medium text-ink">{e.name}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                <CalendarDays className="h-3 w-3 flex-shrink-0" strokeWidth={1.75} />
                {new Date(e.startsAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                <MapPin className="h-3 w-3 flex-shrink-0" strokeWidth={1.75} />
                <span className="truncate">{e.venue}</span>
              </p>
              <div className="mt-2">
                {e.soldOut ? <Badge status="out-of-stock">Sold out</Badge> : <span className="ui-figure text-sm text-ink">From {naira(e.fromPrice)}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
