// app/(admin)/admin/disputes/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle, User, DollarSign, MessageSquare,
  Truck, Send, Loader2, CheckCircle, Package, Phone
} from 'lucide-react'
import { AdminHeader, AdminPanel, AdminEmpty } from '@/components/admin/AdminUI'
import { DataRow } from '@/components/ui/Shell'
import { Badge } from '@/components/ui/Badge'

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
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    )
  }

  if (!dispute) {
    return (
      <AdminEmpty
        icon={AlertTriangle}
        title="Dispute not found"
        description="This case may already have been resolved and archived."
      />
    )
  }

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
      <AdminHeader
        eyebrow={`Order #${dispute.order?.orderNumber}`}
        title={<span className="ui-figure">#{dispute.id.slice(0, 8).toUpperCase()}</span>}
        description="Work the case top to bottom: send a rider, confirm the return, then release the money."
        actions={
          <Badge status={isFullyDone ? 'success' : 'warning'}>
            {isFullyDone ? 'Resolved' : dispute.status.replace(/_/g, ' ')}
          </Badge>
        }
      />

      <div className="grid gap-px border border-border bg-border md:grid-cols-3">
        <div className="bg-card p-4">
          <p className="ui-mono ui-mono-sm text-ink-muted">Buyer</p>
          <p className="mt-2 truncate text-sm font-medium text-ink">{dispute.buyer?.name}</p>
          <p className="mt-0.5 truncate text-xs text-ink-secondary">{dispute.buyer?.email}</p>
        </div>

        <div className="bg-card p-4">
          <p className="ui-mono ui-mono-sm text-ink-muted">Order amount</p>
          <p className="ui-figure mt-2 text-xl text-ink">₦{orderTotal.toLocaleString()}</p>
          <p className="mt-1 text-xs text-ink-muted">
            After the 10% fee the buyer receives ₦{netRefund.toLocaleString()}
          </p>
        </div>

        <div className="bg-card p-4">
          <p className="ui-mono ui-mono-sm text-ink-muted">Original rider</p>
          {rider ? (
            <>
              <p className="mt-2 truncate text-sm font-medium text-ink">{rider.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-secondary">
                <Phone className="h-3 w-3" strokeWidth={1.75} />{rider.phone}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">No rider on record</p>
          )}
        </div>
      </div>

      <AdminPanel title="Buyer's complaint">
        <p className="max-w-[70ch] whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">
          {dispute.reason}
        </p>
      </AdminPanel>

      {/* Fee breakdown */}
      <AdminPanel title="Money">
        <div className="ui-divide">
          <DataRow label="Order total" value={`₦${orderTotal.toLocaleString()}`} />
          <DataRow
            label="Processing fee (10%)"
            value={<span className="text-warning">− ₦{processingFee.toLocaleString()}</span>}
          />
          <DataRow
            label="Buyer receives"
            emphasis
            value={<span className="text-success">₦{netRefund.toLocaleString()}</span>}
          />
          <DataRow label="Rider pickup pay" value={`₦${riderPickupPay.toLocaleString()}`} />
        </div>
      </AdminPanel>

      {/* ── Action panel ──────────────────────────────────────────────────── */}
      {!isFullyDone && (
        <AdminPanel title="Actions">
          {actionFeedback && (
            <div className={`mb-5 border px-4 py-3 text-sm font-medium ${
              actionFeedback.startsWith('Error')
                ? 'border-danger/25 bg-danger/5 text-danger'
                : 'border-success/25 bg-success/5 text-success'
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
                <div key={step.key} className="flex flex-shrink-0 items-center gap-2">
                  <div className={`ui-mono ui-mono-sm flex items-center gap-1.5 border px-3 py-1.5 ${
                    done   ? 'border-success/25 bg-success/5 text-success' :
                    active ? 'border-ink bg-ink text-background' :
                             'border-border bg-card text-ink-muted'
                  }`}>
                    {done && <CheckCircle className="h-3 w-3" strokeWidth={2} />}
                    {step.label}
                  </div>
                  {i < arr.length - 1 && <span className="text-xs text-ink-muted">→</span>}
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
                    className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-ink hover:bg-primary text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
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
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-ink hover:bg-primary text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
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
        </AdminPanel>
      )}

      {/* ── Resolved summary ──────────────────────────────────────────────── */}
      {isFullyDone && (
        <section className="ui-panel border-success/30">
          <p className="ui-eyebrow mb-5 text-success">
            <CheckCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
            Resolved
          </p>
          <div className="ui-divide">
            <DataRow label="Status" value={dispute.status.replace(/_/g, ' ')} />
            {dispute.refundAmount > 0 && (
              <DataRow
                label="Refund paid"
                emphasis
                value={<span className="text-success">₦{dispute.refundAmount.toLocaleString()}</span>}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Chat ──────────────────────────────────────────────────────────── */}
      <AdminPanel title="Chat with buyer">

        <div className="mb-5 max-h-72 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-secondary">No messages yet</p>
          ) : (
            messages.map((msg: any) => {
              const isAdmin = msg.senderType === 'ADMIN'
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-sm px-4 py-3 text-sm leading-relaxed ${
                    isAdmin ? 'bg-ink text-background' : 'border border-border bg-surface text-ink'
                  }`}>
                    <p className="ui-mono ui-mono-sm mb-1.5 opacity-60">
                      {isAdmin ? 'You (admin)' : 'Buyer'}
                    </p>
                    <p>{msg.message}</p>
                    <p className="ui-mono ui-mono-sm mt-1.5 opacity-45">
                      {new Date(msg.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {!isFullyDone && (
          <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-border pt-5">
            <input
              type="text"
              value={adminMessage}
              onChange={(e) => setAdminMessage(e.target.value)}
              placeholder="Message the buyer…"
              className="h-10 flex-1 border border-border bg-card px-3.5 text-sm text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              disabled={sendingMsg}
            />
            <button
              type="submit"
              disabled={sendingMsg || !adminMessage.trim()}
              className="ui-mono ui-mono-sm inline-flex h-10 flex-shrink-0 items-center gap-2 bg-ink px-4 text-white transition-colors hover:bg-primary disabled:pointer-events-none disabled:opacity-40"
            >
              {sendingMsg ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              Send
            </button>
          </form>
        )}
      </AdminPanel>

    </div>
  )
}
