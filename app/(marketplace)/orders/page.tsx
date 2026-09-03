// app/(marketplace)/orders/page.tsx
// ── UPGRADED: Parses variant selection from orderNote and displays it ─────────
'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Star, CheckCircle, Loader2, Package, MapPin, User,
  Bike, ChevronRight, ArrowRight, ShoppingBag, Clock,
  X, BadgeCheck, AlertCircle, Tag, Heart,
} from 'lucide-react'
import { OrderNotificationBanner } from '@/components/layout/OrderNotificationBanner'
import { getVariantChips, parseVariantNote } from '@/lib/order-notes'
import { CAMPAIGNS, isValidCampaignKey } from '@/lib/campaigns'
import GirlfriendsDayCelebration from '@/components/marketplace/GirlfriendsDayCelebration'

interface ProductReview { id: string; rating: number; comment: string; createdAt: string }
interface Review { id: string; type: string; rating: number; comment: string | null; createdAt: string }
interface Seller { id: string; name: string; profilePhoto: string | null; email: string; phone: string; avgRating: number; trustLevel: string }
interface Product { id: string; name: string; images: string[]; price: number; landmark?: string }
interface Rider { id: string; name: string; phone: string | null }
interface PeopleLikeYouItem {
  key: string
  soldCount: number
  product: {
    id: string
    name: string
    price: number
    images: string[]
    seller: { name: string; avgRating: number }
  }
}
interface Order {
  id: string; orderNumber?: string; status: string; totalAmount: number; quantity?: number
  deliveryAddress: string; deliveryLandmark?: string; createdAt: string; completedAt?: string; isPaid?: boolean
  orderNote?: string | null; campaignTag?: string | null
  seller: Seller; product: Product; rider?: Rider; reviews?: Review[]; productReviews?: ProductReview[]
}

function isGirlfriendsDayOrder(order: Order) {
  return isValidCampaignKey(order.campaignTag)
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

function VariantBadges({ orderNote }: { orderNote?: string | null }) {
  const { variantSummary, extraNote } = parseVariantNote(orderNote)
  if (!variantSummary && !extraNote) return null
  const chips = getVariantChips(orderNote)
  return (
    <div className="mt-1.5 space-y-1">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map(chip => (
            <span key={chip} className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
              <Tag className="w-2.5 h-2.5" />
              {chip}
            </span>
          ))}
        </div>
      )}
      {extraNote && (
        <p className="text-[10px] text-ink-muted italic">Note: {extraNote}</p>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-ink-secondary', bg: 'bg-surface', ring: 'ring-border', dot: 'bg-ink-muted' }
  return (
    <span className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ' + cfg.bg + ' ' + cfg.color + ' ' + cfg.ring}>
      <span className={'w-1.5 h-1.5 rounded-full ' + cfg.dot} />
      {cfg.label}
    </span>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [showSuccess, setShowSuccess] = useState(false)
  const [postPayment, setPostPayment] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const [celebrateOrder, setCelebrateOrder] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [peopleLikeYouBought, setPeopleLikeYouBought] = useState<PeopleLikeYouItem[]>([])

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const token = localStorage.getItem('token')
    if (!token) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
    setCheckingAuth(false)

    const paymentStatus = query.get('payment')
    const orderNumber = query.get('order')
    const orderCount = query.get('count')

    if (paymentStatus === 'success') {
      setPostPayment(true)
      sessionStorage.removeItem('checkout_product')
      sessionStorage.removeItem('checkout_cart')
      window.history.replaceState({}, '', '/orders')
    }

    fetchOrders().then((fetched) => {
      if (paymentStatus !== 'success') return

      const count = orderCount ? parseInt(orderCount) : 1
      const matched = orderNumber ? fetched.find((o) => o.orderNumber === orderNumber) : null

      if (matched && isGirlfriendsDayOrder(matched)) {
        const label = CAMPAIGNS[matched.campaignTag as keyof typeof CAMPAIGNS].label
        setSuccessMessage(`Your ${label} order has been placed${orderNumber ? ` — #${orderNumber}` : ''}. She's going to love this.`)
        setCelebrateOrder(true)
        setCelebrate(true)
      } else {
        setSuccessMessage(
          orderNumber
            ? `Payment successful! Order${count > 1 ? 's' : ''} placed: ${orderNumber}${count > 1 ? ` and ${count - 1} more` : ''}`
            : 'Payment successful! Your order has been placed.'
        )
      }
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 6000)
    })
    fetchPeopleLikeYouBought()
  }, [router])

  const fetchOrders = async (): Promise<Order[]> => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/orders', { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await response.json()
      if (response.ok) {
        const nextOrders: Order[] = data.orders || []
        setOrders(nextOrders)
        return nextOrders
      }
    } catch (error) { console.error('Error fetching orders:', error) }
    finally { setLoading(false) }
    return []
  }

  const fetchPeopleLikeYouBought = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const response = await fetch('/api/products/people-like-you?mode=top&pageSize=10', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (response.ok) {
        const items = data.items || []
        setPeopleLikeYouBought(items)
      }
    } catch {}
  }

  const confirmDelivery = async (orderId: string) => {
    if (actionLoading[`confirm-${orderId}`]) return
    if (!confirm('Confirm you received the product? This will release payment to seller and rider.')) return
    setActionLoading(prev => ({ ...prev, [`confirm-${orderId}`]: true }))
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/orders/confirm-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ orderId }),
      })
      const result = await response.json()
      if (response.ok) { alert(result.message || 'Payment released. Thank you!'); fetchOrders() }
      else alert(result.error || 'Failed to confirm delivery')
    } catch { alert('Error confirming delivery') }
    finally { setActionLoading(prev => ({ ...prev, [`confirm-${orderId}`]: false })) }
  }

  const nav = (key: string, path: string) => {
    if (actionLoading[key]) return
    setActionLoading(prev => ({ ...prev, [key]: true }))
    router.push(path)
  }

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

  const canReview = (o: Order) => o.status === 'DELIVERED' || o.status === 'COMPLETED'
  const hasReviewedProduct = (o: Order) => o.productReviews && o.productReviews.length > 0
  const hasReviewedSeller = (o: Order) => o.reviews?.some((r: Review) => r.type === 'SELLER')

  if (checkingAuth) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-surface pb-20">

      {/* ── Girlfriend's Day celebration ──────────────────────────────── */}
      {celebrate && <GirlfriendsDayCelebration onDone={() => setCelebrate(false)} />}

      {/* ── Success toast ─────────────────────────────────────────────── */}
      {showSuccess && (
        <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 animate-in slide-in-from-top-3 duration-300">
          <div className={`w-full max-w-md rounded-xl px-4 py-3 shadow-soft flex items-start gap-3 ${
            celebrateOrder ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white' : 'bg-ink text-background'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              celebrateOrder ? 'bg-white/20' : 'bg-success'
            }`}>
              {celebrateOrder
                ? <Heart className="w-4 h-4" strokeWidth={1.75} fill="currentColor" />
                : <CheckCircle className="w-4 h-4" strokeWidth={1.75} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm leading-snug break-words">{successMessage}</p>
              <p className="text-xs text-white/70 mt-0.5">Seller has been notified</p>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="text-white/70 hover:text-white flex-shrink-0 ml-1 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Notification banner (post-payment or passive nudge) ─────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4">
        <OrderNotificationBanner postPayment={postPayment} />
      </div>

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="ui-eyebrow mb-2 max-w-[12rem]">
                {orders.length} order{orders.length !== 1 ? 's' : ''} total
              </p>
              <h1 className="text-[clamp(1.6rem,3.4vw,2.4rem)] text-ink">My orders</h1>
            </div>
            <Link
              href="/marketplace"
              className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors duration-300 hover:text-ink sm:flex"
            >
              <ShoppingBag className="h-3.5 w-3.5" /> Shop more
            </Link>
            <Link
              href="/orders/sales"
              className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors duration-300 hover:text-ink sm:flex"
            >
              <Package className="h-3.5 w-3.5" /> Selling
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {peopleLikeYouBought.length > 0 && (
          <div className="mb-6 bg-card rounded-2xl border border-border shadow-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-ink">People Like You Bought</h2>
              <button
                onClick={() => router.push('/most-bought')}
                className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
              >
                See more <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {peopleLikeYouBought.map((item) => (
                <div
                  key={item.key}
                  onClick={() => router.push(`/product/${item.product.id}`)}
                  className="flex-shrink-0 w-36 sm:w-44 rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-soft transition-shadow bg-card"
                >
                  <div className="aspect-square bg-surface overflow-hidden">
                    <img
                      src={item.product.images?.[0] || '/placeholder.png'}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-ink line-clamp-2 leading-snug">{item.product.name}</p>
                    <p className="text-xs font-semibold text-primary mt-1">{formatPrice(item.product.price)}</p>
                    <p className="text-[10px] text-ink-secondary mt-1">{item.soldCount} bought</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-2xl p-5 animate-pulse">
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
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-border">
            <div className="w-20 h-20 bg-surface rounded-2xl flex items-center justify-center mb-5 ring-1 ring-border">
              <ShoppingBag className="w-9 h-9 text-ink-muted" />
            </div>
            <h3 className="text-xl font-semibold text-ink mb-1">No orders yet</h3>
            <p className="text-ink-muted text-sm mb-6">Start shopping on BATAMART marketplace!</p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 bg-ink hover:bg-primary text-background px-6 py-3 rounded-xl font-semibold text-sm shadow-soft transition-all"
            >
              Browse Products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isGfd = isGirlfriendsDayOrder(order)
              const gfdLabel = isGfd ? CAMPAIGNS[order.campaignTag as keyof typeof CAMPAIGNS].label : null
              return (
              <div
                key={order.id}
                className={`rounded-2xl border shadow-soft hover:shadow-soft transition-all duration-200 overflow-hidden ${
                  isGfd
                    ? 'bg-gradient-to-br from-rose-50 to-white border-rose-200/70 ring-1 ring-rose-100'
                    : 'bg-card border-border'
                }`}
              >

                {/* ── Order header ── */}
                <div className={`flex items-center justify-between px-5 py-3.5 border-b ${
                  isGfd ? 'border-rose-200/60 bg-rose-500/5' : 'border-border bg-surface/50'
                }`}>
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
                    {isGfd && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[10px] font-semibold uppercase tracking-wider">
                        <Heart className="w-2.5 h-2.5" strokeWidth={2} fill="currentColor" /> {gfdLabel}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {/* ── Product row ── */}
                <div className="p-5">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface flex-shrink-0 border border-border">
                      <img
                        src={order.product?.images?.[0] || '/placeholder.png'}
                        alt={order.product?.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink text-base sm:text-lg leading-snug line-clamp-2">
                        {order.product?.name || 'Product'}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold text-[10px]">{(order.seller?.name || 'S')[0]}</span>
                        </div>
                        <p className="text-xs font-semibold text-ink-secondary">
                          {order.seller?.name || 'Seller'}
                          {order.seller?.avgRating > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5">
                              <Star className="w-3 h-3 text-warning fill-warning" />
                              {order.seller.avgRating.toFixed(1)}
                            </span>
                          )}
                        </p>
                      </div>
                      {/* ── Variant badges from order note ── */}
                      <VariantBadges orderNote={order.orderNote} />
                      <div className="flex items-center gap-3 mt-2.5">
                        <span className="text-primary font-semibold text-lg">{formatPrice(order.totalAmount)}</span>
                        <span className="text-xs text-ink-muted bg-surface px-2 py-1 rounded-full font-semibold">
                          Qty: {order.quantity || 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Meta info ── */}
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <div className="flex items-start gap-2 text-sm text-ink-secondary">
                      <MapPin className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" />
                      <span className="font-medium">{order.deliveryAddress || 'Not specified'}</span>
                    </div>
                    {order.product?.landmark && order.deliveryLandmark && (
                      <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          {order.product.landmark} <ArrowRight className="w-3 h-3" /> {order.deliveryLandmark}
                        </span>
                      </div>
                    )}
                    {order.rider && (
                      <div className="flex items-center gap-2 text-sm text-ink-secondary">
                        <Bike className="w-4 h-4 text-ink-muted flex-shrink-0" />
                        <span className="font-medium">{order.rider.name}</span>
                        {order.rider.phone && <span className="text-ink-muted">{'\u00b7'} {order.rider.phone}</span>}
                      </div>
                    )}
                  </div>

                  {/* ── Review status bar ── */}
                  {canReview(order) && (
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${hasReviewedProduct(order)
                          ? 'bg-success/10 text-success ring-success/30'
                          : 'bg-warning/10 text-warning ring-warning/30'
                        }`}>
                        {hasReviewedProduct(order) ? <BadgeCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        Product {hasReviewedProduct(order) ? 'Reviewed' : 'Not Reviewed'}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ring-1 ${hasReviewedSeller(order)
                          ? 'bg-success/10 text-success ring-success/30'
                          : 'bg-warning/10 text-warning ring-warning/30'
                        }`}>
                        {hasReviewedSeller(order) ? <BadgeCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        Seller {hasReviewedSeller(order) ? 'Reviewed' : 'Not Reviewed'}
                      </span>
                    </div>
                  )}

                  {/* ── Action buttons ── */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {/* View Details */}
                    <button
                      onClick={() => nav(`view-${order.id}`, `/orders/${order.id}`)}
                      disabled={!!actionLoading[`view-${order.id}`]}
                      className="flex items-center gap-2 px-4 py-2.5 bg-surface hover:bg-border text-ink rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                    >
                      {actionLoading[`view-${order.id}`]
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                      View Details
                    </button>

                    {/* Review Product */}
                    {canReview(order) && !hasReviewedProduct(order) && (
                      <button
                        onClick={() => nav(`review-product-${order.id}`, `/orders/${order.id}/review-product`)}
                        disabled={!!actionLoading[`review-product-${order.id}`]}
                        className="flex items-center gap-2 px-4 py-2.5 bg-ink hover:bg-primary text-background rounded-xl font-semibold text-sm transition-all disabled:opacity-50 shadow-soft shadow-primary/20"
                      >
                        {actionLoading[`review-product-${order.id}`]
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Star className="w-3.5 h-3.5" />}
                        Review Product
                      </button>
                    )}

                    {/* Review Seller */}
                    {canReview(order) && hasReviewedProduct(order) && !hasReviewedSeller(order) && (
                      <button
                        onClick={() => nav(`review-seller-${order.id}`, `/orders/${order.id}/review-seller`)}
                        disabled={!!actionLoading[`review-seller-${order.id}`]}
                        className="flex items-center gap-2 px-4 py-2.5 bg-ink hover:bg-primary text-background rounded-lg font-medium text-sm transition-all disabled:opacity-50"
                      >
                        {actionLoading[`review-seller-${order.id}`]
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Star className="w-3.5 h-3.5" />}
                        Review Seller
                      </button>
                    )}

                    {/* Confirm Delivery */}
                    {order.status === 'DELIVERED' && (
                      <button
                        onClick={() => confirmDelivery(order.id)}
                        disabled={!!actionLoading[`confirm-${order.id}`]}
                        className="flex items-center gap-2 px-4 py-2.5 bg-success hover:brightness-95 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 shadow-soft shadow-success/20"
                      >
                        {actionLoading[`confirm-${order.id}`]
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                          : <><CheckCircle className="w-3.5 h-3.5" /> Confirm Received</>}
                      </button>
                    )}

                    {/* All reviewed */}
                    {canReview(order) && hasReviewedProduct(order) && hasReviewedSeller(order) && (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface text-ink-secondary rounded-xl font-semibold text-sm ring-1 ring-border">
                        <BadgeCheck className="w-3.5 h-3.5 text-success" /> All Reviews Done
                      </span>
                    )}

                    {/* Completed */}
                    {order.status === 'COMPLETED' && (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-surface text-ink-secondary rounded-xl font-semibold text-sm ring-1 ring-border">
                        <CheckCircle className="w-3.5 h-3.5 text-success" /> Order Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
