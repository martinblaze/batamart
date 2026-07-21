'use client'
// app/(admin)/admin/analytics/page.tsx

import { useState, useEffect } from 'react'
import {
  TrendingUp, TrendingDown, Users, Package, ShoppingBag, DollarSign,
  CheckCircle, Gift, Store, Bike, Activity, BarChart2, Target,
  AlertTriangle, Clock, RefreshCw, ArrowUpRight, ArrowDownRight,
  Layers, Zap, Shield, CreditCard, UserCheck, Repeat, Building2,
} from 'lucide-react'

interface AnalyticsData {
  newUsers: number; totalUsers: number; newSellers: number; newRiders: number
  newProducts: number; totalProducts: number; totalOrders: number
  completedOrders: number; completionRate: number; revenue: number
  platformCommission: number; credoFees: number; netRevenue: number
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
    <div className="flex items-center gap-3 mb-4">
      <div className="text-primary">{icon}</div>
      <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-secondary">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function KpiCard({
  label, value, sub, icon, trend, trendGood = 'up', accent = 'red', trendNA = false,
}: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode
  trend?: number | null; trendGood?: 'up' | 'down'
  accent?: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'cyan' | 'pink'
  trendNA?: boolean  // show "N/A" instead of a percentage
}) {
  // Design bible: admin charts/stats use --color-primary plus status colors only —
  // every accent name collapses onto one of the four tokens, no rainbow variety.
  const accentMap: Record<string, string> = {
    red: 'border-danger/30 bg-danger/5', blue: 'border-primary/30 bg-primary/5',
    green: 'border-success/30 bg-success/5', yellow: 'border-warning/30 bg-warning/5',
    purple: 'border-primary/30 bg-primary/5', orange: 'border-warning/30 bg-warning/5',
    cyan: 'border-primary/30 bg-primary/5', pink: 'border-primary/30 bg-primary/5',
  }
  const iconMap: Record<string, string> = {
    red: 'text-danger', blue: 'text-primary', green: 'text-success',
    yellow: 'text-warning', purple: 'text-primary', orange: 'text-warning',
    cyan: 'text-primary', pink: 'text-primary',
  }

  const hasTrend = trend !== undefined && trend !== null
  const { isPositive, isGood } = hasTrend ? delta(trend!, trendGood) : { isPositive: true, isGood: true }

  return (
    <div className={`border ${accentMap[accent]} rounded-lg p-4 flex flex-col gap-2 relative overflow-hidden`}>
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-semibold tracking-widest uppercase text-ink-muted">{label}</span>
        <span className={iconMap[accent]}>{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-ink font-mono leading-none tracking-tight">{value}</p>
      <div className="flex items-center justify-between mt-auto">
        {sub && <span className="text-[11px] text-ink-muted">{sub}</span>}
        {trendNA && (
          <span className="text-[11px] text-ink-muted ml-auto">vs prev: N/A</span>
        )}
        {hasTrend && !trendNA && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold ml-auto ${isGood ? 'text-success' : 'text-danger'}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
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
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        {flag && <span className={`w-1.5 h-1.5 rounded-full ${flagColor} flex-shrink-0`} />}
        <span className="text-[12px] text-ink-secondary">{label}</span>
      </div>
      <div className="text-right">
        <span className="text-[13px] text-ink font-mono font-semibold">{value}</span>
        {sub && <p className="text-[10px] text-ink-muted">{sub}</p>}
      </div>
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const d = data!

  return (
    <div className="space-y-8 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Analytics</h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            <span className="text-ink font-medium">{selectedUniName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* University switcher */}
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2">
            <Building2 className="w-4 h-4 text-ink-secondary flex-shrink-0" />
            <select
              value={selectedUni}
              onChange={e => setSelectedUni(e.target.value)}
              className="bg-transparent text-ink text-sm font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Universities</option>
              {universities.map(u => (
                <option key={u.id} value={u.id}>{u.shortName}</option>
              ))}
            </select>
          </div>
          {/* Range selector */}
          <div className="flex bg-white border border-border rounded-xl overflow-hidden">
            {[['7days', '7D'], ['30days', '30D'], ['90days', '90D'], ['all', 'All']].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setRange(v)}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  range === v
                    ? 'bg-danger text-white'
                    : 'text-ink-secondary hover:text-ink hover:bg-surface'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAnalytics}
            className="p-2 bg-white border border-border rounded-xl text-ink-secondary hover:text-ink transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!data ? (
        <p className="text-ink-secondary text-center py-12">No data available</p>
      ) : (
        <>
          {/* ── Growth ── */}
          <div>
            <SectionHeader label="Growth" icon={<TrendingUp className="w-4 h-4" />} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="New users"    value={fmt(d.newUsers)}    icon={<Users className="w-4 h-4" />}   accent="blue" />
              <KpiCard label="New sellers"  value={fmt(d.newSellers)}  icon={<Store className="w-4 h-4" />}   accent="green" />
              <KpiCard label="New riders"   value={fmt(d.newRiders)}   icon={<Bike className="w-4 h-4" />}    accent="cyan" />
              <KpiCard label="New products" value={fmt(d.newProducts)} icon={<Package className="w-4 h-4" />} accent="purple" />
            </div>
          </div>

          {/* ── Revenue ── */}
          <div>
            <SectionHeader label="Revenue" icon={<DollarSign className="w-4 h-4" />} />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* FIX #9: revenueTrend is null for 'all' range — show N/A badge */}
              <KpiCard
                label="GMV"
                value={fmtNgn(d.gmv)}
                icon={<ShoppingBag className="w-4 h-4" />}
                accent="yellow"
                trend={d.revenueTrend ?? undefined}
                trendNA={d.revenueTrend === null}
              />
              <KpiCard label="Commission"  value={fmtNgn(d.platformCommission)} icon={<CreditCard className="w-4 h-4" />} accent="orange" />
              {/* FIX #6: net revenue now correctly deducts Credo fees — label updated */}
              <KpiCard
                label="Net revenue"
                value={fmtNgn(d.netRevenue)}
                icon={<Shield className="w-4 h-4" />}
                accent="green"
                sub={`−₦${fmt(Math.round(d.credoFees || 0))} Credo fees`}
              />
              <KpiCard label="Orders" value={fmt(d.totalOrders)} icon={<CheckCircle className="w-4 h-4" />} accent="blue" sub={`${d.completionRate}% completed`} />
            </div>
          </div>

          {/* ── Engagement ── */}
          <div>
            <SectionHeader label="Engagement" icon={<Activity className="w-4 h-4" />} />
            {/* FIX #7: DAU/WAU/MAU labels clarified as rolling windows (not period-scoped) */}
            <p className="text-[11px] text-ink-muted mb-3 -mt-2">
              DAU / WAU / MAU are rolling windows (last 24h / 7d / 30d), not scoped to the selected range.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="DAU (rolling 24h)"  value={fmt(d.dau)}  icon={<Zap className="w-4 h-4" />}       accent="red" />
              <KpiCard label="WAU (rolling 7d)"   value={fmt(d.wau)}  icon={<Activity className="w-4 h-4" />}  accent="orange" />
              <KpiCard label="MAU (rolling 30d)"  value={fmt(d.mau)}  icon={<Users className="w-4 h-4" />}     accent="purple" />
              {/* FIX #3: repeatBuyerPct now uses total buyers as denominator */}
              <KpiCard label="Repeat buyers" value={fmtPct(d.repeatBuyerPct)} icon={<Repeat className="w-4 h-4" />} accent="cyan" sub="of all buyers" />
            </div>
          </div>

          {/* ── Marketplace Health + Logistics ── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <SectionHeader label="Marketplace health" icon={<BarChart2 className="w-4 h-4" />} />
              {/* FIX #5: activeSellers = sellers who received completed orders (not just listed) */}
              <DataRow label="Active sellers (with orders)"  value={fmt(d.activeSellers)}    flag={d.activeSellers > 10 ? 'ok' : 'warn'} />
              <DataRow label="Completed orders per seller"   value={d.ordersPerSeller.toFixed(1)} />
              <DataRow label="Total products"                value={fmt(d.totalProducts)} />
              <DataRow label="Referral rewards"              value={fmt(d.referrals.newRewards)} sub={`₦${fmt(d.referrals.totalPaidOut)} paid out`} />
              {/* FIX #4: retentionDay1 is buyer activation rate — renamed for clarity */}
              <DataRow label="New buyer activation rate"     value={fmtPct(d.retentionDay1)} sub="new buyers who placed an order" />
            </div>
            <div className="bg-surface border border-border rounded-2xl p-5">
              <SectionHeader label="Logistics" icon={<Bike className="w-4 h-4" />} />
              {/* FIX #2: avgDeliveryMinutes now uses deliveredAt (actual delivery time) */}
              <DataRow label="Avg delivery time (order→delivery)" value={fmtMin(d.avgDeliveryMinutes)} flag={d.avgDeliveryMinutes < 60 ? 'ok' : d.avgDeliveryMinutes < 120 ? 'warn' : 'danger'} />
              {/* FIX #1: riderCompletionRate is now actual rider delivery rate */}
              <DataRow label="Rider delivery rate"          value={fmtPct(d.riderCompletionRate)} flag={d.riderCompletionRate > 80 ? 'ok' : 'warn'} />
              <DataRow label="Order completion rate"        value={fmtPct(d.completionRate)}       flag={d.completionRate > 70 ? 'ok' : 'warn'} />
              <DataRow label="Failed delivery %"            value={fmtPct(d.failedDeliveryPct)}    flag={d.failedDeliveryPct < 5 ? 'ok' : 'danger'} />
            </div>
          </div>

          {/* ── Top Categories ── */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            {/* FIX #8: topCategories is now period-scoped — label updated */}
            <SectionHeader label={`Top categories (${range === 'all' ? 'all time' : range})`} icon={<Target className="w-4 h-4" />} />
            <div className="space-y-3">
              {d.topCategories.length === 0 ? (
                <p className="text-ink-muted text-sm text-center py-4">No product listings in this period</p>
              ) : d.topCategories.map((c) => {
                const max = d.topCategories[0]?.count || 1
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-secondary">{c.category}</span>
                      <span className="text-ink font-mono">{fmt(c.count)}</span>
                    </div>
                    <div className="h-1.5 bg-white rounded-full">
                      <div
                        className="h-full bg-danger rounded-full transition-all duration-700"
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