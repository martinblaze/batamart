// app/(admin)/admin/page.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Users, AlertTriangle,
  Flag, CheckCircle, Clock, Building2, RefreshCw,
} from 'lucide-react'
import {
  AdminHeader, StatGrid, AdminPanel, AdminEmpty, AdminButton, type AdminStat,
} from '@/components/admin/AdminUI'

interface DashboardStats {
  totalUsers: number
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  pendingDisputes: number
  activeReports: number
  newUsersToday: number
  ordersToday: number
}

interface University {
  id: string
  name: string
  shortName: string
  isActive: boolean
}

function UniversitySwitcher({
  universities,
  value,
  onChange,
}: {
  universities: University[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex h-9 items-center gap-2 border border-border bg-card px-3">
      <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="University"
        className="cursor-pointer bg-transparent text-[13px] text-ink focus:outline-none"
      >
        <option value="all">All universities</option>
        {universities.map(u => (
          <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>
        ))}
      </select>
    </div>
  )
}

function getAdminToken() {
  let token = localStorage.getItem('adminToken')

  if (!token) {
    const cookies = document.cookie.split(';')
    const adminCookie = cookies.find(c => c.trim().startsWith('adminToken='))
    if (adminCookie) {
      token = adminCookie.split('=')[1]
      localStorage.setItem('adminToken', token)
    }
  }

  return token
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [universities, setUniversities] = useState<University[]>([])
  const [selectedUni, setSelectedUni] = useState('all')
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsSaving, setPaymentsSaving] = useState(false)

  const fetchDashboardData = async (universityId: string) => {
    setLoading(true)
    try {
      const token = getAdminToken()

      if (!token) {
        console.error('No admin token found. Redirecting to login...')
        window.location.href = '/admin-login'
        return
      }

      const qs = universityId !== 'all' ? `?universityId=${universityId}` : ''

      const [statsRes, activityRes] = await Promise.all([
        fetch(`/api/admin/dashboard/stats${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/dashboard/activity', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data.stats)
        if (data.universities?.length) setUniversities(data.universities)
      } else if (statsRes.status === 401 || statsRes.status === 403) {
        console.error('Token validation failed. Redirecting to login...')
        localStorage.removeItem('adminToken')
        window.location.href = '/admin-login'
        return
      }

      if (activityRes.ok) {
        const data = await activityRes.json()
        setRecentActivity(data.activity || [])
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPaymentSetting = async () => {
    setPaymentsLoading(true)
    try {
      const res = await fetch('/api/payment-availability')
      const data = await res.json()
      if (res.ok) {
        setPaymentsEnabled(data.enabled !== false)
      }
    } catch (error) {
      console.error('Failed to fetch payment availability:', error)
    } finally {
      setPaymentsLoading(false)
    }
  }

  const togglePaymentSetting = async () => {
    if (paymentsSaving) return
    setPaymentsSaving(true)
    try {
      const token = getAdminToken()

      if (!token) {
        window.location.href = '/admin-login'
        return
      }

      const res = await fetch('/api/payment-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: !paymentsEnabled }),
      })
      const data = await res.json()
      if (res.ok) {
        setPaymentsEnabled(Boolean(data.enabled))
      }
    } catch (error) {
      console.error('Failed to toggle payment availability:', error)
    } finally {
      setPaymentsSaving(false)
    }
  }

  useEffect(() => {
    fetchDashboardData(selectedUni)
    fetchPaymentSetting()
  }, [selectedUni])

  const refreshAll = () => {
    fetchDashboardData(selectedUni)
    fetchPaymentSetting()
  }

  const selectedUniName = selectedUni === 'all'
    ? 'All Universities'
    : universities.find(u => u.id === selectedUni)?.shortName ?? ''

  // Only the two figures that represent work waiting on an admin carry a
  // colour; the rest are neutral so attention lands where it is needed.
  const statCards: AdminStat[] = [
    {
      label: 'Users',
      value: (stats?.totalUsers || 0).toLocaleString(),
      note: `+${stats?.newUsersToday || 0} today`,
    },
    {
      label: 'Products',
      value: (stats?.totalProducts || 0).toLocaleString(),
      note: 'Active listings',
    },
    {
      label: 'Orders',
      value: (stats?.totalOrders || 0).toLocaleString(),
      note: `+${stats?.ordersToday || 0} today`,
    },
    {
      label: 'Revenue',
      value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`,
      note: 'All-time GMV',
    },
    {
      label: 'Open disputes',
      value: stats?.pendingDisputes || 0,
      note: 'Needs attention',
      tone: (stats?.pendingDisputes || 0) > 0 ? 'warning' : 'default',
    },
    {
      label: 'Active reports',
      value: stats?.activeReports || 0,
      note: 'Awaiting review',
      tone: (stats?.activeReports || 0) > 0 ? 'danger' : 'default',
    },
  ]

  const activityIcon = (type: string) => {
    if (type === 'order') return CheckCircle
    if (type === 'dispute') return AlertTriangle
    if (type === 'report') return Flag
    return Users
  }

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Overview"
        title="Dashboard"
        description={
          <>
            Showing figures for <span className="font-medium text-ink">{selectedUniName}</span>.
          </>
        }
        actions={
          <>
            <UniversitySwitcher
              universities={universities}
              value={selectedUni}
              onChange={setSelectedUni}
            />
            <AdminButton onClick={refreshAll} icon={RefreshCw} title="Refresh">
              Refresh
            </AdminButton>
          </>
        }
      />

      {/* Checkout kill-switch — the one destructive control on this page. */}
      <AdminPanel title="Checkout payments">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-ink-secondary">
              Turns the checkout payment button on or off for every buyer at once.
            </p>
            <p className="ui-mono ui-mono-sm mt-3 flex items-center gap-2 text-ink">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  paymentsLoading ? 'bg-ink-muted' : paymentsEnabled ? 'bg-success' : 'bg-warning'
                }`}
              />
              {paymentsLoading ? 'Checking…' : paymentsEnabled ? 'Currently on' : 'Currently off'}
            </p>
          </div>
          <AdminButton
            onClick={togglePaymentSetting}
            disabled={paymentsLoading || paymentsSaving}
            tone={paymentsEnabled ? 'warning' : 'success'}
            className="h-11 flex-shrink-0 px-6"
          >
            {paymentsSaving ? 'Saving…' : paymentsEnabled ? 'Disable payments' : 'Enable payments'}
          </AdminButton>
        </div>
      </AdminPanel>

      <StatGrid stats={statCards} columns={3} loading={loading} />

      <AdminPanel title="Recent activity" padded={false}>
        {recentActivity.length === 0 ? (
          <AdminEmpty
            className="border-0"
            icon={Clock}
            title="Nothing recent"
            description="New orders, disputes and reports will appear here as they happen."
          />
        ) : (
          <div className="ui-divide">
            {recentActivity.map((activity, index) => {
              const Icon = activityIcon(activity.type)
              return (
                <div key={index} className="ui-row">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-border bg-surface">
                    <Icon className="h-4 w-4 text-ink-secondary" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{activity.message}</p>
                    <p className="ui-mono ui-mono-sm mt-1 text-ink-muted">{activity.timestamp}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </AdminPanel>
    </div>
  )
}
