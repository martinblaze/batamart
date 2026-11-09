'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertCircle, AtSign, CalendarDays, CreditCard, Loader2, Mail, MapPin, Minus, Plus, ShieldCheck, Ticket, UserRound, Wallet,
} from 'lucide-react'
import { PageHeader } from '@/components/marketplace/DetailChrome'
import SellTicketsButton from '@/components/tickets/SellTicketsButton'
import { formatWhen, naira } from '@/components/tickets/ticket-format'

interface EventInfo {
  id: string; name: string; description: string | null; venue: string; address: string | null
  startsAt: string; endsAt: string | null; flyerUrl: string | null
  hostId: string; hostName: string; hostUsername: string | null; allowResale: boolean; isOver: boolean
}
interface Tier {
  id: string; name: string; description: string | null; imageUrl: string | null
  price: number; available: number; saleOpen: boolean; saleMessage: string | null
}
interface Me { username: string | null; email: string | null; balance: number; hasPin: boolean }

const MAX_QTY = 10

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [event, setEvent] = useState<EventInfo | null>(null)
  const [tiers, setTiers] = useState<Tier[]>([])
  const [reseller, setReseller] = useState<{ id: string; name: string; username: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [paymentFailed, setPaymentFailed] = useState(false)

  const [me, setMe] = useState<Me | null>(null)
  const [signedIn, setSignedIn] = useState(false)

  const [tierId, setTierId] = useState('')
  const [qty, setQty] = useState(1)
  const [email, setEmail] = useState('')
  const [method, setMethod] = useState<'CARD' | 'WALLET'>('CARD')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const submitting = useRef(false)
  const refParam = useRef('')

  const loadEvent = useCallback(async () => {
    try {
      const ref = refParam.current
      const res = await fetch(`/api/tickets/events/${encodeURIComponent(id)}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`)
      const data = await res.json()
      if (!res.ok) { setLoadError(res.status === 404 ? 'This event is not available.' : data.error || 'Could not load this event.'); return }
      setEvent(data.event)
      setTiers(data.tiers)
      setReseller(data.reseller)
      setTierId(prev => prev || data.tiers.find((t: Tier) => t.saleOpen)?.id || '')
    } catch {
      setLoadError('Could not load this event. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    refParam.current = sp.get('ref') ?? ''
    if (sp.get('payment') === 'failed') {
      setPaymentFailed(true)
      window.history.replaceState({}, '', `/events/${id}${refParam.current ? `?ref=${encodeURIComponent(refParam.current)}` : ''}`)
    }
    loadEvent()

    const token = localStorage.getItem('token')
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (!d?.user) return
          setSignedIn(true)
          setMe({
            username: d.user.username ?? null,
            email: d.user.email ?? null,
            balance: Number(d.user.availableBalance ?? 0),
            hasPin: !!d.user.hasWithdrawalPin,
          })
        })
        .catch(() => {})
    }
  }, [id, loadEvent])

  const tier = tiers.find(t => t.id === tierId) ?? null
  const maxQty = tier ? Math.max(1, Math.min(MAX_QTY, tier.available)) : 1
  useEffect(() => { if (qty > maxQty) setQty(maxQty) }, [maxQty, qty])

  const total = tier ? tier.price * qty : 0
  const needsUsername = signedIn && me && !me.username
  const canUseWallet = signedIn && !!me?.username
  const walletShort = canUseWallet && me ? me.balance < total : false
  const payWithWallet = canUseWallet && method === 'WALLET'

  const buy = async () => {
    if (submitting.current || !tier || !event) return
    setError(''); setErrorCode('')
    if (!signedIn && !/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter the email address your ticket should be sent to.'); return }
    if (payWithWallet && me?.hasPin && !/^\d{6}$/.test(pin)) { setError('Enter your 6-digit wallet PIN.'); return }

    submitting.current = true
    setBusy(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/tickets/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(signedIn && token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          eventId: event.id, tierId: tier.id, quantity: qty,
          method: payWithWallet ? 'WALLET' : 'CARD',
          ...(signedIn ? {} : { email: email.trim() }),
          ...(reseller ? { resellerId: reseller.id } : {}),
          ...(payWithWallet && me?.hasPin ? { pin } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not complete your purchase.')
        setErrorCode(data.code || '')
        if (data.code === 'SOLD_OUT' || res.status === 409) loadEvent()
        return
      }
      if (data.authorizationUrl) { window.location.href = data.authorizationUrl; return }
      if (data.ok && data.purchaseId) { router.push(`/tickets?purchase=${data.purchaseId}&paid=1`); return }
      setError('Unexpected response. Please try again.')
    } catch {
      setError('Could not reach BataMart. Check your connection and try again.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-surface"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }
  if (loadError || !event) {
    return (
      <div className="min-h-screen bg-surface">
        <PageHeader title="Event" back="/events" />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <Ticket className="mx-auto h-10 w-10 text-ink-muted" strokeWidth={1.25} />
          <p className="mt-3 font-semibold text-ink">{loadError || 'Event not found'}</p>
          <Link href="/events" className="mt-4 inline-block text-sm font-semibold text-primary">Browse events</Link>
        </div>
      </div>
    )
  }

  const anyOpen = tiers.some(t => t.saleOpen)

  return (
    <div className="min-h-screen bg-surface pb-32">
      <PageHeader eyebrow="Event" title={event.name} back="/events" />

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Flyer */}
        <div>
          <div className="overflow-hidden border border-border bg-card">
            {event.flyerUrl
              ? <img src={event.flyerUrl} alt={event.name} className="w-full object-cover" />
              : <div className="flex aspect-[4/5] items-center justify-center bg-surface"><Ticket className="h-14 w-14 text-ink-muted" strokeWidth={1.25} /></div>}
          </div>
        </div>

        <div className="space-y-6">
          <section className="border border-border bg-card p-5">
            <h1 className="text-xl font-semibold leading-snug text-ink sm:text-2xl">{event.name}</h1>
            <div className="mt-4 space-y-2.5 text-sm text-ink-secondary">
              <p className="flex items-start gap-2.5"><CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" />{formatWhen(event.startsAt)}</p>
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" />
                <span>{event.venue}{event.address ? `, ${event.address}` : ''}</span>
              </p>
              <p className="flex items-start gap-2.5"><UserRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" />Hosted by {event.hostName}{event.hostUsername ? ` (@${event.hostUsername})` : ''}</p>
            </div>
            {event.description && <p className="mt-4 whitespace-pre-line border-t border-border pt-4 text-sm leading-relaxed text-ink-secondary">{event.description}</p>}
          </section>

          {reseller && (
            <div className="flex items-start gap-2.5 border border-border bg-card p-4 text-sm text-ink-secondary">
              <AtSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <span>You are buying through <strong className="text-ink">{reseller.name}</strong>{reseller.username ? ` (@${reseller.username})` : ''}. The price is the same as buying from the host.</span>
            </div>
          )}

          {paymentFailed && (
            <div className="flex items-start gap-2.5 border border-danger/40 bg-danger/10 p-4 text-sm text-ink">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
              <span>Your payment did not go through, so you have not been charged. You can try again below.</span>
            </div>
          )}

          {/* Tiers */}
          <section>
            <p className="ui-eyebrow mb-3">Choose a ticket</p>
            {tiers.length === 0 ? (
              <p className="border border-border bg-card p-5 text-sm text-ink-secondary">No tickets are on sale for this event yet.</p>
            ) : (
              <div className="space-y-2.5" role="radiogroup" aria-label="Ticket type">
                {tiers.map(t => {
                  const selected = t.id === tierId
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!t.saleOpen}
                      onClick={() => setTierId(t.id)}
                      className={`flex w-full items-stretch gap-3 border bg-card p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-ink/25'}`}
                    >
                      {t.imageUrl && <img src={t.imageUrl} alt="" className="h-16 w-16 flex-shrink-0 object-cover" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{t.name}</p>
                        {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">{t.description}</p>}
                        <p className="mt-1 text-xs text-ink-muted">
                          {!t.saleOpen ? t.saleMessage : t.available <= 10 ? `Only ${t.available} left` : `${t.available} available`}
                        </p>
                      </div>
                      <p className="ui-figure flex-shrink-0 self-center text-lg text-ink">{naira(t.price)}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {tier && tier.saleOpen && (
            <section className="space-y-5 border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">Quantity</span>
                <div className="flex items-center border border-border">
                  <button type="button" aria-label="Fewer tickets" onClick={() => setQty(q => Math.max(1, q - 1))} disabled={qty <= 1}
                    className="flex h-11 w-11 items-center justify-center text-ink disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                  <span className="ui-figure w-10 text-center text-base text-ink">{qty}</span>
                  <button type="button" aria-label="More tickets" onClick={() => setQty(q => Math.min(maxQty, q + 1))} disabled={qty >= maxQty}
                    className="flex h-11 w-11 items-center justify-center text-ink disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                </div>
              </div>

              {!signedIn ? (
                <div>
                  <label className="block">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink"><Mail className="h-4 w-4 text-ink-muted" /> Your email</span>
                    <input
                      type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="mt-2 h-12 w-full border border-border bg-surface px-4 text-base text-ink outline-none focus:border-primary"
                    />
                  </label>
                  <p className="mt-2 text-xs text-ink-secondary">
                    Your ticket link is sent to this email after payment, so use a real address you can open. Temporary emails are not accepted.
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    Have an account? <Link href={`/login?redirect=${encodeURIComponent(`/events/${id}${refParam.current ? `?ref=${refParam.current}` : ''}`)}`} className="font-semibold text-primary">Sign in</Link> to pay from your wallet and keep your tickets in your account.
                  </p>
                </div>
              ) : needsUsername ? (
                <div className="flex items-start gap-2.5 border border-warning/40 bg-warning/10 p-3.5 text-sm text-ink">
                  <AtSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                  <span>
                    Set a username in your profile before buying tickets. It lets friends send you tickets and lets the host see who bought.{' '}
                    <Link href="/myprofile" className="font-semibold text-primary">Set username</Link>
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-medium text-ink">Pay with</span>
                  <div className="mt-2 grid grid-cols-2 gap-2.5">
                    <button type="button" onClick={() => setMethod('WALLET')}
                      className={`flex flex-col items-start gap-1 border p-3 text-left ${method === 'WALLET' ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-ink/25'}`}>
                      <Wallet className="h-4 w-4 text-ink-muted" />
                      <span className="text-sm font-semibold text-ink">Wallet</span>
                      <span className="text-xs text-ink-secondary">{naira(me?.balance ?? 0)}</span>
                    </button>
                    <button type="button" onClick={() => setMethod('CARD')}
                      className={`flex flex-col items-start gap-1 border p-3 text-left ${method === 'CARD' ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-ink/25'}`}>
                      <CreditCard className="h-4 w-4 text-ink-muted" />
                      <span className="text-sm font-semibold text-ink">Card or transfer</span>
                      <span className="text-xs text-ink-secondary">Secure checkout</span>
                    </button>
                  </div>
                  {method === 'WALLET' && walletShort && (
                    <p className="mt-2 text-xs text-danger">Your wallet balance is too low. <Link href="/wallet" className="font-semibold underline">Top up</Link> or pay by card.</p>
                  )}
                  {method === 'WALLET' && me?.hasPin && (
                    <label className="mt-3 block">
                      <span className="text-sm font-medium text-ink">Wallet PIN</span>
                      <input
                        type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit PIN"
                        className="mt-2 h-12 w-full border border-border bg-surface px-4 text-base tracking-[0.3em] text-ink outline-none focus:border-primary"
                      />
                    </label>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 text-sm text-danger" role="alert">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    {error}{' '}
                    {errorCode === 'USERNAME_REQUIRED' && <Link href="/myprofile" className="font-semibold underline">Set username</Link>}
                    {errorCode === 'INSUFFICIENT_BALANCE' && <Link href="/wallet" className="font-semibold underline">Top up</Link>}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-ink-secondary">Total</span>
                <span className="ui-figure text-2xl text-ink">{naira(total)}</span>
              </div>
              <button
                type="button" onClick={buy} disabled={busy || !!needsUsername || (payWithWallet && walletShort)}
                className="flex h-12 w-full items-center justify-center gap-2 bg-primary text-[15px] font-semibold text-white transition hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing</> : <><Ticket className="h-4 w-4" /> {payWithWallet ? 'Pay from wallet' : 'Continue to payment'}</>}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted"><ShieldCheck className="h-3.5 w-3.5" /> No refunds once paid. Tickets are issued instantly.</p>
            </section>
          )}

          {tiers.length > 0 && !anyOpen && !tier && (
            <p className="border border-border bg-card p-4 text-center text-sm text-ink-secondary">Tickets are not on sale right now.</p>
          )}

          {/* Resale slot (component owned by the Resale feature). */}
          <SellTicketsButton
            eventId={event.id}
            eventName={event.name}
            allowResale={event.allowResale}
            hostId={event.hostId}
            tiers={tiers.map(t => ({ name: t.name, price: t.price }))}
          />
        </div>
      </div>
    </div>
  )
}
