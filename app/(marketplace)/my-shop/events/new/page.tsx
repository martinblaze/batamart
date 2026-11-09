'use client'
// app/(marketplace)/my-shop/events/new/page.tsx — create an event.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Info, Users, ScanLine, AlertTriangle } from 'lucide-react'
import { Shell, PageHeader } from '@/components/ui/Shell'
import { authFetch } from '@/lib/auth-client'
import { MAX_CHECKERS_PER_EVENT, MAX_TIERS_PER_EVENT, MAX_UNIQUE_SELLERS_PER_EVENT } from '@/lib/tickets/config'
import {
  field, labelCls, btnInk, btnGhost, ImagePicker, TierEditor, newTierDraft, tierDraftError, tierDraftBody,
  fromLocalInput, type TierDraft,
} from '../_shared'

const splitList = (s: string) => Array.from(new Set(s.split(/[\s,;\n]+/).map(x => x.trim()).filter(Boolean)))

export default function NewEventPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [venue, setVenue] = useState('')
  const [address, setAddress] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [flyerUrl, setFlyerUrl] = useState('')
  const [allowResale, setAllowResale] = useState(true)
  const [tiers, setTiers] = useState<TierDraft[]>([newTierDraft()])
  const [checkers, setCheckers] = useState('')
  const [sellers, setSellers] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')

  const submit = async () => {
    setError(''); setCode('')
    if (name.trim().length < 3) return setError('Give the event a name of at least 3 characters.')
    if (!venue.trim()) return setError('Enter the venue.')
    if (!startsAt) return setError('Choose when the event starts.')
    if (new Date(startsAt).getTime() <= Date.now()) return setError('The event must start in the future.')
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) return setError('The end time must be after the start time.')
    if (!flyerUrl) return setError('Upload a flyer for the event.')
    for (const t of tiers) { const e = tierDraftError(t); if (e) return setError(e) }
    const names = tiers.map(t => t.name.trim().toLowerCase())
    if (new Set(names).size !== names.length) return setError('Two ticket types have the same name.')

    const checkerEmails = splitList(checkers).map(x => x.toLowerCase())
    const sellerUsernames = splitList(sellers).map(x => x.replace(/^@/, '').toLowerCase())

    setSaving(true)
    try {
      const res = await authFetch('/api/tickets/host/events', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          venue: venue.trim(),
          address: address.trim() || undefined,
          startsAt: fromLocalInput(startsAt),
          endsAt: fromLocalInput(endsAt) || undefined,
          flyerUrl,
          allowResale,
          tiers: tiers.map(t => {
            const b: any = tierDraftBody(t)
            delete b.id; delete b.isActive
            if (!b.description) delete b.description
            if (!b.imageUrl) delete b.imageUrl
            if (!b.saleStartsAt) delete b.saleStartsAt
            if (!b.saleEndsAt) delete b.saleEndsAt
            return b
          }),
          checkerEmails: checkerEmails.length ? checkerEmails : undefined,
          sellerUsernames: sellerUsernames.length ? sellerUsernames : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) { router.push(`/login?redirect=${encodeURIComponent('/my-shop/events/new')}`); return }
      if (!res.ok) { setError(data.error || 'Could not create the event'); setCode(data.code || ''); return }
      router.push(`/my-shop/events/${data.id}?created=1`)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-28">
      <Shell width="reading" className="space-y-6 pt-8">
        <PageHeader
          back={{ href: '/my-shop/events', label: 'My events' }}
          eyebrow="New event"
          title="List an event"
          description="BataMart reviews every event before it goes public. You can add tickets, checkers and sellers now or later."
        />

        {/* Basics */}
        <section className="ui-panel space-y-5">
          <h2 className="text-base font-semibold text-ink">The event</h2>
          <ImagePicker label="Flyer" value={flyerUrl} onChange={setFlyerUrl} onError={setError} className="h-56 w-44" />
          <div>
            <label className={labelCls}>Event name</label>
            <input className={field} value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. Freshers Night 2026" />
          </div>
          <div>
            <label className={labelCls}>Description (optional)</label>
            <textarea className={`${field} h-28 py-3`} value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} placeholder="Line-up, dress code, what guests should know" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Venue</label>
              <input className={field} value={venue} onChange={e => setVenue(e.target.value)} maxLength={150} placeholder="e.g. Amphitheatre, UNIZIK" />
            </div>
            <div>
              <label className={labelCls}>Address or directions (optional)</label>
              <input className={field} value={address} onChange={e => setAddress(e.target.value)} maxLength={250} />
            </div>
            <div>
              <label className={labelCls}>Starts</label>
              <input type="datetime-local" className={field} value={startsAt} onChange={e => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Ends (optional)</label>
              <input type="datetime-local" className={field} value={endsAt} onChange={e => setEndsAt(e.target.value)} />
            </div>
          </div>
        </section>

        {/* Tiers */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Ticket types</h2>
            <p className="mt-1 text-sm text-ink-secondary">Regular, VIP, table and so on. You can add up to {MAX_TIERS_PER_EVENT}.</p>
          </div>
          {tiers.map((t, i) => (
            <TierEditor
              key={t.key} tier={t} index={i}
              onChange={next => setTiers(prev => prev.map(x => (x.key === t.key ? next : x)))}
              onRemove={() => setTiers(prev => prev.filter(x => x.key !== t.key))}
              onError={setError}
              canRemove={tiers.length > 1}
            />
          ))}
          {tiers.length < MAX_TIERS_PER_EVENT && (
            <button type="button" className={btnGhost} onClick={() => setTiers(prev => [...prev, newTierDraft()])}>
              <Plus className="h-4 w-4" /> Add another ticket type
            </button>
          )}
        </section>

        {/* Resale + sellers */}
        <section className="ui-panel space-y-5">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-secondary" />
            <div>
              <h2 className="text-base font-semibold text-ink">Sellers</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                Any BataMart seller can put your tickets in their shop and sell them at your price. They earn the &quot;any seller&quot; commission you set above, paid from your share.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm text-ink">
            <input type="checkbox" checked={allowResale} onChange={e => setAllowResale(e.target.checked)} />
            Let other sellers resell my tickets
          </label>
          <div>
            <label className={labelCls}>Unique sellers (optional, usernames)</label>
            <textarea className={`${field} h-20 py-3`} value={sellers} onChange={e => setSellers(e.target.value)} placeholder="chidi, amaka, @tolu" />
            <p className="mt-2 flex gap-2 text-xs leading-relaxed text-ink-muted">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              A unique seller is someone you name, such as a campus rep. Their sales are tracked separately for you and they earn the &quot;your named sellers&quot; commission instead. Separate usernames with commas. Up to {MAX_UNIQUE_SELLERS_PER_EVENT}. Each must be an existing BataMart user.
            </p>
          </div>
        </section>

        {/* Checkers */}
        <section className="ui-panel space-y-4">
          <div className="flex items-start gap-3">
            <ScanLine className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-secondary" />
            <div>
              <h2 className="text-base font-semibold text-ink">Door checkers</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
                Checkers scan guests&apos; QR codes at the entrance. Each one gets an emailed link, and signs in by typing that same email. Their access works for this event only.
              </p>
            </div>
          </div>
          <div>
            <label className={labelCls}>Checker emails (optional)</label>
            <textarea className={`${field} h-20 py-3`} value={checkers} onChange={e => setCheckers(e.target.value)} placeholder="door1@gmail.com, door2@gmail.com" />
            <p className="mt-2 text-xs text-ink-muted">Up to {MAX_CHECKERS_PER_EVENT}. You can add more after creating the event.</p>
          </div>
        </section>

        {error && (
          <div className="flex gap-2 border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              {error}
              {code === 'USERNAME_REQUIRED' && <Link href="/myprofile" className="ml-2 underline">Set a username</Link>}
              {code === 'NOT_SELLER' && <Link href="/become-seller" className="ml-2 underline">Become a seller</Link>}
            </div>
          </div>
        )}

        <button onClick={submit} disabled={saving} className={`${btnInk} w-full`}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit for review
        </button>
      </Shell>
    </div>
  )
}
