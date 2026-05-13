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
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    step: 1,
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    sublabel: 'Admin is reviewing your case',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    step: 2,
  },
  RESOLVED_BUYER_FAVOR: {
    label: 'Resolved — Refund Issued',
    sublabel: 'Case closed in your favour',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    step: 3,
  },
  RESOLVED_SELLER_FAVOR: {
    label: 'Resolved — No Refund',
    sublabel: 'Case closed in seller\'s favour',
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
    step: 3,
  },
  RESOLVED_COMPROMISE: {
    label: 'Resolved — Partial Refund',
    sublabel: 'Compromise reached',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    step: 3,
  },
  DISMISSED: {
    label: 'Case Dismissed',
    sublabel: 'Insufficient grounds for dispute',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    dot: 'bg-red-400',
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-medium">Loading case details…</p>
        </div>
      </div>
    )
  }

  if (!dispute) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Case Not Found</h2>
          <p className="text-gray-500 mb-6 text-sm">{error || 'This dispute does not exist or you don\'t have access to it.'}</p>
          <button
            onClick={() => router.push('/orders')}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const isResolved = dispute.status.startsWith('RESOLVED_') || dispute.status === 'DISMISSED'
  const statusInfo = STATUS_CONFIG[dispute.status] ?? {
    label: dispute.status, sublabel: '', color: 'text-gray-700',
    bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400', step: 1,
  }
  const preferenceInfo = dispute.resolutionPreference
    ? RESOLUTION_LABELS[dispute.resolutionPreference]
    : null
  const currentStep = statusInfo.step
  const messageGroups = groupByDate(dispute.messages)
  const ticketId = `BATAMART-${dispute.id.slice(-8).toUpperCase()}`

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000]">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => router.push('/orders')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Orders
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-gray-400 tracking-wider">{ticketId}</span>
            {refreshing && (
              <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin" />
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
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* Product strip */}
          <div className="flex items-center gap-4 p-5 border-b border-gray-100">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
              <img
                src={dispute.order.product.images[0] || '/placeholder.png'}
                alt={dispute.order.product.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{dispute.order.product.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Order #{dispute.order.orderNumber} &middot; ₦{dispute.order.totalAmount.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => router.push(`/orders/${dispute.order.id}`)}
              className="flex items-center gap-1 text-xs text-orange-600 font-semibold hover:text-orange-700 transition-colors flex-shrink-0"
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
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${done ? 'bg-gray-900 border-gray-900'
                          : active ? 'bg-orange-500 border-orange-500'
                            : 'bg-white border-gray-200'
                        }`}>
                        <StepIcon className={`w-4 h-4 ${(done || active) ? 'text-white' : 'text-gray-300'}`} />
                      </div>
                      <p className={`text-xs font-semibold mt-1.5 whitespace-nowrap ${active ? 'text-orange-600' : done ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                        {step.label}
                      </p>
                    </div>
                    {!last && (
                      <div className={`flex-1 h-0.5 mx-3 mb-4 rounded-full transition-colors ${done ? 'bg-gray-900' : 'bg-gray-200'
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
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Your Complaint</p>
            <p className="text-sm text-gray-800 leading-relaxed">{dispute.reason}</p>
            <p className="text-xs text-gray-400 mt-3">Filed {formatDateTime(dispute.createdAt)}</p>
          </div>

          {/* Resolution request / outcome */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            {isResolved && dispute.resolution ? (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Admin Decision</p>
                <p className="text-sm text-gray-800 leading-relaxed">{dispute.resolution}</p>
                {dispute.refundAmount != null && dispute.refundAmount > 0 && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-700">
                      ₦{dispute.refundAmount.toLocaleString()} refund
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-3">Resolved {formatDateTime(dispute.updatedAt)}</p>
              </>
            ) : preferenceInfo ? (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Requested Resolution</p>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <preferenceInfo.icon className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{preferenceInfo.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{preferenceInfo.desc}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Resolution</p>
                <p className="text-sm text-gray-400 italic">Pending admin decision</p>
              </>
            )}
          </div>
        </div>

        {/* ── Chat ────────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">BATAMARTMart Support</p>
              <p className="text-xs text-gray-400">Dispute Resolution Team · Replies within 24h</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isResolved ? 'bg-gray-400' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="text-xs text-gray-500 font-medium">
                {isResolved ? 'Closed' : 'Active'}
              </span>
            </div>
          </div>

          {/* Messages area */}
          <div className="px-4 py-4 space-y-4 min-h-64 max-h-96 overflow-y-auto">

            {/* System: case opened */}
            <div className="flex justify-center">
              <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">
                Case opened · {formatDate(dispute.createdAt)}
              </span>
            </div>

            {dispute.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-10 h-10 text-gray-200 mb-3" />
                <p className="text-sm font-semibold text-gray-400">No messages yet</p>
                <p className="text-xs text-gray-400 mt-1">
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
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400 font-medium">{group.date}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>

                  {group.messages.map((msg) => {
                    const isAdmin = msg.senderType === 'ADMIN'
                    const isBuyer = msg.senderType === 'BUYER'

                    return (
                      <div key={msg.id} className={`flex ${isBuyer ? 'justify-end' : 'justify-start'}`}>
                        {/* Admin avatar */}
                        {isAdmin && (
                          <div className="w-7 h-7 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                            <Shield className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}

                        <div className={`max-w-xs lg:max-w-md space-y-1 ${isBuyer ? 'items-end' : 'items-start'} flex flex-col`}>
                          {isAdmin && (
                            <p className="text-xs font-semibold text-gray-500 ml-1">Support Team</p>
                          )}
                          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isBuyer
                              ? 'bg-orange-500 text-white rounded-br-md'
                              : 'bg-gray-100 text-gray-900 rounded-bl-md'
                            }`}>
                            {msg.message}
                          </div>
                          <p className={`text-[11px] px-1 ${isBuyer ? 'text-gray-400 text-right' : 'text-gray-400'}`}>
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
          <div className="border-t border-gray-100 p-4">
            {error && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700">{error}</p>
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
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-400 transition-all"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="w-10 h-10 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                >
                  {sending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2">
                <XCircle className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">
                  This case is closed. No further messages can be sent.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Info footer ─────────────────────────────────────────────────── */}
        {!isResolved && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">What happens next</p>
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
                  <div className="w-7 h-7 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed pt-0.5">{text}</p>
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
