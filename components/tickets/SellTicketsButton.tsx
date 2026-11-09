'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Store, X, Loader2, Copy, Share2, Check, Lock, Percent, CheckCircle2, AlertTriangle } from 'lucide-react'
import { authFetch } from '@/lib/auth-client'

export interface SellTicketsTier {
  name: string
  price: number
  randomCommissionPct?: number
  uniqueCommissionPct?: number
}

interface Props {
  eventId: string
  eventName: string
  allowResale: boolean
  hostId?: string
  tiers?: SellTicketsTier[]
  className?: string
}

const naira = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

/** "Sell these tickets" button for the public event page. Price is never an input. */
export default function SellTicketsButton({ eventId, eventName, allowResale, tiers = [], className }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  if (!allowResale) return null

  const currentPage = () => window.location.pathname + window.location.search

  const onPress = () => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(currentPage())}`)
      return
    }
    if (localStorage.getItem('userRole') !== 'SELLER') {
      router.push(`/become-seller?next=${encodeURIComponent(currentPage())}`)
      return
    }
    setError('')
    setLink('')
    setOpen(true)
  }

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await authFetch('/api/tickets/listings', {
        method: 'POST',
        body: JSON.stringify({ eventId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 403 && data.code === 'NOT_SELLER') {
        setOpen(false)
        router.push(`/become-seller?next=${encodeURIComponent(currentPage())}`)
        return
      }
      if (!res.ok) throw new Error(data.error || 'Could not list these tickets.')
      const path: string = typeof data.resaleLink === 'string' && data.resaleLink.startsWith('/') ? data.resaleLink : ''
      if (!path) throw new Error('Could not build your link. Open My tickets to find it.')
      setLink(`${window.location.origin}${path}`)
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Select the link and copy it manually.')
    }
  }

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: eventName, text: `Get tickets for ${eventName}`, url: link })
      } else {
        await copy()
      }
    } catch { /* user dismissed the share sheet */ }
  }

  const anyCommission = tiers.some((t) => (t.randomCommissionPct ?? 0) > 0 || (t.uniqueCommissionPct ?? 0) > 0)

  return (
    <>
      <button
        type="button"
        onClick={onPress}
        className={
          className ??
          'inline-flex h-11 w-full items-center justify-center gap-2 border border-border bg-card px-5 text-sm font-medium text-ink transition-colors hover:bg-surface sm:w-auto'
        }
      >
        <Store className="h-4 w-4" strokeWidth={1.75} /> Sell these tickets
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:px-4" onClick={() => !busy && setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sell these tickets"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full overflow-y-auto border border-border bg-card p-5 sm:max-w-md sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="ui-eyebrow mb-2">Resell</p>
                <h3 className="text-lg text-ink">{link ? 'You are selling this event' : 'Sell tickets for this event'}</h3>
                <p className="mt-1 truncate text-sm text-ink-secondary">{eventName}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close" className="flex-shrink-0 p-1 text-ink-muted hover:text-ink">
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            {link ? (
              <div className="space-y-4">
                <p className="flex items-start gap-2 text-sm text-ink-secondary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" strokeWidth={1.75} />
                  Share this link. When someone buys through it, your commission is paid to your wallet straight away.
                </p>
                <div className="break-all border border-border bg-surface px-3 py-2.5 font-mono text-xs text-ink">{link}</div>
                <div className="flex gap-3">
                  <button type="button" onClick={copy} className="inline-flex h-11 flex-1 items-center justify-center gap-2 border border-border text-sm font-medium text-ink hover:bg-surface">
                    {copied ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <button type="button" onClick={share} className="inline-flex h-11 flex-1 items-center justify-center gap-2 bg-primary text-sm font-medium text-white hover:brightness-95">
                    <Share2 className="h-4 w-4" strokeWidth={1.75} /> Share
                  </button>
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button type="button" onClick={() => router.push('/my-shop/tickets')} className="w-full text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary hover:text-ink">
                  View my ticket listings
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <ul className="space-y-3 text-sm text-ink-secondary">
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                    <span>The price cannot be changed. Buyers pay exactly what the host charges for each ticket type.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Percent className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                    <span>
                      The host sets your commission for each ticket type. If the host has named you a unique seller for this event,
                      you may earn more than other sellers.
                    </span>
                  </li>
                </ul>

                {anyCommission && (
                  <div className="divide-y divide-border border border-border">
                    {tiers.map((t) => {
                      const r = t.randomCommissionPct ?? 0
                      const u = t.uniqueCommissionPct ?? 0
                      return (
                        <div key={t.name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{t.name}</p>
                            <p className="text-xs text-ink-muted">{naira(t.price)} per ticket</p>
                          </div>
                          <div className="text-right text-xs text-ink-secondary">
                            <p><span className="font-semibold text-ink">{r}%</span> {r > 0 ? `(${naira(Math.floor((t.price * r) / 100))})` : ''}</p>
                            {u > r && <p className="text-ink-muted">up to {u}% if unique</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {error && (
                  <p className="flex items-start gap-2 text-sm text-danger">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} /> {error}
                  </p>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setOpen(false)} disabled={busy} className="h-11 flex-1 border border-border text-sm font-medium text-ink-secondary hover:bg-surface">
                    Cancel
                  </button>
                  <button type="button" onClick={confirm} disabled={busy} className="inline-flex h-11 flex-1 items-center justify-center gap-2 bg-primary text-sm font-medium text-white hover:brightness-95 disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" strokeWidth={1.75} />}
                    {busy ? 'Listing' : 'Start selling'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
