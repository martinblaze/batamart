'use client'
// app/(admin)/admin/revenue/page.tsx

import { useState, useEffect } from 'react'
import { DollarSign, AlertCircle, Users, Truck, Gift, Info, ShieldCheck, Building2, RefreshCw } from 'lucide-react'

interface University { id: string; name: string; shortName: string }

export default function RevenuePage() {
  const [revenue, setRevenue]           = useState<any>(null)
  const [loading, setLoading]           = useState(true)
  const [selectedUni, setSelectedUni]   = useState('all')
  const [universities, setUniversities] = useState<University[]>([])

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    fetch('/api/universities', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUniversities(d.universities ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchRevenue() }, [selectedUni])

  const fetchRevenue = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const qs = selectedUni !== 'all' ? `?universityId=${selectedUni}` : ''
      const response = await fetch(`/api/admin/revenue${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setRevenue(data.revenue)
      }
    } catch (error) {
      console.error('Failed to fetch revenue:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedUniName = selectedUni === 'all'
    ? 'All Universities'
    : universities.find(u => u.id === selectedUni)?.shortName ?? ''

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent" />
      </div>
    )
  }

  const p           = revenue?.platform      || {}
  const gross       = p.gross                || {}
  const net         = p.net                  || {}
  const fees        = p.credoFees            || {}
  const obligations = revenue?.obligations   || {}
  const withdrawal  = revenue?.withdrawal    || {}
  const referrals   = revenue?.referrals     || {}
  const topSellers  = revenue?.topSellers    || []
  const breakdown   = withdrawal.breakdown   || {}

  return (
    <div className="space-y-8">

      {/* ── Header with switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Revenue</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            <span className="text-white font-medium">{selectedUniName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
            <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={selectedUni}
              onChange={e => setSelectedUni(e.target.value)}
              className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Universities</option>
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchRevenue} className="p-2 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Safe Withdrawal Banner ── */}
      <div className="bg-green-500/10 border-2 border-green-500/40 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-500/20 rounded-xl shrink-0">
            <ShieldCheck className="w-7 h-7 text-green-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-1">Safe to Withdraw from Credo</h2>
            <p className="text-gray-300 text-sm mb-4">
              Your actual profit after ALL deductions — including money still owed to sellers and riders.
              {selectedUni !== 'all' && ` Scoped to ${selectedUniName}.`}
            </p>
            <div className="bg-gray-800/60 rounded-xl p-4 space-y-2 mb-4 font-mono text-sm">
              <div className="flex justify-between text-gray-300">
                <span>Gross platform commission (all time)</span>
                <span className="text-white">+ ₦{(breakdown.grossCommission || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Credo fees (1.5% + ₦100, waived under ₦2k, max ₦2.1k per order)</span>
                <span className="text-red-400">− ₦{(breakdown.minusCredoFees || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Referral rewards paid to users</span>
                <span className="text-red-400">− ₦{(breakdown.minusReferralPayouts || 0).toLocaleString()}</span>
              </div>
              {/* ── NEW: show the seller/rider obligations deductions ── */}
              <div className="flex justify-between text-gray-300">
                <span>Seller balances (settled, not yet withdrawn)</span>
                <span className="text-orange-400">− ₦{(breakdown.minusSellersAvailable || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Rider balances (settled, not yet withdrawn)</span>
                <span className="text-orange-400">− ₦{(breakdown.minusRidersAvailable || 0).toLocaleString()}</span>
              </div>
              <div className="border-t border-gray-600 pt-2 flex justify-between font-bold text-lg">
                <span className="text-white">Your NET profit (safe to withdraw)</span>
                <span className="text-green-400">= ₦{(withdrawal.safeToWithdraw || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Warning if admin obligations eat into profit */}
            {(breakdown.minusSellersAvailable || 0) + (breakdown.minusRidersAvailable || 0) > 0 && (
              <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-4 text-sm text-orange-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  ₦{((breakdown.minusSellersAvailable || 0) + (breakdown.minusRidersAvailable || 0)).toLocaleString()} of Credo-managed balance belongs to sellers/riders who haven't withdrawn yet.
                  You must leave that amount in Credo-managed balance.
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-green-300 font-bold text-lg">
              <DollarSign className="w-5 h-5" />
              Withdraw exactly ₦{(withdrawal.safeToWithdraw || 0).toLocaleString()} from Credo-managed balance
            </div>
          </div>
        </div>
      </div>

      {/* ── Net Profit Cards ── */}
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Net Platform Profit</h2>
        <p className="text-gray-400 text-sm mb-4">After Credo fees. Referral payouts + user obligations deducted from all-time.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'All Time NET',    value: withdrawal.safeToWithdraw || 0, sub: `Gross: ₦${(gross.allTime || 0).toLocaleString()}`,    color: 'from-green-500 to-green-600',   textLight: 'text-green-100' },
            { label: 'This Month NET',  value: net.thisMonth || 0,             sub: `${revenue?.thisMonth?.orders || 0} orders`,           color: 'from-blue-500 to-blue-600',     textLight: 'text-blue-100' },
            { label: 'Last Month NET',  value: net.lastMonth || 0,             sub: `${revenue?.lastMonth?.orders || 0} orders`,           color: 'from-purple-500 to-purple-600', textLight: 'text-purple-100' },
            { label: 'Today NET',       value: net.today || 0,                 sub: `${revenue?.today?.orders || 0} orders`,               color: 'from-yellow-500 to-orange-500', textLight: 'text-yellow-100' },
          ].map(card => (
            <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-2xl p-6 text-white`}>
              <p className={`${card.textLight} text-sm mb-1`}>{card.label}</p>
              <p className="text-3xl font-bold">₦{card.value.toLocaleString()}</p>
              <p className={`${card.textLight} text-xs mt-2`}>{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Obligations ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-1">Money Owed to Users</h3>
        <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
          <Info className="w-3 h-3" /> Keep this amount in Credo-managed balance — it belongs to sellers and riders
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Sellers</span>
            </div>
            <p className="text-2xl font-bold text-white">₦{((obligations.totalOwedToSellers) || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">
              ₦{(obligations.sellersAvailableNow || 0).toLocaleString()} available (must keep) · ₦{(obligations.sellersPending || 0).toLocaleString()} in escrow
            </p>
          </div>
          <div className="bg-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-white">Riders</span>
            </div>
            <p className="text-2xl font-bold text-white">₦{((obligations.totalOwedToRiders) || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">
              ₦{(obligations.ridersAvailableNow || 0).toLocaleString()} available (must keep) · ₦{(obligations.ridersPending || 0).toLocaleString()} in escrow
            </p>
          </div>
        </div>
      </div>

      {/* ── Referrals ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">Referral Rewards</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700/50 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Total Paid Out (All Time)</p>
            <p className="text-2xl font-bold text-white">₦{(referrals.totalPaidOut || 0).toLocaleString()}</p>
          </div>
          <div className="bg-gray-700/50 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Total Rewards Given</p>
            <p className="text-2xl font-bold text-white">{(referrals.totalRewards || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Top Sellers ── */}
      {topSellers.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Top Sellers by Revenue</h3>
          <div className="space-y-3">
            {topSellers.map((seller: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm w-5">{i + 1}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{seller.name}</p>
                    <p className="text-gray-400 text-xs">{seller.totalOrders} orders</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm font-bold">₦{(seller.totalRevenue || 0).toLocaleString()}</p>
                  <p className="text-gray-400 text-xs">₦{(seller.platformEarned || 0).toLocaleString()} commission</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 