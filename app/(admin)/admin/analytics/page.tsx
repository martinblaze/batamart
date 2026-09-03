'use client'
// app/(admin)/admin/analytics/page.tsx

import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, Users, Package, ShoppingBag, DollarSign,
  CheckCircle, Gift, Store, Bike, Activity, BarChart2, Target,
  AlertTriangle, Clock, RefreshCw, ArrowUpRight, ArrowDownRight,
  Layers, Zap, Shield, CreditCard, UserCheck, Repeat, Building2,
} from 'lucide-react'
import { AdminHeader, AdminButton } from '@/components/admin/AdminUI'

interface AnalyticsData {
  newUsers: number; totalUsers: number; newSellers: number; newRiders: number
  newProducts: number; totalProducts: number; totalOrders: number
  completedOrders: number; completionRate: number; revenue: number
  platformCommission: number; flutterwaveFees: number; netRevenue: number
  revenueTrend: number | null   // null when range='all' (not applicable)
  dau: number; wau: number; mau: number
  retentionDay1: number; retentionDay7: number; repeatBuyerPct: number
  appOpens: number; productViews: number; addToCart: number; checkoutSuccessPct: number
  activeSellers: number; ordersPerSeller: number; listingGrowthPct: number
  avgDeliveryMinutes: number; riderCompletionRate: number; failedDeliveryPct: number
  gmv: number; cac: number; ltv: number
  topCategories: { category: string; count: number }[]
  referrals: { newRewards: number; totalPaidOut: number }
}

interface University { id: string; name: string; shortName: string }

const fmt    = (n: number) => n.toLocaleString()
const fmtNgn = (n: number) => `₦${fmt(Math.round(n))}`
const fmtPct = (n: number) => `${n.toFixed(1)}%`
const fmtMin = (n: number) => n >= 60 ? `${Math.floor(n / 60)}h ${n % 60}m` : `${n}m`

function delta(val: number, good: 'up' | 'down' = 'up') {
  const isPositive = val >= 0
  const isGood = good === 'up' ? isPositive : !isPositive
  return { isPositive, isGood }
}

function SectionHeader({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <p className="ui-eyebrow mb-5">
      <span className="text-ink-muted">{icon}</span>
      {label}
    </p>
  )
}

/**
 * A single KPI. Deliberately monochrome — with twenty of these on one screen,
 * per-tile accent colour was pure decoration, and it drowned out the trend
 * arrows, which are the only thing here that genuinely signals good or bad.
 */
function KpiCard({
  label, value, sub, icon, trend, trendGood = 'up', trendNA = false,
}: {
  label: string; value: string | number; sub?: string; icon?: React.ReactNode
  trend?: number | null; trendGood?: 'up' | 'down'
  trendNA?: boolean  // show "N/A" instead of a percentage
}) {
  const hasTrend = trend !== undefined && trend !== null
  const { isPositive, isGood } = hasTrend ? delta(trend!, trendGood) : { isPositive: true, isGood: true }

  return (
    <div className="relative flex flex-col gap-3 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="ui-mono ui-mono-sm text-ink-muted">{label}</span>
        {icon && <span className="flex-shrink-0 text-ink-muted">{icon}</span>}
      </div>

      <p className="ui-figure text-[clamp(1.35rem,2.6vw,1.75rem)] leading-none text-ink">{value}</p>

      <div className="mt-auto flex items-center justify-between gap-2">
        {sub && <span className="text-[11px] leading-snug text-ink-muted">{sub}</span>}
        {trendNA && <span className="ui-mono ui-mono-sm ml-auto text-ink-muted">n/a</span>}
        {hasTrend && !trendNA && (
          <span
            className={`ml-auto flex flex-shrink-0 items-center gap-0.5 text-[11px] font-medium tabular-nums ${
              isGood ? 'text-success' : 'text-danger'
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
            ) : (
              <ArrowDownRight className="h-3 w-3" strokeWidth={2} />
            )}
            {Math.abs(trend!).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

function DataRow({ label, value, sub, flag }: { label: string; value: string; sub?: string; flag?: 'ok' | 'warn' | 'danger' }) {
  const flagColor = flag === 'ok' ? 'bg-success' : flag === 'warn' ? 'bg-warning' : flag === 'danger' ? 'bg-danger' : 'bg-transparent'
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-2">
        {flag && <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${flagColor}`} />}
        <span className="text-[13px] text-ink-secondary">{label}</span>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className="ui-figure text-[14px] text-ink">{value}</span>
        {sub && <p className="mt-0.5 text-[10px] text-ink-muted">{sub}</p>}
      </div>
    </div>
  )
}

/** Wraps a KPI row in the hairline grid the rest of the panel uses. */
function KpiRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
      {children}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData]               = useState<AnalyticsData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [range, setRange]             = useState('7days')
  const [selectedUni, setSelectedUni] = useState('all')
  const [universities, setUniversities] = useState<University[]>([])

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    fetch('/api/universities', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUniversities(d.universities ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchAnalytics() }, [range, selectedUni])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const qs = new URLSearchParams({ range })
      if (selectedUni !== 'all') qs.set('universityId', selectedUni)
      const res = await fetch(`/api/admin/analytics?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const selectedUniName = selectedUni === 'all'
    ? 'All Universities'
    : universities.find(u => u.id === selectedUni)?.shortName ?? ''

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    )
  }

  const d = data!

  return (
    <div className="space-y-10 pb-10">

      {/* ── Header ── */}
      <AdminHeader
        eyebrow="Insight"
        title="Analytics"
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
                  <option key={u.id} value={u.id}>{u.shortName}</option>
                ))}
              </select>
            </div>

            {/* Range selector */}
            <div className="flex border border-border bg-card">
              {[['7days', '7D'], ['30days', '30D'], ['90days', '90D'], ['all', 'All']].map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setRange(v)}
                  aria-pressed={range === v}
                  className={`h-9 px-3.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-300 ${
                    range === v
                      ? 'bg-ink text-background'
                      : 'text-ink-secondary hover:bg-surface hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <AdminButton onClick={fetchAnalytics} icon={RefreshCw}>Refresh</AdminButton>
          </>
        }
      />

      {!data ? (
        <p className="text-ink-secondary text-center py-12">No data available</p>
      ) : (
        <>
          {/* ── Growth ── */}
          <div>
            <SectionHeader label="Growth" icon={<TrendingUp className="h-3.5 w-3.5" strokeWidth={1.75} />} />
            <KpiRow>
              <KpiCard label="New users"    value={fmt(d.newUsers)}    icon={<Users className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              <KpiCard label="New sellers"  value={fmt(d.newSellers)}  icon={<Store className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              <KpiCard label="New riders"   value={fmt(d.newRiders)}   icon={<Bike className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              <KpiCard label="New products" value={fmt(d.newProducts)} icon={<Package className="h-3.5 w-3.5" strokeWidth={1.75} />} />
            </KpiRow>
          </div>

          {/* ── Revenue ── */}
          <div>
            <SectionHeader label="Revenue" icon={<DollarSign className="h-3.5 w-3.5" strokeWidth={1.75} />} />
            <KpiRow>
              {/* revenueTrend is null for the 'all' range — show N/A rather than 0% */}
              <KpiCard
                label="GMV"
                value={fmtNgn(d.gmv)}
                icon={<ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.75} />}
                trend={d.revenueTrend ?? undefined}
                trendNA={d.revenueTrend === null}
              />
              <KpiCard label="Commission"  value={fmtNgn(d.platformCommission)} icon={<CreditCard className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              {/* FIX #6: net revenue now correctly deducts Flutterwave fees — label updated */}
              <KpiCard
                label="Net revenue"
                value={fmtNgn(d.netRevenue)}
                icon={<Shield className="h-3.5 w-3.5" strokeWidth={1.75} />}
                sub={`−₦${fmt(Math.round(d.flutterwaveFees || 0))} Flutterwave fees`}
              />
              <KpiCard label="Orders" value={fmt(d.totalOrders)} icon={<CheckCircle className="h-3.5 w-3.5" strokeWidth={1.75} />} sub={`${d.completionRate}% completed`} />
            </KpiRow>
          </div>

          {/* ── Engagement ── */}
          <div>
            <SectionHeader label="Engagement" icon={<Activity className="h-3.5 w-3.5" strokeWidth={1.75} />} />
            {/* FIX #7: DAU/WAU/MAU labels clarified as rolling windows (not period-scoped) */}
            <p className="text-[11px] text-ink-muted mb-3 -mt-2">
              DAU / WAU / MAU are rolling windows (last 24h / 7d / 30d), not scoped to the selected range.
            </p>
            <KpiRow>
              <KpiCard label="DAU (24h)"  value={fmt(d.dau)}  icon={<Zap className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              <KpiCard label="WAU (7d)"   value={fmt(d.wau)}  icon={<Activity className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              <KpiCard label="MAU (30d)"  value={fmt(d.mau)}  icon={<Users className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              <KpiCard label="Repeat buyers" value={fmtPct(d.repeatBuyerPct)} icon={<Repeat className="h-3.5 w-3.5" strokeWidth={1.75} />} sub="of all buyers" />
            </KpiRow>
          </div>

          {/* ── Marketplace Health + Logistics ── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="ui-panel">
              <SectionHeader label="Marketplace health" icon={<BarChart2 className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              {/* FIX #5: activeSellers = sellers who received completed orders (not just listed) */}
              <DataRow label="Active sellers (with orders)"  value={fmt(d.activeSellers)}    flag={d.activeSellers > 10 ? 'ok' : 'warn'} />
              <DataRow label="Completed orders per seller"   value={d.ordersPerSeller.toFixed(1)} />
              <DataRow label="Total products"                value={fmt(d.totalProducts)} />
              <DataRow label="Referral rewards"              value={fmt(d.referrals.newRewards)} sub={`₦${fmt(d.referrals.totalPaidOut)} paid out`} />
              {/* FIX #4: retentionDay1 is buyer activation rate — renamed for clarity */}
              <DataRow label="New buyer activation rate"     value={fmtPct(d.retentionDay1)} sub="new buyers who placed an order" />
            </div>
            <div className="ui-panel">
              <SectionHeader label="Logistics" icon={<Bike className="h-3.5 w-3.5" strokeWidth={1.75} />} />
              {/* FIX #2: avgDeliveryMinutes now uses deliveredAt (actual delivery time) */}
              <DataRow label="Avg delivery time (order→delivery)" value={fmtMin(d.avgDeliveryMinutes)} flag={d.avgDeliveryMinutes < 60 ? 'ok' : d.avgDeliveryMinutes < 120 ? 'warn' : 'danger'} />
              {/* FIX #1: riderCompletionRate is now actual rider delivery rate */}
              <DataRow label="Rider delivery rate"          value={fmtPct(d.riderCompletionRate)} flag={d.riderCompletionRate > 80 ? 'ok' : 'warn'} />
              <DataRow label="Order completion rate"        value={fmtPct(d.completionRate)}       flag={d.completionRate > 70 ? 'ok' : 'warn'} />
              <DataRow label="Failed delivery %"            value={fmtPct(d.failedDeliveryPct)}    flag={d.failedDeliveryPct < 5 ? 'ok' : 'danger'} />
            </div>
          </div>

          {/* ── Top Categories ── */}
          <div className="ui-panel">
            <SectionHeader label={`Top categories · ${range === 'all' ? 'all time' : range}`} icon={<Target className="h-3.5 w-3.5" strokeWidth={1.75} />} />
            <div className="space-y-3">
              {d.topCategories.length === 0 ? (
                <p className="text-ink-muted text-sm text-center py-4">No product listings in this period</p>
              ) : d.topCategories.map((c) => {
                const max = d.topCategories[0]?.count || 1
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-ink-secondary">{c.category}</span>
                      <span className="ui-figure text-[13px] text-ink">{fmt(c.count)}</span>
                    </div>
                    <div className="h-[3px] bg-surface">
                      <div
                        className="h-full bg-ink transition-[width] duration-700 ease-out"
                        style={{ width: `${(c.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}