'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Package, ChevronRight, ShoppingBag } from 'lucide-react'
import { authFetch } from '@/lib/auth-client'
import { Shell, PageHeader, EmptyState } from '@/components/ui/Shell'
import { Badge } from '@/components/ui/Badge'

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

/** Product thumbnail with a graceful fallback when the listing has no image. */
function OrderThumb({ order }: { order: Order }) {
  return (
    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden bg-surface">
      {order.product.images?.[0] ? (
        <img
          src={order.product.images[0]}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <Package className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
      )}
    </div>
  )
}

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
      router.push('/login?redirect=/dispute/select-order')
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
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Shell width="reading" className="pt-8 sm:pt-12">
        <PageHeader
          eyebrow="Support"
          back={{ href: '/orders', label: 'All orders' }}
          title={
            <>
              Open a <span className="ui-serif">dispute</span>
            </>
          }
          description="Pick the delivered order you want to raise. Disputes must be opened within 48 hours of delivery."
        />

        {error && (
          <div className="mt-8 flex items-start gap-3 border border-danger/25 bg-danger/5 px-4 py-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" strokeWidth={1.75} />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Eligible orders */}
        <div className="mt-10">
          {eligibleOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No eligible orders"
              description="Only delivered or completed orders within the last 48 hours can be disputed."
              action={
                <Link
                  href="/orders"
                  className="inline-flex items-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-ink/90"
                >
                  View all orders
                </Link>
              }
            />
          ) : (
            <>
              <p className="ui-eyebrow mb-5">Eligible orders</p>
              <div className="ui-divide border border-border">
                {eligibleOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() =>
                      router.push(`/orders/${order.id}/dispute${isApp ? '?app=true' : ''}`)
                    }
                    className="ui-row group w-full text-left"
                  >
                    <OrderThumb order={order} />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {order.product.name}
                      </p>
                      <p className="ui-mono ui-mono-sm mt-1.5 text-ink-muted">
                        #{order.orderNumber ?? order.id.slice(-6).toUpperCase()}
                      </p>
                      <p className="mt-1 text-xs text-ink-secondary">
                        <span className="ui-figure text-[13px] text-ink">
                          ₦{order.totalAmount.toLocaleString()}
                        </span>
                        {' · '}
                        {new Date(
                          order.deliveredAt ?? order.completedAt ?? order.createdAt
                        ).toLocaleDateString()}
                      </p>
                    </div>

                    <ChevronRight
                      className="h-4 w-4 flex-shrink-0 text-ink-muted transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-ink"
                      strokeWidth={2}
                    />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Already disputed orders */}
        {disputedOrders.length > 0 && (
          <div className="mt-14">
            <p className="ui-eyebrow mb-5">Existing disputes</p>
            <div className="ui-divide border border-border">
              {disputedOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="ui-row group"
                >
                  <OrderThumb order={order} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {order.product.name}
                    </p>
                    <p className="ui-mono ui-mono-sm mt-1.5 text-ink-muted">
                      #{order.orderNumber ?? order.id.slice(-6).toUpperCase()}
                    </p>
                    <div className="mt-2">
                      <Badge status="danger">Disputed</Badge>
                    </div>
                  </div>

                  <ChevronRight
                    className="h-4 w-4 flex-shrink-0 text-ink-muted transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-ink"
                    strokeWidth={2}
                  />
                </Link>
              ))}
            </div>
          </div>
        )}
      </Shell>
    </div>
  )
}
