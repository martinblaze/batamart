'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Share2, Loader2 } from 'lucide-react'
import { Shell, PageHeader } from '@/components/ui/Shell'
import { authFetch } from '@/lib/auth-client'

// Must match REFERRAL_DELIVERY_REWARD in lib/referral/processReferralReward.ts.
const PER_ORDER = 120
const GOAL = 10_000
const ORDERS_FOR_GOAL = Math.ceil(GOAL / PER_ORDER) // 84

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`

export default function EarnPage() {
  const [friends, setFriends] = useState(10)
  const [orders, setOrders] = useState(2)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [link, setLink] = useState('')
  const [earned, setEarned] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    setLoggedIn(!!token)
    if (!token) return
    authFetch('/api/referrals')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        setCode(d.referralCode ?? '')
        setLink(d.referralLink ?? '')
        setEarned(d.totalEarnings ?? 0)
      })
      .catch(() => {})
  }, [])

  const total = friends * orders * PER_ORDER
  const progress = Math.min(100, (total / GOAL) * 100)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link || code)
    } catch {
      window.prompt('Copy your link:', link || code)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Shop on BataMart, the campus marketplace for Awka, and get it delivered to your hostel.\nJoin with my link: ${link}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Shell width="narrow" className="space-y-8 pt-10">
        <PageHeader
          eyebrow="Earn on BataMart"
          title="Earn up to ₦10,000 a week"
          description="Here is exactly how, with the real numbers. No tricks, no sign-up fee."
        />

        <section className="ui-panel p-6">
          <p className="ui-mono ui-mono-sm mb-5 text-ink-muted">How it works</p>
          <ol className="space-y-5">
            {[
              ['Share your code', 'Every BataMart account already has one. Send it to friends, course mates and your hostel group.'],
              ['They sign up and order', 'Your friend joins with your code and orders from anyone on campus.'],
              [`You earn ${naira(PER_ORDER)}`, 'When their order is delivered, the money lands in your wallet. Each delivered order pays you, and there is no limit.'],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4">
                <span className="ui-figure flex h-7 w-7 flex-shrink-0 items-center justify-center border border-border text-sm text-ink">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-ink">{title}</p>
                  <p className="mt-0.5 text-sm text-ink-secondary">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ui-panel p-6">
          <p className="ui-mono ui-mono-sm mb-5 text-ink-muted">Work out your week</p>

          <label className="flex items-center justify-between text-sm text-ink">
            <span>Friends who order</span>
            <span className="ui-figure">{friends}</span>
          </label>
          <input type="range" min={1} max={60} value={friends} onChange={e => setFriends(Number(e.target.value))} className="mt-2 w-full accent-[#131311]" />

          <label className="mt-5 flex items-center justify-between text-sm text-ink">
            <span>Orders each, this week</span>
            <span className="ui-figure">{orders}</span>
          </label>
          <input type="range" min={1} max={5} value={orders} onChange={e => setOrders(Number(e.target.value))} className="mt-2 w-full accent-[#131311]" />

          <div className="mt-6 border-t border-border pt-5">
            <p className="ui-figure text-4xl text-ink">{naira(total)}</p>
            <p className="mt-1 text-xs text-ink-secondary">
              {friends} friends x {orders} order{orders > 1 ? 's' : ''} x {naira(PER_ORDER)}
            </p>
            <div className="mt-4 h-1.5 w-full bg-border">
              <div className="h-full bg-ink transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-xs text-ink-secondary">
              {total >= GOAL
                ? `That reaches ${naira(GOAL)}.`
                : `${naira(GOAL)} takes ${ORDERS_FOR_GOAL} delivered orders in a week, for example ${Math.ceil(ORDERS_FOR_GOAL / 3)} friends ordering 3 times. Most weeks you will earn less, and it adds up the more friends you bring.`}
            </p>
          </div>
        </section>

        <section className="ui-panel p-6">
          <p className="ui-mono ui-mono-sm mb-4 text-ink-muted">Your code</p>
          {loggedIn === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
          ) : loggedIn ? (
            <>
              <p className="ui-figure text-3xl tracking-wider text-ink">{code || '...'}</p>
              {earned > 0 && <p className="mt-2 text-sm text-ink-secondary">You have earned {naira(earned)} so far.</p>}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={copy} disabled={!code} className="flex h-11 items-center justify-center gap-2 border border-border bg-card text-sm font-medium text-ink disabled:opacity-50">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}
                </button>
                <button onClick={shareWhatsApp} disabled={!link} className="flex h-11 items-center justify-center gap-2 bg-ink text-sm font-medium text-background disabled:opacity-50">
                  <Share2 className="h-4 w-4" /> WhatsApp
                </button>
              </div>
              <Link href="/referrals" className="ui-mono ui-mono-sm mt-5 inline-block text-ink-secondary hover:text-ink">See my referrals and earnings</Link>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-secondary">Sign in to get your code and start earning.</p>
              <Link href="/login?redirect=/earn" className="mt-4 flex h-11 items-center justify-center bg-ink text-sm font-medium text-background">Sign in to get my code</Link>
            </>
          )}
        </section>

        <p className="text-xs text-ink-muted">
          Rewards are paid when the order is delivered and confirmed. One order is one vendor, so two items from the same vendor pay once and items from different vendors pay separately.
        </p>
      </Shell>
    </div>
  )
}
