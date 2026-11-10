'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Ticket } from 'lucide-react'
import { PageHeader } from '@/components/marketplace/DetailChrome'
import TicketRow, { EndedPurchaseRow, EndedPurchase, MyTicket, ticketIsUpcoming } from '@/components/tickets/TicketRow'

export default function MyTicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<MyTicket[]>([])
  const [ended, setEnded] = useState<EndedPurchase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [justPaid, setJustPaid] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('paid') === '1') {
      setJustPaid(true)
      window.history.replaceState({}, '', '/tickets')
    }
    fetch('/api/tickets/mine', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async res => {
        if (res.status === 401) {
          localStorage.removeItem('token')
          router.push('/login?redirect=%2Ftickets')
          return
        }
        const data = await res.json()
        if (!res.ok) setError(data.error || 'Could not load your tickets')
        else { setTickets(data.tickets); setEnded(Array.isArray(data.endedPurchases) ? data.endedPurchases : []) }
      })
      .catch(() => setError('Could not load your tickets. Check your connection.'))
      .finally(() => setLoading(false))
  }, [router])

  const upcoming = tickets.filter(ticketIsUpcoming).sort((a, b) => +new Date(a.event.startsAt) - +new Date(b.event.startsAt))
  const past = tickets.filter(t => !ticketIsUpcoming(t))

  return (
    <div className="min-h-screen bg-surface pb-24">
      <PageHeader
        eyebrow={`${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`}
        title="My tickets"
        back="/orders"
        actions={<Link href="/events" className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary hover:text-ink">Find events</Link>}
      />
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6">
        {justPaid && (
          <div className="flex items-start gap-3 border border-success/40 bg-success/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" strokeWidth={1.75} />
            <div className="text-sm">
              <p className="font-semibold text-ink">Payment successful</p>
              <p className="mt-0.5 text-ink-secondary">Your tickets are ready below. We also emailed you a receipt.</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : error ? (
          <p className="border border-border bg-card p-8 text-center text-ink">{error}</p>
        ) : tickets.length === 0 ? (
          <div className="border border-border bg-card p-10 text-center">
            <Ticket className="mx-auto h-9 w-9 text-ink-muted" strokeWidth={1.25} />
            <p className="mt-3 font-semibold text-ink">No tickets yet</p>
            <p className="mt-1 text-sm text-ink-secondary">Tickets you buy, or that friends send you, show up here.</p>
            <Link href="/events" className="mt-4 inline-flex h-11 items-center bg-primary px-6 text-sm font-semibold text-white">Browse events</Link>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <p className="ui-eyebrow mb-3">Upcoming</p>
                <div className="space-y-3">{upcoming.map(t => <TicketRow key={t.id} ticket={t} />)}</div>
              </section>
            )}
            {(past.length > 0 || ended.length > 0) && (
              <section>
                <p className="ui-eyebrow mb-3">Past and used</p>
                <div className="space-y-3">{past.map(t => <TicketRow key={t.id} ticket={t} />)}{ended.map(p => <EndedPurchaseRow key={p.purchaseId} purchase={p} />)}</div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
