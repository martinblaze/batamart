'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Shield, AlertCircle, Send, Loader2, Truck, RotateCcw,
  Package, ArrowLeft, Clock, CheckCircle2, XCircle,
  ChevronRight, MessageSquare, Info, RefreshCw
} from 'lucide-react'

interface DisputeMessage {
  id: string
  message: string
  senderType: string
  attachments: string[]
  createdAt: string
}

interface Dispute {
  id: string
  status: string
  reason: string
  resolutionPreference?: string
  buyerEvidence: string[]
  resolution: string | null
  refundAmount: number | null
  createdAt: string
  updatedAt: string
  order: {
    id: string
    orderNumber: string
    totalAmount: number
    product: { name: string; images: string[] }
  }
  buyer: { id: string; name: string; profilePhoto: string | null }
  messages: DisputeMessage[]
}

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string
  sublabel: string
  color: string
  bg: string
  border: string
  dot: string
  step: number
}> = {
  OPEN: {
    label: 'Case Opened',
    sublabel: 'Awaiting admin review',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    dot: 'bg-primary',
    step: 1,
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    sublabel: 'Admin is reviewing your case',
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    dot: 'bg-warning',
    step: 2,
  },
  RESOLVED_BUYER_FAVOR: {
    label: 'Resolved — Refund Issued',
    sublabel: 'Case closed in your favour',
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    dot: 'bg-success',
    step: 3,
  },
  RESOLVED_SELLER_FAVOR: {
    label: 'Resolved — No Refund',
    sublabel: 'Case closed in seller\'s favour',
    color: 'text-ink-secondary',
    bg: 'bg-surface',
    border: 'border-border',
    dot: 'bg-ink-muted',
    step: 3,
  },
  RESOLVED_COMPROMISE: {
    label: 'Resolved — Partial Refund',
    sublabel: 'Compromise reached',
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    dot: 'bg-primary',
    step: 3,
  },
  DISMISSED: {
    label: 'Case Dismissed',
    sublabel: 'Insufficient grounds for dispute',
    color: 'text-danger',
    bg: 'bg-danger/10',
    border: 'border-danger/30',
    dot: 'bg-danger',
    step: 3,
  },
}

const RESOLUTION_LABELS: Record<string, { label: string; icon: React.ElementType; desc: string }> = {
  REFUND_WITH_PICKUP: {
    label: 'Refund + Item Return',
    icon: Truck,
    desc: 'Rider collects item, then refund is processed',
  },
  EXCHANGE: {
    label: 'Exchange / Replacement',
    icon: RotateCcw,
    desc: 'Seller sends a replacement item',
  },
  PARTIAL_REFUND: {
    label: 'Partial Refund',
    icon: Package,
    desc: 'Keep the item, receive partial refund',
  },
}

const STEPS = [
  { key: 'OPEN', label: 'Filed', icon: Shield },
  { key: 'UNDER_REVIEW', label: 'In Review', icon: Clock },
  { key: 'RESOLVED', label: 'Resolved', icon: CheckCircle2 },
]

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString('en-NG', {
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// Group messages by date
function groupByDate(messages: DisputeMessage[]) {
  const groups: { date: string; messages: DisputeMessage[] }[] = []
  for (const msg of messages) {
    const date = new Date(msg.createdAt).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    const last = groups[groups.length - 1]
    if (last && last.date === date) {
      last.messages.push(msg)
    } else {
      groups.push({ date, messages: [msg] })
    }
  }
  return groups
}

export default function DisputeDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const disputeId = params.id as string

  const [dispute, setDispute] = useState<Dispute | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [newMessage, setNewMessage] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchDispute() }, [disputeId])

  // Auto-scroll to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [dispute?.messages])

  // Poll every 15s while dispute is open
  useEffect(() => {
    if (!dispute) return
    const isOpen = !dispute.status.startsWith('RESOLVED_') && dispute.status !== 'DISMISSED'
    if (!isOpen) return
    const timer = setInterval(() => fetchDispute(true), 15000)
    return () => clearInterval(timer)
  }, [dispute?.status])

  const fetchDispute = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/disputes/${disputeId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setDispute(data.dispute)
      } else {
        setError('Dispute not found')
      }
    } catch {
      setError('Failed to load dispute')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    setSending(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/disputes/${disputeId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: newMessage }),
      })
      if (response.ok) {
        setNewMessage('')
        await fetchDispute(true)
        inputRef.current?.focus()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to send message')
      }
    } catch {
      setError('An error occurred')
    } finally {
      setSending(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface dark:bg-[#000000] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-ink-secondary font-medium">Loading case details…</p>
        </div>
      </div>
    )
  }

  if (!dispute) {
    return (
      <div className="min-h-screen bg-surface dark:bg-[#000000] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-danger" />
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">Case Not Found</h2>
          <p className="text-ink-secondary mb-6 text-sm">{error || 'This dispute does not exist or you don\'t have access to it.'}</p>
          <button
            onClick={() => router.push('/orders')}
            className="px-6 py-2.5 bg-primary text-white rounded-lg font-medium text-sm hover:brightness-95 transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const isResolved = dispute.status.startsWith('RESOLVED_') || dispute.status === 'DISMISSED'
  const statusInfo = STATUS_CONFIG[dispute.status] ?? {
    label: dispute.status, sublabel: '', color: 'text-ink-secondary',
    bg: 'bg-surface', border: 'border-border', dot: 'bg-ink-muted', step: 1,
  }
  const preferenceInfo = dispute.resolutionPreference
    ? RESOLUTION_LABELS[dispute.resolutionPreference]
    : null
  const currentStep = statusInfo.step
  const messageGroups = groupByDate(dispute.messages)
  const ticketId = `BATAMART-${dispute.id.slice(-8).toUpperCase()}`

  return (
    <div className="min-h-screen bg-surface dark:bg-[#000000]">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push('/orders')}
            className="flex items-center gap-2 text-ink-secondary hover:text-ink text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Orders
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold text-ink-muted tracking-wider">{ticketId}</span>
            {refreshing && (
              <RefreshCw className="w-3.5 h-3.5 text-ink-muted animate-spin" />
            )}
          </div>

          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} ${!isResolved ? 'animate-pulse' : ''}`} />
            {statusInfo.label}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* ── Case header ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">

          {/* Product strip */}
          <div className="flex items-center gap-4 p-5 border-b border-border">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface flex-shrink-0">
              <img
                src={dispute.order.product.images[0] || '/placeholder.png'}
                alt={dispute.order.product.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink truncate">{dispute.order.product.name}</p>
              <p className="text-sm text-ink-secondary mt-0.5">
                Order #{dispute.order.orderNumber} &middot; ₦{dispute.order.totalAmount.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => router.push(`/orders/${dispute.order.id}`)}
              className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline transition-colors flex-shrink-0"
            >
              View Order <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress stepper */}
          <div className="px-6 py-5">
            <div className="flex items-center">
              {STEPS.map((step, idx) => {
                const StepIcon = step.icon
                const done = currentStep > idx + 1
                const active = currentStep === idx + 1
                const last = idx === STEPS.length - 1
                return (
                  <div key={step.key} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${done ? 'bg-ink border-ink'
                          : active ? 'bg-primary border-primary'
                            : 'bg-white border-border'
                        }`}>
                        <StepIcon className={`w-4 h-4 ${(done || active) ? 'text-white' : 'text-ink-muted'}`} />
                      </div>
                      <p className={`text-xs font-semibold mt-1.5 whitespace-nowrap ${active ? 'text-primary' : done ? 'text-ink' : 'text-ink-muted'
                        }`}>
                        {step.label}
                      </p>
                    </div>
                    {!last && (
                      <div className={`flex-1 h-0.5 mx-3 mb-4 rounded-full transition-colors ${done ? 'bg-ink' : 'bg-border'
                        }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status message */}
          <div className={`mx-5 mb-5 px-4 py-3 rounded-xl border ${statusInfo.bg} ${statusInfo.border} flex items-start gap-3`}>
            <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusInfo.color}`} />
            <div>
              <p className={`text-sm font-semibold ${statusInfo.color}`}>{statusInfo.label}</p>
              <p className={`text-xs mt-0.5 ${statusInfo.color} opacity-80`}>{statusInfo.sublabel}</p>
            </div>
          </div>
        </div>

        {/* ── Complaint + resolution details ──────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Your complaint */}
          <div className="bg-white rounded-2xl border border-border p-5">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Your Complaint</p>
            <p className="text-sm text-ink leading-relaxed">{dispute.reason}</p>
            <p className="text-xs text-ink-muted mt-3">Filed {formatDateTime(dispute.createdAt)}</p>
          </div>

          {/* Resolution request / outcome */}
          <div className="bg-white rounded-2xl border border-border p-5">
            {isResolved && dispute.resolution ? (
              <>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Admin Decision</p>
                <p className="text-sm text-ink leading-relaxed">{dispute.resolution}</p>
                {dispute.refundAmount != null && dispute.refundAmount > 0 && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-success/10 border border-success/30 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <span className="text-sm font-semibold text-success">
                      ₦{dispute.refundAmount.toLocaleString()} refund
                    </span>
                  </div>
                )}
                <p className="text-xs text-ink-muted mt-3">Resolved {formatDateTime(dispute.updatedAt)}</p>
              </>
            ) : preferenceInfo ? (
              <>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Requested Resolution</p>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <preferenceInfo.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{preferenceInfo.label}</p>
                    <p className="text-xs text-ink-secondary mt-0.5">{preferenceInfo.desc}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Resolution</p>
                <p className="text-sm text-ink-muted italic">Pending admin decision</p>
              </>
            )}
          </div>
        </div>

        {/* ── Chat ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">BATAMARTMart Support</p>
              <p className="text-xs text-ink-muted">Dispute Resolution Team · Replies within 24h</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isResolved ? 'bg-ink-muted' : 'bg-success animate-pulse'}`} />
              <span className="text-xs text-ink-secondary font-medium">
                {isResolved ? 'Closed' : 'Active'}
              </span>
            </div>
          </div>

          {/* Messages area */}
          <div className="px-4 py-4 space-y-4 min-h-64 max-h-96 overflow-y-auto">

            {/* System: case opened */}
            <div className="flex justify-center">
              <span className="px-3 py-1 bg-surface text-ink-secondary text-xs rounded-full font-medium">
                Case opened · {formatDate(dispute.createdAt)}
              </span>
            </div>

            {dispute.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-10 h-10 text-border mb-3" />
                <p className="text-sm font-semibold text-ink-muted">No messages yet</p>
                <p className="text-xs text-ink-muted mt-1">
                  {isResolved
                    ? 'This case was resolved without additional messages.'
                    : 'Send a message to the support team below.'}
                </p>
              </div>
            ) : (
              messageGroups.map((group) => (
                <div key={group.date} className="space-y-3">
                  {/* Date separator */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-surface" />
                    <span className="text-xs text-ink-muted font-medium">{group.date}</span>
                    <div className="flex-1 h-px bg-surface" />
                  </div>

                  {group.messages.map((msg) => {
                    const isAdmin = msg.senderType === 'ADMIN'
                    const isBuyer = msg.senderType === 'BUYER'

                    return (
                      <div key={msg.id} className={`flex ${isBuyer ? 'justify-end' : 'justify-start'}`}>
                        {/* Admin avatar */}
                        {isAdmin && (
                          <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                            <Shield className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}

                        <div className={`max-w-xs lg:max-w-md space-y-1 ${isBuyer ? 'items-end' : 'items-start'} flex flex-col`}>
                          {isAdmin && (
                            <p className="text-xs font-semibold text-ink-secondary ml-1">Support Team</p>
                          )}
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isBuyer
                              ? 'bg-primary text-white rounded-br-md'
                              : 'bg-surface text-ink rounded-bl-md'
                            }`}>
                            {msg.message}
                          </div>
                          <p className={`text-[11px] px-1 ${isBuyer ? 'text-ink-muted text-right' : 'text-ink-muted'}`}>
                            {formatTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border p-4">
            {error && (
              <div className="mb-3 px-3 py-2 bg-danger/10 border border-danger/30 rounded-lg">
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}

            {!isResolved ? (
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message the support team…"
                  className="flex-1 px-4 py-2.5 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent placeholder-ink-muted transition-all"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="w-10 h-10 bg-primary hover:brightness-95 disabled:bg-border text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                >
                  {sending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2">
                <XCircle className="w-4 h-4 text-ink-muted" />
                <p className="text-sm text-ink-muted">
                  This case is closed. No further messages can be sent.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Info footer ─────────────────────────────────────────────────── */}
        {!isResolved && (
          <div className="bg-white rounded-2xl border border-border p-5">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">What happens next</p>
            <div className="space-y-3">
              {[
                { icon: Shield, text: 'Your case is being reviewed by our admin team.' },
                { icon: MessageSquare, text: 'We\'ll send you a message here if we need more information.' },
                { icon: Clock, text: 'Expect a final decision within 3–5 business days.' },
                ...(dispute.resolutionPreference === 'REFUND_WITH_PICKUP'
                  ? [{ icon: Truck, text: 'If approved, a rider will collect the item before your refund is processed.' }]
                  : []),
              ].map(({ icon: Icon, text }, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-surface border border-border rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-ink-secondary" />
                  </div>
                  <p className="text-sm text-ink-secondary leading-relaxed pt-0.5">{text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  )
}
