'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertTriangle, Package, ChevronRight, ShoppingBag } from 'lucide-react'
import { authFetch } from '@/lib/auth-client'

interface Order {
  id: string
  orderNumber?: string
  status: string
  totalAmount: number
  createdAt: string
  deliveredAt?: string
  completedAt?: string
  isDisputed?: boolean
  product: { id: string; name: string; images: string[] }
  seller: { id: string; name: string }
}

const DISPUTE_ELIGIBLE = ['DELIVERED', 'COMPLETED']

export default function SelectOrderForDisputePage() {
  const router = useRouter()
  const [isApp, setIsApp] = useState(false)

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setIsApp(new URLSearchParams(window.location.search).get('app') === 'true')
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login?returnTo=/dispute/select-order')
      return
    }
    fetchOrders()
  }, [router])

  const fetchOrders = async () => {
    try {
      const res = await authFetch('/api/orders/my-orders')
      if (!res.ok) throw new Error('Failed to fetch orders')
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (err) {
      setError('Could not load your orders. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const eligibleOrders = orders.filter(
    (o) => DISPUTE_ELIGIBLE.includes(o.status) && !o.isDisputed
  )
  const disputedOrders = orders.filter((o) => o.isDisputed)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-[#000000] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h1 className="text-2xl font-semibold text-ink">Open a Dispute</h1>
          </div>
          <p className="text-ink-secondary text-sm">
            Select the delivered order you want to dispute. Disputes must be opened within 48 hours of delivery.
          </p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Eligible orders */}
        {eligibleOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-8 text-center">
            <ShoppingBag className="w-10 h-10 text-ink-muted mx-auto mb-3" />
            <p className="text-ink-secondary font-medium">No eligible orders</p>
            <p className="text-ink-muted text-sm mt-1">
              Only delivered or completed orders within 48 hours can be disputed.
            </p>
            <Link
              href="/orders"
              className="inline-block mt-4 text-primary text-sm font-semibold hover:underline"
            >
              View all orders →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {eligibleOrders.map((order) => (
              <button
                key={order.id}
                onClick={() =>
                  router.push(
                    `/orders/${order.id}/dispute${isApp ? '?app=true' : ''}`
                  )
                }
                className="w-full bg-white border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/50 hover:shadow-soft transition-all text-left"
              >
                {/* Product image */}
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface flex-shrink-0">
                  {order.product.images?.[0] ? (
                    <img
                      src={order.product.images[0]}
                      alt={order.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-ink-muted m-auto mt-4" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink truncate">
                    {order.product.name}
                  </p>
                  <p className="text-sm text-ink-secondary">
                    Order #{order.orderNumber ?? order.id.slice(-6).toUpperCase()}
                  </p>
                  <p className="text-sm text-ink-muted">
                    ₦{order.totalAmount.toLocaleString()} ·{' '}
                    {new Date(
                      order.deliveredAt ?? order.completedAt ?? order.createdAt
                    ).toLocaleDateString()}
                  </p>
                </div>

                <ChevronRight className="w-5 h-5 text-ink-muted flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Already disputed orders */}
        {disputedOrders.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wider mb-3">
              Existing Disputes
            </h2>
            <div className="space-y-3">
              {disputedOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-4 bg-white border border-border rounded-2xl p-4 hover:border-border transition-all"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-surface flex-shrink-0">
                    {order.product.images?.[0] ? (
                      <img
                        src={order.product.images[0]}
                        alt={order.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-ink-muted m-auto mt-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink truncate">
                      {order.product.name}
                    </p>
                    <p className="text-sm text-ink-secondary">
                      Order #{order.orderNumber ?? order.id.slice(-6).toUpperCase()}
                    </p>
                    <span className="inline-block text-xs font-semibold text-danger bg-danger/10 px-2 py-0.5 rounded-full mt-1">
                      Disputed
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-ink-muted flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
