'use client'
// app/(admin)/admin/revenue/page.tsx

import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Info, Building2, RefreshCw } from 'lucide-react'
import {
  AdminHeader, AdminPanel, StatGrid, AdminButton, type AdminStat,
} from '@/components/admin/AdminUI'
import { DataRow } from '@/components/ui/Shell'

interface University { id: string; name: string; shortName: string }

type RevenuePeriod = 'today' | 'week' | 'month' | 'year' | 'all'

interface RevenueData {
  period: {
    revenue: number
    orders: number
    platformEarned: number
    flutterwaveFees: number
    checkoutFees: number
    walletTopUpFees: number
    withdrawalFees: number
    disputeFeeRecovery: number
    estimatedFeeTransactions: number
    referralRewards: number
    netAfterDeductions: number
  }
  platform: {
    gross: { allTime: number; thisMonth: number; lastMonth: number; today: number }
    net: { allTime: number; thisMonth: number; lastMonth: number; today: number }
  }
  obligations: {
    totalOwedToSellers: number
    totalOwedToRiders: number
    sellersAvailableNow: number
    sellersPending: number
    ridersAvailableNow: number
    ridersPending: number
  }
  referrals: {
    totalCredited: number
    totalRewards: number
    allTimeCredited: number
    allTimeRewards: number
  }
  dataQuality: {
    completedOrdersMissingCompletedAt: number
    completedOrdersMissingPayment: number
  }
  thisMonth: { orders: number }
  lastMonth: { orders: number }
  today: { orders: number }
  topSellers: {
    name: string
    totalOrders: number
    totalRevenue: number
    platformEarned: number
  }[]
  topRoutes: {
    zoneA: string
    zoneB: string
    count: number
    totalDeliveryFee: number
    riderTotal: number
  }[]
}

const REVENUE_PERIOD_LABELS: Record<RevenuePeriod, string> = {
  today: 'Today',
  week: '1 week',
  month: '1 month',
  year: '1 year',
  all: 'All time',
}

export default function RevenuePage() {
  const [revenue, setRevenue]           = useState<RevenueData | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
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
    setError(null)
    try {
      const token = localStorage.getItem('adminToken')
      const params = new URLSearchParams({ period: selectedPeriod })
      if (selectedUni !== 'all') params.set('universityId', selectedUni)
      const qs = `?${params.toString()}`
      const response = await fetch(`/api/admin/revenue${qs}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({})) as {
        error?: string
        revenue?: RevenueData
      }
      if (!response.ok) {
        throw new Error(data.error || `Revenue request failed (${response.status})`)
      }
      if (!data.revenue) throw new Error('Revenue response did not contain report data')
      setRevenue(data.revenue)
    } catch (error) {
      console.error('Failed to fetch revenue:', error)
      setRevenue(null)
      setError(error instanceof Error ? error.message : 'Failed to fetch revenue')
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

  if (error || !revenue) {
    return (
      <AdminPanel title="Revenue data unavailable">
        <p className="text-sm text-ink-secondary">{error || 'No revenue data was returned.'}</p>
        <AdminButton onClick={fetchRevenue} icon={RefreshCw}>Try again</AdminButton>
      </AdminPanel>
    )
  }

  const gross       = revenue.platform.gross
  const net         = revenue.platform.net
  const obligations = revenue.obligations
  const referrals   = revenue.referrals
  const topSellers  = revenue.topSellers
  const topRoutes   = revenue.topRoutes
  const periodData  = revenue.period
  const dataQuality = revenue.dataQuality
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
              label: 'Gross order value',
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
              label: 'Estimated net earnings',
              value: `₦${(periodData.netAfterDeductions || 0).toLocaleString()}`,
              note: `Fees ₦${(periodData.flutterwaveFees || 0).toLocaleString()} · rewards ₦${(periodData.referralRewards || 0).toLocaleString()} · recovered ₦${(periodData.disputeFeeRecovery || 0).toLocaleString()}`,
            },
          ] as AdminStat[]}
        />
      </AdminPanel>

      {(dataQuality.completedOrdersMissingCompletedAt > 0
        || dataQuality.completedOrdersMissingPayment > 0
        || periodData.estimatedFeeTransactions > 0) && (
        <div className="flex items-start gap-3 border border-warning/25 bg-warning/5 p-4 text-sm text-warning">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
          <span className="leading-relaxed">
            Financial data note:{' '}
            {dataQuality.completedOrdersMissingCompletedAt > 0 && (
              <>
                {dataQuality.completedOrdersMissingCompletedAt} completed orders lack a completion time, so
                period totals cannot place them accurately.{' '}
              </>
            )}
            {dataQuality.completedOrdersMissingPayment > 0 && (
              <>{dataQuality.completedOrdersMissingPayment} completed orders lack a payment record.{' '}</>
            )}
            {periodData.estimatedFeeTransactions > 0 && (
              <>
                Fees for {periodData.estimatedFeeTransactions} checkout, wallet top-up, or withdrawal
                transaction(s) are estimated because Flutterwave fee details were not recorded.
              </>
            )}
          </span>
        </div>
      )}

      {/* ── Estimated earnings ─────────────────────────────────────────── */}
      <section className="border border-border bg-card">
        <div className="flex items-start gap-4 border-b border-border p-5 sm:p-6">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-success/30 bg-success/5">
            <Info className="h-5 w-5 text-success" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <p className="ui-eyebrow mb-3">Platform earnings · {periodLabel}</p>
            <p className="ui-figure text-[clamp(2rem,5vw,3rem)] leading-none text-success">
              ₦{(periodData.netAfterDeductions || 0).toLocaleString()}
            </p>
            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ink-secondary">
              Platform commission after actual or estimated collection and transfer fees, less referral rewards,
              plus dispute fees recovered. This is not your live Flutterwave balance or a safe-to-withdraw amount.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <p className="ui-eyebrow mb-4">How it derives</p>
          <div className="ui-divide">
            <DataRow
              label={`Gross platform commission (${periodLabel.toLowerCase()})`}
              value={<span className="text-ink">+ ₦{(periodData.platformEarned || 0).toLocaleString()}</span>}
            />
            <DataRow
              label="Checkout collection fees"
              value={<span className="text-danger">− ₦{(periodData.checkoutFees || 0).toLocaleString()}</span>}
            />
            <DataRow
              label="Wallet top-up fees"
              value={<span className="text-danger">− ₦{(periodData.walletTopUpFees || 0).toLocaleString()}</span>}
            />
            <DataRow
              label="Withdrawal transfer fees"
              value={<span className="text-danger">− ₦{(periodData.withdrawalFees || 0).toLocaleString()}</span>}
            />
            <DataRow
              label={`Referral rewards credited (${periodLabel.toLowerCase()})`}
              value={<span className="text-danger">− ₦{(periodData.referralRewards || 0).toLocaleString()}</span>}
            />
            <DataRow
              label="Dispute fees recovered"
              value={<span className="text-ink">+ ₦{(periodData.disputeFeeRecovery || 0).toLocaleString()}</span>}
            />
            <DataRow
              label={`Estimated net earnings (${periodLabel.toLowerCase()})`}
              emphasis
              value={<span className="text-success">₦{(periodData.netAfterDeductions || 0).toLocaleString()}</span>}
            />
          </div>

        </div>
      </section>

      {/* ── Net profit over time ── */}
      <div>
        <AdminHeader
          eyebrow="Estimated earnings"
          title="Over fixed periods"
          description="These estimates use completed-order dates. The selected filter applies to the summary, rankings, and referral rewards; user balances below are current snapshots."
          className="mb-6"
        />
        <StatGrid
          columns={4}
          stats={[
            {
              label: 'All time (estimate)',
              value: `₦${(net.allTime || 0).toLocaleString()}`,
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
        title="Current money owed to users"
        description={
          <span className="inline-flex items-center gap-1.5">
            <Info className="h-3 w-3" strokeWidth={2} />
            Live balance snapshot, not historical period totals. Keep this money available for sellers and riders.
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
      <AdminPanel title={`Referral rewards — ${periodLabel}`} padded={false}>
        <div className="grid gap-px bg-border sm:grid-cols-2">
          <div className="bg-card p-5">
            <p className="ui-mono ui-mono-sm text-ink-muted">Credited in this period</p>
            <p className="ui-figure mt-2.5 text-2xl text-ink">
              ₦{(referrals.totalCredited || 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-card p-5">
            <p className="ui-mono ui-mono-sm text-ink-muted">Rewards credited</p>
            <p className="ui-figure mt-2.5 text-2xl text-ink">
              {(referrals.totalRewards || 0).toLocaleString()}
            </p>
          </div>
        </div>
        <p className="px-5 py-3 text-xs text-ink-muted">
          All-time credited: ₦{(referrals.allTimeCredited || 0).toLocaleString()} ({(referrals.allTimeRewards || 0).toLocaleString()} rewards)
        </p>
      </AdminPanel>

      {/* ── Top Sellers ── */}
      {topSellers.length > 0 && (
        <AdminPanel title={`Top sellers by revenue — ${periodLabel}`} padded={false}>
          <div className="ui-divide">
            {topSellers.map((seller, i) => (
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
            {topRoutes.map((route, i) => (
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
