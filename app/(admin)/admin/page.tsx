// app/(admin)/admin/page.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Users, Package, DollarSign, AlertTriangle,
  ShoppingBag, Flag, CheckCircle, Clock, Building2, RefreshCw,
} from 'lucide-react'

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
    <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2">
      <Building2 className="w-4 h-4 text-ink-secondary flex-shrink-0" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent text-ink text-sm font-medium focus:outline-none cursor-pointer"
      >
        <option value="all">All Universities</option>
        {universities.map(u => (
          <option key={u.id} value={u.id}>{u.shortName} - {u.name}</option>
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

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      change: `+${stats?.newUsersToday || 0} today`,
      icon: Users,
      bgColor: 'bg-primary/10',
      textColor: 'text-primary',
    },
    {
      title: 'Total Products',
      value: stats?.totalProducts || 0,
      change: 'Active listings',
      icon: Package,
      bgColor: 'bg-success/10',
      textColor: 'text-success',
    },
    {
      title: 'Total Orders',
      value: stats?.totalOrders || 0,
      change: `+${stats?.ordersToday || 0} today`,
      icon: ShoppingBag,
      bgColor: 'bg-primary/10',
      textColor: 'text-primary',
    },
    {
      title: 'Total Revenue',
      value: `₦${(stats?.totalRevenue || 0).toLocaleString()}`,
      change: 'All time GMV',
      icon: DollarSign,
      bgColor: 'bg-warning/10',
      textColor: 'text-warning',
    },
    {
      title: 'Pending Disputes',
      value: stats?.pendingDisputes || 0,
      change: 'Needs attention',
      icon: AlertTriangle,
      bgColor: 'bg-warning/10',
      textColor: 'text-warning',
    },
    {
      title: 'Active Reports',
      value: stats?.activeReports || 0,
      change: 'Awaiting review',
      icon: Flag,
      bgColor: 'bg-danger/10',
      textColor: 'text-danger',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-secondary mt-0.5">
            Showing stats for <span className="text-ink font-medium">{selectedUniName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UniversitySwitcher
            universities={universities}
            value={selectedUni}
            onChange={setSelectedUni}
          />
          <button
            onClick={refreshAll}
            className="p-2 bg-white border border-border rounded-xl text-ink-secondary hover:text-ink transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border border-border rounded-2xl p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ink font-semibold text-lg">Checkout Payments</p>
          <p className="text-sm text-ink-secondary mt-1">Turn the checkout payment button on or off for everyone.</p>
          <p className={`text-xs font-semibold mt-2 ${paymentsEnabled ? 'text-success' : 'text-warning'}`}>
            {paymentsLoading ? 'Loading status...' : paymentsEnabled ? 'Status: ON' : 'Status: OFF'}
          </p>
        </div>
        <button
          onClick={togglePaymentSetting}
          disabled={paymentsLoading || paymentsSaving}
          className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-60 ${
            paymentsEnabled ? 'bg-warning hover:brightness-95 text-white' : 'bg-success hover:brightness-95 text-white'
          }`}
        >
          {paymentsSaving ? 'Saving...' : paymentsEnabled ? 'Disable Payments' : 'Enable Payments'}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-2xl p-6 animate-pulse">
              <div className="h-12 w-12 rounded-xl bg-surface mb-4" />
              <div className="h-4 w-24 bg-surface rounded mb-2" />
              <div className="h-8 w-16 bg-surface rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div
                key={index}
                className="bg-white border border-border rounded-2xl p-6 hover:border-border transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.textColor}`} />
                  </div>
                  <span className="text-xs text-ink-muted bg-surface px-2 py-1 rounded-full">Live</span>
                </div>
                <h3 className="text-ink-secondary text-sm font-medium mb-1">{stat.title}</h3>
                <p className="text-3xl font-semibold text-ink mb-2">{stat.value}</p>
                <p className="text-sm text-ink-muted">{stat.change}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-white border border-border rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-ink mb-6">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.length === 0 ? (
            <p className="text-ink-secondary text-center py-8">No recent activity</p>
          ) : (
            recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-surface rounded-xl hover:bg-surface transition-colors"
              >
                <div className={`p-2 rounded-lg ${
                  activity.type === 'order' ? 'bg-success/10' :
                  activity.type === 'dispute' ? 'bg-warning/10' :
                  activity.type === 'report' ? 'bg-danger/10' :
                  'bg-primary/10'
                }`}>
                  {activity.type === 'order' && <CheckCircle className="w-5 h-5 text-success" />}
                  {activity.type === 'dispute' && <AlertTriangle className="w-5 h-5 text-warning" />}
                  {activity.type === 'report' && <Flag className="w-5 h-5 text-danger" />}
                  {activity.type === 'user' && <Users className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1">
                  <p className="text-ink font-medium">{activity.message}</p>
                  <p className="text-sm text-ink-secondary">{activity.timestamp}</p>
                </div>
                <Clock className="w-4 h-4 text-ink-muted" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
