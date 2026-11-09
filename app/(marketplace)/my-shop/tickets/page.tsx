'use client'
// app/(marketplace)/my-shop/tickets/page.tsx
// Events I resell, what I earn per ticket type, and my share links.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Ticket, Copy, Check, ExternalLink, Power, Loader2, Banknote, TrendingUp,
  CalendarDays, Star, Mail, ArrowRight,
} from 'lucide-react'
import { Shell, PageHeader, EmptyState, Skeleton } from '@/components/ui/Shell'
import { Badge } from '@/components/ui/Badge'
import { authFetch } from '@/lib/auth-client'

interface TierRow { name: string; price: number; commissionPct: number }
interface Listing {
  id: string; eventId: string; eventName: string; startsAt: string; eventStatus: string
  isActive: boolean; kind: 'RANDOM' | 'UNIQUE'; ticketsSold: number; commissionEarned: number; tiers: TierRow[]
}
interface Invitation {
  eventId: string; eventName: string; startsAt: string; kind: 'UNIQUE'; tiers: TierRow[]
}

const naira = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function KindBadge({ kind }: { kind: 'RANDOM' | 'UNIQUE' }) {
  return kind === 'UNIQUE'
    ? <Badge status="verified" icon={Star}>Unique seller</Badge>
    : <Badge status="neutral">Open seller</Badge>
}

function TierTable({ tiers }: { tiers: TierRow[] }) {
  if (tiers.length === 0) return null
  return (
    <div className="divide-y divide-border border border-border">
      {tiers.map((t) => (
        <div key={t.name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{t.name}</p>
            <p className="text-xs text-ink-muted">{naira(t.price)}</p>
          </div>
          <p className="text-right text-xs text-ink-secondary">
            <span className="font-semibold text-ink">{t.commissionPct}%</span>
            {t.commissionPct > 0 && <span className="text-ink-muted"> ({naira(Math.floor((t.price * t.commissionPct) / 100))} each)</span>}
          </p>
        </div>
      ))}
    </div>
  )
}

export default function MyTicketListingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listings, setListings] = useState<Listing[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [totals, setTotals] = useState({ ticketsSold: 0, commissionEarned: 0 })
  const [userId, setUserId] = useState('')
  const [busyId, setBusyId] = useState('')
  const [copiedId, setCopiedId] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/tickets/listings/mine')
      if (res.status === 401) return
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load your listings.')
      setListings(data.listings || [])
      setInvitations(data.invitations || [])
      setTotals(data.totals || { ticketsSold: 0, commissionEarned: 0 })
      setUserId(data.userId || '')
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Could not load your listings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.replace('/login?redirect=/my-shop/tickets')
      return
    }
    load()
  }, [load, router])

  const linkFor = (eventId: string) => `${window.location.origin}/events/${eventId}?ref=${userId}`

  const copy = async (listingKey: string, eventId: string) => {
    try {
      await navigator.clipboard.writeText(linkFor(eventId))
      setCopiedId(listingKey)
      setTimeout(() => setCopiedId(''), 2000)
    } catch {
      setError('Could not copy the link.')
    }
  }

  const setActive = async (l: Listing, active: boolean) => {
    setBusyId(l.id)
    setError('')
    try {
      const res = active
        ? await authFetch('/api/tickets/listings', { method: 'POST', body: JSON.stringify({ eventId: l.eventId }) })
        : await authFetch(`/api/tickets/listings/${l.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not update the listing.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not update the listing.')
    } finally {
      setBusyId('')
    }
  }

  const startInvited = async (inv: Invitation) => {
    setBusyId(inv.eventId)
    setError('')
    try {
      const res = await authFetch('/api/tickets/listings', { method: 'POST', body: JSON.stringify({ eventId: inv.eventId }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not start selling.')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Could not start selling.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <Shell width="reading" className="pt-8 sm:pt-12">
        <PageHeader
          back={{ href: '/my-shop', label: 'My shop' }}
          eyebrow="Tickets"
          title="Tickets I sell"
          description="Events you resell at the host's price. Share your link; your commission is paid to your wallet the moment a ticket is bought."
          actions={
            <Link href="/events" className="inline-flex h-10 items-center gap-2 border border-border bg-card px-4 text-sm font-medium text-ink hover:bg-surface">
              Browse events <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          }
        />

        {error && (
          <div className="mt-6 border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
        )}

        {loading ? (
          <div className="mt-8 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-px bg-border">
              <div className="bg-card px-4 py-5 sm:px-6">
                <p className="ui-figure text-[clamp(1.4rem,3vw,2rem)] leading-none text-ink">{totals.ticketsSold}</p>
                <p className="ui-mono ui-mono-sm mt-3 flex items-center gap-1.5 text-ink"><TrendingUp className="h-3 w-3" strokeWidth={2} /> Tickets sold</p>
              </div>
              <div className="bg-card px-4 py-5 sm:px-6">
                <p className="ui-figure text-[clamp(1.4rem,3vw,2rem)] leading-none text-ink">{naira(totals.commissionEarned)}</p>
                <p className="ui-mono ui-mono-sm mt-3 flex items-center gap-1.5 text-ink"><Banknote className="h-3 w-3" strokeWidth={2} /> Commission earned</p>
              </div>
            </div>

            {invitations.length > 0 && (
              <section className="mt-10">
                <p className="ui-eyebrow mb-4">Invited by a host</p>
                <div className="space-y-4">
                  {invitations.map((inv) => (
                    <div key={inv.eventId} className="border border-border bg-card p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base text-ink">{inv.eventName}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted"><CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} /> {when(inv.startsAt)}</p>
                        </div>
                        <KindBadge kind="UNIQUE" />
                      </div>
                      <p className="mt-3 flex items-start gap-2 text-sm text-ink-secondary">
                        <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                        The host named you a unique seller. These are your commissions.
                      </p>
                      <div className="mt-3"><TierTable tiers={inv.tiers} /></div>
                      <button
                        onClick={() => startInvited(inv)}
                        disabled={busyId === inv.eventId}
                        className="mt-4 inline-flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
                      >
                        {busyId === inv.eventId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" strokeWidth={1.75} />}
                        Start selling
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-10">
              <p className="ui-eyebrow mb-4">Your listings</p>
              {listings.length === 0 ? (
                <EmptyState
                  icon={Ticket}
                  title="You are not reselling any events"
                  description="Open an event and press Sell these tickets to get your own link. You earn the commission the host sets."
                  action={
                    <Link href="/events" className="inline-flex h-10 items-center gap-2 bg-primary px-5 text-sm font-medium text-white hover:brightness-95">
                      Find events
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {listings.map((l) => {
                    const sellable = l.isActive && l.eventStatus === 'ACTIVE'
                    return (
                      <div key={l.id} className="border border-border bg-card p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link href={`/events/${l.eventId}`} className="inline-flex items-center gap-1.5 text-base text-ink hover:underline">
                              <span className="truncate">{l.eventName}</span>
                              <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                            </Link>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted"><CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} /> {when(l.startsAt)}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <KindBadge kind={l.kind} />
                            {!l.isActive ? <Badge status="neutral">Paused</Badge>
                              : l.eventStatus !== 'ACTIVE' ? <Badge status="warning">Event off sale</Badge>
                              : <Badge status="success">Live</Badge>}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-px bg-border">
                          <div className="bg-card py-2.5 pr-3">
                            <p className="ui-figure text-lg text-ink">{l.ticketsSold}</p>
                            <p className="ui-mono ui-mono-sm text-ink-muted">Sold</p>
                          </div>
                          <div className="bg-card px-3 py-2.5">
                            <p className="ui-figure text-lg text-ink">{naira(l.commissionEarned)}</p>
                            <p className="ui-mono ui-mono-sm text-ink-muted">Earned</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="ui-mono ui-mono-sm mb-2 text-ink-muted">Your commission per ticket type</p>
                          <TierTable tiers={l.tiers} />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          {sellable && (
                            <button
                              onClick={() => copy(l.id, l.eventId)}
                              disabled={!userId}
                              className="inline-flex h-10 items-center gap-2 border border-border px-4 text-sm font-medium text-ink hover:bg-surface"
                            >
                              {copiedId === l.id ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
                              {copiedId === l.id ? 'Copied' : 'Copy my link'}
                            </button>
                          )}
                          <button
                            onClick={() => setActive(l, !l.isActive)}
                            disabled={busyId === l.id}
                            className="inline-flex h-10 items-center gap-2 border border-border px-4 text-sm font-medium text-ink-secondary hover:bg-surface disabled:opacity-50"
                          >
                            {busyId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" strokeWidth={1.75} />}
                            {l.isActive ? 'Stop selling' : 'Resume selling'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <p className="mt-10 text-sm text-ink-secondary">
              Hosting an event yourself?{' '}
              <Link href="/my-shop/events" className="text-primary hover:underline">Manage your events and set commissions</Link>.
            </p>
          </>
        )}
      </Shell>
    </div>
  )
}
