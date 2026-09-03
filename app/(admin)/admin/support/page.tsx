// app/(admin)/admin/support/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Search, MessageSquare, CheckCircle, Clock, Eye, X, Mail } from 'lucide-react'
import {
  AdminHeader, AdminPanel, AdminEmpty, AdminLoading, AdminButton, StatGrid,
} from '@/components/admin/AdminUI'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'

interface Ticket {
  id: string
  name: string
  email: string
  category: string
  message: string
  status: string
  adminNotes: string | null
  createdAt: string
  resolvedAt: string | null
  user: { id: string; name: string } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  PAYMENT_ISSUE: 'Payment issue',
  ORDER_PROBLEM: 'Order problem',
  ACCOUNT_ISSUE: 'Account issue',
  DISPUTE_HELP: 'Dispute help',
  SELLER_ISSUE: 'Seller issue',
  RIDER_ISSUE: 'Rider issue',
  BUG_REPORT: 'Bug report',
  OTHER: 'Other',
}

const STATUS_TONES: Record<string, BadgeStatus> = {
  OPEN: 'warning',
  IN_REVIEW: 'verified',
  RESOLVED: 'success',
  CLOSED: 'neutral',
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchTickets() }, [])

  const fetchTickets = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch('/api/admin/support', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTicket = async (ticketId: string, status: string) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, adminNotes: notes }),
      })
      if (res.ok) {
        await fetchTickets()
        setSelected(null)
        setNotes('')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const filtered = tickets.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      t.message.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'ALL' || t.status === filterStatus
    return matchSearch && matchStatus
  })

  const openCount = tickets.filter(t => t.status === 'OPEN').length
  const inReviewCount = tickets.filter(t => t.status === 'IN_REVIEW').length
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length

  return (
    <div className="space-y-8">

      <AdminHeader
        eyebrow="Inbox"
        title="Support"
        description="Tickets raised through the contact form. Triage, annotate internally, then reply by email."
        actions={
          <>
            <div className="flex h-9 w-full min-w-[14rem] items-center gap-2 border border-border bg-card px-3 sm:w-64">
              <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tickets…"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted focus:outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              aria-label="Filter by status"
              className="h-9 border border-border bg-card px-3 text-[13px] text-ink transition-colors hover:border-ink/25 focus:border-ink/40 focus:outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_REVIEW">In review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </>
        }
      />

      <StatGrid
        columns={3}
        stats={[
          { label: 'Open', value: openCount, note: 'Awaiting triage', tone: openCount > 0 ? 'warning' : 'default' },
          { label: 'In review', value: inReviewCount, note: 'Being worked on' },
          { label: 'Resolved', value: resolvedCount, note: 'Closed out' },
        ]}
      />

      {/* Ticket list */}
      {loading ? (
        <AdminLoading rows={5} />
      ) : filtered.length === 0 ? (
        <AdminEmpty
          icon={MessageSquare}
          title="No tickets found"
          description="Nothing matches this search and filter combination."
        />
      ) : (
        <AdminPanel padded={false}>
          <div className="ui-divide">
            {filtered.map(ticket => (
              <button
                key={ticket.id}
                onClick={() => { setSelected(ticket); setNotes(ticket.adminNotes || '') }}
                className="group w-full p-5 text-left transition-colors duration-300 hover:bg-surface"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="text-sm font-medium text-ink">{ticket.name}</span>
                      <Badge status={STATUS_TONES[ticket.status] ?? 'neutral'}>
                        {ticket.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="ui-mono ui-mono-sm text-ink-muted">
                        {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs text-ink-secondary">{ticket.email}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-secondary">
                      {ticket.message}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="ui-mono ui-mono-sm text-ink-muted">
                      {new Date(ticket.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </p>
                    <Eye
                      className="ml-auto mt-3 h-4 w-4 text-ink-muted transition-colors group-hover:text-ink"
                      strokeWidth={1.75}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </AdminPanel>
      )}

      {/* Ticket detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div className="min-w-0">
                <p className="ui-eyebrow mb-3">Ticket</p>
                <h2 className="truncate text-lg text-ink">{selected.name}</h2>
                <p className="mt-1 truncate text-sm text-ink-secondary">{selected.email}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="flex-shrink-0 text-ink-muted transition-colors hover:text-ink"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex flex-wrap gap-2">
                <Badge status={STATUS_TONES[selected.status] ?? 'neutral'}>
                  {selected.status.replace(/_/g, ' ')}
                </Badge>
                <Badge status="neutral">
                  {CATEGORY_LABELS[selected.category] ?? selected.category}
                </Badge>
                {selected.user && <Badge status="verified">Registered user</Badge>}
              </div>

              <div>
                <p className="ui-eyebrow mb-3">Message</p>
                <div className="whitespace-pre-wrap border border-border bg-surface p-4 text-sm leading-relaxed text-ink-secondary">
                  {selected.message}
                </div>
              </div>

              <div>
                <p className="ui-eyebrow mb-3">Internal notes</p>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes for other admins — never shown to the user."
                  className="w-full resize-none border border-border bg-card px-4 py-3 text-sm leading-relaxed text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-6">
                <AdminButton
                  onClick={() => handleUpdateTicket(selected.id, 'IN_REVIEW')}
                  disabled={saving || selected.status === 'IN_REVIEW'}
                  icon={Clock}
                  className="flex-1"
                >
                  In review
                </AdminButton>
                <AdminButton
                  tone="success"
                  onClick={() => handleUpdateTicket(selected.id, 'RESOLVED')}
                  disabled={saving || selected.status === 'RESOLVED'}
                  icon={CheckCircle}
                  className="flex-1"
                >
                  Resolved
                </AdminButton>
                <a
                  href={`mailto:${selected.email}?subject=Re: Your BataMart support request`}
                  className="ui-mono ui-mono-sm inline-flex h-9 w-full items-center justify-center gap-2 bg-ink px-4 text-background transition-colors hover:bg-ink/90"
                >
                  <Mail className="h-3.5 w-3.5" strokeWidth={2} />
                  Reply by email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}