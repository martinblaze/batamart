// app/(marketplace)/field-marketers/page.tsx
// Unlisted page: nothing in the app links here. Reached by direct URL only.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check, Copy, Crown, Flame, Gift, Loader2, Medal, Megaphone, Share2,
  Trophy, Users, Wallet, Zap,
} from 'lucide-react'
import { Shell, PageHeader } from '@/components/ui/Shell'

interface MarketerStats {
  joined: true
  link: string
  code: string
  payPerSignup: number
  totalSignups: number
  totalEarned: number
  availableBalance: number
  signupsToday: number
  signupsThisWeek: number
  rank: number
  tier: 'none' | 'broke-the-scale' | 'god-mode'
  milestone: string | null
  encouragement: { tone: string; message: string; signupsLeft: number }
  recent: { id: string; name: string; amount: number; at: string }[]
}

interface BoardEntry { rank: number; name: string; signups: number; isYou: boolean }

const naira = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const LOGIN_REDIRECT = `/login?redirect=${encodeURIComponent('/field-marketers')}`

export default function FieldMarketersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<MarketerStats | null>(null)
  const [board, setBoard] = useState<BoardEntry[]>([])
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) { router.push(LOGIN_REDIRECT); return }
    const headers = { Authorization: `Bearer ${token}` }
    try {
      const res = await fetch('/api/field-marketer/me', { headers })
      if (res.status === 401) { router.push(LOGIN_REDIRECT); return }
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to load'); return }
      if (data.joined) {
        setStats(data)
        const lb = await fetch('/api/field-marketer/leaderboard', { headers })
        if (lb.ok) setBoard((await lb.json()).entries ?? [])
      } else {
        setStats(null)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const join = async () => {
    const token = localStorage.getItem('token')
    if (!token) { router.push(LOGIN_REDIRECT); return }
    setJoining(true)
    setError('')
    try {
      const res = await fetch('/api/field-marketer/join', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not join'); return }
      setLoading(true)
      await load()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setJoining(false)
    }
  }

  const copyLink = async () => {
    if (!stats) return
    try {
      await navigator.clipboard.writeText(stats.link)
    } catch {
      window.prompt('Copy your link:', stats.link)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    if (!stats) return
    const text = encodeURIComponent(`Join BataMart, the campus marketplace for Awka.\nSign up here: ${stats.link}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-surface pb-16">
        <Shell width="narrow" className="pt-10">
          <PageHeader
            eyebrow="Field marketers"
            title="Get paid to grow Batamart"
            description="Join the field team, get your own signup link, and earn for every person who joins through it."
          />
          <div className="ui-panel mt-8 p-6 text-center">
            <Megaphone className="mx-auto mb-4 h-8 w-8 text-ink" strokeWidth={1.5} />
            <p className="mb-6 text-sm text-ink-secondary">
              Top marketers on the leaderboard win gifts. Tap below to request your spot.
            </p>
            {error && <p className="mb-4 text-sm text-danger">{error}</p>}
            <button
              onClick={join}
              disabled={joining}
              className="flex h-11 w-full items-center justify-center gap-2 bg-ink font-medium text-background disabled:opacity-50"
            >
              {joining && <Loader2 className="h-4 w-4 animate-spin" />}
              Request to join
            </button>
          </div>
        </Shell>
      </div>
    )
  }

  const top3 = board.slice(0, 3)
  const rest = board.slice(3)
  const youInBoard = board.some(b => b.isYou)
  const godMode = stats.tier === 'god-mode'

  return (
    <div className="min-h-screen bg-surface pb-20">
      <Shell width="reading" className="space-y-8 pt-10">
        <PageHeader
          eyebrow="Field marketers"
          title="Your field desk"
          description={`You earn ${naira(stats.payPerSignup)} for every person who signs up with your link.`}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        {stats.milestone && (
          <div className={`flex items-center gap-3 border p-4 ${godMode ? 'border-ink bg-slab text-slab-fg' : 'border-border bg-card'}`}>
            {godMode
              ? <Zap className="h-6 w-6 shrink-0" strokeWidth={2} />
              : <Flame className="h-6 w-6 shrink-0 text-warning" strokeWidth={2} />}
            <p className="font-medium">{stats.milestone}</p>
          </div>
        )}

        <section className="ui-panel p-5">
          <p className="ui-eyebrow mb-3">Your signup link</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={stats.link}
              onFocus={e => e.currentTarget.select()}
              className="ui-mono-sm h-11 min-w-0 flex-1 border border-border bg-surface px-3 text-ink"
            />
            <button onClick={copyLink} className="flex h-11 items-center gap-2 bg-ink px-4 text-sm font-medium text-background">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={shareWhatsApp} className="mt-3 flex items-center gap-2 text-sm text-ink-secondary hover:text-ink">
            <Share2 className="h-4 w-4" /> Share on WhatsApp
          </button>
        </section>

        <section className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          {[
            { label: 'Signups', value: String(stats.totalSignups), icon: Users },
            { label: 'Earned', value: naira(stats.totalEarned), icon: Wallet },
            { label: 'Today', value: String(stats.signupsToday), icon: Flame },
            { label: 'Rank', value: ordinal(stats.rank), icon: Trophy },
          ].map(s => (
            <div key={s.label} className="bg-card p-4">
              <s.icon className="mb-2 h-4 w-4 text-ink-muted" strokeWidth={1.75} />
              <p className="ui-figure text-xl text-ink">{s.value}</p>
              <p className="ui-mono-sm text-ink-muted">{s.label}</p>
            </div>
          ))}
        </section>

        <section className="ui-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="ui-eyebrow mb-1">Available balance</p>
              <p className="ui-figure text-3xl text-ink">{naira(stats.availableBalance)}</p>
              <p className="ui-mono-sm mt-1 text-ink-muted">
                {stats.signupsThisWeek} signup{stats.signupsThisWeek === 1 ? '' : 's'} this week
              </p>
            </div>
            <Link href="/wallet" className="flex h-10 items-center border border-ink px-4 text-sm font-medium text-ink">
              Withdraw
            </Link>
          </div>
          <p className="mt-4 border-t border-border pt-4 text-sm text-ink-secondary" data-tone={stats.encouragement.tone}>
            {stats.encouragement.message}
          </p>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="ui-eyebrow mb-1">Leaderboard</p>
              <h2 className="text-xl text-ink">Top marketers</h2>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-ink-secondary">
              <Gift className="h-4 w-4" /> Top 3 win gifts
            </p>
          </div>

          <div className="grid grid-cols-3 gap-px border border-border bg-border">
            {[1, 0, 2].map(i => {
              const e = top3[i]
              const place = i + 1
              return (
                <div
                  key={place}
                  className={`bg-card p-4 text-center ${place === 1 ? 'pt-8' : 'pt-12'} ${e?.isYou ? 'ring-2 ring-inset ring-ink' : ''}`}
                >
                  {place === 1
                    ? <Crown className="mx-auto mb-2 h-6 w-6 text-warning" />
                    : <Medal className="mx-auto mb-2 h-5 w-5 text-ink-muted" />}
                  <p className="ui-mono-sm text-ink-muted">{ordinal(place)}</p>
                  <p className="mt-1 truncate text-sm font-medium text-ink">{e ? (e.isYou ? 'You' : e.name) : '—'}</p>
                  <p className="ui-figure text-lg text-ink">{e ? e.signups : '—'}</p>
                </div>
              )
            })}
          </div>

          {rest.length > 0 && (
            <ul className="ui-divide border border-t-0 border-border bg-card">
              {rest.map(e => (
                <li key={e.rank} className={`ui-row flex items-center justify-between px-4 py-3 ${e.isYou ? 'bg-surface font-medium' : ''}`}>
                  <span className="flex items-center gap-3 text-sm text-ink">
                    <span className="ui-mono-sm w-6 text-ink-muted">{e.rank}</span>
                    {e.isYou ? 'You' : e.name}
                  </span>
                  <span className="ui-figure text-sm text-ink">{e.signups}</span>
                </li>
              ))}
            </ul>
          )}

          {!youInBoard && (
            <p className="mt-3 text-center text-sm text-ink-secondary">
              You are {ordinal(stats.rank)} right now. Keep pushing to crack the top 3.
            </p>
          )}
        </section>

        <section>
          <p className="ui-eyebrow mb-3">Recent signups</p>
          {stats.recent.length === 0 ? (
            <p className="ui-panel p-6 text-center text-sm text-ink-secondary">
              No signups yet. Share your link to get the first one.
            </p>
          ) : (
            <ul className="ui-divide border border-border bg-card">
              {stats.recent.map(r => (
                <li key={r.id} className="ui-row flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-ink">{r.name}</p>
                    <p className="ui-mono-sm text-ink-muted">{fmtDate(r.at)}</p>
                  </div>
                  <span className="ui-figure text-sm text-success">+{naira(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Shell>
    </div>
  )
}
