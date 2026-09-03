'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Shield, AlertCircle, Send, Loader2, Truck, RotateCcw,
  Package, ArrowLeft, Clock, CheckCircle2, XCircle,
  ChevronRight, MessageSquare, Info, RefreshCw
} from 'lucide-react'
import { Shell, EmptyState } from '@/components/ui/Shell'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'

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
// One semantic tone per state drives both the badge and the dot, so the
// status reads the same everywhere on the page.
const STATUS_CONFIG: Record<string, {
  label: string
  sublabel: string
  tone: BadgeStatus
  dot: string
  step: number
}> = {
  OPEN: {
    label: 'Case opened',
    sublabel: 'Awaiting admin review',
    tone: 'verified',
    dot: 'bg-primary',
    step: 1,
  },
  UNDER_REVIEW: {
    label: 'Under review',
    sublabel: 'An admin is reviewing your case',
    tone: 'warning',
    dot: 'bg-warning',
    step: 2,
  },
  RESOLVED_BUYER_FAVOR: {
    label: 'Refund issued',
    sublabel: 'Case closed in your favour',
    tone: 'success',
    dot: 'bg-success',
    step: 3,
  },
  RESOLVED_SELLER_FAVOR: {
    label: 'No refund',
    sublabel: "Case closed in the seller's favour",
    tone: 'neutral',
    dot: 'bg-ink-muted',
    step: 3,
  },
  RESOLVED_COMPROMISE: {
    label: 'Partial refund',
    sublabel: 'A compromise was reached',
    tone: 'verified',
    dot: 'bg-primary',
    step: 3,
  },
  DISMISSED: {
    label: 'Case dismissed',
    sublabel: 'Insufficient grounds for a dispute',
    tone: 'danger',
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
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
          <p className="ui-mono ui-mono-sm mt-5 text-ink-muted">Loading case…</p>
        </div>
      </div>
    )
  }

  if (!dispute) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-16 sm:pt-24">
          <EmptyState
            icon={AlertCircle}
            title="Case not found"
            description={error || "This dispute doesn't exist, or it isn't one you have access to."}
            action={
              <Button variant="ink" onClick={() => router.push('/orders')}>
                Back to orders
              </Button>
            }
          />
        </Shell>
      </div>
    )
  }

  const isResolved = dispute.status.startsWith('RESOLVED_') || dispute.status === 'DISMISSED'
  const statusInfo = STATUS_CONFIG[dispute.status] ?? {
    label: dispute.status, sublabel: '', tone: 'neutral' as BadgeStatus,
    dot: 'bg-ink-muted', step: 1,
  }
  const preferenceInfo = dispute.resolutionPreference
    ? RESOLUTION_LABELS[dispute.resolutionPreference]
    : null
  const currentStep = statusInfo.step
  const messageGroups = groupByDate(dispute.messages)
  const ticketId = `BATAMART-${dispute.id.slice(-8).toUpperCase()}`

  return (
    <div className="min-h-screen bg-surface">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-4">
          <button
            onClick={() => router.push('/orders')}
            className="group ui-mono ui-mono-sm inline-flex items-center gap-2 text-ink-secondary transition-colors hover:text-ink"
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
              strokeWidth={2}
            />
            Orders
          </button>

          <div className="flex items-center gap-2">
            <span className="ui-mono ui-mono-sm hidden text-ink-muted sm:inline">{ticketId}</span>
            {refreshing && (
              <RefreshCw className="h-3 w-3 animate-spin text-ink-muted" strokeWidth={2} />
            )}
          </div>

          <Badge status={statusInfo.tone} pill>
            <span
              className={`mr-0.5 h-1.5 w-1.5 rounded-full ${statusInfo.dot} ${
                !isResolved ? 'animate-pulse' : ''
              }`}
            />
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* ── Case header ─────────────────────────────────────────────────── */}
        <div className="border border-border bg-card">

          {/* Product strip */}
          <div className="flex items-center gap-4 border-b border-border p-5">
            <div className="h-14 w-14 flex-shrink-0 overflow-hidden bg-surface">
              <img
                src={dispute.order.product.images[0] || '/placeholder.png'}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{dispute.order.product.name}</p>
              <p className="mt-1 text-xs text-ink-secondary">
                #{dispute.order.orderNumber} ·{' '}
                <span className="ui-figure text-[13px] text-ink">
                  ₦{dispute.order.totalAmount.toLocaleString()}
                </span>
              </p>
            </div>
            <button
              onClick={() => router.push(`/orders/${dispute.order.id}`)}
              className="group ui-mono ui-mono-sm inline-flex flex-shrink-0 items-center gap-1 text-ink-secondary transition-colors hover:text-ink"
            >
              View order
              <ChevronRight
                className="h-3 w-3 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </button>
          </div>

          {/* Progress stepper */}
          <div className="px-6 py-7">
            <div className="flex items-start">
              {STEPS.map((step, idx) => {
                const StepIcon = step.icon
                const done = currentStep > idx + 1
                const active = currentStep === idx + 1
                const last = idx === STEPS.length - 1
                return (
                  <div key={step.key} className="flex flex-1 items-start last:flex-none">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-[26px] w-[26px] items-center justify-center border transition-colors duration-500 ${
                          done || active
                            ? 'border-ink bg-ink text-background'
                            : 'border-border bg-card text-ink-muted'
                        }`}
                      >
                        <StepIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </div>
                      <p
                        className={`ui-mono ui-mono-sm mt-3 whitespace-nowrap transition-colors duration-500 ${
                          done || active ? 'text-ink' : 'text-ink-muted'
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                    {!last && (
                      <div
                        className={`mx-3 mt-[13px] h-px flex-1 transition-colors duration-500 ${
                          done ? 'bg-ink' : 'bg-border'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status message */}
          <div className="mx-5 mb-5 flex items-start gap-3 border border-border bg-surface px-4 py-3.5">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-secondary" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-medium text-ink">{statusInfo.label}</p>
              <p className="mt-0.5 text-xs text-ink-secondary">{statusInfo.sublabel}</p>
            </div>
          </div>
        </div>

        {/* ── Complaint + resolution details ──────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">

          {/* Your complaint */}
          <div className="ui-panel">
            <p className="ui-eyebrow mb-5">Your complaint</p>
            <p className="text-sm leading-relaxed text-ink">{dispute.reason}</p>
            <p className="ui-mono ui-mono-sm mt-5 text-ink-muted">
              Filed {formatDateTime(dispute.createdAt)}
            </p>
          </div>

          {/* Resolution request / outcome */}
          <div className="ui-panel">
            {isResolved && dispute.resolution ? (
              <>
                <p className="ui-eyebrow mb-5">Admin decision</p>
                <p className="text-sm leading-relaxed text-ink">{dispute.resolution}</p>
                {dispute.refundAmount != null && dispute.refundAmount > 0 && (
                  <div className="mt-5 inline-flex items-center gap-2 border border-success/25 bg-success/5 px-3.5 py-2">
                    <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={1.75} />
                    <span className="ui-figure text-sm text-success">
                      ₦{dispute.refundAmount.toLocaleString()} refunded
                    </span>
                  </div>
                )}
                <p className="ui-mono ui-mono-sm mt-5 text-ink-muted">
                  Resolved {formatDateTime(dispute.updatedAt)}
                </p>
              </>
            ) : preferenceInfo ? (
              <>
                <p className="ui-eyebrow mb-5">Requested resolution</p>
                <div className="flex items-start gap-3.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-border bg-surface">
                    <preferenceInfo.icon className="h-4 w-4 text-ink-secondary" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{preferenceInfo.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                      {preferenceInfo.desc}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="ui-eyebrow mb-5">Resolution</p>
                <p className="ui-serif text-base text-ink-muted">Pending an admin decision</p>
              </>
            )}
          </div>
        </div>

        {/* ── Chat ────────────────────────────────────────────────────────── */}
        <div className="border border-border bg-card">

          {/* Chat header */}
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-ink">
              <Shield className="h-4 w-4 text-background" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">BataMart Support</p>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Dispute resolution · replies within 24h
              </p>
            </div>
            <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isResolved ? 'bg-ink-muted' : 'animate-pulse bg-success'
                }`}
              />
              <span className="ui-mono ui-mono-sm text-ink-secondary">
                {isResolved ? 'Closed' : 'Active'}
              </span>
            </div>
          </div>

          {/* Messages area */}
          <div className="max-h-96 min-h-64 space-y-5 overflow-y-auto px-4 py-5">

            {/* System: case opened */}
            <div className="flex justify-center">
              <span className="ui-mono ui-mono-sm border border-border bg-surface px-3 py-1.5 text-ink-secondary">
                Case opened · {formatDate(dispute.createdAt)}
              </span>
            </div>

            {dispute.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="mb-4 h-8 w-8 text-ink-muted" strokeWidth={1.5} />
                <p className="text-sm text-ink">No messages yet</p>
                <p className="mt-1.5 max-w-[34ch] text-xs leading-relaxed text-ink-secondary">
                  {isResolved
                    ? 'This case was resolved without any further messages.'
                    : 'Send a message below and the support team will pick it up.'}
                </p>
              </div>
            ) : (
              messageGroups.map((group) => (
                <div key={group.date} className="space-y-4">
                  {/* Date separator */}
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="ui-mono ui-mono-sm text-ink-muted">{group.date}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {group.messages.map((msg) => {
                    const isAdmin = msg.senderType === 'ADMIN'
                    const isBuyer = msg.senderType === 'BUYER'

                    return (
                      <div key={msg.id} className={`flex ${isBuyer ? 'justify-end' : 'justify-start'}`}>
                        {/* Admin avatar */}
                        {isAdmin && (
                          <div className="mr-2.5 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center bg-ink">
                            <Shield className="h-3.5 w-3.5 text-background" strokeWidth={1.75} />
                          </div>
                        )}

                        <div
                          className={`flex max-w-xs flex-col gap-1.5 lg:max-w-md ${
                            isBuyer ? 'items-end' : 'items-start'
                          }`}
                        >
                          {isAdmin && (
                            <p className="ui-mono ui-mono-sm text-ink-muted">Support team</p>
                          )}
                          <div
                            className={`px-4 py-3 text-sm leading-relaxed ${
                              isBuyer
                                ? 'bg-ink text-background'
                                : 'border border-border bg-surface text-ink'
                            }`}
                          >
                            {msg.message}
                          </div>
                          <p className="ui-mono ui-mono-sm text-ink-muted">
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
              <div className="mb-3 border border-danger/25 bg-danger/5 px-3.5 py-2.5">
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
                  className="h-11 flex-1 border border-border bg-card px-4 text-sm text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  disabled={sending}
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={sending || !newMessage.trim()}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center bg-ink text-background transition-colors hover:bg-primary disabled:pointer-events-none disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <Send className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2.5">
                <XCircle className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
                <p className="text-sm text-ink-secondary">
                  This case is closed — no further messages can be sent.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Info footer ─────────────────────────────────────────────────── */}
        {!isResolved && (
          <div className="ui-panel">
            <p className="ui-eyebrow mb-6">What happens next</p>
            <div className="space-y-4">
              {[
                { icon: Shield, text: 'Your case is with our admin team for review.' },
                { icon: MessageSquare, text: "We'll message you here if we need more information." },
                { icon: Clock, text: 'Expect a final decision within 3–5 business days.' },
                ...(dispute.resolutionPreference === 'REFUND_WITH_PICKUP'
                  ? [{ icon: Truck, text: 'If approved, a rider collects the item before your refund is released.' }]
                  : []),
              ].map(({ icon: Icon, text }, idx) => (
                <div key={idx} className="flex items-start gap-3.5">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-border bg-surface">
                    <Icon className="h-3.5 w-3.5 text-ink-secondary" strokeWidth={1.75} />
                  </span>
                  <p className="pt-1 text-sm leading-relaxed text-ink-secondary">{text}</p>
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
