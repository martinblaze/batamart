'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Database,
  HardDrive,
  Package,
  RefreshCw,
  ShoppingBag,
  Users,
} from 'lucide-react'

interface UsageData {
  dbSize: string | null
  notificationCount: number
  productCount: number
  userCount: number
  orderCount: number
}

function numberFmt(value: number) {
  return value.toLocaleString()
}

function parseSizeToMb(size: string | null) {
  if (!size) return null
  const match = size.trim().match(/^([\d.]+)\s*(bytes|kB|MB|GB|TB)$/i)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2].toLowerCase()
  if (!Number.isFinite(value)) return null
  if (unit === 'bytes') return value / 1024 / 1024
  if (unit === 'kb') return value / 1024
  if (unit === 'mb') return value
  if (unit === 'gb') return value * 1024
  if (unit === 'tb') return value * 1024 * 1024
  return null
}

function UsageCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string
  value: string
  sub: string
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className="bg-white border border-border rounded-2xl p-6 hover:border-border transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${accent}`}>
          {icon}
        </div>
        <span className="text-xs text-ink-muted bg-surface px-2 py-1 rounded-full">Live</span>
      </div>
      <h3 className="text-ink-secondary text-sm font-medium mb-1">{label}</h3>
      <p className="text-3xl font-semibold text-ink mb-2 font-mono">{value}</p>
      <p className="text-sm text-ink-muted">{sub}</p>
    </div>
  )
}

export default function AdminUsagePage() {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchUsage = async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch('/api/admin/usage', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Failed to load usage data')
        setUsage(null)
        return
      }
      setUsage(data)
      setLastUpdated(new Date())
    } catch {
      setError('Failed to load usage data')
      setUsage(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  const dbSizeMb = useMemo(() => parseSizeToMb(usage?.dbSize ?? null), [usage?.dbSize])
  const dbSizeSub = dbSizeMb === null
    ? 'Supabase database size estimate'
    : `${Math.max(0, Math.round((500 - dbSizeMb) * 10) / 10).toLocaleString()} MB before the 500 MB free-tier storage mark`

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Usage</h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            Database size and table counts for free-tier monitoring
          </p>
        </div>
        <button
          onClick={fetchUsage}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-border rounded-xl text-sm font-semibold text-ink-secondary hover:text-ink hover:border-border disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-danger/10 border border-danger/30 rounded-2xl p-4">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-danger">Usage data unavailable</p>
            <p className="text-sm text-danger/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {loading && !usage ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-2xl p-6 animate-pulse">
              <div className="h-12 w-12 rounded-xl bg-surface mb-4" />
              <div className="h-4 w-24 bg-surface rounded mb-2" />
              <div className="h-8 w-20 bg-surface rounded" />
            </div>
          ))}
        </div>
      ) : usage ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <UsageCard
              label="Database Size"
              value={usage.dbSize || 'Unknown'}
              sub={dbSizeSub}
              icon={<HardDrive className="w-6 h-6 text-primary" />}
              accent="bg-primary/10"
            />
            <UsageCard
              label="Users"
              value={numberFmt(usage.userCount)}
              sub="Total accounts in the database"
              icon={<Users className="w-6 h-6 text-primary" />}
              accent="bg-primary/10"
            />
            <UsageCard
              label="Products"
              value={numberFmt(usage.productCount)}
              sub="Total product records"
              icon={<Package className="w-6 h-6 text-success" />}
              accent="bg-success/10"
            />
            <UsageCard
              label="Orders"
              value={numberFmt(usage.orderCount)}
              sub="Total order records"
              icon={<ShoppingBag className="w-6 h-6 text-primary" />}
              accent="bg-primary/10"
            />
            <UsageCard
              label="Notifications"
              value={numberFmt(usage.notificationCount)}
              sub="Rows that can grow quickly over time"
              icon={<Bell className="w-6 h-6 text-warning" />}
              accent="bg-warning/100/10"
            />
          </div>

          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-ink">Free-Tier Watchlist</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 py-3 border-b border-border/60">
                <span className="text-ink-secondary">Supabase storage</span>
                <span className="font-mono text-ink">{usage.dbSize || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-3 border-b border-border/60">
                <span className="text-ink-secondary">Most likely table to prune first</span>
                <span className="font-mono text-ink">Notifications</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="text-ink-secondary">Last refreshed</span>
                <span className="font-mono text-ink">{lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}</span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
