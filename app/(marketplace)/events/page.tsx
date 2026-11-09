'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Loader2, MapPin, Search, Ticket } from 'lucide-react'
import { PageHeader } from '@/components/marketplace/DetailChrome'
import { formatDay, formatWhen, naira } from '@/components/tickets/ticket-format'

interface EventCard {
  id: string; name: string; venue: string; startsAt: string; flyerUrl: string | null
  fromPrice: number | null; soldOut: boolean; hostName: string
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventCard[]>([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const reqId = useRef(0)

  const load = useCallback(async (q: string, p: number) => {
    const id = ++reqId.current
    p === 1 ? setLoading(true) : setLoadingMore(true)
    setError('')
    try {
      const res = await fetch(`/api/tickets/events?page=${p}${q ? `&search=${encodeURIComponent(q)}` : ''}`)
      const data = await res.json()
      if (id !== reqId.current) return
      if (!res.ok) { setError(data.error || 'Could not load events'); return }
      setEvents(prev => (p === 1 ? data.events : [...prev, ...data.events]))
      setMore(!!data.hasMore)
      setPage(p)
    } catch {
      if (id === reqId.current) setError('Could not load events. Check your connection.')
    } finally {
      if (id === reqId.current) { setLoading(false); setLoadingMore(false) }
    }
  }, [])

  useEffect(() => { load(query, 1) }, [query, load])

  return (
    <div className="min-h-screen bg-surface pb-24">
      <PageHeader
        eyebrow="Tickets"
        title="Events"
        actions={
          <Link href="/tickets" className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary hover:text-ink">
            <Ticket className="h-3.5 w-3.5" /> My tickets
          </Link>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <form
          onSubmit={e => { e.preventDefault(); setQuery(search.trim()) }}
          className="mb-6 flex h-12 items-center gap-2 border border-border bg-card px-3"
        >
          <Search className="h-4 w-4 flex-shrink-0 text-ink-muted" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); if (!e.target.value) setQuery('') }}
            placeholder="Search events or venues"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
          />
        </form>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="ui-skeleton aspect-[4/5]" />)}
          </div>
        ) : error ? (
          <div className="border border-border bg-card p-8 text-center">
            <p className="text-ink">{error}</p>
            <button onClick={() => load(query, 1)} className="mt-3 text-sm font-semibold text-primary">Try again</button>
          </div>
        ) : events.length === 0 ? (
          <div className="border border-border bg-card p-10 text-center">
            <Ticket className="mx-auto h-9 w-9 text-ink-muted" strokeWidth={1.25} />
            <p className="mt-3 font-semibold text-ink">{query ? 'No events match your search' : 'No events on sale right now'}</p>
            <p className="mt-1 text-sm text-ink-secondary">Check back soon. New events are added all the time.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map(ev => {
                const d = formatDay(ev.startsAt)
                return (
                  <Link
                    key={ev.id}
                    href={`/events/${ev.id}`}
                    className="group overflow-hidden border border-border bg-card transition-colors duration-300 hover:border-ink/20"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-surface">
                      {ev.flyerUrl
                        ? <img src={ev.flyerUrl} alt={ev.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                        : <div className="flex h-full w-full items-center justify-center"><Ticket className="h-12 w-12 text-ink-muted" strokeWidth={1.25} /></div>}
                      <div className="absolute left-3 top-3 border border-border bg-card px-2.5 py-1.5 text-center leading-none">
                        <p className="ui-figure text-lg text-ink">{d.day}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">{d.month}</p>
                      </div>
                      {ev.soldOut && (
                        <span className="absolute right-3 top-3 bg-ink px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-background">Sold out</span>
                      )}
                    </div>
                    <div className="p-4">
                      <h2 className="line-clamp-2 text-base font-semibold leading-snug text-ink">{ev.name}</h2>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-secondary"><CalendarDays className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" />{formatWhen(ev.startsAt)}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary"><MapPin className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" /><span className="truncate">{ev.venue}</span></p>
                      <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
                        <span className="truncate pr-2 text-xs text-ink-muted">by {ev.hostName}</span>
                        {ev.fromPrice != null && (
                          <span className="flex-shrink-0 text-right">
                            <span className="ui-mono ui-mono-sm text-ink-muted">From </span>
                            <span className="ui-figure text-base text-ink">{naira(ev.fromPrice)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
            {more && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => load(query, page + 1)}
                  disabled={loadingMore}
                  className="inline-flex h-11 items-center gap-2 border border-border bg-card px-6 text-sm font-semibold text-ink hover:border-ink/25 disabled:opacity-50"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Show more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
