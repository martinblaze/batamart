'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, ChevronRight, MapPin, Package, ShoppingBag, Tag, User } from 'lucide-react'
import { getVariantChips, parseVariantNote } from '@/lib/order-notes'

interface SalesItem {
  id: string
  productId: string
  variantId: string | null
  variantData: Record<string, string> | null
  quantity: number
  price: number
}

interface SalesBuyer {
  id: string
  name: string | null
  phone: string | null
  profilePhoto: string | null
}

interface SalesProduct {
  id: string
  name: string
  images: string[]
  price: number
}

interface SalesOrder {
  id: string
  orderNumber: string | null
  status: string
  orderNote: string | null
  totalAmount: number
  deliveryAddress: string
  createdAt: string
  buyer: SalesBuyer
  product: SalesProduct
  items: SalesItem[]
}

// Design bible: status colors are reserved for true status only — success/danger/warning,
// plus primary for neutral in-progress states. No per-stage color variety.
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string; dot: string }> = {
  PENDING: { label: 'Pending', color: 'text-warning', bg: 'bg-warning/10', ring: 'ring-warning/30', dot: 'bg-warning' },
  PROCESSING: { label: 'Processing', color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/30', dot: 'bg-primary' },
  SHIPPED: { label: 'Shipped', color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/30', dot: 'bg-primary' },
  RIDER_ASSIGNED: { label: 'Rider assigned', color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/30', dot: 'bg-primary' },
  PICKED_UP: { label: 'Picked up', color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/30', dot: 'bg-primary' },
  ON_THE_WAY: { label: 'On the way', color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/30', dot: 'bg-primary' },
  DELIVERED: { label: 'Delivered', color: 'text-success', bg: 'bg-success/10', ring: 'ring-success/30', dot: 'bg-success' },
  COMPLETED: { label: 'Completed', color: 'text-success', bg: 'bg-success/10', ring: 'ring-success/30', dot: 'bg-success' },
  CANCELLED: { label: 'Cancelled', color: 'text-danger', bg: 'bg-danger/10', ring: 'ring-danger/30', dot: 'bg-danger' },
  DISPUTED: { label: 'Disputed', color: 'text-danger', bg: 'bg-danger/10', ring: 'ring-danger/30', dot: 'bg-danger' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-ink-secondary", bg: "bg-surface", ring: "ring-border", dot: "bg-ink-muted" }
  return (
    <span className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ' + cfg.bg + ' ' + cfg.color + ' ' + cfg.ring}>
      <span className={'w-1.5 h-1.5 rounded-full ' + cfg.dot} />
      {cfg.label}
    </span>
  )
}

function VariantBadges({ orderNote }: { orderNote?: string | null }) {
  const { variantSummary, extraNote } = parseVariantNote(orderNote)
  const chips = getVariantChips(orderNote)
  if (!variantSummary && !extraNote) return null
  return (
    <div className="mt-1.5 space-y-1">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span key={chip} className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
              <Tag className="w-2.5 h-2.5" />
              {chip}
            </span>
          ))}
        </div>
      )}
      {extraNote && <p className="text-[10px] text-ink-muted italic">Buyer's note: {extraNote}</p>}
    </div>
  )
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)
}

export default function SalesOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    setHighlightId(query.get('highlight'))
  }, [router])

  useEffect(() => {
    if (!highlightId) return
    const timer = window.setTimeout(() => {
      document.getElementById(`sales-order-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 100)
    return () => window.clearTimeout(timer)
  }, [highlightId, orders])

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const response = await fetch('/api/orders/sales', { headers: { Authorization: `Bearer ${token}` } })
        const data = await response.json()
        if (response.ok) {
          setOrders(data.orders || [])
        }
      } catch (error) {
        console.error('[SalesOrdersPage] fetch error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  return (
    <div className="min-h-screen bg-surface pb-20">
      <div className="bg-white border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-ink">My Sales</h1>
              <p className="text-sm text-ink-secondary mt-0.5">
                {orders.length} incoming order{orders.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href="/orders"
              className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline transition-colors"
            >
              <ShoppingBag className="w-4 h-4" /> My Orders
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-border rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-border rounded-lg w-3/4" />
                    <div className="h-3 bg-border rounded-lg w-1/2" />
                    <div className="h-5 bg-border rounded-lg w-1/4 mt-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-border">
            <div className="w-20 h-20 bg-surface rounded-2xl flex items-center justify-center mb-5 ring-1 ring-border">
              <Package className="w-9 h-9 text-ink-muted" />
            </div>
            <h3 className="text-xl font-semibold text-ink mb-1">No sales yet</h3>
            <p className="text-ink-muted text-sm mb-6">Orders from buyers will show up here.</p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 bg-primary hover:brightness-95 text-white px-6 py-3 rounded-xl font-semibold text-sm shadow-soft transition-all"
            >
              Browse Marketplace <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const { extraNote } = parseVariantNote(order.orderNote)
              const isHighlighted = highlightId === order.id
              const cardClass = `bg-white rounded-2xl border shadow-soft hover:shadow-soft transition-all duration-200 overflow-hidden ${isHighlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-border'}`
              return (
                <div
                  key={order.id}
                  id={`sales-order-${order.id}`}
                  className={cardClass}
                >
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-surface/50">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Order</p>
                        <p className="text-sm font-semibold text-ink">#{order.orderNumber || order.id.slice(-8).toUpperCase()}</p>
                      </div>
                      <div className="hidden sm:block w-px h-8 bg-border" />
                      <div className="hidden sm:block">
                        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Date</p>
                        <p className="text-sm font-semibold text-ink-secondary">
                          {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="p-5">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface flex-shrink-0 border border-border">
                        <img
                          src={order.buyer?.profilePhoto || '/placeholder.png'}
                          alt={order.buyer?.name || 'Buyer'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-ink text-base sm:text-lg leading-snug line-clamp-2">
                              {order.product?.name || 'Product'}
                            </h3>
                            <p className="text-xs font-semibold text-ink-secondary mt-1 inline-flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" />
                              {order.buyer?.name || 'Buyer'}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-primary whitespace-nowrap">{formatPrice(order.totalAmount)}</p>
                        </div>
                        <p className="text-xs text-ink-muted mt-1">Placed {new Date(order.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                        <VariantBadges orderNote={order.orderNote} />
                        <div className="mt-3 grid gap-2 text-sm text-ink-secondary">
                          <p className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-ink-muted flex-shrink-0" />{order.deliveryAddress}</p>
                          {extraNote && <p className="text-xs text-ink-secondary"><span className="font-semibold text-ink-secondary">Buyer's note:</span> {extraNote}</p>}
                          <p className="text-xs text-ink-muted">
                            {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <Link
                            href={`/orders/${order.id}`}
                            className="inline-flex items-center gap-2 bg-primary hover:brightness-95 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-soft transition-all"
                          >
                            View details <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}