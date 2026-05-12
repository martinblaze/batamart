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
    <div className="bg-white dark:bg-[#1E1E1E] rounded-xl border border-gray-200 dark:border-[#343434] overflow-hidden">
      <div className="px-4 lg:px-5 py-3 lg:py-4 border-b border-gray-100 dark:border-[#343434] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-BATAMART-primary" />
          <h2 className="font-bold text-gray-900 dark:text-[#E0E0E0] text-sm lg:text-base">REFERRAL PROGRAMME</h2>
        </div>
        <Link href="/referrals" className="text-BATAMART-primary text-sm font-medium flex items-center gap-1">
          View All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="p-4 lg:p-5 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-3 text-center">
            <Users className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="font-bold text-gray-900 dark:text-[#E0E0E0]">{totalReferrals}</p>
            <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">Referrals</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-3 text-center">
            <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className="font-bold text-gray-900 dark:text-[#E0E0E0]">{fmt(totalEarnings)}</p>
            <p className="text-xs text-gray-500 dark:text-[#A0A0A0]">Earned</p>
          </div>
        </div>

        {/* Referral code */}
        <div>
          <p className="text-xs text-gray-400 dark:text-[#A0A0A0] mb-1.5">Your referral code</p>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#232323] rounded-lg px-3 py-2 border border-gray-200 dark:border-[#343434]">
            <span className="font-extrabold text-BATAMART-primary tracking-widest flex-1 text-sm">
              {referralCode}
            </span>
            <button onClick={copy} className="text-BATAMART-primary hover:text-BATAMART-dark transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Link
          href="/referrals"
          className="block w-full text-center py-2.5 rounded-xl bg-BATAMART-primary text-white text-sm font-semibold hover:bg-BATAMART-dark transition-colors"
        >
          Invite Friends & Earn
        </Link>
      </div>
    </div>
  )
}

