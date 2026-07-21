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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const p           = revenue?.platform      || {}
  const gross       = p.gross                || {}
  const net         = p.net                  || {}
  const fees        = p.credoFees            || {}
  const feeConfig    = revenue?.credoFeeConfig || {}
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
          <h1 className="text-2xl font-semibold text-ink">Revenue</h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            <span className="text-ink font-medium">{selectedUniName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2">
            <Building2 className="w-4 h-4 text-ink-secondary flex-shrink-0" />
            <select
              value={selectedUni}
              onChange={e => setSelectedUni(e.target.value)}
              className="bg-transparent text-ink text-sm font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Universities</option>
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchRevenue} className="p-2 bg-white border border-border rounded-xl text-ink-secondary hover:text-ink">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Safe Withdrawal Banner ── */}
      <div className="bg-success/10 border-2 border-success/40 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-success/10 rounded-xl shrink-0">
            <ShieldCheck className="w-7 h-7 text-success" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-ink mb-1">Safe to Withdraw from Credo-managed balance</h2>
            <p className="text-ink-secondary text-sm mb-4">
              Your actual profit after ALL deductions — including money still owed to sellers and riders.
              {selectedUni !== 'all' && ` Scoped to ${selectedUniName}.`}
            </p>
            <div className="bg-white/60 rounded-xl p-4 space-y-2 mb-4 font-mono text-sm">
              <div className="flex justify-between text-ink-secondary">
                <span>Gross platform commission (all time)</span>
                <span className="text-ink">+ ₦{(breakdown.grossCommission || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Credo fees (plan-based estimate)</span>
                <span className="text-danger">− ₦{(breakdown.minusCredoFees || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Referral rewards paid to users</span>
                <span className="text-danger">− ₦{(breakdown.minusReferralPayouts || 0).toLocaleString()}</span>
              </div>
              {/* ── NEW: show the seller/rider obligations deductions ── */}
              <div className="flex justify-between text-ink-secondary">
                <span>Seller balances (settled, not yet withdrawn)</span>
                <span className="text-warning">− ₦{(breakdown.minusSellersAvailable || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-ink-secondary">
                <span>Rider balances (settled, not yet withdrawn)</span>
                <span className="text-warning">− ₦{(breakdown.minusRidersAvailable || 0).toLocaleString()}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold text-lg">
                <span className="text-ink">Your NET profit (safe to withdraw)</span>
                <span className="text-success">= ₦{(withdrawal.safeToWithdraw || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Warning if admin obligations eat into profit */}
            {(breakdown.minusSellersAvailable || 0) + (breakdown.minusRidersAvailable || 0) > 0 && (
              <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl p-3 mb-4 text-sm text-warning">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  ₦{((breakdown.minusSellersAvailable || 0) + (breakdown.minusRidersAvailable || 0)).toLocaleString()} of Credo-managed balance belongs to sellers/riders who haven't withdrawn yet.
                  You must leave that amount in Credo-managed balance.
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-success font-semibold text-lg">
              <DollarSign className="w-5 h-5" />
              Withdraw exactly ₦{(withdrawal.safeToWithdraw || 0).toLocaleString()} from Credo-managed balance
            </div>
          </div>
        </div>
      </div>

      {/* ── Net Profit Cards ── */}
      <div>
        <h2 className="text-xl font-semibold text-ink mb-1">Net Platform Profit</h2>
        <p className="text-ink-secondary text-sm mb-4">After Credo fees. Referral payouts + user obligations deducted from all-time.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'All time NET',    value: withdrawal.safeToWithdraw || 0, sub: `Gross: ₦${(gross.allTime || 0).toLocaleString()}` },
            { label: 'This month NET',  value: net.thisMonth || 0,             sub: `${revenue?.thisMonth?.orders || 0} orders` },
            { label: 'Last month NET',  value: net.lastMonth || 0,             sub: `${revenue?.lastMonth?.orders || 0} orders` },
            { label: 'Today NET',       value: net.today || 0,                 sub: `${revenue?.today?.orders || 0} orders` },
          ].map(card => (
            <div key={card.label} className="bg-primary rounded-2xl p-6 text-white">
              <p className="text-white/75 text-sm mb-1">{card.label}</p>
              <p className="text-3xl font-semibold">₦{card.value.toLocaleString()}</p>
              <p className="text-white/75 text-xs mt-2">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Obligations ── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-ink mb-1">Money Owed to Users</h3>
        <p className="text-xs text-ink-secondary mb-4 flex items-center gap-1">
          <Info className="w-3 h-3" /> Keep this amount in Credo-managed balance — it belongs to sellers and riders
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-ink">Sellers</span>
            </div>
            <p className="text-2xl font-semibold text-ink">₦{((obligations.totalOwedToSellers) || 0).toLocaleString()}</p>
            <p className="text-xs text-ink-secondary mt-1">
              ₦{(obligations.sellersAvailableNow || 0).toLocaleString()} available (must keep) Â· ₦{(obligations.sellersPending || 0).toLocaleString()} in escrow
            </p>
          </div>
          <div className="bg-surface rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4 text-success" />
              <span className="text-sm font-semibold text-ink">Riders</span>
            </div>
            <p className="text-2xl font-semibold text-ink">₦{((obligations.totalOwedToRiders) || 0).toLocaleString()}</p>
            <p className="text-xs text-ink-secondary mt-1">
              ₦{(obligations.ridersAvailableNow || 0).toLocaleString()} available (must keep) Â· ₦{(obligations.ridersPending || 0).toLocaleString()} in escrow
            </p>
          </div>
        </div>
      </div>

      {/* ── Referrals ── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-ink">Referral Rewards</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface rounded-xl p-4">
            <p className="text-sm text-ink-secondary mb-1">Total Paid Out (All Time)</p>
            <p className="text-2xl font-semibold text-ink">₦{(referrals.totalPaidOut || 0).toLocaleString()}</p>
          </div>
          <div className="bg-surface rounded-xl p-4">
            <p className="text-sm text-ink-secondary mb-1">Total Rewards Given</p>
            <p className="text-2xl font-semibold text-ink">{(referrals.totalRewards || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ── Top Sellers ── */}
      {topSellers.length > 0 && (
        <div className="bg-white border border-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-ink mb-4">Top Sellers by Revenue</h3>
          <div className="space-y-3">
            {topSellers.map((seller: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-ink-muted text-sm w-5">{i + 1}</span>
                  <div>
                    <p className="text-ink text-sm font-medium">{seller.name}</p>
                    <p className="text-ink-secondary text-xs">{seller.totalOrders} orders</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-ink text-sm font-semibold">₦{(seller.totalRevenue || 0).toLocaleString()}</p>
                  <p className="text-ink-secondary text-xs">₦{(seller.platformEarned || 0).toLocaleString()} commission</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 
