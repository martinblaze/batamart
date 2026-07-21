// app/(admin)/admin/support/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Search, MessageSquare, CheckCircle, Clock, Eye, X, Mail } from 'lucide-react'

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

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-warning/10 text-warning',
  IN_REVIEW: 'bg-primary/10 text-primary',
  RESOLVED: 'bg-success/10 text-success',
  CLOSED: 'bg-surface text-ink-secondary',
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
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Open', count: openCount, color: 'text-warning', bg: 'bg-warning/10' },
          { label: 'In Review', count: inReviewCount, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Resolved', count: resolvedCount, color: 'text-success', bg: 'bg-success/10' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
            <p className={`text-3xl font-semibold ${s.color}`}>{s.count}</p>
            <p className="text-ink-secondary text-sm mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-secondary" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tickets..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-border rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-3 bg-white border border-border rounded-xl text-ink focus:outline-none"
        >
          <option value="ALL">All Status</option>
          <option value="OPEN">Open</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Ticket list */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-ink-secondary">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No tickets found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(ticket => (
              <div key={ticket.id}
                className="p-5 hover:bg-surface/30 transition-colors cursor-pointer"
                onClick={() => { setSelected(ticket); setNotes(ticket.adminNotes || '') }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-ink font-semibold">{ticket.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[ticket.status]}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                      </span>
                    </div>
                    <p className="text-sm text-ink-secondary mb-1">{ticket.email}</p>
                    <p className="text-sm text-ink-secondary line-clamp-2">{ticket.message}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-ink-muted">
                      {new Date(ticket.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    </p>
                    <Eye className="w-4 h-4 text-ink-muted mt-2 ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-ink font-semibold text-lg">{selected.name}</h2>
                <p className="text-ink-secondary text-sm">{selected.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-ink-secondary hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[selected.status]}`}>
                  {selected.status.replace('_', ' ')}
                </span>
                <span className="px-3 py-1 bg-surface rounded-full text-xs text-ink-secondary">
                  {CATEGORY_LABELS[selected.category]}
                </span>
                {selected.user && (
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs">
                    Registered user
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs text-ink-secondary font-semibold uppercase mb-2">Message</p>
                <div className="bg-surface rounded-xl p-4 text-ink-secondary text-sm leading-relaxed whitespace-pre-wrap">
                  {selected.message}
                </div>
              </div>

              <div>
                <p className="text-xs text-ink-secondary font-semibold uppercase mb-2">Admin Notes (internal)</p>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Add internal notes..."
                  className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />
              </div>

              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => handleUpdateTicket(selected.id, 'IN_REVIEW')}
                  disabled={saving || selected.status === 'IN_REVIEW'}
                  className="flex-1 px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/10 disabled:opacity-40 transition-colors"
                >
                  <Clock className="w-4 h-4 inline mr-1.5" />
                  Mark In Review
                </button>
                <button
                  onClick={() => handleUpdateTicket(selected.id, 'RESOLVED')}
                  disabled={saving || selected.status === 'RESOLVED'}
                  className="flex-1 px-4 py-2.5 bg-success/10 text-success rounded-xl text-sm font-semibold hover:bg-success/10 disabled:opacity-40 transition-colors"
                >
                  <CheckCircle className="w-4 h-4 inline mr-1.5" />
                  Mark Resolved
                </button>
                <a
                  href={`mailto:${selected.email}?subject=Re: Your BATAMART Support Request`}
                  className="w-full flex items-center justify-center gap-1.5 text-center px-4 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-semibold hover:bg-primary/20 transition-colors"
                >
                  <Mail className="w-4 h-4" strokeWidth={1.75} /> Reply via Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}