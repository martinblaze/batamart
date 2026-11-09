'use client'

// Public guest ticket page, opened from the link in the receipt email.
// Works without an account; the token in the URL is the credential.

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, Loader2, Mail, Ticket } from 'lucide-react'
import LiveTicket from '@/components/tickets/LiveTicket'

interface GuestTicket { id: string; code: string; tierName: string; status: string }
interface GuestData {
  event: { name: string }
  buyerEmail: string
  tickets: GuestTicket[]
}

export default function GuestTicketsPage() {
  const params = useParams<{ token: string }>()
  const token = params.token
  const [data, setData] = useState<GuestData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [paid, setPaid] = useState(false)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('paid') === '1') setPaid(true)
    let cancelled = false
    fetch(`/api/tickets/t/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async res => {
        if (cancelled) return
        if (res.status === 404) { setState('missing'); return }
        const body = await res.json()
        if (!res.ok) { setState('error'); return }
        setData(body)
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [token])

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-surface"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }
  if (state !== 'ready' || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="max-w-sm border border-border bg-card p-8 text-center">
          <Ticket className="mx-auto h-9 w-9 text-ink-muted" strokeWidth={1.25} />
          <p className="mt-3 font-semibold text-ink">{state === 'missing' ? 'This ticket link is not valid' : 'Could not load your tickets'}</p>
          <p className="mt-1 text-sm text-ink-secondary">
            {state === 'missing' ? 'Check that you opened the full link from your email.' : 'Check your connection and try again.'}
          </p>
        </div>
      </div>
    )
  }

  const tickets = data.tickets
  const current = tickets[Math.min(selected, tickets.length - 1)]

  return (
    <div className="min-h-screen bg-surface pb-24 pt-4">
      <div className="mx-auto max-w-md space-y-4 px-4">
        {paid && (
          <div className="flex items-start gap-3 border border-success/40 bg-success/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" strokeWidth={1.75} />
            <div className="text-sm">
              <p className="font-semibold text-ink">Payment successful</p>
              <p className="mt-0.5 text-ink-secondary">Keep this page or the email we sent. Open it at the door to show your QR.</p>
            </div>
          </div>
        )}
        <p className="flex items-center gap-2 text-xs text-ink-muted"><Mail className="h-3.5 w-3.5" /> Tickets for {data.buyerEmail}</p>

        {tickets.length === 0 ? (
          <div className="border border-border bg-card p-6 text-center">
            <p className="font-semibold text-ink">No tickets on this link</p>
            <p className="mt-1 text-sm text-ink-secondary">The tickets from this purchase have been sent to other people.</p>
          </div>
        ) : (
          <>
            {tickets.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
                {tickets.map((t, i) => (
                  <button
                    key={t.id} role="tab" aria-selected={i === selected} onClick={() => setSelected(i)}
                    className={`flex-shrink-0 border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.1em] ${i === selected ? 'border-ink bg-ink text-background' : 'border-border bg-card text-ink-secondary'}`}
                  >
                    {t.tierName} {i + 1}
                  </button>
                ))}
              </div>
            )}
            <LiveTicket key={current.id} ticketId={current.id} token={token} index={selected} total={tickets.length} />
          </>
        )}
      </div>
    </div>
  )
}
