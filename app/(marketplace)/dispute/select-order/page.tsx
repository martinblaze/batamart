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
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h1 className="text-2xl font-bold text-gray-900">Open a Dispute</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Select the delivered order you want to dispute. Disputes must be opened within 48 hours of delivery.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Eligible orders */}
        {eligibleOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No eligible orders</p>
            <p className="text-gray-400 text-sm mt-1">
              Only delivered or completed orders within 48 hours can be disputed.
            </p>
            <Link
              href="/orders"
              className="inline-block mt-4 text-indigo-600 text-sm font-semibold hover:underline"
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
                className="w-full bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 hover:border-indigo-400 hover:shadow-md transition-all text-left"
              >
                {/* Product image */}
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {order.product.images?.[0] ? (
                    <img
                      src={order.product.images[0]}
                      alt={order.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-gray-300 m-auto mt-4" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {order.product.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    Order #{order.orderNumber ?? order.id.slice(-6).toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-400">
                    ₦{order.totalAmount.toLocaleString()} ·{' '}
                    {new Date(
                      order.deliveredAt ?? order.completedAt ?? order.createdAt
                    ).toLocaleDateString()}
                  </p>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Already disputed orders */}
        {disputedOrders.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Existing Disputes
            </h2>
            <div className="space-y-3">
              {disputedOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {order.product.images?.[0] ? (
                      <img
                        src={order.product.images[0]}
                        alt={order.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-gray-300 m-auto mt-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {order.product.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      Order #{order.orderNumber ?? order.id.slice(-6).toUpperCase()}
                    </p>
                    <span className="inline-block text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-1">
                      Disputed
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
