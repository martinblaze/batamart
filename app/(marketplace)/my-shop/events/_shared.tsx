'use client'
// Pieces shared by the host event pages (list, create, manage).

import { useState } from 'react'
import { Loader2, Plus, X, Clock, CheckCircle2, XCircle, PauseCircle, Ban, ImagePlus } from 'lucide-react'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'
import { authFetch } from '@/lib/auth-client'
import { MAX_COMMISSION_PCT, MAX_TICKET_PRICE, MIN_TICKET_PRICE, PLATFORM_FEE_PCT } from '@/lib/tickets/config'

export const field = 'h-11 w-full border border-border bg-card px-3 text-sm text-ink outline-none focus:border-ink/40'
export const labelCls = 'ui-mono ui-mono-sm mb-2 block text-ink-muted'
export const btnInk = 'inline-flex h-11 items-center justify-center gap-2 bg-ink px-5 text-sm font-medium text-background disabled:opacity-50'
export const btnGhost = 'inline-flex h-10 items-center justify-center gap-2 border border-border bg-card px-4 text-sm font-medium text-ink hover:border-ink/40 disabled:opacity-50'

export const fmtNaira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
export const fmtWhen = (d: string | Date) =>
  new Date(d).toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
export const fmtShort = (d: string | Date) =>
  new Date(d).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** ISO -> value for <input type="datetime-local"> in the viewer's own timezone. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null)

export type EventStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'PAUSED' | 'CANCELLED'

const STATUS: Record<EventStatus, { label: string; status: BadgeStatus; icon: any }> = {
  PENDING_REVIEW: { label: 'Pending review', status: 'warning', icon: Clock },
  ACTIVE: { label: 'Live', status: 'success', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', status: 'danger', icon: XCircle },
  PAUSED: { label: 'Paused', status: 'neutral', icon: PauseCircle },
  CANCELLED: { label: 'Cancelled', status: 'danger', icon: Ban },
}

export function StatusBadge({ status }: { status: EventStatus }) {
  const s = STATUS[status] ?? STATUS.PENDING_REVIEW
  return <Badge status={s.status} icon={s.icon}>{s.label}</Badge>
}

/** Same upload route the product listing uses (Cloudinary, moderated). */
export async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const res = await authFetch('/api/upload', { method: 'POST', body: JSON.stringify({ image: base64 }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data.url as string
}

export function ImagePicker({
  value, onChange, onError, label, className = 'h-40 w-full sm:w-72',
}: { value: string; onChange: (url: string) => void; onError: (m: string) => void; label: string; className?: string }) {
  const [busy, setBusy] = useState(false)
  const pick = async (f: File | null) => {
    if (!f) return
    setBusy(true)
    try { onChange(await uploadImage(f)) } catch (e: any) { onError(e.message || 'Upload failed') } finally { setBusy(false) }
  }
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {value ? (
        <div className={`relative border border-border bg-surface ${className}`}>
          <img src={value} alt="" className="h-full w-full object-cover" />
          <button type="button" onClick={() => onChange('')} aria-label="Remove image"
            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center bg-ink text-background">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-border text-ink-muted hover:border-ink/40 ${className}`}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-xs">{busy ? 'Uploading...' : 'Tap to upload'}</span>
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={e => { pick(e.target.files?.[0] || null); e.target.value = '' }} />
        </label>
      )}
    </div>
  )
}

export interface TierDraft {
  key: string
  id?: string
  name: string
  description: string
  imageUrl: string
  price: string
  capacity: string
  randomPct: string
  uniquePct: string
  saleStartsAt: string
  saleEndsAt: string
  isActive: boolean
  sold?: number
}

export const newTierDraft = (): TierDraft => ({
  key: Math.random().toString(36).slice(2),
  name: '', description: '', imageUrl: '', price: '', capacity: '', randomPct: '0', uniquePct: '0',
  saleStartsAt: '', saleEndsAt: '', isActive: true,
})

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))

/** Returns an error message for a draft, or null if it is ready to send. */
export function tierDraftError(t: TierDraft): string | null {
  const label = t.name.trim() || 'A ticket type'
  if (!t.name.trim()) return 'Every ticket type needs a name.'
  const price = num(t.price), cap = num(t.capacity), rp = num(t.randomPct), up = num(t.uniquePct)
  if (!Number.isInteger(price) || price < MIN_TICKET_PRICE || price > MAX_TICKET_PRICE) return `${label}: price must be between ${fmtNaira(MIN_TICKET_PRICE)} and ${fmtNaira(MAX_TICKET_PRICE)}.`
  if (!Number.isInteger(cap) || cap < 1) return `${label}: enter how many tickets you have.`
  if (t.sold !== undefined && cap < t.sold) return `${label}: ${t.sold} already sold, so capacity cannot be lower.`
  for (const p of [rp, up]) if (!Number.isInteger(p) || p < 0 || p > MAX_COMMISSION_PCT) return `${label}: commission must be 0 to ${MAX_COMMISSION_PCT} percent.`
  if (t.saleStartsAt && t.saleEndsAt && new Date(t.saleEndsAt) <= new Date(t.saleStartsAt)) return `${label}: sales must close after they open.`
  return null
}

export function tierDraftBody(t: TierDraft) {
  return {
    ...(t.id ? { id: t.id } : {}),
    name: t.name.trim(),
    description: t.description.trim() || null,
    imageUrl: t.imageUrl || null,
    price: Number(t.price),
    capacity: Number(t.capacity),
    randomCommissionPct: Number(t.randomPct),
    uniqueCommissionPct: Number(t.uniquePct),
    saleStartsAt: fromLocalInput(t.saleStartsAt),
    saleEndsAt: fromLocalInput(t.saleEndsAt),
    isActive: t.isActive,
  }
}

export function TierEditor({
  tier, index, onChange, onRemove, onError, canRemove, showActive,
}: {
  tier: TierDraft
  index: number
  onChange: (t: TierDraft) => void
  onRemove?: () => void
  onError: (m: string) => void
  canRemove: boolean
  showActive?: boolean
}) {
  const set = (patch: Partial<TierDraft>) => onChange({ ...tier, ...patch })
  const price = Number(tier.price)
  const rp = Number(tier.randomPct) || 0
  const up = Number(tier.uniquePct) || 0
  const fee = Number.isFinite(price) ? Math.round((price * PLATFORM_FEE_PCT) / 100) : 0
  const youGet = (pct: number) => (Number.isFinite(price) && price > 0 ? price - fee - Math.floor((price * pct) / 100) : 0)

  return (
    <div className="space-y-4 border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="ui-mono ui-mono-sm text-ink-secondary">
          Ticket type {index + 1}{tier.sold ? ` · ${tier.sold} sold` : ''}
        </p>
        <div className="flex items-center gap-3">
          {showActive && tier.id && (
            <label className="flex items-center gap-2 text-xs text-ink-secondary">
              <input type="checkbox" checked={tier.isActive} onChange={e => set({ isActive: e.target.checked })} />
              On sale
            </label>
          )}
          {canRemove && onRemove && (
            <button type="button" onClick={onRemove} className="flex h-8 w-8 items-center justify-center border border-border text-ink-secondary hover:text-danger" aria-label="Remove ticket type">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Name</label>
          <input className={field} value={tier.name} onChange={e => set({ name: e.target.value })} maxLength={40} placeholder="Regular, VIP, Table for 4" />
        </div>
        <div>
          <label className={labelCls}>Short description (optional)</label>
          <input className={field} value={tier.description} onChange={e => set({ description: e.target.value })} maxLength={200} placeholder="What this ticket includes" />
        </div>
        <div>
          <label className={labelCls}>Price (₦)</label>
          <input className={field} inputMode="numeric" value={tier.price} onChange={e => set({ price: e.target.value.replace(/\D/g, '') })} placeholder={`From ${MIN_TICKET_PRICE}`} />
        </div>
        <div>
          <label className={labelCls}>Tickets available</label>
          <input className={field} inputMode="numeric" value={tier.capacity} onChange={e => set({ capacity: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 200" />
        </div>
        <div>
          <label className={labelCls}>Sales open (optional)</label>
          <input type="datetime-local" className={field} value={tier.saleStartsAt} onChange={e => set({ saleStartsAt: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Sales close (optional)</label>
          <input type="datetime-local" className={field} value={tier.saleEndsAt} onChange={e => set({ saleEndsAt: e.target.value })} />
        </div>
      </div>

      <div className="border border-border bg-surface p-3">
        <p className="mb-3 text-xs leading-relaxed text-ink-secondary">
          Commission is what a seller earns when they resell this ticket. It comes out of your share, never on top of the price. BataMart keeps {PLATFORM_FEE_PCT}%.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Any seller (percent, max {MAX_COMMISSION_PCT})</label>
            <input className={field} inputMode="numeric" value={tier.randomPct} onChange={e => set({ randomPct: e.target.value.replace(/\D/g, '') })} />
            {price > 0 && <p className="mt-1 text-xs text-ink-muted">You keep {fmtNaira(youGet(rp))} per ticket</p>}
          </div>
          <div>
            <label className={labelCls}>Your named sellers (percent, max {MAX_COMMISSION_PCT})</label>
            <input className={field} inputMode="numeric" value={tier.uniquePct} onChange={e => set({ uniquePct: e.target.value.replace(/\D/g, '') })} />
            {price > 0 && <p className="mt-1 text-xs text-ink-muted">You keep {fmtNaira(youGet(up))} per ticket</p>}
          </div>
        </div>
      </div>

      <ImagePicker label="Ticket image (optional)" value={tier.imageUrl} onChange={url => set({ imageUrl: url })} onError={onError} className="h-28 w-40" />
    </div>
  )
}

export { Plus }
