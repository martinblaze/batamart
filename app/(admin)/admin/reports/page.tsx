// app/(admin)/admin/reports/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Flag, Eye, Clock } from 'lucide-react'
import { ReportType, ReportStatus } from '@prisma/client'

interface Report {
  id: string
  type: ReportType
  reason: string
  description: string
  status: ReportStatus
  createdAt: string
  reporter: { id: string; name: string }
  reportedUser?: { id: string; name: string }
  reportedProduct?: { id: string; name: string }
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('PENDING')
  const [filterType, setFilterType] = useState<string>('ALL')

  useEffect(() => {
    fetchReports()
  }, [filterStatus, filterType])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const params = new URLSearchParams()
      if (filterStatus !== 'ALL') params.set('status', filterStatus)
      if (filterType !== 'ALL') params.set('type', filterType)

      const response = await fetch(`/api/admin/reports?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setReports(data.reports)
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PRODUCT': return 'bg-primary/10 text-primary'
      case 'SELLER': return 'bg-success/10 text-success'
      case 'RIDER': return 'bg-primary/10 text-primary'
      case 'BUYER': return 'bg-warning/10 text-warning'
      default: return 'bg-surface text-ink-secondary'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 bg-white border border-border rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="PENDING">Pending</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="DISMISSED">Dismissed</option>
          <option value="ALL">All Status</option>
        </select>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-3 bg-white border border-border rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="ALL">All Types</option>
          <option value="PRODUCT">Product</option>
          <option value="SELLER">Seller</option>
          <option value="RIDER">Rider</option>
          <option value="BUYER">Buyer</option>
        </select>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 bg-white border border-border rounded-2xl">
            <Flag className="w-16 h-16 text-ink-muted mx-auto mb-4" />
            <p className="text-ink-secondary">No reports found</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="bg-white border border-border rounded-2xl p-6 hover:shadow-soft transition-all">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-danger/10 rounded-xl">
                    <Flag className="w-6 h-6 text-danger" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(report.type)}`}>
                        {report.type}
                      </span>
                      <span className="px-3 py-1 bg-warning/10 text-warning rounded-full text-xs font-semibold">
                        {report.reason}
                      </span>
                    </div>
                    <p className="text-ink font-medium mb-1">
                      Reported by: {report.reporter.name}
                    </p>
                    {report.reportedUser && (
                      <p className="text-ink-secondary text-sm">Against: {report.reportedUser.name}</p>
                    )}
                    {report.reportedProduct && (
                      <p className="text-ink-secondary text-sm">Product: {report.reportedProduct.name}</p>
                    )}
                  </div>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  report.status === 'PENDING' ? 'bg-warning/10 text-warning' :
                  report.status === 'UNDER_REVIEW' ? 'bg-primary/10 text-primary' :
                  report.status === 'RESOLVED' ? 'bg-success/10 text-success' :
                  'bg-surface text-ink-secondary'
                }`}>
                  {report.status}
                </span>
              </div>

              <p className="text-ink-secondary mb-4">{report.description}</p>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <span className="text-sm text-ink-muted">
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
                <Link
                  href={`/admin/reports/${report.id}`}
                  className="px-4 py-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/10 transition-colors font-semibold text-sm flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Review
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}