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

// ── University Switcher ───────────────────────────────────────────────────────
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
    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
      <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent text-white text-sm font-medium focus:outline-none cursor-pointer"
      >
        <option value="all">All Universities</option>
        {universities.map(u => (
          <option key={u.id} value={u.id}>{u.shortName} — {u.name}</option>
        ))}
      </select>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [stats, setStats]             = useState<DashboardStats | null>(null)
  const [universities, setUniversities] = useState<University[]>([])
  const [selectedUni, setSelectedUni] = useState('all')
  const [loading, setLoading]         = useState(true)
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  useEffect(() => { fetchDashboardData(selectedUni) }, [selectedUni])

  const fetchDashboardData = async (universityId: string) => {
    setLoading(true)
    try {
      // Get token from localStorage with fallback to cookie parsing
      let token = localStorage.getItem('adminToken')
      
      if (!token) {
        // Try to get from cookie as fallback
        const cookies = document.cookie.split(';')
        const adminCookie = cookies.find(c => c.trim().startsWith('adminToken='))
        if (adminCookie) {
          token = adminCookie.split('=')[1]
          localStorage.setItem('adminToken', token)
        }
      }

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

  const selectedUniName = selectedUni === 'all'
    ? 'All Universities'
    : universities.find(u => u.id === selectedUni)?.shortName ?? ''

  const statCards = [
    {
      title:     'Total Users',
      value:     stats?.totalUsers || 0,
      change:    `+${stats?.newUsersToday || 0} today`,
      icon:      Users,
      bgColor:   'bg-blue-500/10',
      textColor: 'text-blue-400',
    },
    {
      title:     'Total Products',
      value:     stats?.totalProducts || 0,
      change:    'Active listings',
      icon:      Package,
      bgColor:   'bg-green-500/10',
      textColor: 'text-green-400',
    },
    {
      title:     'Total Orders',
      value:     stats?.totalOrders || 0,
      change:    `+${stats?.ordersToday || 0} today`,
      icon:      ShoppingBag,
      bgColor:   'bg-purple-500/10',
      textColor: 'text-purple-400',
    },
    {
      title:     'Total Revenue',
      value:     `₦${(stats?.totalRevenue || 0).toLocaleString()}`,
      change:    'All time GMV',
      icon:      DollarSign,
      bgColor:   'bg-yellow-500/10',
      textColor: 'text-yellow-400',
    },
    {
      title:     'Pending Disputes',
      value:     stats?.pendingDisputes || 0,
      change:    'Needs attention',
      icon:      AlertTriangle,
      bgColor:   'bg-orange-500/10',
      textColor: 'text-orange-400',
    },
    {
      title:     'Active Reports',
      value:     stats?.activeReports || 0,
      change:    'Awaiting review',
      icon:      Flag,
      bgColor:   'bg-red-500/10',
      textColor: 'text-red-400',
    },
  ]

  return (
    <div className="space-y-6">

      {/* ── Header row with university switcher ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Showing stats for <span className="text-white font-medium">{selectedUniName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UniversitySwitcher
            universities={universities}
            value={selectedUni}
            onChange={setSelectedUni}
          />
          <button
            onClick={() => fetchDashboardData(selectedUni)}
            className="p-2 bg-gray-800 border border-gray-700 rounded-xl text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-800 border border-gray-700 rounded-2xl p-6 animate-pulse">
              <div className="h-12 w-12 rounded-xl bg-gray-700 mb-4" />
              <div className="h-4 w-24 bg-gray-700 rounded mb-2" />
              <div className="h-8 w-16 bg-gray-700 rounded" />
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
                className="bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-gray-600 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.textColor}`} />
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded-full">Live</span>
                </div>
                <h3 className="text-gray-400 text-sm font-medium mb-1">{stat.title}</h3>
                <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.change}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Recent Activity ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-6">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No recent activity</p>
          ) : (
            recentActivity.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-4 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-colors"
              >
                <div className={`p-2 rounded-lg ${
                  activity.type === 'order'   ? 'bg-green-500/10' :
                  activity.type === 'dispute' ? 'bg-orange-500/10' :
                  activity.type === 'report'  ? 'bg-red-500/10' :
                  'bg-blue-500/10'
                }`}>
                  {activity.type === 'order'   && <CheckCircle className="w-5 h-5 text-green-400" />}
                  {activity.type === 'dispute' && <AlertTriangle className="w-5 h-5 text-orange-400" />}
                  {activity.type === 'report'  && <Flag className="w-5 h-5 text-red-400" />}
                  {activity.type === 'user'    && <Users className="w-5 h-5 text-blue-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{activity.message}</p>
                  <p className="text-sm text-gray-400">{activity.timestamp}</p>
                </div>
                <Clock className="w-4 h-4 text-gray-600" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}