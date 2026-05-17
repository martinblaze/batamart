'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ShoppingCart, Star, Shield, Package, Truck,
  Heart, Share2, ChevronRight, Plus, Minus, Eye, Zap,
  MapPin, Clock, CheckCircle, AlertCircle, Store, Award,
  MessageCircle, ThumbsUp, Camera, Tag, ArrowRight, Flame,
  BadgeCheck, Info, RefreshCw, ChevronDown, ChevronUp,
  StarHalf, Users, TrendingUp, Sparkles, Loader2,
  CheckCircle2,
} from 'lucide-react'
import { useCartStore } from '@/lib/cart-store'
import { decodeProductData } from '@/lib/variants'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
interface Product {
  id: string
  name: string
  description: string
  price: number
  category: string
  subcategory?: string
  categoryKey?: string
  subcategoryKey?: string
  variantsEnabled?: boolean
  basePrice?: number | null
  variants?: Array<{
    id: string
    combination: Record<string, string>
    price: number
    stock: number
    sku?: string | null
    imageUrl?: string | null
  }>
  attributeValues?: Array<{
    id: string
    key: string
    label: string
    value: any
    searchable?: boolean
    filterable?: boolean
  }>
  quantity: number
  images: string[]
  viewCount: number
  hostelName: string
  roomNumber: string
  landmark: string
  createdAt: string
  deliveryEstimate?: string
  seller: {
    id: string
    name: string
    avgRating: number
    trustLevel: string
    completedOrders: number
    profilePhoto?: string
  }
  _count?: { orders: number }
}

interface RelatedProduct {
  id: string
  name: string
  price: number
  images: string[]
  category: string
  seller: { name: string; trustLevel: string; avgRating: number }
  _isNameRelated: boolean
}

// ─────────────────────────────────────────────────────────
// Injected CSS
// ─────────────────────────────────────────────────────────
const PAGE_CSS = `
  html { scroll-behavior: smooth; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .shimmer {
    background: linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
    background-size: 1200px 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  .img-thumb {
    transition: all 0.2s cubic-bezier(0.34,1.4,0.64,1);
    cursor: pointer;
  }
  .img-thumb:hover { transform: scale(1.06); }
  .img-thumb.active {
    outline: 2.5px solid #6366f1;
    outline-offset: 2px;
  }

  .main-img {
    transition: opacity 0.22s ease, transform 0.22s ease;
  }
  .main-img.switching {
    opacity: 0;
    transform: scale(0.98);
  }

  .add-btn {
    background: linear-gradient(135deg,#6366f1 0%,#4c1d95 100%);
    transition: all 0.22s cubic-bezier(0.34,1.4,0.64,1);
    box-shadow: 0 4px 16px rgba(99,102,241,0.35);
  }
  .add-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99,102,241,0.45);
  }
  .add-btn:active:not(:disabled) { transform: scale(0.97); }
  .add-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  .buy-btn {
    background: linear-gradient(135deg,#f97316 0%,#dc2626 100%);
    transition: all 0.22s cubic-bezier(0.34,1.4,0.64,1);
    box-shadow: 0 4px 16px rgba(249,115,22,0.35);
  }
  .buy-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(249,115,22,0.45);
  }
  .buy-btn:active:not(:disabled) { transform: scale(0.97); }

  .qty-btn {
    transition: all 0.15s cubic-bezier(0.34,1.4,0.64,1);
  }
  .qty-btn:hover:not(:disabled) { transform: scale(1.12); background:#6366f1; color:white; }
  .qty-btn:active:not(:disabled) { transform: scale(0.92); }

  .rv-card {
    transition: transform 0.25s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.25s ease;
  }
  .rv-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.1); }
  .rv-card:active { transform: scale(0.97); }

  .tab-btn {
    transition: all 0.2s ease;
    border-bottom: 2px solid transparent;
  }
  .tab-btn.active {
    border-bottom-color: #6366f1;
    color: #6366f1;
    font-weight: 700;
  }

  .trust-gold   { color: #d97706; background: #fef3c7; }
  .trust-silver { color: #475569; background: #f1f5f9; }
  .trust-bronze { color: #c2410c; background: #fff7ed; }

  .tag-pill {
    transition: all 0.18s cubic-bezier(0.34,1.4,0.64,1);
  }
  .tag-pill:hover { transform: scale(1.06) translateY(-1px); background:#6366f1; color:white; }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }

  .sticky-bar {
    transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
  }

  .see-more-btn {
    transition: all 0.2s cubic-bezier(0.34,1.4,0.64,1);
    background: linear-gradient(135deg,#6366f1 0%,#4c1d95 100%);
    box-shadow: 0 2px 10px rgba(99,102,241,0.3);
  }
  .see-more-btn:hover:not(:disabled) {
    transform: scale(1.04);
    box-shadow: 0 4px 16px rgba(99,102,241,0.45);
  }
  .see-more-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .variant-chip {
    transition: all 0.15s cubic-bezier(0.34,1.4,0.64,1);
    cursor: pointer;
  }
  .variant-chip:hover { transform: scale(1.04); }
  .variant-chip-active {
    background: #4f46e5 !important;
    color: white !important;
    border-color: transparent !important;
    box-shadow: 0 4px 12px rgba(79,70,229,0.3);
  }

  @media (max-width: 640px) {
    .product-grid { grid-template-columns: 1fr !important; }
  }
`

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────
const ALSO_LIKE_PAGE_SIZE = 15

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          className={`${sz} ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`}
        />
      ))}
    </div>
  )
}

function TrustBadge({ level }: { level: string }) {
  const cls = level === 'GOLD'
    ? 'trust-gold'
    : level === 'SILVER' ? 'trust-silver' : 'trust-bronze'
  const icon = level === 'GOLD' ? '🥇' : level === 'SILVER' ? '🥈' : '🥉'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>
      {icon} {level}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        <div className="shimmer h-8 w-32 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="shimmer h-64 sm:h-96 rounded-2xl" />
          <div className="space-y-3">
            <div className="shimmer h-6 w-3/4 rounded-lg" />
            <div className="shimmer h-8 w-1/2 rounded-lg" />
            <div className="shimmer h-4 w-full rounded-lg" />
            <div className="shimmer h-4 w-5/6 rounded-lg" />
            <div className="shimmer h-12 w-full rounded-xl mt-6" />
            <div className="shimmer h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Related Product Card (horizontal scroll)
// ─────────────────────────────────────────────────────────
function RelatedCard({ product, onClick }: { product: RelatedProduct; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="rv-card bg-white rounded-2xl overflow-hidden cursor-pointer flex-shrink-0 w-36 sm:w-44"
      style={{ border: '1px solid #f0f0f0' }}
    >
      <div className="relative">
        <div className="aspect-square overflow-hidden bg-gray-50">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-300" />
            </div>
          )}
        </div>
        {product._isNameRelated && (
          <span className="absolute top-1.5 left-1.5 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
            Similar
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="text-[11px] font-semibold text-gray-800 leading-tight line-clamp-2 mb-1">
          {product.name}
        </p>
        <p className="text-[12px] font-bold text-indigo-600">{fmt(product.price)}</p>
        <div className="flex items-center gap-1 mt-1">
          <StarRow rating={product.seller.avgRating || 0} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// "See More" inline card for horizontal scroll
// ─────────────────────────────────────────────────────────
function SeeMoreCard({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <div
      onClick={!loading ? onClick : undefined}
      className="flex-shrink-0 w-36 sm:w-44 rounded-2xl overflow-hidden cursor-pointer flex flex-col items-center justify-center gap-2 bg-indigo-50 border border-indigo-100"
      style={{ minHeight: '180px' }}
    >
      {loading ? (
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      ) : (
        <>
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-bold text-indigo-700 text-center px-2">See more</p>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────
export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const productId = params?.id as string
  const isApp = searchParams.get('app') === 'true'

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeImg, setActiveImg] = useState(0)
  const [imgSwitching, setImgSwitching] = useState(false)
  const [qty, setQty] = useState(1)
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartMsg, setCartMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'desc' | 'reviews'>('desc')
  const [descExpanded, setDescExpanded] = useState(false)

  // ── NEW: Variant state ──────────────────────────────────
  const [variants, setVariants] = useState<Record<string, string[]>>({})
  const [structuredVariants, setStructuredVariants] = useState<Array<{
    id: string
    combination: Record<string, string>
    price: number
    stock: number
    sku?: string | null
    imageUrl?: string | null
  }>>([])
  const [tags, setTags] = useState<string[]>([])
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [variantError, setVariantError] = useState('')

  // Related products (horizontal strip) — paginated with "See more"
  const [relatedNameRelated, setRelatedNameRelated] = useState<RelatedProduct[]>([])
  const [relatedOthers, setRelatedOthers] = useState<RelatedProduct[]>([])
  const [relatedSourceName, setRelatedSourceName] = useState('')
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [relatedPage, setRelatedPage] = useState(1)
  const [relatedHasMore, setRelatedHasMore] = useState(false)
  const [relatedLoadingMore, setRelatedLoadingMore] = useState(false)
  const RELATED_PAGE_SIZE = 8
  const [peopleLikeYouBought, setPeopleLikeYouBought] = useState<RelatedProduct[]>([])
  const [peopleLikeLoading, setPeopleLikeLoading] = useState(false)

  // "You might also like" grid — infinite scroll
  const [alsoLikeItems, setAlsoLikeItems] = useState<RelatedProduct[]>([])
  const [alsoLikePage, setAlsoLikePage] = useState(0)
  const [alsoLikeHasMore, setAlsoLikeHasMore] = useState(true)
  const [alsoLikeLoading, setAlsoLikeLoading] = useState(false)
  const alsoLikeSentinelRef = useRef<HTMLDivElement>(null)

  const [reviews, setReviews] = useState<any[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [showStickyBar, setShowStickyBar] = useState(false)
  const [sessionId, setSessionId] = useState('')

  const { addItem, items } = useCartStore()
  const mainRef = useRef<HTMLDivElement>(null)
  const buyBoxRef = useRef<HTMLDivElement>(null)
  const relatedScrollRef = useRef<HTMLDivElement>(null)

  const alreadyInCart = items.some(i => i.productId === productId)

  const ensureSessionId = () => {
    const key = 'BATAMART_SESSION_ID'
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const generated = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(key, generated)
    return generated
  }

  const trackSessionEvent = (eventType: 'view' | 'click' | 'search', payload?: { productId?: string; meta?: Record<string, any> }) => {
    try {
      const token = localStorage.getItem('token') || ''
      const sid = sessionId || ensureSessionId()
      if (!sessionId) setSessionId(sid)
      fetch('/api/session-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          sessionId: sid,
          productId: payload?.productId || null,
          eventType,
          meta: payload?.meta || undefined,
        }),
      }).catch(() => {})
    } catch {}
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSessionId(ensureSessionId())
  }, [])

  // ── Sticky CTA bar ──────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => setShowStickyBar(!e.isIntersecting),
      { threshold: 0 }
    )
    if (buyBoxRef.current) observer.observe(buyBoxRef.current)
    return () => observer.disconnect()
  }, [product])

  // ── Fetch product ───────────────────────────────────────
  useEffect(() => {
    if (!productId) return
    fetchProduct()
  }, [productId])

  const fetchProduct = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) { router.push('/login'); return }
      const res = await fetch(`/api/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return }
        setError('Product not found')
        return
      }
      const data = await res.json()
      const p = data.product || data
      setProduct(p)

      if (p.variantsEnabled && Array.isArray(p.variants) && p.variants.length > 0) {
        setStructuredVariants(p.variants)
        const map: Record<string, Set<string>> = {}
        for (const v of p.variants) {
          const combo = (v.combination || {}) as Record<string, string>
          for (const [k, val] of Object.entries(combo)) {
            if (!val) continue
            if (!map[k]) map[k] = new Set()
            map[k].add(String(val))
          }
        }
        setVariants(Object.fromEntries(Object.entries(map).map(([k, vals]) => [k, Array.from(vals)])))
        setTags([])
      } else {
        setStructuredVariants([])
        const decoded = decodeProductData(p.description || '')
        setVariants(decoded.variants)
        setTags(decoded.tags)
      }

      try {
        fetch(`/api/products/${productId}/view`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {})
        trackSessionEvent('view', { productId })
        const viewed = JSON.parse(localStorage.getItem('BATAMART-recently-viewed') || '[]')
        const updated = [p, ...viewed.filter((v: any) => v.id !== p.id)].slice(0, 20)
        localStorage.setItem('BATAMART-recently-viewed', JSON.stringify(updated))
      } catch {}

      fetchRelatedFirst(token)
      fetchPeopleLikeYou(token)
    } catch {
      setError('Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  const fetchPeopleLikeYou = async (token: string) => {
    setPeopleLikeLoading(true)
    try {
      const res = await fetch(`/api/products/people-like-you?mode=top&pageSize=10&sessionId=${encodeURIComponent(sessionId || ensureSessionId())}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) return
      const items = (data.items || [])
        .map((it: any) => ({
          ...it.product,
          _isNameRelated: false,
        }))
        .filter((p: any) => p?.id && p.id !== productId)
      setPeopleLikeYouBought(items)
    } catch {}
    finally { setPeopleLikeLoading(false) }
  }

  // ── Related: initial load ───────────────────────────────
  const fetchRelatedFirst = async (token: string) => {
    setRelatedLoading(true)
    try {
      const res = await fetch(
        `/api/products/${productId}/related?limit=${RELATED_PAGE_SIZE}&page=1&sessionId=${encodeURIComponent(sessionId || ensureSessionId())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.success) {
        setRelatedNameRelated(data.related?.nameRelated || [])
        const others: RelatedProduct[] = data.related?.others || []
        setRelatedOthers(others)
        setRelatedSourceName(data.sourceProduct?.name || '')
        setRelatedHasMore(Boolean(data.hasMore))
        setRelatedPage(1)
      }
    } catch {}
    finally { setRelatedLoading(false) }
  }

  // ── Related: load more ──────────────────────────────────
  const loadMoreRelated = async () => {
    if (relatedLoadingMore) return
    setRelatedLoadingMore(true)
    try {
      const token = localStorage.getItem('token') || ''
      const nextPage = relatedPage + 1
      const res = await fetch(
        `/api/products/${productId}/related?limit=${RELATED_PAGE_SIZE}&page=${nextPage}&othersOnly=true&sessionId=${encodeURIComponent(sessionId || ensureSessionId())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.success) {
        const newOthers: RelatedProduct[] = data.related?.others || []
        setRelatedOthers(prev => [...prev, ...newOthers])
        setRelatedPage(nextPage)
        setRelatedHasMore(Boolean(data.hasMore))
        setTimeout(() => {
          if (relatedScrollRef.current) {
            relatedScrollRef.current.scrollBy({ left: 300, behavior: 'smooth' })
          }
        }, 100)
      }
    } catch {}
    finally { setRelatedLoadingMore(false) }
  }

  // ── "You might also like": infinite scroll loader ───────
  const loadAlsoLike = useCallback(async () => {
    if (alsoLikeLoading || !alsoLikeHasMore || !product) return
    setAlsoLikeLoading(true)
    try {
      const token = localStorage.getItem('token') || ''
      const nextPage = alsoLikePage + 1
      const res = await fetch(
        `/api/products/${productId}/related?limit=${ALSO_LIKE_PAGE_SIZE}&page=${nextPage}&category=${encodeURIComponent(product.category)}&gridMode=true&sessionId=${encodeURIComponent(sessionId || ensureSessionId())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.success) {
        const items: RelatedProduct[] = data.related?.grid || data.related?.others || []
        setAlsoLikeItems(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const fresh = items.filter(p => p.id !== productId && !existingIds.has(p.id))
          return [...prev, ...fresh]
        })
        setAlsoLikePage(nextPage)
        setAlsoLikeHasMore(items.length === ALSO_LIKE_PAGE_SIZE)
      } else {
        setAlsoLikeHasMore(false)
      }
    } catch {
      setAlsoLikeHasMore(false)
    } finally {
      setAlsoLikeLoading(false)
    }
  }, [alsoLikeLoading, alsoLikeHasMore, alsoLikePage, product, productId])

  // ── IntersectionObserver for infinite scroll ────────────
  useEffect(() => {
    if (!product) return
    const sentinel = alsoLikeSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadAlsoLike() },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadAlsoLike, product])

  // ── Reviews ─────────────────────────────────────────────
  const fetchReviews = async () => {
    if (reviews.length || reviewsLoading || !product) return
    setReviewsLoading(true)
    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch(`/api/reviews/product?productId=${product.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setReviews(data.reviews || [])
    } catch {}
    finally { setReviewsLoading(false) }
  }

  const switchImg = (idx: number) => {
    if (idx === activeImg) return
    setImgSwitching(true)
    setTimeout(() => {
      setActiveImg(idx)
      setImgSwitching(false)
    }, 180)
  }

  // ── NEW: Variant-aware add to cart ──────────────────────
  const variantKeys = Object.keys(variants)
  const requiredVariants = variantKeys.filter(k => variants[k].length > 0)
  const allVariantsSelected = requiredVariants.length === 0 || requiredVariants.every(k => selected[k])
  const variantSummary = Object.entries(selected).filter(([, v]) => v).map(([, v]) => v).join(' · ')
  const matchedVariant = structuredVariants.find(v =>
    requiredVariants.every(k => (v.combination || {})[k] === selected[k])
  )
  const effectivePrice = matchedVariant?.price ?? product?.price ?? 0
  const effectiveStock = matchedVariant?.stock ?? product?.quantity ?? 0
  const structuredPriceValues = structuredVariants.map(v => Number(v.price)).filter(v => Number.isFinite(v) && v > 0)
  const minStructuredPrice = structuredPriceValues.length ? Math.min(...structuredPriceValues) : 0
  const maxStructuredPrice = structuredPriceValues.length ? Math.max(...structuredPriceValues) : 0
  const isStructuredVariantProduct = structuredVariants.length > 0
  const normalizedVariantKeys = new Set(variantKeys.map(k => k.trim().toLowerCase()))
  const specAttributes = (product?.attributeValues || []).filter((attr) => {
    const key = (attr.key || '').trim().toLowerCase()
    const label = (attr.label || '').trim().toLowerCase()
    return !normalizedVariantKeys.has(key) && !normalizedVariantKeys.has(label)
  })

  const isOptionAvailable = (variantKey: string, value: string) => {
    if (!isStructuredVariantProduct) return true
    return structuredVariants.some(v => {
      const combo = (v.combination || {}) as Record<string, string>
      if ((combo[variantKey] || '') !== value) return false
      if ((v.stock || 0) <= 0) return false
      for (const [k, selVal] of Object.entries(selected)) {
        if (!selVal || k === variantKey) continue
        if ((combo[k] || '') !== selVal) return false
      }
      return true
    })
  }

  // Auto-select locked single-value variant fields
  useEffect(() => {
    if (variantKeys.length === 0) return
    setSelected(prev => {
      let changed = false
      const next = { ...prev }
      for (const key of variantKeys) {
        const vals = variants[key] || []
        if (vals.length === 1 && next[key] !== vals[0]) {
          next[key] = vals[0]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [variantKeys.join('|'), JSON.stringify(variants)])

  const handleAddToCart = async () => {
    if (!product) return
    if (!allVariantsSelected) {
      setVariantError('Please select all options before adding to cart')
      // Scroll up to variant selector
      document.getElementById('variant-selector')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (product.variantsEnabled && requiredVariants.length > 0 && !matchedVariant) {
      setVariantError('Selected combination is unavailable')
      return
    }
    setVariantError('')
    setAddingToCart(true)
    try {
      addItem({
        productId: product.id,
        variantId: matchedVariant?.id,
        name: product.name,
        price: effectivePrice,
        image: product.images?.[0] || '',
        sellerId: product.seller.id,
        sellerName: product.seller.name,
        maxQuantity: effectiveStock,
        quantity: qty,
        selectedVariants: selected,
        category: product.category,
        subcategory: product.subcategory,
        deliveryEstimate: product.deliveryEstimate,
      })
      setCartMsg('Added to cart!')
      setTimeout(() => setCartMsg(''), 2500)
    } catch {
      setCartMsg('Failed to add')
    } finally {
      setAddingToCart(false)
    }
  }

  const handleBuyNow = () => {
    if (!product) return
    if (!allVariantsSelected) {
      setVariantError('Please select all options first')
      document.getElementById('variant-selector')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (product.variantsEnabled && requiredVariants.length > 0 && !matchedVariant) {
      setVariantError('Selected combination is unavailable')
      return
    }
    sessionStorage.setItem('checkout_product', JSON.stringify({
      ...product,
      variantId: matchedVariant?.id,
      price: effectivePrice,
      selectedVariants: selected,
    }))
    router.push('/checkout')
  }

  const navigateRelated = (id: string) => router.push(`/product/${id}`)
  const navigateRelatedTracked = (id: string) => {
    trackSessionEvent('click', { productId: id, meta: { from: 'product-related' } })
    router.push(`/product/${id}`)
  }

  // Description: for new products description is VARIANTS_V2 encoded — show tags instead
  // For legacy products it may have pipe-separated tags as first segment
  const descriptionClean = (() => {
    if (!product?.description) return ''
    if (product.description.startsWith('VARIANTS_V2::')) return ''  // no plain text description for new products
    return product.description.split(' | ')[0].trim()
  })()

  const ageDays = product
    ? (Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    : 999
  const isNew = ageDays <= 7

  if (loading) return <Skeleton />

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <p className="text-lg font-semibold text-gray-700">{error || 'Product not found'}</p>
          <button onClick={() => router.back()} className="text-indigo-600 font-semibold underline text-sm">
            Go back
          </button>
        </div>
      </div>
    )
  }

  const hasRelated = relatedNameRelated.length > 0 || relatedOthers.length > 0

  return (
    <div className="min-h-screen bg-[#f7f8fa]" ref={mainRef}>
      <style>{PAGE_CSS}</style>

      {/* ── Sticky bottom bar (mobile only) ──────────────── */}
      {!isApp && <div
        className={`sticky-bar fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 p-3 flex gap-2 sm:hidden ${
          showStickyBar ? 'translate-y-0 shadow-2xl' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handleAddToCart}
          disabled={product.quantity === 0 || addingToCart}
          className="add-btn flex-1 text-white font-bold text-sm py-3 rounded-xl"
        >
          {addingToCart ? 'Adding…' : variantKeys.length > 0 && !allVariantsSelected ? '⚠️ Select Options' : '🛒 Add to Cart'}
        </button>
        <button
          onClick={handleBuyNow}
          disabled={product.quantity === 0}
          className="buy-btn flex-1 text-white font-bold text-sm py-3 rounded-xl"
        >
          Buy Now
        </button>
      </div>}

      {/* ── Top nav ───────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-12 flex items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-600 hover:text-indigo-600 transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium hidden xs:inline">Back</span>
          </button>

          <p className="text-[13px] font-semibold text-gray-700 truncate flex-1 text-center">
            {product.name}
          </p>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: product.name, url: window.location.href }).catch(() => {})
                } else {
                  navigator.clipboard.writeText(window.location.href).catch(() => {})
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Link
              href="/cart"
              className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            >
              <ShoppingCart className="w-4 h-4" />
              {items.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Breadcrumb (tablet+) ───────────────────────────── */}
      <div className="hidden sm:block max-w-5xl mx-auto px-4 py-2">
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <Link href="/marketplace" className="hover:text-indigo-600 transition-colors">Marketplace</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="hover:text-indigo-600 cursor-pointer transition-colors">{product.category}</span>
          {product.subcategory && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="hover:text-indigo-600 cursor-pointer transition-colors">{product.subcategory}</span>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-medium truncate max-w-[200px]">{product.name}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-24 sm:pb-8 space-y-4">

        {/* ── Main product section ───────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4 fade-up">

          {/* LEFT — Images */}
          <div className="space-y-2">
            <div className="relative bg-white rounded-2xl overflow-hidden shadow-sm" style={{ border: '1px solid #f0f0f0' }}>
              <div className="relative aspect-square sm:aspect-[4/3] overflow-hidden">
                {product.images?.[activeImg] ? (
                  <img
                    src={product.images[activeImg]}
                    alt={product.name}
                    className={`main-img w-full h-full object-contain p-2 ${imgSwitching ? 'switching' : ''}`}
                    style={{ background: '#fafafa' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <Package className="w-16 h-16 text-gray-300" />
                  </div>
                )}

                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {isNew && (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">NEW</span>
                  )}
                  {product.quantity <= 3 && product.quantity > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {product.quantity} left
                    </span>
                  )}
                  {product.quantity === 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Out of stock
                    </span>
                  )}
                </div>

                {(product.viewCount || 0) > 5 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {product.viewCount} views
                  </div>
                )}

                {product.images.length > 1 && (
                  <>
                    <button
                      onClick={() => switchImg((activeImg - 1 + product.images.length) % product.images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-700" />
                    </button>
                    <button
                      onClick={() => switchImg((activeImg + 1) % product.images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-all"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-700" />
                    </button>
                  </>
                )}
              </div>

              {product.images.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 py-2">
                  {product.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => switchImg(i)}
                      className={`rounded-full transition-all duration-200 ${
                        i === activeImg ? 'w-4 h-1.5 bg-indigo-600' : 'w-1.5 h-1.5 bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => switchImg(i)}
                    className={`img-thumb flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-gray-50 ${i === activeImg ? 'active' : 'ring-1 ring-gray-200'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Buy box */}
          <div ref={buyBoxRef} className="space-y-3">

            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                {product.category}{product.subcategory ? ` › ${product.subcategory}` : ''}
              </span>
              <TrustBadge level={product.seller.trustLevel} />
              {(product._count?.orders || 0) >= 5 && (
                <span className="bg-red-50 text-red-600 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Popular
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>

            <div className="flex items-center gap-2 flex-wrap">
              <StarRow rating={product.seller.avgRating || 0} size="md" />
              <span className="text-sm font-semibold text-amber-600">{(product.seller.avgRating || 0).toFixed(1)}</span>
              <span className="text-sm text-gray-400">·</span>
              <span className="text-sm text-gray-500">{product._count?.orders || 0} sold</span>
              {product.viewCount > 0 && (
                <>
                  <span className="text-sm text-gray-400">·</span>
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> {product.viewCount}
                  </span>
                </>
              )}
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-3 sm:p-4 border border-indigo-100">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-indigo-700">{fmt(effectivePrice)}</span>
                {product.basePrice && product.basePrice > effectivePrice && (
                  <span className="text-xs sm:text-sm text-gray-400 line-through font-semibold">{fmt(product.basePrice)}</span>
                )}
              </div>
              {structuredVariants.length > 0 && minStructuredPrice > 0 && (
                <p className="text-[11px] sm:text-xs text-indigo-500 font-semibold mt-1">
                  Range: {fmt(minStructuredPrice)} - {fmt(maxStructuredPrice)}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" />
                Secure checkout · Buyer protection
              </p>
            </div>

            {effectiveStock > 0 && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${effectiveStock <= 5 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className={`text-sm font-medium ${effectiveStock <= 5 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {effectiveStock <= 5 ? `Only ${effectiveStock} left` : `${effectiveStock} in stock`}
                </span>
              </div>
            )}

            {/* ── NEW: Variant Selector ──────────────────── */}
            {(variantKeys.length > 0 || specAttributes.length > 0) && (
              <div id="variant-selector" className="bg-white rounded-2xl p-4 ring-1 ring-gray-200 space-y-4">
                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Options & Specs
                </h3>
                {variantKeys.length > 0 && (
                  <p className="text-[11px] text-gray-500 -mt-2">
                    Pick all required options to unlock exact stock and pricing.
                  </p>
                )}

                {variantError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-700 font-semibold">{variantError}</p>
                  </div>
                )}

                {variantKeys.map(key => {
                  const vals = variants[key]
                  if (!vals || vals.length === 0) return null
                  const isSingleLocked = vals.length === 1
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  return (
                    <div key={key} className="rounded-xl border border-gray-200 p-3 bg-gray-50/40">
                      <p className="text-xs font-black text-gray-700 mb-2 flex items-center justify-between">
                        <span>
                          {label}: {selected[key] ? <span className="text-indigo-700">{selected[key]}</span> : <span className="text-gray-400">Select</span>}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold">{vals.length} option{vals.length > 1 ? 's' : ''}</span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {vals.map(v => (
                          (() => {
                            const available = isOptionAvailable(key, v)
                            const chosen = selected[key] === v
                            return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => {
                              if (isSingleLocked || !available) return
                              setSelected(prev => ({ ...prev, [key]: prev[key] === v ? prev[key] : v }))
                              setVariantError('')
                            }}
                            className={`variant-chip text-left px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                              chosen
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200'
                                : available
                                ? 'border-gray-300 bg-white text-gray-800 hover:border-indigo-400 hover:shadow-sm'
                                : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-70'
                            }`}
                            disabled={isSingleLocked || !available}
                          >
                            <span className="block truncate">{v}</span>
                            <span className={`block text-[10px] mt-0.5 ${chosen ? 'text-indigo-100' : available ? 'text-emerald-600' : 'text-gray-400'}`}>
                              {isSingleLocked ? 'Auto-selected' : available ? 'Available' : 'Unavailable'}
                            </span>
                          </button>
                            )
                          })()
                        ))}
                      </div>
                    </div>
                  )
                })}

                {variantSummary && (
                  <div className="bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100">
                    <p className="text-xs text-indigo-700 font-bold">Selected: {variantSummary}</p>
                    {matchedVariant && (
                      <p className="text-xs text-indigo-800 font-extrabold mt-1">
                        Selected price: {fmt(matchedVariant.price)}
                      </p>
                    )}
                    {structuredVariants.length > 0 && minStructuredPrice > 0 && (
                      <p className="text-[11px] text-indigo-500 font-semibold mt-1">
                        Range: {fmt(minStructuredPrice)} – {fmt(maxStructuredPrice)}
                        {product?.basePrice ? ` · Base: ${fmt(product.basePrice)}` : ''}
                      </p>
                    )}
                  </div>
                )}

                {specAttributes.length > 0 && (
                  <div className="rounded-xl border border-gray-200 p-3 bg-gray-50/40">
                    <p className="text-xs font-black text-gray-700 mb-2">Item Specs</p>
                    <div className="flex flex-wrap gap-2">
                      {specAttributes.map((attr) => {
                        const displayValue = Array.isArray(attr.value)
                          ? attr.value.join(', ')
                          : typeof attr.value === 'boolean'
                          ? (attr.value ? 'Yes' : 'No')
                          : String(attr.value)
                        return (
                          <span
                            key={attr.id}
                            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700"
                          >
                            <span className="text-gray-500">{attr.label || attr.key}:</span>
                            <span className="text-gray-900">{displayValue}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {effectiveStock > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Qty:</span>
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1 ring-1 ring-gray-200">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="qty-btn w-8 h-8 rounded-lg bg-white ring-1 ring-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-40"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-gray-800">{qty}</span>
                  <button
                    onClick={() => setQty(q => Math.min(effectiveStock, q + 1))}
                    disabled={qty >= effectiveStock}
                    className="qty-btn w-8 h-8 rounded-lg bg-white ring-1 ring-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-xs text-gray-400">({effectiveStock} available)</span>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={handleAddToCart}
                disabled={effectiveStock === 0 || addingToCart}
                className="add-btn flex-1 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {addingToCart
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <ShoppingCart className="w-4 h-4" />
                }
                {effectiveStock === 0
                  ? 'Out of Stock'
                  : addingToCart
                  ? 'Adding…'
                  : variantKeys.length > 0 && !allVariantsSelected
                  ? 'Select Options First'
                  : 'Add to Cart'}
              </button>
              {effectiveStock > 0 && (
                <button
                  onClick={handleBuyNow}
                  className="buy-btn flex-1 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Zap className="w-4 h-4" />
                  Buy Now
                </button>
              )}
            </div>

            {cartMsg && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-3 py-2 rounded-xl">
                <CheckCircle className="w-4 h-4" />
                {cartMsg}
              </div>
            )}

            {/* Delivery info */}
            <div className="bg-white rounded-2xl p-3 space-y-2 ring-1 ring-gray-100">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">Campus delivery available via BataMart riders</p>
              </div>
              {product.deliveryEstimate && (
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <p className="text-xs text-gray-600">Estimated delivery: {product.deliveryEstimate}</p>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">Contact the seller to arrange pickup or delivery details</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <p className="text-xs text-gray-600">Protected by BataMart buyer guarantee</p>
              </div>
            </div>

            {/* Seller card */}
            <Link
              href={`/seller/${product.seller.id}`}
              className="flex items-center gap-3 bg-white rounded-2xl p-3 ring-1 ring-gray-100 hover:ring-indigo-200 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0">
                {product.seller.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-900 truncate">{product.seller.name}</p>
                  {product.seller.trustLevel === 'GOLD' && (
                    <BadgeCheck className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <StarRow rating={product.seller.avgRating || 0} />
                  <span className="text-[11px] text-gray-500">{product.seller.completedOrders || 0} orders</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-indigo-500 group-hover:translate-x-0.5 transition-transform">
                <span className="text-xs font-semibold hidden sm:block">Visit Shop</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>

        {/* ── Tabs: Description · Details · Reviews ─────── */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm fade-up" style={{ border: '1px solid #f0f0f0', animationDelay: '0.1s' }}>
          <div className="flex border-b border-gray-100">
            {(['desc', 'reviews'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  if (tab === 'reviews') fetchReviews()
                }}
                className={`tab-btn flex-1 py-3 text-sm font-semibold text-gray-500 transition-all ${activeTab === tab ? 'active' : ''}`}
              >
                {tab === 'desc' ? 'Description' : 'Reviews'}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Description tab */}
            {activeTab === 'desc' && (
              <div>
                {/* Show variant summary if new-style product */}
                {variantKeys.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Available Options
                    </p>
                    <div className="space-y-2">
                      {variantKeys.map(key => {
                        const vals = variants[key]
                        if (!vals || vals.length === 0) return null
                        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                        return (
                          <div key={key} className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-gray-600 w-24 flex-shrink-0">{label}:</span>
                            <div className="flex flex-wrap gap-1">
                              {vals.map(v => (
                                <span key={v} className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">{v}</span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {descriptionClean ? (
                  <div>
                    <p className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${!descExpanded && descriptionClean.length > 200 ? 'line-clamp-4' : ''}`}>
                      {descriptionClean}
                    </p>
                    {descriptionClean.length > 200 && (
                      <button
                        onClick={() => setDescExpanded(e => !e)}
                        className="flex items-center gap-1 text-indigo-600 text-sm font-semibold mt-2 hover:underline"
                      >
                        {descExpanded ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Read more</>}
                      </button>
                    )}
                  </div>
                ) : variantKeys.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No description provided.</p>
                ) : null}

                {tags.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag, i) => (
                        <span key={i} className="tag-pill bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full cursor-default">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reviews tab */}
            {activeTab === 'reviews' && (
              <div>
                {reviewsLoading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex gap-3">
                        <div className="shimmer w-9 h-9 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="shimmer h-3 w-24 rounded" />
                          <div className="shimmer h-3 w-full rounded" />
                          <div className="shimmer h-3 w-3/4 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No reviews yet</p>
                    <p className="text-xs text-gray-300 mt-1">Be the first to buy and review this product</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((r: any) => (
                      <div key={r.id} className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {r.reviewer?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-800">{r.reviewer?.name || 'Buyer'}</p>
                            <StarRow rating={r.rating} />
                          </div>
                          {r.comment && (
                            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{r.comment}</p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-1">
                            {new Date(r.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Related products (horizontal scroll) ──────── */}
        {hasRelated && (
          <div className="fade-up" style={{ animationDelay: '0.15s' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Deals on related products
                </h2>
                {relatedSourceName && (
                  <p className="text-xs text-gray-400 mt-0.5">Similar to "{relatedSourceName}"</p>
                )}
              </div>
            </div>

            {relatedLoading ? (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex-shrink-0 w-36 sm:w-44 rounded-2xl overflow-hidden">
                    <div className="shimmer aspect-square w-full" />
                    <div className="bg-white p-2 space-y-1.5">
                      <div className="shimmer h-3 w-full rounded" />
                      <div className="shimmer h-3 w-2/3 rounded" />
                      <div className="shimmer h-4 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div ref={relatedScrollRef} className="flex gap-3 overflow-x-auto no-scrollbar pb-3">
                {relatedNameRelated.map(p => (
                  <RelatedCard key={p.id} product={p} onClick={() => navigateRelatedTracked(p.id)} />
                ))}
                {relatedNameRelated.length > 0 && relatedOthers.length > 0 && (
                  <div className="flex-shrink-0 flex items-center px-1">
                    <div className="w-px h-24 bg-gray-200" />
                  </div>
                )}
                {relatedOthers.map(p => (
                  <RelatedCard key={p.id} product={p} onClick={() => navigateRelatedTracked(p.id)} />
                ))}
                {relatedHasMore && (
                  <SeeMoreCard onClick={loadMoreRelated} loading={relatedLoadingMore} />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── People Like You Bought ─────────────────────── */}
        {(peopleLikeLoading || peopleLikeYouBought.length > 0) && (
          <div className="fade-up" style={{ animationDelay: '0.18s' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-500" />
                People Like You Bought
              </h2>
            </div>
            {peopleLikeLoading ? (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex-shrink-0 w-36 sm:w-44 rounded-2xl overflow-hidden">
                    <div className="shimmer aspect-square w-full" />
                    <div className="bg-white p-2 space-y-1.5">
                      <div className="shimmer h-3 w-full rounded" />
                      <div className="shimmer h-3 w-2/3 rounded" />
                      <div className="shimmer h-4 w-1/2 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3">
                {peopleLikeYouBought.map(p => (
                  <RelatedCard key={p.id} product={p} onClick={() => navigateRelatedTracked(p.id)} />
                ))}
                <SeeMoreCard onClick={() => router.push('/most-bought')} loading={false} />
              </div>
            )}
          </div>
        )}

        {/* ── You might also like — infinite scroll grid ── */}
        <div className="fade-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            You might also like
          </h2>

          {alsoLikeItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {alsoLikeItems.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigateRelatedTracked(p.id)}
                  className="rv-card bg-white rounded-2xl overflow-hidden cursor-pointer"
                  style={{ border: '1px solid #f0f0f0' }}
                >
                  <div className="aspect-square overflow-hidden bg-gray-50">
                    {p.images?.[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 line-clamp-2 leading-tight mb-1">
                      {p.name}
                    </p>
                    <p className="text-sm font-bold text-indigo-600">{fmt(p.price)}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <StarRow rating={p.seller?.avgRating || 0} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {alsoLikeLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
              {Array.from({ length: ALSO_LIKE_PAGE_SIZE }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #f0f0f0' }}>
                  <div className="shimmer aspect-square w-full" />
                  <div className="p-2.5 space-y-1.5">
                    <div className="shimmer h-3 w-full rounded" />
                    <div className="shimmer h-3 w-2/3 rounded" />
                    <div className="shimmer h-4 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!alsoLikeHasMore && alsoLikeItems.length > 0 && (
            <p className="text-center text-xs text-gray-400 mt-4 py-2">You've seen it all! 🎉</p>
          )}

          <div ref={alsoLikeSentinelRef} className="h-1 w-full" />
        </div>

      </div>
    </div>
  )
}
