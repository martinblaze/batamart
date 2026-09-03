'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import {
  AdminHeader, AdminPanel, StatGrid, AdminButton, type AdminStat,
} from '@/components/admin/AdminUI'
import { DataRow } from '@/components/ui/Shell'

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
  const headroomMb = dbSizeMb === null ? null : Math.max(0, Math.round((500 - dbSizeMb) * 10) / 10)

  // Storage is the only figure with a ceiling, so it is the only one that
  // earns a colour — and only once it is actually close to that ceiling.
  const storageTone: AdminStat['tone'] =
    headroomMb === null ? 'default' : headroomMb < 50 ? 'danger' : headroomMb < 150 ? 'warning' : 'default'

  const stats: AdminStat[] = usage
    ? [
        {
          label: 'Database size',
          value: usage.dbSize || 'Unknown',
          note:
            headroomMb === null
              ? 'Supabase size estimate'
              : `${headroomMb.toLocaleString()} MB before the 500 MB free-tier mark`,
          tone: storageTone,
        },
        { label: 'Users', value: numberFmt(usage.userCount), note: 'Total accounts' },
        { label: 'Products', value: numberFmt(usage.productCount), note: 'Total product records' },
        { label: 'Orders', value: numberFmt(usage.orderCount), note: 'Total order records' },
        {
          label: 'Notifications',
          value: numberFmt(usage.notificationCount),
          note: 'Grows fastest — prune here first',
        },
      ]
    : []

  return (
    <div className="space-y-8 pb-10">
      <AdminHeader
        eyebrow="Infrastructure"
        title="Usage"
        description="Database size and table counts, for keeping the deployment inside its free-tier limits."
        actions={
          <AdminButton onClick={fetchUsage} disabled={loading} icon={RefreshCw}>
            Refresh
          </AdminButton>
        }
      />

      {error && (
        <div className="flex items-start gap-3 border border-danger/25 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-medium text-danger">Usage data unavailable</p>
            <p className="mt-1 text-sm text-danger/80">{error}</p>
          </div>
        </div>
      )}

      {loading && !usage ? (
        <StatGrid stats={Array.from({ length: 5 }, () => ({ label: '', value: '' }))} loading />
      ) : usage ? (
        <>
          <StatGrid stats={stats} columns={3} />

          <AdminPanel title="Free-tier watchlist">
            <div className="ui-divide">
              <DataRow label="Supabase storage" value={usage.dbSize || 'Unknown'} />
              <DataRow label="Prune this table first" value="Notifications" />
              <DataRow
                label="Last refreshed"
                value={lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
              />
            </div>
          </AdminPanel>
        </>
      ) : null}
    </div>
  )
}
