'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Phone } from 'lucide-react'
import { AdminHeader, AdminPanel, AdminEmpty, AdminLoading, AdminButton } from '@/components/admin/AdminUI'
import { Badge } from '@/components/ui/Badge'

interface IntakeOrder {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  placedAt: string
  buyerUsername: string | null
  seller: { name: string; phone: string; hostelName: string | null; landmark: string | null }
  products: { name: string; quantity: number; estimate: string | null }[]
  readyDays: number
  readyOn: string
  deliveryDate: string
}

const WED_OR_SAT = [3, 6]
const lagosDay = (iso: string) =>
  new Date(new Date(iso).getTime() + 60 * 60 * 1000).getUTCDay()

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })

export default function AdminOrderIntakePage() {
  const [orders, setOrders] = useState<IntakeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const token = localStorage.getItem('adminToken')
    try {
      const res = await fetch('/api/admin/order-intake', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load'); return }
      setOrders(json.orders)
      setError('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const cancel = async (order: IntakeOrder) => {
    const reason = window.prompt(
      `Cancel order #${order.orderNumber} and refund the buyer to their wallet?\n\nReason shown to the buyer:`,
      'Product not available',
    )
    if (reason === null) return
    setBusyId(order.id)
    const token = localStorage.getItem('adminToken')
    try {
      const res = await fetch(`/api/admin/order-intake/${order.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const json = await res.json()
      if (!res.ok) window.alert(json.error || 'Could not cancel')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Operations"
        title="Order intake"
        description="New orders waiting on the vendor. Call each vendor, confirm when the product will be ready, and cancel if they cannot supply it."
      />

      {loading ? (
        <AdminLoading rows={4} />
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : orders.length === 0 ? (
        <AdminEmpty icon={ClipboardList} title="Nothing to confirm" description="New orders appear here as soon as they are paid." />
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
            const readyDow = lagosDay(order.readyOn)
            const readyIsDeliveryDay = WED_OR_SAT.includes(readyDow)
            return (
              <AdminPanel key={order.id} title={`#${order.orderNumber}`}>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <p className="ui-mono ui-mono-sm text-ink-muted">Vendor</p>
                      <p className="mt-1 text-sm font-medium text-ink">{order.seller.name}</p>
                      <a href={`tel:${order.seller.phone}`} className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-primary">
                        <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {order.seller.phone}
                      </a>
                      {(order.seller.hostelName || order.seller.landmark) && (
                        <p className="mt-0.5 text-xs text-ink-secondary">
                          {[order.seller.hostelName, order.seller.landmark].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="ui-mono ui-mono-sm text-ink-muted">Buyer</p>
                      <p className="mt-1 text-sm text-ink">{order.buyerUsername ? `@${order.buyerUsername}` : 'No username'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="ui-mono ui-mono-sm text-ink-muted">Items</p>
                      <ul className="mt-1 space-y-1">
                        {order.products.map((p, i) => (
                          <li key={i} className="text-sm text-ink">
                            {p.name} <span className="text-ink-muted">x{p.quantity}</span>
                            <span className="ml-2 text-xs text-ink-secondary">vendor says {p.estimate || 'no estimate'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid grid-cols-2 gap-px border border-border bg-border">
                      <div className="bg-card px-3 py-2.5">
                        <p className="ui-mono ui-mono-sm text-ink-muted">Ready on</p>
                        <p className="mt-1 text-sm text-ink">{fmtDay(order.readyOn)}</p>
                      </div>
                      <div className="bg-card px-3 py-2.5">
                        <p className="ui-mono ui-mono-sm text-ink-muted">Delivered on</p>
                        <p className="mt-1 text-sm font-medium text-ink">{fmtDay(order.deliveryDate)}</p>
                      </div>
                    </div>
                    {!readyIsDeliveryDay && (
                      <p className="border border-warning/25 bg-warning/5 px-3 py-2 text-xs text-warning">
                        Ready day is not a Wednesday or Saturday. Tell the vendor and the buyer it will be delivered on {fmtDay(order.deliveryDate)}.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="flex items-center gap-3">
                    <Badge status={order.status === 'PENDING' ? 'warning' : 'verified'}>{order.status === 'PENDING' ? 'Vendor not accepted' : 'Vendor accepted'}</Badge>
                    <span className="ui-figure text-sm text-ink">₦{order.totalAmount.toLocaleString('en-NG')}</span>
                  </div>
                  <AdminButton onClick={() => cancel(order)} disabled={busyId === order.id} tone="danger">
                    Cancel and refund
                  </AdminButton>
                </div>
              </AdminPanel>
            )
          })}
        </div>
      )}
    </div>
  )
}
