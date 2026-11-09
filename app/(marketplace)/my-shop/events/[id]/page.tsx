'use client'
// app/(marketplace)/my-shop/events/[id]/page.tsx — manage one event and see how it is selling.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Loader2, Plus, Wallet, RefreshCw, Mail, UserX, Trash2, AlertTriangle, Ticket, Users, ScanLine,
  ReceiptText, History, Info, CheckCircle2, Ban, X, CalendarDays, MapPin, ShieldAlert,
} from 'lucide-react'
import { Shell, PageHeader } from '@/components/ui/Shell'
import { Badge } from '@/components/ui/Badge'
import { authFetch } from '@/lib/auth-client'
import { PLATFORM_FEE_PCT } from '@/lib/tickets/config'
import {
  field, labelCls, btnInk, btnGhost, fmtNaira, fmtWhen, fmtShort, toLocalInput, fromLocalInput,
  StatusBadge, ImagePicker, TierEditor, newTierDraft, tierDraftError, tierDraftBody, type TierDraft, type EventStatus,
} from '../_shared'

const SCAN_LABEL: Record<string, string> = {
  OK: 'Checked in', ALREADY_USED: 'Already used', INVALID: 'Invalid', WRONG_EVENT: 'Wrong event', STALE: 'Old code', VOID: 'Void',
}

const toDraft = (t: any): TierDraft => ({
  key: t.id, id: t.id, name: t.name, description: t.description ?? '', imageUrl: t.imageUrl ?? '',
  price: String(t.price), capacity: String(t.capacity),
  randomPct: String(t.randomCommissionPct), uniquePct: String(t.uniqueCommissionPct),
  saleStartsAt: toLocalInput(t.saleStartsAt), saleEndsAt: toLocalInput(t.saleEndsAt),
  isActive: t.isActive, sold: t.sold,
})

function Section({ icon: Icon, title, hint, children }: { icon: any; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="ui-panel space-y-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-secondary" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {hint && <p className="mt-1 text-sm leading-relaxed text-ink-secondary">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function ManageEventPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id)

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState('')
  const [justCreated, setJustCreated] = useState(false)

  // details form
  const [d, setD] = useState({ name: '', venue: '', address: '', description: '', startsAt: '', endsAt: '', flyerUrl: '', allowResale: true })
  // tiers form
  const [tiers, setTiers] = useState<TierDraft[]>([])
  const [removedTierIds, setRemovedTierIds] = useState<string[]>([])
  // checkers / sellers
  const [chEmail, setChEmail] = useState('')
  const [chName, setChName] = useState('')
  const [sellerName, setSellerName] = useState('')
  // purchases / audit
  const [purchases, setPurchases] = useState<any[]>([])
  const [pCursor, setPCursor] = useState<string | null>(null)
  const [audit, setAudit] = useState<any[] | null>(null)
  const [auditCursor, setAuditCursor] = useState<string | null>(null)
  // cancel
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelAck, setCancelAck] = useState(false)
  const [cancelText, setCancelText] = useState('')

  const flash = (type: 'ok' | 'err', text: string) => { setMsg({ type, text }); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const hydrate = (j: any) => {
    setData(j)
    setPurchases(j.purchases)
    setPCursor(j.purchasesNextCursor)
    setD({
      name: j.event.name, venue: j.event.venue, address: j.event.address ?? '', description: j.event.description ?? '',
      startsAt: toLocalInput(j.event.startsAt), endsAt: toLocalInput(j.event.endsAt), flyerUrl: j.event.flyerUrl ?? '',
      allowResale: j.event.allowResale,
    })
    setTiers(j.tiers.map(toDraft))
    setRemovedTierIds([])
  }

  const load = useCallback(async () => {
    try {
      const r = await authFetch(`/api/tickets/host/events/${id}`)
      if (r.status === 401) { router.push(`/login?redirect=${encodeURIComponent(`/my-shop/events/${id}`)}`); return }
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setLoadError(j.error || 'Could not load this event'); return }
      hydrate(j)
    } catch {
      setLoadError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router])

  const loadAudit = useCallback(async (cursor?: string | null) => {
    const r = await authFetch(`/api/tickets/host/events/${id}/audit${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
    const j = await r.json().catch(() => ({}))
    if (r.ok) {
      setAudit(prev => (cursor && prev ? [...prev, ...j.items] : j.items))
      setAuditCursor(j.nextCursor)
    }
  }, [id])

  useEffect(() => {
    if (typeof window !== 'undefined') setJustCreated(new URLSearchParams(window.location.search).get('created') === '1')
    load()
    loadAudit()
  }, [load, loadAudit])

  /** One place for every write: runs it, reports the outcome, reloads. */
  const act = async (key: string, url: string, init: RequestInit, okText: string, after?: (j: any) => void) => {
    setBusy(key); setMsg(null)
    try {
      const r = await authFetch(url, init)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { flash('err', j.error || 'Something went wrong'); return false }
      if (after) after(j)
      flash('ok', okText)
      await Promise.all([load(), loadAudit()])
      return true
    } catch {
      flash('err', 'Network error. Try again.')
      return false
    } finally {
      setBusy('')
    }
  }

  const base = `/api/tickets/host/events/${id}`
  const post = (b: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(b) })

  const saveDetails = () => {
    if (d.name.trim().length < 3) return flash('err', 'Give the event a name of at least 3 characters.')
    if (!d.venue.trim()) return flash('err', 'Enter the venue.')
    if (!d.startsAt) return flash('err', 'Choose when the event starts.')
    if (!d.flyerUrl) return flash('err', 'The event needs a flyer.')
    const body: Record<string, unknown> = {
      name: d.name.trim(), venue: d.venue.trim(), address: d.address.trim() || null,
      description: d.description.trim() || null, flyerUrl: d.flyerUrl, allowResale: d.allowResale,
    }
    if (d.startsAt !== toLocalInput(data.event.startsAt)) body.startsAt = fromLocalInput(d.startsAt)
    if (d.endsAt !== toLocalInput(data.event.endsAt)) body.endsAt = fromLocalInput(d.endsAt)
    act('details', base, { method: 'PATCH', body: JSON.stringify(body) }, 'Event details saved.')
  }

  const saveTiers = () => {
    for (const t of tiers) { const e = tierDraftError(t); if (e) return flash('err', e) }
    act('tiers', base, {
      method: 'PATCH',
      body: JSON.stringify({ tiers: tiers.map(tierDraftBody), ...(removedTierIds.length ? { removeTierIds: removedTierIds } : {}) }),
    }, 'Ticket types saved.')
  }

  const addChecker = async () => {
    const ok = await act('checker-add', `${base}/checkers`, post({ email: chEmail.trim(), name: chName.trim() || undefined }), 'Checker added and the sign-in link emailed.',
      j => { if (j.emailSent === false) flash('err', 'Checker added, but the email could not be sent. Use "Resend link" in a moment.') })
    if (ok) { setChEmail(''); setChName('') }
  }
  const addSeller = async () => {
    const ok = await act('seller-add', `${base}/sellers`, post({ username: sellerName.trim() }), 'Unique seller added.')
    if (ok) setSellerName('')
  }

  const cancelEvent = async () => {
    const ok = await act('cancel', `${base}/cancel`, post({ confirm: true }), 'The event is cancelled and ticket holders were told.')
    if (ok) setCancelOpen(false)
  }

  const loadMorePurchases = async () => {
    if (!pCursor) return
    setBusy('more')
    try {
      const r = await authFetch(`${base}?pcursor=${encodeURIComponent(pCursor)}`)
      const j = await r.json().catch(() => ({}))
      if (r.ok) { setPurchases(prev => [...prev, ...j.purchases]); setPCursor(j.purchasesNextCursor) }
    } finally { setBusy('') }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-surface"><Loader2 className="h-6 w-6 animate-spin text-ink-muted" /></div>
  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-surface">
        <Shell width="narrow" className="pt-12 text-center">
          <p className="text-ink">{loadError || 'Event not found'}</p>
          <Link href="/my-shop/events" className="ui-mono ui-mono-sm mt-4 inline-block text-ink">Back to my events</Link>
        </Shell>
      </div>
    )
  }

  const ev = data.event
  const status: EventStatus = ev.status
  const t = data.totals
  const cancelled = status === 'CANCELLED'
  const materialWarn = ev.hasPaidTickets
    ? 'Tickets have been sold. Changes to the name, venue or time apply immediately, every ticket holder is told, and BataMart is alerted so it can check nothing misleading changed.'
    : 'Changing the name, venue or time sends this event back to BataMart for review before it is public again.'

  const stats = [
    { label: 'Tickets sold', value: String(t.ticketsSold) },
    { label: 'Gross sales', value: fmtNaira(t.grossSales) },
    { label: `BataMart fee (${PLATFORM_FEE_PCT}%)`, value: fmtNaira(t.platformFee) },
    { label: 'Seller commission', value: fmtNaira(t.commissionPaid) },
    { label: 'Your earnings', value: fmtNaira(t.hostEarnings), strong: true },
    { label: 'Checked in', value: `${t.checkedIn} / ${t.ticketsSold}` },
  ]

  return (
    <div className="min-h-screen bg-surface pb-28">
      <Shell width="reading" className="space-y-6 pt-8">
        <PageHeader
          back={{ href: '/my-shop/events', label: 'My events' }}
          eyebrow="Manage event"
          title={ev.name}
          description={
            <span className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {fmtWhen(ev.startsAt)}</span>
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {ev.venue}</span>
            </span>
          }
          actions={<StatusBadge status={status} />}
        />

        {msg && (
          <div className={`flex gap-2 border px-3 py-2 text-sm ${msg.type === 'ok' ? 'border-success/25 bg-success/5 text-success' : 'border-danger/25 bg-danger/5 text-danger'}`} role="status">
            {msg.type === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
            <span className="flex-1">{msg.text}</span>
            <button onClick={() => setMsg(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        )}
        {justCreated && status === 'PENDING_REVIEW' && (
          <p className="border border-success/25 bg-success/5 px-3 py-2 text-sm text-success">Event submitted. BataMart will review it shortly and you will be notified.</p>
        )}
        {status === 'PENDING_REVIEW' && <p className="border border-warning/25 bg-warning/5 px-3 py-2 text-sm text-warning">Waiting for BataMart review. It is not public yet and tickets cannot be bought.</p>}
        {status === 'REJECTED' && (
          <p className="border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
            Rejected{ev.reviewNote ? `: ${ev.reviewNote}` : '.'} Fix the details below and save to send it for review again.
          </p>
        )}
        {status === 'PAUSED' && <p className="border border-warning/25 bg-warning/5 px-3 py-2 text-sm text-warning">BataMart paused this event. It is hidden and sales are stopped until it is resumed.</p>}
        {cancelled && <p className="border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">This event is cancelled. No refunds are issued.</p>}

        {/* Overview */}
        <section>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map(s => (
              <div key={s.label} className={`ui-card p-4 ${s.strong ? 'border-ink' : ''}`}>
                <p className="ui-mono ui-mono-sm text-ink-muted">{s.label}</p>
                <p className="mt-2 text-xl font-semibold text-ink">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href="/wallet" className={btnInk}><Wallet className="h-4 w-4" /> Withdraw earnings</Link>
            <p className="text-xs text-ink-muted">Ticket money reaches your wallet the moment it is paid.</p>
          </div>
        </section>

        {/* Ticket types */}
        <Section icon={Ticket} title="Ticket types" hint="Price, commission, capacity and sale windows can change any time and apply to future sales. Capacity cannot go below what is sold, and a ticket type with sales is switched off rather than deleted.">
          <div className="space-y-4">
            {tiers.map((tr, i) => {
              const live = tr.id ? data.tiers.find((x: any) => x.id === tr.id) : null
              return (
                <div key={tr.key}>
                  {live && (
                    <p className="mb-1 text-xs text-ink-muted">{live.sold} sold · {live.available} left right now{!live.isActive ? ' · not on sale' : ''}</p>
                  )}
                  <TierEditor
                    tier={tr} index={i} showActive
                    onChange={next => setTiers(prev => prev.map(x => (x.key === tr.key ? next : x)))}
                    onRemove={() => {
                      if (tr.id) setRemovedTierIds(prev => [...prev, tr.id!])
                      setTiers(prev => prev.filter(x => x.key !== tr.key))
                    }}
                    onError={m => flash('err', m)}
                    canRemove={!cancelled && tiers.length > 1 && !(tr.sold && tr.sold > 0)}
                  />
                </div>
              )
            })}
          </div>
          {!cancelled && (
            <div className="flex flex-wrap gap-3">
              <button className={btnGhost} onClick={() => setTiers(prev => [...prev, newTierDraft()])}><Plus className="h-4 w-4" /> Add ticket type</button>
              <button className={btnInk} disabled={busy === 'tiers'} onClick={saveTiers}>
                {busy === 'tiers' && <Loader2 className="h-4 w-4 animate-spin" />} Save ticket types
              </button>
            </div>
          )}
        </Section>

        {/* Details */}
        {!cancelled && (
          <Section icon={Info} title="Event details" hint={materialWarn}>
            <ImagePicker label="Flyer" value={d.flyerUrl} onChange={v => setD(p => ({ ...p, flyerUrl: v }))} onError={m => flash('err', m)} className="h-56 w-44" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Event name</label>
                <input className={field} value={d.name} maxLength={120} onChange={e => setD(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Venue</label>
                <input className={field} value={d.venue} maxLength={150} onChange={e => setD(p => ({ ...p, venue: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Address (optional)</label>
                <input className={field} value={d.address} maxLength={250} onChange={e => setD(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Starts</label>
                <input type="datetime-local" className={field} value={d.startsAt} onChange={e => setD(p => ({ ...p, startsAt: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Ends (optional)</label>
                <input type="datetime-local" className={field} value={d.endsAt} onChange={e => setD(p => ({ ...p, endsAt: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea className={`${field} h-28 py-3`} value={d.description} maxLength={2000} onChange={e => setD(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-3 text-sm text-ink">
              <input type="checkbox" checked={d.allowResale} onChange={e => setD(p => ({ ...p, allowResale: e.target.checked }))} />
              Let other sellers resell my tickets
            </label>
            <button className={btnInk} disabled={busy === 'details'} onClick={saveDetails}>
              {busy === 'details' && <Loader2 className="h-4 w-4 animate-spin" />} Save details
            </button>
          </Section>
        )}

        {/* Sellers */}
        <Section icon={Users} title="Sellers" hint="Where your sales came from. Direct sales are bought on your own event page. Unique sellers are people you named; everyone else who resells is a random seller.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="ui-mono ui-mono-sm border-b border-border text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Seller</th><th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 text-right font-medium">Sold</th><th className="py-2 pr-3 text-right font-medium">Sales</th>
                  <th className="py-2 pr-3 text-right font-medium">Commission</th><th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {data.sellers.length === 0 && <tr><td colSpan={6} className="py-4 text-ink-muted">No sales yet.</td></tr>}
                {data.sellers.map((s: any) => (
                  <tr key={`${s.kind}-${s.userId ?? 'direct'}`} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 text-ink">{s.username ? `@${s.username}` : s.name}</td>
                    <td className="py-2.5 pr-3"><Badge status={s.kind === 'UNIQUE' ? 'verified' : 'neutral'}>{s.kind.toLowerCase()}</Badge></td>
                    <td className="py-2.5 pr-3 text-right">{s.ticketsSold}</td>
                    <td className="py-2.5 pr-3 text-right">{fmtNaira(s.grossSales)}</td>
                    <td className="py-2.5 pr-3 text-right">{fmtNaira(s.commission)}</td>
                    <td className="py-2.5 text-right">
                      {s.kind === 'UNIQUE' && s.rowId && !cancelled && (
                        <button aria-label="Remove unique seller" disabled={busy === `sel-${s.rowId}`} onClick={() => act(`sel-${s.rowId}`, `${base}/sellers/${s.rowId}`, { method: 'DELETE' }, 'Unique seller removed.')}
                          className="p-1.5 text-ink-secondary hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!cancelled && (
            <div>
              <label className={labelCls}>Add a unique seller by username</label>
              <div className="flex gap-2">
                <input className={field} value={sellerName} onChange={e => setSellerName(e.target.value)} placeholder="username" maxLength={40}
                  onKeyDown={e => { if (e.key === 'Enter' && sellerName.trim()) addSeller() }} />
                <button className={btnInk} disabled={!sellerName.trim() || busy === 'seller-add'} onClick={addSeller}>
                  {busy === 'seller-add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-muted">They earn the &quot;your named sellers&quot; commission on each ticket type. Removing them later does not change past sales.</p>
            </div>
          )}
        </Section>

        {/* Checkers */}
        <Section icon={ScanLine} title="Door checkers" hint="Each checker gets a personal link by email and signs in with that email. Resending a link replaces the old one and signs them out. Deactivating stops them scanning immediately.">
          <ul className="divide-y divide-border border border-border">
            {data.checkers.length === 0 && <li className="p-3 text-sm text-ink-muted">No checkers yet.</li>}
            {data.checkers.map((c: any) => (
              <li key={c.id} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-all text-sm font-medium text-ink">{c.name ? `${c.name} · ` : ''}{c.email}</span>
                  <Badge status={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Active' : 'Off'}</Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  {c.lastLoginAt ? `Last signed in ${fmtShort(c.lastLoginAt)}` : 'Has not signed in yet'} · {c.scanCount} scans, {c.okCount} checked in
                </p>
                {!cancelled && (
                  <div className="flex flex-wrap gap-2">
                    <button className={btnGhost} disabled={busy === `re-${c.id}`} onClick={() => act(`re-${c.id}`, `${base}/checkers/${c.id}/resend`, post({}), 'A new link was emailed.',
                      j => { if (j.emailSent === false) flash('err', 'The new link was created but the email could not be sent. Try again shortly.') })}>
                      {busy === `re-${c.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Resend link
                    </button>
                    {c.isActive && (
                      <button className={btnGhost} disabled={busy === `de-${c.id}`} onClick={() => act(`de-${c.id}`, `${base}/checkers/${c.id}`, { method: 'DELETE' }, 'Checker deactivated.')}>
                        <UserX className="h-4 w-4" /> Deactivate
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!cancelled && (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <label className={labelCls}>Checker email</label>
                <input className={field} type="email" value={chEmail} onChange={e => setChEmail(e.target.value)} placeholder="door@gmail.com" maxLength={254} />
              </div>
              <div>
                <label className={labelCls}>Name (optional)</label>
                <input className={field} value={chName} onChange={e => setChName(e.target.value)} maxLength={60} />
              </div>
              <button className={btnInk} disabled={!chEmail.trim() || busy === 'checker-add'} onClick={addChecker}>
                {busy === 'checker-add' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
              </button>
            </div>
          )}
        </Section>

        {/* Purchases */}
        <Section icon={ReceiptText} title="Purchases" hint="Every paid order, newest first, with who sold it.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="ui-mono ui-mono-sm border-b border-border text-ink-muted">
                  <th className="py-2 pr-3 font-medium">When</th><th className="py-2 pr-3 font-medium">Buyer</th>
                  <th className="py-2 pr-3 font-medium">Ticket</th><th className="py-2 pr-3 font-medium">Sold by</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 && <tr><td colSpan={5} className="py-4 text-ink-muted">No purchases yet.</td></tr>}
                {purchases.map((p: any) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 text-ink-secondary">{fmtShort(p.createdAt)}</td>
                    <td className="max-w-[180px] truncate py-2.5 pr-3 text-ink">{p.buyerLabel.includes('@') ? p.buyerLabel : `@${p.buyerLabel}`}</td>
                    <td className="py-2.5 pr-3 text-ink">{p.quantity} x {p.tierName}</td>
                    <td className="py-2.5 pr-3">
                      {p.via === 'DIRECT' ? <Badge>Direct</Badge> : <span className="text-ink">@{p.via} <span className="text-ink-muted">({p.kind.toLowerCase()})</span></span>}
                    </td>
                    <td className="py-2.5 text-right font-medium text-ink">{fmtNaira(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pCursor && (
            <button className={btnGhost} onClick={loadMorePurchases} disabled={busy === 'more'}>
              {busy === 'more' && <Loader2 className="h-4 w-4 animate-spin" />} Load more
            </button>
          )}
        </Section>

        {/* Scan log */}
        <Section icon={ScanLine} title="Door scan log" hint="The latest 50 scans, good and bad.">
          {data.scans.length === 0 ? <p className="text-sm text-ink-muted">Nothing scanned yet.</p> : (
            <ul className="divide-y divide-border border border-border">
              {data.scans.map((s: any) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0 text-ink">{s.holder || 'Unknown holder'}{s.tierName ? ` · ${s.tierName}` : ''}</span>
                  <span className="flex items-center gap-2">
                    <Badge status={s.result === 'OK' ? 'success' : 'danger'}>{SCAN_LABEL[s.result] ?? s.result}</Badge>
                    <span className="text-xs text-ink-muted">{s.checker} · {fmtShort(s.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Audit */}
        <Section icon={History} title="Activity timeline" hint="Purchases, transfers, scans and changes in one place.">
          {audit === null ? <Loader2 className="h-5 w-5 animate-spin text-ink-muted" /> : audit.length === 0 ? <p className="text-sm text-ink-muted">No activity yet.</p> : (
            <ul className="space-y-0 border-l border-border">
              {audit.map((a, i) => (
                <li key={i} className="relative pb-4 pl-4 last:pb-0">
                  <span className="absolute -left-[3px] top-1.5 h-1.5 w-1.5 bg-ink" />
                  <p className="text-sm text-ink">{a.text}</p>
                  <p className="text-xs text-ink-muted">{fmtShort(a.at)}</p>
                </li>
              ))}
            </ul>
          )}
          {auditCursor && <button className={btnGhost} onClick={() => loadAudit(auditCursor)}>Load older</button>}
        </Section>

        {/* Cancel */}
        {!cancelled && (
          <section className="border border-danger/30 bg-danger/5 p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
              <div>
                <h2 className="text-base font-semibold text-danger">Cancel this event</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                  This stops all sales and makes every ticket unusable. <strong>BataMart does not refund tickets for a cancelled event.</strong> Buyers have already paid and the money is already in your wallet and your sellers&apos; wallets, so any refunds are between you and your guests. This cannot be undone.
                </p>
                <button className="mt-4 inline-flex h-10 items-center gap-2 border border-danger px-4 text-sm font-medium text-danger hover:bg-danger hover:text-white" onClick={() => { setCancelOpen(true); setCancelAck(false); setCancelText('') }}>
                  <Ban className="h-4 w-4" /> Cancel event
                </button>
              </div>
            </div>
          </section>
        )}
      </Shell>

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 bg-card p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-danger" />
              <div>
                <h3 className="text-lg font-semibold text-ink">Cancel &quot;{ev.name}&quot;?</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                  {t.ticketsSold} ticket{t.ticketsSold === 1 ? '' : 's'} sold. All holders will be notified that the event is cancelled. <strong>No refunds are issued by BataMart.</strong>
                </p>
              </div>
            </div>
            <label className="flex items-start gap-3 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={cancelAck} onChange={e => setCancelAck(e.target.checked)} />
              I understand ticket buyers will not be refunded by BataMart and this cannot be undone.
            </label>
            <div>
              <label className={labelCls}>Type CANCEL to confirm</label>
              <input className={field} value={cancelText} onChange={e => setCancelText(e.target.value)} autoCapitalize="characters" />
            </div>
            <div className="flex gap-3">
              <button className={`${btnGhost} flex-1`} onClick={() => setCancelOpen(false)}>Keep event</button>
              <button
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 bg-danger px-4 text-sm font-medium text-white disabled:opacity-40"
                disabled={!cancelAck || cancelText.trim().toUpperCase() !== 'CANCEL' || busy === 'cancel'}
                onClick={cancelEvent}
              >
                {busy === 'cancel' && <Loader2 className="h-4 w-4 animate-spin" />} Cancel event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
