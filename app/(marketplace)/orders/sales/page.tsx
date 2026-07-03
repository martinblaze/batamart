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
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "text-gray-700", bg: "bg-gray-100", ring: "ring-gray-200", dot: "bg-gray-400" }
  return (
    <span className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ring-1 ' + cfg.bg + ' ' + cfg.color + ' ' + cfg.ring}>
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
            <span key={chip} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2.5 py-0.5 rounded-full">
              <Tag className="w-2.5 h-2.5" />
              {chip}
            </span>
          ))}
        </div>
      )}
      {extraNote && <p className="text-[10px] text-gray-400 italic">Buyer's note: {extraNote}</p>}
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
    <div className="min-h-screen bg-[#f7f8fa] pb-20">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900">My Sales</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {orders.length} incoming order{orders.length !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href="/orders"
              className="hidden sm:flex items-center gap-1.5 text-sm font-bold text-BATAMART-primary hover:text-BATAMART-dark transition-colors"
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
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-5 ring-1 ring-gray-100">
              <Package className="w-9 h-9 text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-1">No sales yet</h3>
            <p className="text-gray-400 text-sm mb-6">Orders from buyers will show up here.</p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 bg-BATAMART-primary hover:bg-BATAMART-dark text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all"
            >
              Browse Marketplace <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const { extraNote } = parseVariantNote(order.orderNote)
              const isHighlighted = highlightId === order.id
              const cardClass = `bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${isHighlighted ? 'ring-2 ring-BATAMART-primary ring-offset-2 ring-offset-[#f7f8fa]' : 'border-gray-100'}`
              return (
                <div
                  key={order.id}
                  id={`sales-order-${order.id}`}
                  className={cardClass}
                >
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

                  <div className="p-5">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                        <img
                          src={order.buyer?.profilePhoto || '/placeholder.png'}
                          alt={order.buyer?.name || 'Buyer'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-black text-gray-900 text-base sm:text-lg leading-snug line-clamp-2">
                              {order.product?.name || 'Product'}
                            </h3>
                            <p className="text-xs font-semibold text-gray-500 mt-1 inline-flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5" />
                              {order.buyer?.name || 'Buyer'}
                            </p>
                          </div>
                          <p className="text-sm font-black text-BATAMART-primary whitespace-nowrap">{formatPrice(order.totalAmount)}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Placed {new Date(order.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                        <VariantBadges orderNote={order.orderNote} />
                        <div className="mt-3 grid gap-2 text-sm text-gray-600">
                          <p className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />{order.deliveryAddress}</p>
                          {extraNote && <p className="text-xs text-gray-500"><span className="font-bold text-gray-700">Buyer's note:</span> {extraNote}</p>}
                          <p className="text-xs text-gray-400">
                            {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                          <Link
                            href={`/orders/${order.id}`}
                            className="inline-flex items-center gap-2 bg-BATAMART-primary hover:bg-BATAMART-dark text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all"
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