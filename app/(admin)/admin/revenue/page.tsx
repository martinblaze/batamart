'use client'
// app/(admin)/admin/revenue/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Truck, Info, ShieldCheck, Building2, RefreshCw } from 'lucide-react'
import {
  AdminHeader, AdminPanel, StatGrid, AdminButton, type AdminStat,
} from '@/components/admin/AdminUI'
import { DataRow } from '@/components/ui/Shell'

interface University { id: string; name: string; shortName: string }

type RevenuePeriod = 'today' | 'week' | 'month' | 'year' | 'all'

const REVENUE_PERIOD_LABELS: Record<RevenuePeriod, string> = {
  today: 'Today',
  week: '1 week',
  month: '1 month',
  year: '1 year',
  all: 'All time',
}

export default function RevenuePage() {
  const [revenue, setRevenue]           = useState<any>(null)
  const [loading, setLoading]           = useState(true)
  const [selectedUni, setSelectedUni]   = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState<RevenuePeriod>('all')
  const [universities, setUniversities] = useState<University[]>([])

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    fetch('/api/universities', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUniversities(d.universities ?? []))
      .catch(() => {})
  }, [])

  const fetchRevenue = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const params = new URLSearchParams({ period: selectedPeriod })
      if (selectedUni !== 'all') params.set('universityId', selectedUni)
      const qs = `?${params.toString()}`
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
  }, [selectedUni, selectedPeriod])

  useEffect(() => { void fetchRevenue() }, [fetchRevenue])

  const selectedUniName = selectedUni === 'all'
    ? 'All Universities'
    : universities.find(u => u.id === selectedUni)?.shortName ?? ''

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    )
  }

  const p           = revenue?.platform      || {}
  const gross       = p.gross                || {}
  const net         = p.net                  || {}
  const fees        = p.flutterwaveFees            || {}
  const feeConfig    = revenue?.flutterwaveFeeConfig || {}
  const obligations = revenue?.obligations   || {}
  const withdrawal  = revenue?.withdrawal    || {}
  const referrals   = revenue?.referrals     || {}
  const topSellers  = revenue?.topSellers    || []
  const topRoutes   = revenue?.topRoutes     || []
  const breakdown   = withdrawal.breakdown   || {}
  const periodData  = revenue?.period        || {}
  const periodLabel = REVENUE_PERIOD_LABELS[selectedPeriod]

  return (
    <div className="space-y-8">

      {/* ── Header with switcher ── */}
      <AdminHeader
        eyebrow="Finance"
        title="Revenue"
        description={
          <>
            Scoped to <span className="font-medium text-ink">{selectedUniName}</span>.
          </>
        }
        actions={
          <>
            <div className="flex h-9 items-center gap-2 border border-border bg-card px-3">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
              <select
                value={selectedUni}
                onChange={e => setSelectedUni(e.target.value)}
                aria-label="University"
                className="cursor-pointer bg-transparent text-[13px] text-ink focus:outline-none"
              >
                <option value="all">All universities</option>
                {universities.map(u => (
                  <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>
                ))}
              </select>
            </div>
            <div className="flex h-9 items-center gap-2 border border-border bg-card px-3">
              <select
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value as RevenuePeriod)}
                aria-label="Revenue period"
                className="cursor-pointer bg-transparent text-[13px] text-ink focus:outline-none"
              >
                {(Object.keys(REVENUE_PERIOD_LABELS) as RevenuePeriod[]).map(period => (
                  <option key={period} value={period}>{REVENUE_PERIOD_LABELS[period]}</option>
                ))}
              </select>
            </div>
            <AdminButton onClick={fetchRevenue} icon={RefreshCw}>Refresh</AdminButton>
          </>
        }
      />

      <AdminPanel
        title={`Revenue — ${periodLabel}`}
        description={`Completed orders for ${periodLabel.toLowerCase()} at ${selectedUniName.toLowerCase()}.`}
        padded={false}
      >
        <StatGrid
          columns={4}
          stats={[
            {
              label: 'Sales revenue',
              value: `₦${(periodData.revenue || 0).toLocaleString()}`,
              note: `${periodData.orders || 0} completed orders`,
            },
            {
              label: 'Completed orders',
              value: (periodData.orders || 0).toLocaleString(),
              note: periodLabel,
            },
            {
              label: 'Platform commission',
              value: `₦${(periodData.platformEarned || 0).toLocaleString()}`,
              note: 'Before fees',
            },
            {
              label: 'Net after fees',
              value: `₦${(periodData.netAfterFees || 0).toLocaleString()}`,
              note: `Flutterwave fees ₦${(periodData.flutterwaveFees || 0).toLocaleString()}`,
            },
          ] as AdminStat[]}
        />
      </AdminPanel>

      {/* ── Safe withdrawal ──────────────────────────────────────────────
          The single most consequential number on the panel, so it gets the
          page's only large figure and a full derivation underneath it. */}
      <section className="border border-border bg-card">
        <div className="flex items-start gap-4 border-b border-border p-5 sm:p-6">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-success/30 bg-success/5">
            <ShieldCheck className="h-5 w-5 text-success" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <p className="ui-eyebrow mb-3">Safe to withdraw</p>
            <p className="ui-figure text-[clamp(2rem,5vw,3rem)] leading-none text-success">
              ₦{(withdrawal.safeToWithdraw || 0).toLocaleString()}
            </p>
            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ink-secondary">
              Your actual profit from the Flutterwave-managed balance, after every deduction —
              including money still owed to sellers and riders.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <p className="ui-eyebrow mb-4">How it derives</p>
          <div className="ui-divide">
            <DataRow
              label="Gross commission (all time)"
              value={<span className="text-ink">+ ₦{(breakdown.grossCommission || 0).toLocaleString()}</span>}
            />
            <DataRow
              label="Flutterwave fees (2%, capped ₦2,000)"
              value={<span className="text-danger">− ₦{(breakdown.minusFlutterwaveFees || 0).toLocaleString()}</span>}
            />
            <DataRow
              label="Referral rewards paid out"
              value={<span className="text-danger">− ₦{(breakdown.minusReferralPayouts || 0).toLocaleString()}</span>}
            />
            <DataRow
              label="Seller balances (settled, unwithdrawn)"
              value={<span className="text-warning">− ₦{(breakdown.minusSellersAvailable || 0).toLocaleString()}</span>}
            />
            <DataRow
              label="Rider balances (settled, unwithdrawn)"
              value={<span className="text-warning">− ₦{(breakdown.minusRidersAvailable || 0).toLocaleString()}</span>}
            />
            <DataRow
              label="Net profit"
              emphasis
              value={<span className="text-success">₦{(withdrawal.safeToWithdraw || 0).toLocaleString()}</span>}
            />
          </div>

          {(breakdown.minusSellersAvailable || 0) + (breakdown.minusRidersAvailable || 0) > 0 && (
            <div className="mt-6 flex items-start gap-3 border border-warning/25 bg-warning/5 p-4 text-sm text-warning">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
              <span className="leading-relaxed">
                ₦{((breakdown.minusSellersAvailable || 0) + (breakdown.minusRidersAvailable || 0)).toLocaleString()}{' '}
                of the managed balance belongs to sellers and riders who have not withdrawn yet.
                That amount must stay in the account.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ── Net profit over time ── */}
      <div>
        <AdminHeader
          eyebrow="Net profit"
          title="Over time"
          description="These figures compare fixed periods; the selected date filter applies to the revenue summary and rankings."
          className="mb-6"
        />
        <StatGrid
          columns={4}
          stats={[
            {
              label: 'All time',
              value: `₦${(withdrawal.safeToWithdraw || 0).toLocaleString()}`,
              note: `Gross ₦${(gross.allTime || 0).toLocaleString()}`,
            },
            {
              label: 'This month',
              value: `₦${(net.thisMonth || 0).toLocaleString()}`,
              note: `${revenue?.thisMonth?.orders || 0} orders`,
            },
            {
              label: 'Last month',
              value: `₦${(net.lastMonth || 0).toLocaleString()}`,
              note: `${revenue?.lastMonth?.orders || 0} orders`,
            },
            {
              label: 'Today',
              value: `₦${(net.today || 0).toLocaleString()}`,
              note: `${revenue?.today?.orders || 0} orders`,
            },
          ] as AdminStat[]}
        />
      </div>

      {/* ── Obligations ── */}
      <AdminPanel
        title="Money owed to users"
        description={
          <span className="inline-flex items-center gap-1.5">
            <Info className="h-3 w-3" strokeWidth={2} />
            Keep this in the managed balance — it belongs to sellers and riders.
          </span>
        }
        padded={false}
      >
        <div className="grid gap-px bg-border md:grid-cols-2">
          <div className="bg-card p-5">
            <p className="ui-mono ui-mono-sm text-ink-muted">Sellers</p>
            <p className="ui-figure mt-2.5 text-2xl text-ink">
              ₦{(obligations.totalOwedToSellers || 0).toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-ink-secondary">
              ₦{(obligations.sellersAvailableNow || 0).toLocaleString()} available (must keep) ·
              ₦{(obligations.sellersPending || 0).toLocaleString()} in escrow
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="ui-mono ui-mono-sm text-ink-muted">Riders</p>
            <p className="ui-figure mt-2.5 text-2xl text-ink">
              ₦{(obligations.totalOwedToRiders || 0).toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-ink-secondary">
              ₦{(obligations.ridersAvailableNow || 0).toLocaleString()} available (must keep) ·
              ₦{(obligations.ridersPending || 0).toLocaleString()} in escrow
            </p>
          </div>
        </div>
      </AdminPanel>

      {/* ── Referrals ── */}
      <AdminPanel title="Referral rewards" padded={false}>
        <div className="grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card p-5">
            <p className="ui-mono ui-mono-sm text-ink-muted">Total paid out</p>
            <p className="ui-figure mt-2.5 text-2xl text-ink">
              ₦{(referrals.totalPaidOut || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="ui-mono ui-mono-sm text-ink-muted">Rewards given</p>
            <p className="ui-figure mt-2.5 text-2xl text-ink">
              {(referrals.totalRewards || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </AdminPanel>

      {/* ── Top Sellers ── */}
      {topSellers.length > 0 && (
        <AdminPanel title={`Top sellers by revenue — ${periodLabel}`} padded={false}>
          <div className="ui-divide">
            {topSellers.map((seller: any, i: number) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <span className="ui-mono ui-mono-sm w-5 flex-shrink-0 text-ink-muted">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{seller.name}</p>
                  <p className="ui-mono ui-mono-sm mt-1 text-ink-muted">
                    {seller.totalOrders} orders
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="ui-figure text-sm text-ink">
                    ₦{(seller.totalRevenue || 0).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    ₦{(seller.platformEarned || 0).toLocaleString()} commission
                  </p>
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>
      )}

      {/* ── Top Delivery Routes ── */}
      {topRoutes.length > 0 && (
        <AdminPanel
          title="Top delivery routes"
          description={`By completed order volume for ${periodLabel.toLowerCase()}.`}
          padded={false}
        >
          <div className="ui-divide">
            {topRoutes.map((route: any, i: number) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <span className="ui-mono ui-mono-sm w-5 flex-shrink-0 text-ink-muted">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {route.zoneA} ↔ {route.zoneB}
                  </p>
                  <p className="ui-mono ui-mono-sm mt-1 text-ink-muted">
                    {route.count} deliver{route.count === 1 ? 'y' : 'ies'}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="ui-figure text-sm text-ink">
                    ₦{(route.totalDeliveryFee || 0).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    ₦{(route.riderTotal || 0).toLocaleString()} to riders
                  </p>
                </div>
              </div>
            ))}
          </div>
        </AdminPanel>
      )}
    </div>
  )
}
