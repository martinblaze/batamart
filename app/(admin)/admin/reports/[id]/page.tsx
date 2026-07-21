// app/(admin)/admin/reports/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Flag, User, AlertTriangle } from 'lucide-react'

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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!report) {
    return <div className="text-center py-12 text-ink-secondary">Report not found</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Report Info */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-danger/10 rounded-xl">
            <Flag className="w-6 h-6 text-danger" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Report #{report.id.slice(0, 8)}</h1>
            <p className="text-ink-secondary">{report.type} Report</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-surface rounded-xl">
            <p className="text-ink-secondary text-sm mb-1">Reporter</p>
            <p className="text-ink font-semibold">{report.reporter.name}</p>
            <p className="text-ink-secondary text-sm">{report.reporter.email}</p>
          </div>

          {report.reportedUser && (
            <div className="p-4 bg-surface rounded-xl">
              <p className="text-ink-secondary text-sm mb-1">Reported User</p>
              <p className="text-ink font-semibold">{report.reportedUser.name}</p>
              <p className="text-ink-secondary text-sm">{report.reportedUser.email}</p>
            </div>
          )}

          <div className="p-4 bg-surface rounded-xl">
            <p className="text-ink-secondary text-sm mb-1">Reason</p>
            <p className="text-ink font-semibold">{report.reason}</p>
          </div>

          <div className="p-4 bg-surface rounded-xl">
            <p className="text-ink-secondary text-sm mb-1">Description</p>
            <p className="text-ink">{report.description}</p>
          </div>
        </div>
      </div>

      {/* Resolution Form */}
      {report.status === 'PENDING' || report.status === 'UNDER_REVIEW' ? (
        <div className="bg-white border border-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-ink mb-6">Resolve Report</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-2">
                Action
              </label>
              <select
                value={resolution.action}
                onChange={(e) => setResolution({ ...resolution, action: e.target.value })}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="DISMISS">Dismiss Report</option>
                <option value="WARNING">Issue Warning</option>
                <option value="SUSPEND">Suspend User</option>
                <option value="BAN">Ban User</option>
                <option value="REMOVE_CONTENT">Remove Content</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-2">
                Resolution Notes *
              </label>
              <textarea
                value={resolution.actionNotes}
                onChange={(e) => setResolution({ ...resolution, actionNotes: e.target.value })}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-32"
                placeholder="Explain your decision..."
                required
              />
            </div>

            <div className="p-4 bg-surface rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resolution.penalizeReported}
                  onChange={(e) => setResolution({ ...resolution, penalizeReported: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-danger focus:ring-primary/40"
                />
                <span className="text-ink font-medium">Apply Penalty to Reported User</span>
              </label>
            </div>

            {resolution.penalizeReported && (
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-2">
                  Penalty Reason
                </label>
                <input
                  type="text"
                  value={resolution.penaltyReason}
                  onChange={(e) => setResolution({ ...resolution, penaltyReason: e.target.value })}
                  className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 bg-surface text-ink rounded-xl font-semibold hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="flex-1 px-6 py-3 bg-danger text-white rounded-xl font-semibold hover:brightness-95 transition-all disabled:opacity-50"
              >
                {resolving ? 'Resolving...' : 'Submit Resolution'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-ink mb-4">Resolution</h2>
          <p className="text-ink-secondary">Status: <span className="text-ink font-semibold">{report.status}</span></p>
          {report.actionTaken && (
            <p className="text-ink-secondary mt-2">Action: <span className="text-ink">{report.actionTaken}</span></p>
          )}
        </div>
      )}
    </div>
  )
}