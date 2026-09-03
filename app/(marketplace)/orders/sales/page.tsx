'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, ChevronRight, MapPin, Package, ShoppingBag, Tag, User } from 'lucide-react'
import { Shell, PageHeader, EmptyState, Skeleton } from '@/components/ui/Shell'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
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
  /** Pickup zone — used to show the delivery route on the card. */
  landmark?: string | null
}

interface SalesOrder {
  id: string
  orderNumber: string | null
  status: string
  orderNote: string | null
  totalAmount: number
  deliveryAddress: string
  /** Drop-off zone — pairs with product.landmark to form the route. */
  deliveryLandmark?: string | null
  createdAt: string
  buyer: SalesBuyer
  product: SalesProduct
  items: SalesItem[]
}

// Design bible: status colors are reserved for true status only — success/danger/warning,
// plus primary for neutral in-progress states. No per-stage color variety.
const STATUS_CONFIG: Record<string, { label: string; tone: BadgeStatus }> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  PROCESSING: { label: 'Processing', tone: 'verified' },
  SHIPPED: { label: 'Shipped', tone: 'verified' },
  RIDER_ASSIGNED: { label: 'Rider assigned', tone: 'verified' },
  PICKED_UP: { label: 'Picked up', tone: 'verified' },
  ON_THE_WAY: { label: 'On the way', tone: 'verified' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },
  DISPUTED: { label: 'Disputed', tone: 'danger' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' as BadgeStatus }
  return <Badge status={cfg.tone}>{cfg.label}</Badge>
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
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<{ orderId: string; message: string } | null>(null)

  const acceptOrder = async (orderId: string) => {
    if (acceptingId) return
    setAcceptingId(orderId)
    setAcceptError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'PROCESSING' }),
      })
      const data = await response.json()
      if (!response.ok) {
        setAcceptError({ orderId, message: data.error || 'Failed to accept order. Please try again.' })
        return
      }
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'PROCESSING' } : o)))
    } catch (error) {
      console.error('[SalesOrdersPage] accept error:', error)
      setAcceptError({ orderId, message: 'Network error. Please try again.' })
    } finally {
      setAcceptingId(null)
    }
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const token = localStorage.getItem('token')
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
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
      <Shell width="reading" className="pt-8 sm:pt-12">
        <PageHeader
          eyebrow="Seller"
          title={
            <>
              My <span className="ui-serif">sales</span>
            </>
          }
          description={`${orders.length} incoming order${orders.length !== 1 ? 's' : ''} to fulfil.`}
          actions={
            <Link
              href="/orders"
              className="ui-mono ui-mono-sm inline-flex h-10 items-center gap-2 border border-border bg-card px-4 text-ink-secondary transition-colors hover:border-ink/25 hover:text-ink"
            >
              <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2} /> My orders
            </Link>
          }
        />

        <div className="mt-10">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border bg-card p-5">
                <div className="flex gap-4">
                  <Skeleton className="h-20 w-20 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="mt-3 h-5 w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No sales yet"
            description="When a buyer orders one of your listings, it lands here for you to accept."
            action={
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-ink/90"
              >
                Browse marketplace <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const { extraNote } = parseVariantNote(order.orderNote)
              const isHighlighted = highlightId === order.id
              const cardClass = `border bg-card transition-colors duration-300 ${isHighlighted ? 'border-ink ring-1 ring-ink' : 'border-border'}`
              return (
                <div
                  key={order.id}
                  id={`sales-order-${order.id}`}
                  className={cardClass}
                >
                  <div className="flex items-center justify-between gap-4 border-b border-border bg-surface px-5 py-3.5">
                    <div className="flex items-center gap-5">
                      <div>
                        <p className="ui-mono ui-mono-sm text-ink-muted">Order</p>
                        <p className="ui-figure mt-1 text-[13px] text-ink">
                          #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="ui-mono ui-mono-sm text-ink-muted">Date</p>
                        <p className="mt-1 text-[13px] text-ink-secondary">
                          {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="p-5">
                    <div className="flex gap-4">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden border border-border bg-surface sm:h-24 sm:w-24">
                        <img
                          src={order.product?.images?.[0] || '/placeholder.png'}
                          alt={order.product?.name || 'Product'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="line-clamp-2 text-base font-medium leading-snug text-ink sm:text-lg">
                              {order.product?.name || 'Product'}
                            </h3>
                            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-ink-secondary">
                              <User className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
                              {order.buyer?.name || 'Buyer'}
                            </p>
                          </div>
                          <p className="ui-figure whitespace-nowrap text-base text-ink">{formatPrice(order.totalAmount)}</p>
                        </div>
                        <p className="ui-mono ui-mono-sm mt-2 text-ink-muted">
                          Placed {new Date(order.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                        <VariantBadges orderNote={order.orderNote} />
                        <div className="mt-4 grid gap-2 text-sm text-ink-secondary">
                          <p className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                            {order.deliveryAddress}
                          </p>
                          {order.product?.landmark && order.deliveryLandmark && (
                            <p className="ui-mono ui-mono-sm flex items-center gap-1.5 text-ink-muted">
                              {order.product.landmark}
                              <ArrowRight className="h-3 w-3" strokeWidth={2} />
                              {order.deliveryLandmark}
                            </p>
                          )}
                          {extraNote && (
                            <p className="text-xs text-ink-secondary">
                              <span className="font-medium text-ink">Buyer&apos;s note:</span> {extraNote}
                            </p>
                          )}
                          <p className="ui-mono ui-mono-sm text-ink-muted">
                            {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {acceptError?.orderId === order.id && (
                          <p className="mt-4 border border-danger/25 bg-danger/5 px-3 py-2 text-xs text-danger">
                            {acceptError.message}
                          </p>
                        )}
                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          {order.status === 'PENDING' && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => acceptOrder(order.id)}
                              isLoading={acceptingId === order.id}
                              loadingText="Accepting…"
                              leftIcon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />}
                            >
                              Accept order
                            </Button>
                          )}
                          <Link
                            href={`/orders/${order.id}`}
                            className="ui-mono ui-mono-sm group inline-flex h-9 items-center gap-2 bg-ink px-4 text-background transition-colors hover:bg-ink/90"
                          >
                            View details
                            <ChevronRight
                              className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                              strokeWidth={2}
                            />
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
      </Shell>
    </div>
  )
}