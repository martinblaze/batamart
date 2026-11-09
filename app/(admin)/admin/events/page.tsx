// app/(admin)/admin/events/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Ticket, CheckCircle, XCircle, PauseCircle, PlayCircle, X, Loader2, MapPin, CalendarClock, User as UserIcon, AlertTriangle,
} from 'lucide-react'
import {
  AdminHeader, AdminEmpty, AdminButton, FilterTabs, AdminPanel, StatGrid, AdminTable, Th, Td, Tr,
} from '@/components/admin/AdminUI'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'

type Status = 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED' | 'REJECTED' | 'CANCELLED'
type Action = 'approve' | 'reject' | 'pause' | 'resume'

interface Tier {
  id: string
  name: string
  price: number
  capacity: number
  sold: number
  isActive: boolean
  randomCommissionPct: number
  uniqueCommissionPct: number
}
interface EventRow {
  id: string
  name: string
  description: string | null
  venue: string
  address: string | null
  startsAt: string
  endsAt: string | null
  flyerUrl: string | null
  status: Status
  reviewNote: string | null
  createdAt: string
  host: { id: string; name: string; username: string | null; email: string | null }
  tiers: Tier[]
}
interface Stats {
  sales: { purchases: number; ticketsSold: number; grossSales: number; platformFee: number; commissionPaid: number; hostEarnings: number }
  tickets: { valid: number; checkedIn: number; void: number }
  scans: Record<string, number>
  activeCheckers: number
  tiers: { id: string; name: string; price: number; capacity: number; sold: number }[]
  overbooked: {
    id: string; reference: string; buyerEmail: string; quantity: number; subtotal: number; createdAt: string
    tier: { name: string; capacity: number; sold: number }
    buyer: { name: string; username: string | null } | null
  }[]
}

const TABS: { value: Status; label: string }[] = [
  { value: 'PENDING_REVIEW', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const tone = (s: Status): BadgeStatus =>
  s === 'ACTIVE' ? 'success' : s === 'PENDING_REVIEW' ? 'warning' : s === 'CANCELLED' || s === 'REJECTED' ? 'danger' : 'neutral'

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })

const authHeaders = (json = false): Record<string, string> => {
  const h: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export default function AdminEventsPage() {
  const [status, setStatus] = useState<Status>('PENDING_REVIEW')
  const [events, setEvents] = useState<EventRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ event: EventRow; action: 'reject' | 'pause' } | null>(null)
  const [note, setNote] = useState('')
  const [drawer, setDrawer] = useState<EventRow | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/tickets/events?status=${status}`, { headers: authHeaders() })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Failed to load events')
      setEvents(data.events)
      setCounts(data.counts ?? {})
    } catch (e: any) {
      setError(e?.message || 'Failed to load events')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { load() }, [load])

  const act = async (event: EventRow, action: Action, noteText?: string) => {
    setBusyId(event.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/tickets/events/${event.id}`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ action, note: noteText }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Action failed')
      setDialog(null)
      setNote('')
      setDrawer(null)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const openDrawer = async (event: EventRow) => {
    setDrawer(event)
    setStats(null)
    setStatsLoading(true)
    try {
      const res = await fetch(`/api/admin/tickets/events/${event.id}/stats`, { headers: authHeaders() })
      const data = await res.json().catch(() => null)
      if (res.ok) setStats(data)
    } finally {
      setStatsLoading(false)
    }
  }

  const buttons = (ev: EventRow) => {
    const busy = busyId === ev.id
    const spin = busy ? Loader2 : undefined
    if (ev.status === 'PENDING_REVIEW') {
      return (
        <>
          <AdminButton tone="success" disabled={busy} icon={spin ?? CheckCircle} onClick={() => act(ev, 'approve')} className="flex-1">Approve</AdminButton>
          <AdminButton disabled={busy} icon={XCircle} onClick={() => { setNote(''); setDialog({ event: ev, action: 'reject' }) }} className="flex-1">Reject</AdminButton>
        </>
      )
    }
    if (ev.status === 'ACTIVE') {
      return <AdminButton tone="warning" disabled={busy} icon={spin ?? PauseCircle} onClick={() => { setNote(''); setDialog({ event: ev, action: 'pause' }) }} className="flex-1">Pause</AdminButton>
    }
    if (ev.status === 'PAUSED') {
      return <AdminButton tone="success" disabled={busy} icon={spin ?? PlayCircle} onClick={() => act(ev, 'resume')} className="flex-1">Resume</AdminButton>
    }
    return null
  }

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Ticketing"
        title="Events"
        description="Review events before they go public, and pause or resume them afterwards."
      />

      <FilterTabs
        value={status}
        onChange={(v) => setStatus(v as Status)}
        options={TABS.map(t => ({ ...t, count: counts[t.value] }))}
      />

      {error && (
        <div className="flex items-start gap-2 border border-danger/25 bg-danger/5 p-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center border border-border bg-card py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
        </div>
      ) : events.length === 0 ? (
        <AdminEmpty icon={Ticket} title="No events here" description="Nothing in this status right now." />
      ) : (
        <div className="grid grid-cols-1 gap-px border border-border bg-border lg:grid-cols-2">
          {events.map(ev => (
            <div key={ev.id} className="flex flex-col bg-card">
              <button onClick={() => openDrawer(ev)} className="group flex gap-4 p-4 text-left transition-colors duration-300 hover:bg-surface">
                <div className="h-28 w-24 flex-shrink-0 overflow-hidden bg-surface">
                  {ev.flyerUrl ? (
                    <img src={ev.flyerUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-muted"><Ticket className="h-6 w-6" strokeWidth={1.5} /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink">{ev.name}</h3>
                    <Badge status={tone(ev.status)}>{ev.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-ink-secondary">
                    <UserIcon className="h-3 w-3 flex-shrink-0" strokeWidth={1.75} />
                    {ev.host.name}{ev.host.username ? ` (@${ev.host.username})` : ''}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
                    <CalendarClock className="h-3 w-3 flex-shrink-0" strokeWidth={1.75} />{when(ev.startsAt)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-ink-secondary">
                    <MapPin className="h-3 w-3 flex-shrink-0" strokeWidth={1.75} />{ev.venue}
                  </p>
                  <p className="ui-mono ui-mono-sm mt-2 text-ink-muted">Submitted {when(ev.createdAt)}</p>
                </div>
              </button>

              <div className="border-t border-border px-4 py-3">
                <ul className="space-y-1.5">
                  {ev.tiers.map(t => (
                    <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-4 text-xs">
                      <span className="text-ink">{t.name}{!t.isActive && <span className="text-ink-muted"> (off)</span>}</span>
                      <span className="ui-mono ui-mono-sm text-ink-secondary">
                        {naira(t.price)} · cap {t.capacity} · comm {t.randomCommissionPct}% / {t.uniqueCommissionPct}%
                      </span>
                    </li>
                  ))}
                </ul>
                {ev.reviewNote && (ev.status === 'REJECTED' || ev.status === 'PAUSED') && (
                  <p className="mt-3 border border-warning/25 bg-warning/5 p-2.5 text-xs text-ink-secondary">Note: {ev.reviewNote}</p>
                )}
              </div>

              {buttons(ev) && <div className="flex gap-2 border-t border-border p-4">{buttons(ev)}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Note dialog (reject requires a note, pause optional) */}
      {dialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/50 p-4" onClick={() => setDialog(null)}>
          <div className="w-full max-w-md border border-border bg-card p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <p className="ui-eyebrow">{dialog.action === 'reject' ? 'Reject event' : 'Pause event'}</p>
            <h2 className="mt-2 text-base text-ink">{dialog.event.name}</h2>
            <p className="mt-2 text-sm text-ink-secondary">
              {dialog.action === 'reject' ? 'Tell the host what to fix. They see this note.' : 'Ticket sales stop until you resume. Add a note for the host if useful.'}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder={dialog.action === 'reject' ? 'Why is this being rejected?' : 'Optional note'}
              className="mt-3 w-full resize-none border border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-muted/80 focus:border-ink focus:outline-none"
            />
            <div className="mt-4 flex gap-2">
              <AdminButton onClick={() => setDialog(null)} className="flex-1">Cancel</AdminButton>
              <AdminButton
                tone={dialog.action === 'reject' ? 'danger' : 'warning'}
                disabled={busyId === dialog.event.id || (dialog.action === 'reject' && !note.trim())}
                icon={busyId === dialog.event.id ? Loader2 : undefined}
                onClick={() => act(dialog.event, dialog.action, note.trim() || undefined)}
                className="flex-1"
              >
                {dialog.action === 'reject' ? 'Confirm rejection' : 'Confirm pause'}
              </AdminButton>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-ink/50" onClick={() => setDrawer(null)}>
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="ui-eyebrow">Event detail</p>
                <h2 className="mt-2 text-lg text-ink">{drawer.name}</h2>
                <p className="mt-1 text-xs text-ink-secondary">{when(drawer.startsAt)} · {drawer.venue}</p>
              </div>
              <button onClick={() => setDrawer(null)} aria-label="Close" className="p-2 text-ink-secondary hover:text-ink">
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            {drawer.description && <p className="mb-5 whitespace-pre-line text-sm leading-relaxed text-ink-secondary">{drawer.description}</p>}

            {statsLoading || !stats ? (
              <div className="flex justify-center py-12">
                {statsLoading ? <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-ink" /> : <p className="text-sm text-ink-muted">Could not load stats.</p>}
              </div>
            ) : (
              <div className="space-y-5">
                <StatGrid
                  columns={2}
                  stats={[
                    { label: 'Tickets sold', value: stats.sales.ticketsSold },
                    { label: 'Gross sales', value: naira(stats.sales.grossSales) },
                    { label: 'Checked in', value: stats.tickets.checkedIn, note: `${stats.tickets.valid} still valid` },
                    { label: 'Checkers', value: stats.activeCheckers },
                  ]}
                />

                <AdminPanel title="Money" padded={false}>
                  <AdminTable>
                    <tbody>
                      <Tr><Td>BataMart fee</Td><Td align="right">{naira(stats.sales.platformFee)}</Td></Tr>
                      <Tr><Td>Reseller commission</Td><Td align="right">{naira(stats.sales.commissionPaid)}</Td></Tr>
                      <Tr><Td>Host earnings</Td><Td align="right">{naira(stats.sales.hostEarnings)}</Td></Tr>
                    </tbody>
                  </AdminTable>
                </AdminPanel>

                <AdminPanel title="Tiers" padded={false}>
                  <AdminTable>
                    <thead><tr><Th>Tier</Th><Th align="right">Price</Th><Th align="right">Sold</Th></tr></thead>
                    <tbody>
                      {stats.tiers.map(t => (
                        <Tr key={t.id}>
                          <Td>{t.name}</Td>
                          <Td align="right">{naira(t.price)}</Td>
                          <Td align="right">{t.sold} / {t.capacity}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </AdminTable>
                </AdminPanel>

                {Object.keys(stats.scans).length > 0 && (
                  <AdminPanel title="Door scans" padded={false}>
                    <AdminTable>
                      <tbody>
                        {Object.entries(stats.scans).map(([k, v]) => (
                          <Tr key={k}><Td>{k.replace('_', ' ')}</Td><Td align="right">{v}</Td></Tr>
                        ))}
                      </tbody>
                    </AdminTable>
                  </AdminPanel>
                )}

                <AdminPanel title={`Overbooked purchases (${stats.overbooked.length})`} padded={false}>
                  {stats.overbooked.length === 0 ? (
                    <p className="p-5 text-sm text-ink-muted">None. No tier has sold past its capacity.</p>
                  ) : (
                    <AdminTable>
                      <thead><tr><Th>Buyer</Th><Th>Tier</Th><Th align="right">Qty</Th><Th align="right">Paid</Th></tr></thead>
                      <tbody>
                        {stats.overbooked.map(p => (
                          <Tr key={p.id}>
                            <Td>{p.buyer?.username ? `@${p.buyer.username}` : p.buyerEmail}</Td>
                            <Td>{p.tier.name}</Td>
                            <Td align="right">{p.quantity}</Td>
                            <Td align="right">{naira(p.subtotal)}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </AdminTable>
                  )}
                </AdminPanel>
              </div>
            )}

            {buttons(drawer) && <div className="mt-6 flex gap-2">{buttons(drawer)}</div>}
          </aside>
        </div>
      )}
    </div>
  )
}
