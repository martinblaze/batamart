'use client'
// app/(marketplace)/my-shop/events/page.tsx — events I host.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Ticket, MapPin, CalendarDays, Loader2, ChevronRight } from 'lucide-react'
import { Shell, PageHeader, EmptyState } from '@/components/ui/Shell'
import { authFetch } from '@/lib/auth-client'
import { StatusBadge, fmtNaira, fmtWhen, btnInk, type EventStatus } from './_shared'

interface HostEvent {
  id: string
  name: string
  venue: string
  status: EventStatus
  startsAt: string
  flyerUrl: string | null
  reviewNote: string | null
  ticketsSold: number
  capacity: number
  earnings: number
}

export default function HostEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<HostEvent[] | null>(null)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    authFetch('/api/tickets/host/events')
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (r.status === 401) { router.push('/login?redirect=%2Fmy-shop%2Fevents'); return }
        if (!r.ok) { setError(d.error || 'Could not load your events'); setCode(d.code || ''); setEvents([]); return }
        setEvents(d.events)
      })
      .catch(() => { setError('Network error. Try again.'); setEvents([]) })
  }, [router])

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Shell width="reading" className="space-y-6 pt-8">
        <PageHeader
          back={{ href: '/my-shop', label: 'My shop' }}
          eyebrow="Events and tickets"
          title="My events"
          description="List an event, sell tickets, and watch the door. Every new event is reviewed by BataMart before it goes public."
          actions={<Link href="/my-shop/events/new" className={btnInk}><Plus className="h-4 w-4" /> New event</Link>}
        />

        {error && (
          <div className="border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
            {code === 'USERNAME_REQUIRED' && <Link href="/myprofile" className="ml-2 underline">Set a username</Link>}
            {code === 'NOT_SELLER' && <Link href="/become-seller" className="ml-2 underline">Become a seller</Link>}
          </div>
        )}

        {events === null ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ink-muted" /></div>
        ) : events.length === 0 && !error ? (
          <EmptyState
            icon={Ticket}
            title="No events yet"
            description="Create your first event, add ticket types and share the link. You get paid to your wallet the moment a ticket sells."
            action={<Link href="/my-shop/events/new" className={btnInk}><Plus className="h-4 w-4" /> Create an event</Link>}
          />
        ) : (
          <ul className="space-y-3">
            {events.map(e => (
              <li key={e.id}>
                <Link href={`/my-shop/events/${e.id}`} className="ui-card ui-card-hover flex gap-4 p-3 sm:p-4">
                  <div className="h-24 w-20 flex-shrink-0 overflow-hidden border border-border bg-surface sm:h-28 sm:w-24">
                    {e.flyerUrl ? <img src={e.flyerUrl} alt="" className="h-full w-full object-cover" /> : (
                      <div className="flex h-full w-full items-center justify-center"><Ticket className="h-6 w-6 text-ink-muted" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2"><StatusBadge status={e.status} /></div>
                    <h2 className="truncate text-base font-semibold text-ink">{e.name}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary"><CalendarDays className="h-3.5 w-3.5 flex-shrink-0" /> {fmtWhen(e.startsAt)}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-secondary"><MapPin className="h-3.5 w-3.5 flex-shrink-0" /> <span className="truncate">{e.venue}</span></p>
                    <p className="mt-2 text-xs text-ink">
                      <span className="font-semibold">{e.ticketsSold}</span><span className="text-ink-muted"> / {e.capacity} sold</span>
                      <span className="text-ink-muted"> · </span>
                      <span className="font-semibold">{fmtNaira(e.earnings)}</span><span className="text-ink-muted"> earned</span>
                    </p>
                    {e.status === 'REJECTED' && (
                      <p className="mt-2 border border-danger/25 bg-danger/5 px-2 py-1.5 text-xs text-danger">
                        Rejected{e.reviewNote ? `: ${e.reviewNote}` : '.'} Edit the event and save to send it for review again.
                      </p>
                    )}
                  </div>
                  <ChevronRight className="hidden h-5 w-5 flex-shrink-0 self-center text-ink-muted sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Shell>
    </div>
  )
}
