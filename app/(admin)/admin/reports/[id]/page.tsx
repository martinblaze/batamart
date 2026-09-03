// app/(admin)/admin/reports/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Flag, User, AlertTriangle } from 'lucide-react'
import {
  AdminHeader, AdminPanel, AdminEmpty, AdminButton,
} from '@/components/admin/AdminUI'
import { DataRow } from '@/components/ui/Shell'
import { Badge } from '@/components/ui/Badge'

export default function ReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = params.id as string

  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(false)
  const [resolution, setResolution] = useState({
    action: 'DISMISS',
    actionNotes: '',
    penalizeReported: false,
    penaltyReason: ''
  })

  useEffect(() => {
    fetchReport()
  }, [])

  const fetchReport = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setReport(data.report)
      }
    } catch (error) {
      console.error('Failed to fetch report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async () => {
    if (!resolution.actionNotes.trim()) {
      alert('Please provide resolution notes')
      return
    }

    setResolving(true)
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resolution)
      })

      if (response.ok) {
        alert('Report resolved successfully')
        router.push('/admin/reports')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to resolve report')
      }
    } catch (error) {
      alert('An error occurred')
    } finally {
      setResolving(false)
    }
  }

  const labelClass =
    'mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary'
  const controlClass =
    'w-full border border-border bg-card px-4 text-[15px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    )
  }

  if (!report) {
    return (
      <AdminEmpty
        icon={Flag}
        title="Report not found"
        description="This report may already have been resolved and archived."
        action={
          <AdminButton tone="ink" onClick={() => router.push('/admin/reports')}>
            Back to reports
          </AdminButton>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <AdminHeader
        eyebrow={`${report.type} report`}
        title={<span className="ui-figure">#{report.id.slice(0, 8)}</span>}
        description="Review who raised this, what they say happened, then record a decision."
        actions={<Badge status="warning">{report.reason}</Badge>}
      />

      {/* Report Info */}
      <AdminPanel title="Case detail">
        <div className="ui-divide">
          <DataRow
            label="Reporter"
            value={
              <span className="block text-right">
                <span className="block text-sm text-ink">{report.reporter.name}</span>
                <span className="mt-0.5 block text-xs text-ink-secondary">{report.reporter.email}</span>
              </span>
            }
          />
          {report.reportedUser && (
            <DataRow
              label="Reported user"
              value={
                <span className="block text-right">
                  <span className="block text-sm text-ink">{report.reportedUser.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-secondary">{report.reportedUser.email}</span>
                </span>
              }
            />
          )}
          <DataRow label="Reason" value={report.reason} />
        </div>

        <div className="mt-6 border-t border-border pt-6">
          <p className="ui-eyebrow mb-3">What they said</p>
          <p className="max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">
            {report.description}
          </p>
        </div>
      </AdminPanel>

      {/* Resolution Form */}
      {report.status === 'PENDING' || report.status === 'UNDER_REVIEW' ? (
        <AdminPanel title="Record a decision">
          <div className="space-y-5">
            <div>
              <label className={labelClass}>Action</label>
              <select
                value={resolution.action}
                onChange={(e) => setResolution({ ...resolution, action: e.target.value })}
                className={`${controlClass} h-12`}
              >
                <option value="DISMISS">Dismiss report</option>
                <option value="WARNING">Issue warning</option>
                <option value="SUSPEND">Suspend user</option>
                <option value="BAN">Ban user</option>
                <option value="REMOVE_CONTENT">Remove content</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Resolution notes *</label>
              <textarea
                value={resolution.actionNotes}
                onChange={(e) => setResolution({ ...resolution, actionNotes: e.target.value })}
                className={`${controlClass} min-h-32 resize-none py-3.5 leading-relaxed`}
                placeholder="Explain the decision — this is the record other admins will read."
                required
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 border border-border bg-surface p-4">
              <input
                type="checkbox"
                checked={resolution.penalizeReported}
                onChange={(e) => setResolution({ ...resolution, penalizeReported: e.target.checked })}
                className="h-4 w-4 border-border text-ink focus:ring-primary/40"
              />
              <span className="text-sm font-medium text-ink">Apply a penalty to the reported user</span>
            </label>

            {resolution.penalizeReported && (
              <div>
                <label className={labelClass}>Penalty reason</label>
                <input
                  type="text"
                  value={resolution.penaltyReason}
                  onChange={(e) => setResolution({ ...resolution, penaltyReason: e.target.value })}
                  className={`${controlClass} h-12`}
                />
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">
              <AdminButton onClick={() => router.back()} className="h-11 sm:flex-1">
                Cancel
              </AdminButton>
              <AdminButton
                tone="danger"
                onClick={handleResolve}
                disabled={resolving}
                className="h-11 sm:flex-[2]"
              >
                {resolving ? 'Resolving…' : 'Submit resolution'}
              </AdminButton>
            </div>
          </div>
        </AdminPanel>
      ) : (
        <AdminPanel title="Resolution">
          <div className="ui-divide">
            <DataRow label="Status" value={<Badge status="success">{report.status}</Badge>} />
            {report.actionTaken && <DataRow label="Action taken" value={report.actionTaken} />}
          </div>
        </AdminPanel>
      )}
    </div>
  )
}