// app/(admin)/admin/disputes/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle, User, DollarSign, MessageSquare,
  Truck, Send, Loader2, CheckCircle, Package, Phone
} from 'lucide-react'

const PROCESSING_FEE = 0.10

function getPickupStage(dispute: any): 'INITIAL' | 'RIDER_SENT' | 'ITEM_RECEIVED' | 'REFUND_RELEASED' | 'FULLY_DONE' {
  if (!dispute) return 'INITIAL'
  if (dispute.status === 'RESOLVED_BUYER_FAVOR' && dispute.resolvedAt) return 'FULLY_DONE'
  if (dispute.resolution === '__SELLER_CONFIRMED_RETURN__') return 'REFUND_RELEASED'
  if (dispute.resolution === '__RETURN_DELIVERED_TO_SELLER__') return 'ITEM_RECEIVED'
  if (['__RETURN_PICKED_UP__', '__RETURN_ON_THE_WAY__'].includes(dispute.resolution || '')) return 'RIDER_SENT'
  if (dispute.resolution === '__SELLER_FAULT_AWAITING_PICKUP__') return 'RIDER_SENT'
  if (dispute.resolution === '__REFUND_RELEASED__') return 'REFUND_RELEASED'
  if (dispute.resolution === '__RIDER_PAID__') return 'ITEM_RECEIVED'  // rider paid, refund still pending
  if (dispute.resolution === '__ITEM_RECEIVED__') return 'ITEM_RECEIVED'
  if (dispute.resolution === '__AWAITING_PICKUP__') return 'RIDER_SENT'
  return 'INITIAL'
}

export default function AdminDisputeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const disputeId = params.id as string

  const [dispute, setDispute] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [sendingMsg, setSendingMsg] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [actionFeedback, setActionFeedback] = useState('')

  const [resolution, setResolution] = useState({
    status: 'RESOLVED_SELLER_FAVOR',
    resolution: '',
    penalizeBuyer: false,
    penaltyReason: '',
  })
  const [resolving, setResolving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const [disputeRes, msgRes] = await Promise.all([
        fetch(`/api/admin/disputes/${disputeId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/disputes/${disputeId}/messages`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ])
      if (disputeRes.ok) {
        const data = await disputeRes.json()
        setDispute(data.dispute)
      }
      if (msgRes.ok) {
        const data = await msgRes.json()
        setMessages(data.messages || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const doPickupAction = async (action: string) => {
    setActionLoading(action)
    setActionFeedback('')
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/disputes/${disputeId}/pickup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      setActionFeedback(res.ok ? data.message : `Error: ${data.error}`)
      if (res.ok) await fetchAll()
    } catch {
      setActionFeedback('Something went wrong.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminMessage.trim()) return
    setSendingMsg(true)
    try {
      const token = localStorage.getItem('adminToken')
      await fetch(`/api/disputes/${disputeId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: adminMessage }),
      })
      setAdminMessage('')
      await fetchAll()
    } catch (err) { console.error(err) }
    finally { setSendingMsg(false) }
  }

  const handleDirectResolve = async () => {
    if (!resolution.resolution.trim()) {
      alert('Please write a resolution message for the buyer.')
      return
    }
    setResolving(true)
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resolution, refundAmount: 0 }),
      })
      if (res.ok) await fetchAll()
      else { const d = await res.json(); alert(d.error || 'Failed') }
    } catch { alert('Error occurred') }
    finally { setResolving(false) }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!dispute) return <div className="text-center py-12 text-ink-secondary">Dispute not found</div>

  const stage = getPickupStage(dispute)
  const rider = dispute.order?.rider
  const orderTotal = dispute.order?.totalAmount || 0
  const processingFee = Math.round(orderTotal * PROCESSING_FEE * 100) / 100
  const netRefund = Math.round((orderTotal - processingFee) * 100) / 100
  // Rider always gets 70% of that order's zone-priced delivery fee — see lib/delivery/commission.ts.
  const riderPickupPay = Math.round((dispute.order?.deliveryFee || 0) * 0.7)
  const isFullyDone = stage === 'FULLY_DONE' || ['RESOLVED_SELLER_FAVOR', 'DISMISSED'].includes(dispute.status)

  const stages = ['INITIAL', 'RIDER_SENT', 'ITEM_RECEIVED', 'REFUND_RELEASED', 'FULLY_DONE']
  const currentStageIndex = stages.indexOf(stage)

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-warning/10 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Dispute #{dispute.id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-ink-secondary text-sm">Order #{dispute.order?.orderNumber}</p>
          </div>
          <span className={`ml-auto px-3 py-1.5 rounded-full text-xs font-semibold ${
            isFullyDone ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
          }`}>
            {isFullyDone ? 'Resolved' : dispute.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div className="p-4 bg-surface rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-primary" />
              <p className="text-ink-secondary text-xs uppercase tracking-wide">Buyer</p>
            </div>
            <p className="text-ink font-semibold">{dispute.buyer?.name}</p>
            <p className="text-ink-secondary text-sm">{dispute.buyer?.email}</p>
          </div>

          <div className="p-4 bg-surface rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-warning" />
              <p className="text-ink-secondary text-xs uppercase tracking-wide">Order Amount</p>
            </div>
            <p className="text-ink font-semibold text-xl">₦{orderTotal.toLocaleString()}</p>
            <p className="text-ink-muted text-xs mt-1">After 10% fee → buyer gets ₦{netRefund.toLocaleString()}</p>
          </div>

          <div className="p-4 bg-surface rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="w-4 h-4 text-primary" />
              <p className="text-ink-secondary text-xs uppercase tracking-wide">Original Rider</p>
            </div>
            {rider ? (
              <>
                <p className="text-ink font-semibold">{rider.name}</p>
                <p className="text-ink-secondary text-sm flex items-center gap-1">
                  <Phone className="w-3 h-3" />{rider.phone}
                </p>
              </>
            ) : (
              <p className="text-ink-muted text-sm">No rider on record</p>
            )}
          </div>
        </div>

        <div className="p-4 bg-surface rounded-xl mb-4">
          <p className="text-ink-secondary text-xs uppercase tracking-wide mb-2">Buyer's Complaint</p>
          <p className="text-ink">{dispute.reason}</p>
        </div>

        {/* Fee breakdown */}
        <div className="p-4 bg-surface rounded-xl border border-border text-sm space-y-1.5">
          <div className="flex justify-between text-ink-secondary">
            <span>Order total</span><span>₦{orderTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-warning">
            <span>Processing fee (10%)</span><span>− ₦{processingFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-success font-semibold border-t border-border pt-1.5">
            <span>Buyer receives</span><span>₦{netRefund.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-primary">
            <span>Rider pickup pay</span><span>₦{riderPickupPay.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── Action panel ──────────────────────────────────────────────────── */}
      {!isFullyDone && (
        <div className="bg-white border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-ink mb-5">Actions</h2>

          {actionFeedback && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${
              actionFeedback.startsWith('Error')
                ? 'bg-danger/10 text-danger border border-danger/20'
                : 'bg-success/10 text-success border border-success/20'
            }`}>
              {actionFeedback}
            </div>
          )}

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            {[
              { key: 'INITIAL',         label: '1. Send Rider'      },
              { key: 'RIDER_SENT',      label: '2. Await Pickup'    },
              { key: 'ITEM_RECEIVED',   label: '3. Confirm Receipt' },
              { key: 'REFUND_RELEASED', label: '4. Release Payout'  },
            ].map((step, i, arr) => {
              const stepIndex = stages.indexOf(step.key)
              const done   = currentStageIndex > stepIndex
              const active = currentStageIndex === stepIndex
              return (
                <div key={step.key} className="flex items-center gap-2 flex-shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    done   ? 'bg-success/10 text-success' :
                    active ? 'bg-warning/10 text-warning' :
                             'bg-surface text-ink-muted'
                  }`}>
                    {done && <CheckCircle className="w-3 h-3" />}
                    {step.label}
                  </div>
                  {i < arr.length - 1 && <span className="text-ink-muted text-xs">→</span>}
                </div>
              )
            })}
          </div>

          {/* STEP 1 — Send rider */}
          {stage === 'INITIAL' && (
            <div className="space-y-4">
              {rider ? (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                  <div className="flex items-start gap-3 mb-4">
                    <Truck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-ink font-semibold">Send original rider to collect item</p>
                      <p className="text-ink-secondary text-sm mt-1">
                        <span className="text-primary font-medium">{rider.name}</span> ({rider.phone}) will
                        receive a notification to go back to the buyer and collect the item. They'll earn ₦{riderPickupPay.toLocaleString()} once confirmed.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => doPickupAction('send_rider')}
                    disabled={actionLoading === 'send_rider'}
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:brightness-95 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'send_rider'
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Notifying Rider...</>
                      : <><Truck className="w-4 h-4" /> Notify Rider to Collect Item</>
                    }
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
                  No rider is linked to this order. You may need to arrange pickup manually.
                </div>
              )}

              {/* Collapse for dismiss/favour seller */}
              <details className="group">
                <summary className="text-ink-secondary text-sm cursor-pointer hover:text-ink-secondary select-none py-2">
                  Or resolve without pickup (dismiss / no refund) ▾
                </summary>
                <div className="mt-3 space-y-4 pt-4 border-t border-border">
                  <select
                    value={resolution.status}
                    onChange={(e) => setResolution({ ...resolution, status: e.target.value })}
                    className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-ink focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="RESOLVED_SELLER_FAVOR">No Refund (Favour Seller)</option>
                    <option value="DISMISSED">Dismiss</option>
                  </select>
                  <textarea
                    value={resolution.resolution}
                    onChange={(e) => setResolution({ ...resolution, resolution: e.target.value })}
                    className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-24 resize-none"
                    placeholder="Explain your decision to the buyer..."
                  />
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resolution.penalizeBuyer}
                      onChange={(e) => setResolution({ ...resolution, penalizeBuyer: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-danger"
                    />
                    <span className="text-ink-secondary text-sm">Issue warning to buyer (false dispute)</span>
                  </label>
                  <button
                    onClick={handleDirectResolve}
                    disabled={resolving}
                    className="w-full px-5 py-3 bg-danger text-white rounded-xl font-semibold hover:brightness-95 disabled:opacity-50"
                  >
                    {resolving ? 'Resolving...' : 'Submit Resolution'}
                  </button>
                </div>
              </details>
            </div>
          )}

          {/* STEP 2 — Waiting for pickup */}
          {stage === 'RIDER_SENT' && (
            <div className="space-y-4">
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <Truck className="w-5 h-5 text-warning" />
                  <p className="text-warning font-semibold">
                    Waiting for {rider?.name || 'rider'} return progress
                  </p>
                </div>
                <p className="text-ink-secondary text-sm">
                  Rider updates return status (picked up → on the way → delivered).
                  Buyer refund now releases when seller confirms return receipt.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3 — Release refund + rider pay (two independent buttons) */}
          {(stage === 'ITEM_RECEIVED' || stage === 'REFUND_RELEASED') && (
            <div className="space-y-4">
              <div className="p-3 bg-success/10 border border-success/20 rounded-xl text-sm text-success flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Item confirmed received. Release payments below.
              </div>

              {/* Refund to buyer */}
              <div className={`p-4 rounded-xl border ${
                stage === 'REFUND_RELEASED'
                  ? 'bg-surface border-border opacity-50'
                  : 'bg-surface border-border'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-ink font-semibold flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-success" />
                      Buyer Refund Release
                    </p>
                    <p className="text-ink-secondary text-sm mt-1">
                      Seller confirms return in order page, then buyer refund is released automatically.
                    </p>
                  </div>
                  <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold flex-shrink-0">
                    Seller confirmation required
                  </span>
                </div>
              </div>

              {/* Rider pay */}
              <div className="p-4 bg-surface border border-border rounded-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-ink font-semibold flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      Release Rider Pickup Pay
                    </p>
                    <p className="text-ink-secondary text-sm mt-1">
                      ₦{riderPickupPay.toLocaleString()} → {rider?.name}'s wallet
                    </p>
                  </div>
                  <button
                    onClick={() => doPickupAction('release_rider_pay')}
                    disabled={actionLoading === 'release_rider_pay'}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-primary hover:brightness-95 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'release_rider_pay'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : `Release ₦${riderPickupPay.toLocaleString()}`
                    }
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Resolved summary ──────────────────────────────────────────────── */}
      {isFullyDone && (
        <div className="bg-white border border-success/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-success" />
            <h2 className="text-lg font-semibold text-ink">Dispute Resolved</h2>
          </div>
          <p className="text-ink-secondary">
            Status: <span className="text-ink font-semibold">{dispute.status.replace(/_/g, ' ')}</span>
          </p>
          {dispute.refundAmount > 0 && (
            <p className="text-ink-secondary mt-1">
              Refund paid: <span className="text-success font-semibold">₦{dispute.refundAmount.toLocaleString()}</span>
            </p>
          )}
        </div>
      )}

      {/* ── Chat ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-ink">Chat with Buyer</h2>
        </div>

        <div className="space-y-3 max-h-72 overflow-y-auto mb-4 pr-1">
          {messages.length === 0 ? (
            <p className="text-ink-muted text-sm text-center py-6">No messages yet</p>
          ) : (
            messages.map((msg: any) => {
              const isAdmin = msg.senderType === 'ADMIN'
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-sm px-4 py-3 rounded-2xl text-sm ${
                    isAdmin ? 'bg-primary text-white rounded-br-sm' : 'bg-surface text-ink rounded-bl-sm'
                  }`}>
                    <p className="text-xs opacity-60 mb-1 font-semibold">{isAdmin ? 'You (Admin)' : 'Buyer'}</p>
                    <p>{msg.message}</p>
                    <p className="text-xs opacity-40 mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {!isFullyDone && (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              placeholder="Message the buyer..."
              className="flex-1 px-4 py-2.5 bg-surface border border-border rounded-xl text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={sendingMsg}
            />
            <button
              type="submit"
              disabled={sendingMsg || !adminMessage.trim()}
              className="px-4 py-2.5 bg-danger/100/80 hover:bg-danger/100 text-ink rounded-xl text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </form>
        )}
      </div>

    </div>
  )
}
