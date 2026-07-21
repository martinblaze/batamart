// app/(marketplace)/referrals/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Gift, Copy, Check, Users, TrendingUp, Award,
  Share2, ChevronRight, Loader2, AlertTriangle,
} from 'lucide-react'

interface ReferralStats {
  referralCode: string
  referralLink: string
  totalReferrals: number
  totalEarnings: number
  totalReferralOrders: number
  referrals: { id: string; name: string; joinedAt: string; completedOrders: number }[]
  recentRewards: {
    id: string
    amount: number
    orderNumber: string
    orderAmount: number
    earnedAt: string
  }[]
}

export default function ReferralsPage() {
  const router = useRouter()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchStats() }, [])

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { router.push('/login'); return }

      const res = await fetch('/api/referrals', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error || 'Failed to load'); return }
      setStats(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!stats) return
    try {
      // Primary: modern Clipboard API (requires HTTPS + user gesture)
      await navigator.clipboard.writeText(stats.referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: execCommand for older Android browsers / non-HTTPS
      try {
        const textarea = document.createElement('textarea')
        textarea.value = stats.referralLink
        textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (ok) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } else {
          // Last resort: show the link in an alert so user can copy manually
          window.prompt('Copy your referral link:', stats.referralLink)
        }
      } catch {
        window.prompt('Copy your referral link:', stats.referralLink)
      }
    }
  }

  const shareWhatsApp = () => {
    if (!stats) return
    const text = encodeURIComponent(
      `Join BataMart — a campus marketplace.\nUse my referral link and let's both win:\n${stats.referralLink}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const shareTelegram = () => {
    if (!stats) return
    const text = encodeURIComponent(
      `Join BataMart — a campus marketplace. Use my referral link: ${stats.referralLink}`
    )
    window.open(`https://t.me/share/url?url=${encodeURIComponent(stats.referralLink)}&text=${text}`, '_blank')
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n)

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-danger mx-auto mb-3" />
          <p className="text-ink-secondary mb-4">{error || 'Something went wrong'}</p>
          <button onClick={fetchStats} className="btn-primary">Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-16">

      {/* Hero Banner */}
      <div className="bg-primary text-white">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 mb-4 text-sm font-medium">
            <Gift className="w-4 h-4" strokeWidth={1.75} />
            Referral programme
          </div>
          <h1 className="text-3xl font-semibold mb-2">Invite friends, earn cash</h1>
          <p className="text-white/80 text-base max-w-md mx-auto">
            Invite friends and earn from every order they make. No cap. No expiry.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-6 space-y-5">

        {/* Referral Code Card */}
        <div className="bg-white rounded-2xl shadow-soft border border-border p-5">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Your Referral Code</p>

          <div className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3 mb-4 border border-border">
            <span className="text-xl font-semibold text-primary tracking-widest flex-1">
              {stats.referralCode}
            </span>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:brightness-90 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <p className="text-xs text-ink-muted break-all mb-4">{stats.referralLink}</p>

          {/* Share Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={shareWhatsApp}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-success/10 hover:bg-success/10 transition-colors"
            >
              {/* WhatsApp icon via SVG */}
              <svg className="w-6 h-6 text-success" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <span className="text-xs font-semibold text-success">WhatsApp</span>
            </button>

            <button
              onClick={shareTelegram}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-primary/10 hover:bg-primary/10 transition-colors"
            >
              <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              <span className="text-xs font-semibold text-primary">Telegram</span>
            </button>

            <button
              onClick={copyLink}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-surface hover:bg-border transition-colors"
            >
              {copied
                ? <Check className="w-6 h-6 text-success" />
                : <Copy className="w-6 h-6 text-ink-secondary" />
              }
              <span className="text-xs font-semibold text-ink-secondary">Copy Link</span>
            </button>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <h2 className="font-semibold text-ink mb-4">How It Works</h2>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Share your referral link with friends' },
              { step: '2', text: 'They sign up using your link' },
              { step: '3', text: 'When they complete an order, you earn ₦120 from the delivery fee' },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center flex-shrink-0">
                  {item.step}
                </div>
                <p className="text-ink-secondary text-sm pt-0.5">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <Users className="w-5 h-5" />, label: 'Referrals', value: stats.totalReferrals, color: 'text-primary bg-primary/10' },
            { icon: <TrendingUp className="w-5 h-5" />, label: 'Orders', value: stats.totalReferralOrders, color: 'text-success bg-success/10' },
            { icon: <Award className="w-5 h-5" />, label: 'Earned', value: fmt(stats.totalEarnings), color: 'text-primary bg-primary/10' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-4 text-center">
              <div className={`w-9 h-9 rounded-full ${stat.color} flex items-center justify-center mx-auto mb-2`}>
                {stat.icon}
              </div>
              <p className="font-semibold text-ink text-base">{stat.value}</p>
              <p className="text-xs text-ink-secondary">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Recent Rewards */}
        {stats.recentRewards.length > 0 && (
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-ink">Recent Earnings</h2>
              <Link href="/wallet" className="text-sm text-primary font-medium flex items-center gap-1">
                View Wallet <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {stats.recentRewards.map(reward => (
                <div key={reward.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">Order #{reward.orderNumber}</p>
                    <p className="text-xs text-ink-muted">{fmtDate(reward.earnedAt)}</p>
                  </div>
                  <span className="text-success font-semibold text-sm">+{fmt(reward.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        {stats.referrals.length > 0 && (
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-ink">Your Referrals ({stats.totalReferrals})</h2>
            </div>
            <div className="divide-y divide-border">
              {stats.referrals.map(ref => (
                <div key={ref.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">{ref.name}</p>
                    <p className="text-xs text-ink-muted">Joined {fmtDate(ref.joinedAt)}</p>
                  </div>
                  <span className="text-xs font-medium text-ink-secondary bg-surface rounded-full px-3 py-1">
                    {ref.completedOrders} order{ref.completedOrders !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.referrals.length === 0 && (
          <div className="bg-white rounded-2xl border border-border p-8 text-center">
            <Share2 className="w-12 h-12 text-ink-muted mx-auto mb-3" />
            <p className="font-semibold text-ink-secondary mb-1">No referrals yet</p>
            <p className="text-sm text-ink-muted">Share your link above to start earning!</p>
          </div>
        )}

      </div>
    </div>
  )
}
