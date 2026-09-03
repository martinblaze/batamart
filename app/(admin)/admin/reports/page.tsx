// app/(admin)/admin/reports/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Flag, Eye } from 'lucide-react'
import { ReportType, ReportStatus } from '@prisma/client'
import {
  AdminHeader, AdminEmpty, AdminLoading,
} from '@/components/admin/AdminUI'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'

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

  const getStatusTone = (status: string): BadgeStatus => {
    if (status === 'PENDING') return 'warning'
    if (status === 'UNDER_REVIEW') return 'verified'
    if (status === 'RESOLVED') return 'success'
    return 'neutral'
  }

  const selectClass =
    'h-9 border border-border bg-card px-3 text-[13px] text-ink transition-colors hover:border-ink/25 focus:border-ink/40 focus:outline-none'

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Moderation"
        title="Reports"
        description="Abuse and policy reports raised by users against a product, seller, rider or buyer."
        actions={
          <>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by status"
              className={selectClass}
            >
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
              <option value="ALL">All statuses</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filter by type"
              className={selectClass}
            >
              <option value="ALL">All types</option>
              <option value="PRODUCT">Product</option>
              <option value="SELLER">Seller</option>
              <option value="RIDER">Rider</option>
              <option value="BUYER">Buyer</option>
            </select>
          </>
        }
      />

      {loading ? (
        <AdminLoading rows={4} />
      ) : reports.length === 0 ? (
        <AdminEmpty
          icon={Flag}
          title="No reports here"
          description="Nothing matches these filters — widen them to see resolved and dismissed reports."
        />
      ) : (
        <div className="ui-divide border border-border bg-card">
          {reports.map((report) => (
            <article key={report.id} className="p-5 transition-colors duration-300 hover:bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge status="neutral">{report.type}</Badge>
                    <Badge status="warning">{report.reason}</Badge>
                  </div>
                  <p className="mt-3.5 text-sm text-ink">
                    Reported by <span className="font-medium">{report.reporter.name}</span>
                  </p>
                  {report.reportedUser && (
                    <p className="mt-1 text-sm text-ink-secondary">
                      Against: {report.reportedUser.name}
                    </p>
                  )}
                  {report.reportedProduct && (
                    <p className="mt-1 text-sm text-ink-secondary">
                      Product: {report.reportedProduct.name}
                    </p>
                  )}
                </div>
                <Badge status={getStatusTone(report.status)}>
                  {report.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              {report.description && (
                <p className="mt-5 max-w-[70ch] text-sm leading-relaxed text-ink-secondary">
                  {report.description}
                </p>
              )}

              <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
                <span className="ui-mono ui-mono-sm text-ink-muted">
                  {new Date(report.createdAt).toLocaleDateString()}
                </span>
                <Link
                  href={`/admin/reports/${report.id}`}
                  className="ui-mono ui-mono-sm inline-flex h-9 items-center gap-2 bg-ink px-4 text-background transition-colors hover:bg-ink/90"
                >
                  <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                  Review
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}