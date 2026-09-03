// ============================================================
// FILE 1: components/ui/ReferralCard.tsx
// Drop this into myprofile/page.tsx — see usage note below
// ============================================================

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Gift, Copy, Check, Users, TrendingUp, ChevronRight } from 'lucide-react'

export function ReferralCard() {
  const [referralCode, setReferralCode] = useState('')
  const [referralLink, setReferralLink] = useState('')
  const [totalReferrals, setTotalReferrals] = useState(0)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReferral = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/referrals', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        setReferralCode(data.referralCode)
        setReferralLink(data.referralLink)
        setTotalReferrals(data.totalReferrals)
        setTotalEarnings(data.totalEarnings)
      } catch { }
      finally { setLoading(false) }
    }
    fetchReferral()
  }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n)

  if (loading) return null

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 lg:px-5 py-3 lg:py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-ink text-sm lg:text-base">REFERRAL PROGRAMME</h2>
        </div>
        <Link href="/referrals" className="text-primary text-sm font-medium flex items-center gap-1">
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="p-4 lg:p-5 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary/10 rounded-xl p-3 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="font-semibold text-ink">{totalReferrals}</p>
            <p className="text-xs text-ink-muted">Referrals</p>
          </div>
          <div className="bg-success/10 rounded-xl p-3 text-center">
            <TrendingUp className="w-5 h-5 text-success mx-auto mb-1" />
            <p className="font-semibold text-ink">{fmt(totalEarnings)}</p>
            <p className="text-xs text-ink-muted">Earned</p>
          </div>
        </div>

        {/* Referral code */}
        <div>
          <p className="text-xs text-ink-muted mb-1.5">Your referral code</p>
          <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2 border border-border">
            <span className="font-semibold text-primary tracking-widest flex-1 text-sm">
              {referralCode}
            </span>
            <button onClick={copy} className="text-primary hover:brightness-95 transition-colors">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Link
          href="/referrals"
          className="block w-full text-center py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:brightness-95 transition-colors"
        >
          Invite Friends & Earn
        </Link>
      </div>
    </div>
  )
}

