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
  X, BadgeCheck, AlertCircle, Tag,
} from 'lucide-react'
import { OrderNotificationBanner } from '@/components/layout/OrderNotificationBanner'


// ── Parse variant summary out of orderNote ────────────────────────────────────
// Format stored by checkout: "[Order: 128GB · Black · UK Used] — extra note"
function parseVariantNote(orderNote?: string | null): { variantSummary: string; extraNote: string } {
  if (!orderNote) return { variantSummary: '', extraNote: '' }
  const match = orderNote.match(/^\[Order:\s*([^\]]+)\](?:\s*—\s*(.*))?$/s)
  if (match) return { variantSummary: match[1]?.trim() || '', extraNote: match[2]?.trim() || '' }
  return { variantSummary: '', extraNote: orderNote }
}

function VariantBadges({ orderNote }: { orderNote?: string | null }) {
  const { variantSummary, extraNote } = parseVariantNote(orderNote)
  if (!variantSummary && !extraNote) return null
  const chips = variantSummary ? variantSummary.split(' · ').filter(Boolean) : []
  return (
    <div className="mt-1.5 space-y-1">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map(chip => (
            <span key={chip} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2.5 py-0.5 rounded-full">
              <Tag className="w-2.5 h-2.5" />
              {chip}
            </span>
          ))}
        </div>
      )}
      {extraNote && (
        <p className="text-[10px] text-gray-400 italic">Note: {extraNote}</p>
      )}
    </div>
  )
}

interface ProductReview { id: string; rating: number; comment: string; createdAt: string }
interface Review { id: string; type: string; rating: number; comment: string | null; createdAt: string }
interface Seller { id: string; name: string; profilePhoto: string | null; email: string; phone: string; avgRating: number; trustLevel: string }
interface Product { id: string; name: string; images: string[]; price: number }
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
  deliveryAddress: string; createdAt: string; completedAt?: string; isPaid?: boolean
  orderNote?: string | null
  seller: Seller; product: Product; rider?: Rider; reviews?: Review[]; productReviews?: ProductReview[]
}



const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string; dot: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', dot: 'bg-amber-400' },
  PROCESSING: { label: 'Processing', color: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-200', dot: 'bg-orange-400' },
  SHIPPED: { label: 'Shipped', color: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200', dot: 'bg-blue-400' },
  RIDER_ASSIGNED: { label: 'Rider Assigned', color: 'text-indigo-700', bg: 'bg-indigo-50', ring: 'ring-indigo-200', dot: 'bg-indigo-400' },
  PICKED_UP: { label: 'Picked Up', color: 'text-violet-700', bg: 'bg-violet-50', ring: 'ring-violet-200', dot: 'bg-violet-400' },
  ON_THE_WAY: { label: 'On The Way', color: 'text-pink-700', bg: 'bg-pink-50', ring: 'ring-pink-200', dot: 'bg-pink-400' },
  DELIVERED: { label: 'Delivered', color: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', dot: 'bg-emerald-400' },
  COMPLETED: { label: 'Completed', color: 'text-gray-700', bg: 'bg-gray-100', ring: 'ring-gray-200', dot: 'bg-gray-400' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200', dot: 'bg-red-400' },
  DISPUTED: { label: 'Disputed', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200', dot: 'bg-red-400' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-gray-700', bg: 'bg-gray-100', ring: 'ring-gray-200', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ${cfg.bg} ${cfg.color} ${cfg.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
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
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [peopleLikeYouBought, setPeopleLikeYouBought] = useState<PeopleLikeYouItem[]>([])

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    setCheckingAuth(false)

    const paymentStatus = query.get('payment')
    const orderNumber = query.get('order')
    const orderCount = query.get('count')

    if (paymentStatus === 'success') {
      setPostPayment(true)
      sessionStorage.removeItem('checkout_product')
      sessionStorage.removeItem('checkout_cart')
      const count = orderCount ? parseInt(orderCount) : 1
      setSuccessMessage(
        orderNumber
          ? `Payment successful! Order${count > 1 ? 's' : ''} placed: ${orderNumber}${count > 1 ? ` and ${count - 1} more` : ''}`
          : 'Payment successful! Your order has been placed.'
      )
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 6000)
      window.history.replaceState({}, '', '/orders')
    }

    fetchOrders()
    fetchPeopleLikeYouBought()
  }, [router])

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/orders', { headers: { 'Authorization': `Bearer ${token}` } })
      const data = await response.json()
      if (response.ok) {
        const nextOrders = data.orders || []
        setOrders(nextOrders)
      }
    } catch (error) { console.error('Error fetching orders:', error) }
    finally { setLoading(false) }
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
      if (response.ok) { alert(result.message || 'Payment released! Thank you! 🎉'); fetchOrders() }
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
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-BATAMART-primary border-t-transparent" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f7f8fa] pb-20">

      {/* ── Success toast ─────────────────────────────────────────────── */}
      {showSuccess && (
        <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 animate-in slide-in-from-top-3 duration-300">
          <div className="w-full max-w-md bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-snug break-words">🎉 {successMessage}</p>
              <p className="text-xs text-gray-400 mt-0.5">Seller has been notified!</p>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="text-gray-400 hover:text-white flex-shrink-0 ml-1 mt-0.5"
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
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900">My Orders</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {orders.length} order{orders.length !== 1 ? 's' : ''} total
              </p>
            </div>
            <Link
              href="/marketplace"
              className="hidden sm:flex items-center gap-1.5 text-sm font-bold text-BATAMART-primary hover:text-BATAMART-dark transition-colors"
            >
              <ShoppingBag className="w-4 h-4" /> Shop More
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {peopleLikeYouBought.length > 0 && (
          <div className="mb-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-gray-900">People Like You Bought</h2>
              <button
                onClick={() => router.push('/most-bought')}
                className="text-xs font-bold text-BATAMART-primary flex items-center gap-1 hover:underline"
              >
                See more <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {peopleLikeYouBought.map((item) => (
                <div
                  key={item.key}
                  onClick={() => router.push(`/product/${item.product.id}`)}
                  className="flex-shrink-0 w-36 sm:w-44 rounded-xl border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow bg-white"
                >
                  <div className="aspect-square bg-gray-50 overflow-hidden">
                    <img
                      src={item.product.images?.[0] || '/placeholder.png'}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{item.product.name}</p>
                    <p className="text-xs font-black text-BATAMART-primary mt-1">{formatPrice(item.product.price)}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{item.soldCount} bought</p>
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
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
                    <div className="h-3 bg-gray-200 rounded-lg w-1/2" />
                    <div className="h-5 bg-gray-200 rounded-lg w-1/4 mt-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>

        ) : orders.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-5 ring-1 ring-gray-100">
              <ShoppingBag className="w-9 h-9 text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-1">No orders yet</h3>
            <p className="text-gray-400 text-sm mb-6">Start shopping on BATAMART marketplace!</p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 bg-BATAMART-primary hover:bg-BATAMART-dark text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all"
            >
              Browse Products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">

                {/* ── Order header ── */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Order</p>
                      <p className="text-sm font-black text-gray-900">#{order.orderNumber || order.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div className="hidden sm:block w-px h-8 bg-gray-200" />
                    <div className="hidden sm:block">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date</p>
                      <p className="text-sm font-semibold text-gray-600">
                        {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {/* ── Product row ── */}
                <div className="p-5">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                      <img
                        src={order.product?.images?.[0] || '/placeholder.png'}
                        alt={order.product?.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-black text-gray-900 text-base sm:text-lg leading-snug line-clamp-2">
                        {order.product?.name || 'Product'}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-5 h-5 rounded-full bg-BATAMART-primary/10 flex items-center justify-center">
                          <span className="text-BATAMART-primary font-black text-[10px]">{(order.seller?.name || 'S')[0]}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-500">
                          {order.seller?.name || 'Seller'}
                          {order.seller?.avgRating > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              {order.seller.avgRating.toFixed(1)}
                            </span>
                          )}
                        </p>
                      </div>
                      {/* ── Variant badges from order note ── */}
                      <VariantBadges orderNote={order.orderNote} />
                      <div className="flex items-center gap-3 mt-2.5">
                        <span className="text-BATAMART-primary font-black text-lg">{formatPrice(order.totalAmount)}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full font-semibold">
                          Qty: {order.quantity || 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Meta info ── */}
                  <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
                    <div className="flex items-start gap-2 text-sm text-gray-500">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="font-medium">{order.deliveryAddress || 'Not specified'}</span>
                    </div>
                    {order.rider && (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Bike className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-medium">{order.rider.name}</span>
                        {order.rider.phone && <span className="text-gray-400">· {order.rider.phone}</span>}
                      </div>
                    )}
                  </div>

                  {/* ── Review status bar ── */}
                  {canReview(order) && (
                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ring-1 ${hasReviewedProduct(order)
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200'
                        }`}>
                        {hasReviewedProduct(order) ? <BadgeCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        Product {hasReviewedProduct(order) ? 'Reviewed' : 'Not Reviewed'}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ring-1 ${hasReviewedSeller(order)
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                          : 'bg-amber-50 text-amber-700 ring-amber-200'
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
                      className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
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
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-md shadow-blue-500/20"
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
                        className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-md shadow-violet-500/20"
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
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-md shadow-emerald-500/20"
                      >
                        {actionLoading[`confirm-${order.id}`]
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                          : <><CheckCircle className="w-3.5 h-3.5" /> Confirm Received</>}
                      </button>
                    )}

                    {/* All reviewed */}
                    {canReview(order) && hasReviewedProduct(order) && hasReviewedSeller(order) && (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 text-gray-500 rounded-xl font-bold text-sm ring-1 ring-gray-200">
                        <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" /> All Reviews Done
                      </span>
                    )}

                    {/* Completed */}
                    {order.status === 'COMPLETED' && (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 text-gray-500 rounded-xl font-bold text-sm ring-1 ring-gray-200">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Order Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
