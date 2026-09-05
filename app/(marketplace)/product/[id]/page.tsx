'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, ShoppingCart, Star, Shield, Package, Truck,
  Heart, Share2, ChevronRight, Plus, Minus, Eye, Zap,
  MapPin, Clock, CheckCircle, AlertCircle, Store, Award,
  MessageCircle, ThumbsUp, Camera, Tag, ArrowRight, Flame,
  BadgeCheck, Info, RefreshCw, ChevronDown, ChevronUp,
  StarHalf, Users, TrendingUp, Crown, Loader2,
  CheckCircle2, Flag, X,
} from 'lucide-react'
import { useCartStore } from '@/lib/cart-store'
import { useScrolledPast } from '@/components/marketplace/DetailChrome'
import { decodeProductData, getCategoryDisplayInfo } from '@/lib/variants'
import { useToast } from '@/components/ui/Toast'
import RelatedProductCard from '@/components/marketplace/RelatedProductCard'

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
  universityId?: string | null
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

type RelatedSection = {
  title: string
  reason: string
  products: RelatedProduct[]
}

type RecentlyViewedItem = {
  id: string
  name: string
  price: number
  image?: string
  categoryKey?: string
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

  .shimmer {
    background: var(--color-surface);
    animation: pulse-shimmer 1.4s ease-in-out infinite;
  }
  @keyframes pulse-shimmer {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }

  .img-thumb {
    transition: transform 0.15s ease-out;
    cursor: pointer;
  }
  .img-thumb:hover { transform: scale(1.03); }
  .img-thumb.active {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .main-img {
    transition: opacity 0.22s ease, transform 0.22s ease;
  }
  .main-img.switching {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Design bible: flat fills, one primary accent — Add to cart is secondary, Buy now is the single primary CTA */
  .add-btn {
    background: white;
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    transition: background 0.15s ease-out;
  }
  .add-btn { transition: background 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease; }
  .add-btn:hover:not(:disabled) { background: var(--color-surface); border-color: rgba(19,19,17,0.3); }
  .add-btn:active:not(:disabled) { transform: scale(0.98); }
  .add-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .buy-btn {
    background: var(--ui-slab);
    transition: background 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .buy-btn:hover:not(:disabled) { background: var(--color-primary); }
  .buy-btn:active:not(:disabled) { transform: scale(0.98); }

  .qty-btn {
    transition: background 0.15s ease-out, color 0.15s ease-out;
  }
  .qty-btn:hover:not(:disabled) { background: var(--color-primary); color:white; }
  .qty-btn:active:not(:disabled) { transform: scale(0.95); }

  .rv-card {
    transition: transform 0.15s ease-out;
  }
  .rv-card:hover { transform: translateY(-2px); }
  .rv-card:active { transform: scale(0.98); }

  .tab-btn {
    transition: color 0.15s ease-out, border-color 0.15s ease-out;
    border-bottom: 2px solid transparent;
  }
  .tab-btn.active {
    border-bottom-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }

  .trust-gold   { color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 10%, white); }
  .trust-silver { color: var(--color-text-secondary); background: var(--color-surface); }
  .trust-bronze { color: var(--color-warning); background: color-mix(in srgb, var(--color-warning) 10%, white); }

  .tag-pill {
    transition: background 0.15s ease-out, color 0.15s ease-out;
  }
  .tag-pill:hover { background: var(--color-primary); color:white; }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }

  .see-more-btn {
    transition: filter 0.15s ease-out;
    background: var(--color-primary);
  }
  .see-more-btn:hover:not(:disabled) {
    filter: brightness(0.95);
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
    background: var(--color-primary) !important;
    color: white !important;
    border-color: transparent !important;
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 30%, transparent);
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
          className={`${sz} ${i <= Math.round(rating) ? 'text-warning fill-warning' : 'text-border fill-border'}`}
        />
      ))}
    </div>
  )
}

function TrustBadge({ level }: { level: string }) {
  const cls = level === 'GOLD'
    ? 'trust-gold'
    : level === 'SILVER' ? 'trust-silver' : 'trust-bronze'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      <BadgeCheck className="w-3 h-3" strokeWidth={1.75} /> {level}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen bg-surface">
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
      className="rv-card ui-tile group w-36 flex-shrink-0 cursor-pointer sm:w-44"
    >
      <div className="relative">
        <div className="aspect-square overflow-hidden bg-surface">
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-ink-muted" />
            </div>
          )}
        </div>
        {product._isNameRelated && (
          <span className="absolute top-1.5 left-1.5 bg-primary text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
            Similar
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="text-[11px] font-semibold text-ink leading-tight line-clamp-2 mb-1">
          {product.name}
        </p>
        <p className="text-[12px] font-semibold text-primary">{fmt(product.price)}</p>
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
      className="flex-shrink-0 w-36 sm:w-44 rounded-2xl overflow-hidden cursor-pointer flex flex-col items-center justify-center gap-2 bg-primary/10 border border-primary/20"
      style={{ minHeight: '180px' }}
    >
      {loading ? (
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      ) : (
        <>
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs font-semibold text-primary text-center px-2">See more</p>
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
  const productId = params?.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeImg, setActiveImg] = useState(0)
  const [imgSwitching, setImgSwitching] = useState(false)

  // Roughly the height of the gallery. Past it the floating controls become a
  // titled bar, which is the only point at which a solid header earns its keep.
  const pastHero = useScrolledPast(260)
  const [qty, setQty] = useState(1)
  const [noteToSeller, setNoteToSeller] = useState('')
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartMsg, setCartMsg] = useState('')
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)
  const [reportError, setReportError] = useState('')
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
  const [relatedSections, setRelatedSections] = useState<RelatedSection[]>([])
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
  const [sessionId, setSessionId] = useState('')
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([])

  const { addItem, items } = useCartStore()
  const toast = useToast()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [viewerUniversityId, setViewerUniversityId] = useState<string | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)
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

  // Who's viewing — used only to decide whether buying is allowed
  // (same-university logged-in users), never to gate viewing itself.
  useEffect(() => {
    const token = localStorage.getItem('token')
    setIsLoggedIn(!!token)
    if (!token) return
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setViewerUniversityId(data?.user?.universityId || null))
      .catch(() => {})
  }, [])

  const canTransact = isLoggedIn && !!viewerUniversityId && !!product?.universityId && viewerUniversityId === product.universityId

  // ── Fetch product ───────────────────────────────────────
  useEffect(() => {
    if (!productId) return
    fetchProduct()
  }, [productId])

  const fetchProduct = async () => {
    setLoading(true)
    try {
      // Product pages are publicly viewable — logged out or cross-university
      // visitors can see everything. Buying is what's gated, separately.
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/products/${productId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
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
        // also maintain new client-side key for Recently Viewed (lowercase key per spec)
        setTimeout(() => {
          try {
            const key = 'batamart_recently_viewed'
            const raw = JSON.parse(localStorage.getItem(key) || '[]')
            const stub = { id: p.id, name: p.name, price: p.price, image: p.images?.[0] || '', categoryKey: p.subcategoryKey || p.categoryKey || p.category }
            const merged = [stub, ...raw.filter((r: any) => r.id !== stub.id)].slice(0, 20)
            localStorage.setItem(key, JSON.stringify(merged))
            setRecentlyViewed(merged)
          } catch {}
        }, 1000)
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
        // prefer new `sections` shape; fall back to legacy shape
        if (Array.isArray(data.sections)) {
          setRelatedSections(data.sections)
        } else {
          setRelatedNameRelated(data.related?.nameRelated || [])
          const others: RelatedProduct[] = data.related?.others || []
          setRelatedOthers(others)
          setRelatedSourceName(data.sourceProduct?.name || '')
        }
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

  // Load client-side recently viewed on mount
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('BATAMART-recently-viewed') || '[]')
      if (Array.isArray(raw)) setRecentlyViewed(raw.slice(0, 20))
    } catch {}
  }, [])

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
  const variantSummary = Object.entries(selected).filter(([, v]) => v).map(([, v]) => v).join(' | ')
  const matchedVariant = structuredVariants.find(v =>
    requiredVariants.every(k => (v.combination || {})[k] === selected[k])
  )
  const effectivePrice = matchedVariant?.price ?? product?.price ?? 0
  // Stock is only meaningful once a matching combination is found (or the product has no variants) —
  // before that, don't show a stale/misleading number pulled from the base product quantity.
  const stockKnown = requiredVariants.length === 0 || Boolean(matchedVariant)
  const effectiveStock = matchedVariant?.stock ?? (requiredVariants.length === 0 ? product?.quantity ?? 0 : 0)
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

  // Suggest a note built from what the buyer actually picked (or the product's own
  // specs when it has no variants) — "Make sure it's Black, 128GB" — instead of a
  // generic example that has nothing to do with this listing.
  const noteSuggestionValues = variantSummary
    ? variantSummary.split(' | ').filter(Boolean)
    : specAttributes
        .map((attr) => (Array.isArray(attr.value) ? attr.value[0] : attr.value))
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .slice(0, 2)
  const noteSuggestionText = noteSuggestionValues.length > 0 ? `Make sure it's ${noteSuggestionValues.join(', ')}` : ''

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
    if (!isLoggedIn) {
      router.push(`/login?redirect=/product/${productId}`)
      return
    }
    if (!canTransact) {
      toast.error("This item isn't available for delivery to your campus.")
      return
    }
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
        note: noteToSeller.trim() || undefined,
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
    if (!isLoggedIn) {
      router.push(`/login?redirect=/product/${productId}`)
      return
    }
    if (!canTransact) {
      toast.error("This item isn't available for delivery to your campus.")
      return
    }
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
      note: noteToSeller.trim() || undefined,
    }))
    router.push('/checkout')
  }

  const handleReportListing = async () => {
    if (!product || reporting || reported) return
    setReporting(true)
    setReportError('')
    try {
      const token = localStorage.getItem('token') || ''
      const response = await fetch(`/api/products/${product.id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reportReason }),
      })
      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        setReported(true)
        setShowReportModal(false)
        setReportReason('')
        toast.success('Thank you, this listing has been reported.')
        return
      }

      if (response.status === 409) {
        setReported(true)
      }
      setReportError(data.error || 'Failed to report listing')
    } catch {
      setReportError('Network error. Please try again.')
    } finally {
      setReporting(false)
    }
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
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-danger mx-auto" />
          <p className="text-lg font-semibold text-ink-secondary">{error || 'Product not found'}</p>
          <button onClick={() => router.back()} className="text-primary font-semibold underline text-sm">
            Go back
          </button>
        </div>
      </div>
    )
  }

  const hasRelated = relatedNameRelated.length > 0 || relatedOthers.length > 0

  return (
    <div className="min-h-screen bg-surface" ref={mainRef}>
      <style>{PAGE_CSS}</style>

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto space-y-4 p-4 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-ink">Report this listing</h3>
              <button
                onClick={() => {
                  setShowReportModal(false)
                  setReportReason('')
                  setReportError('')
                }}
                className="p-1.5 hover:bg-surface rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-ink-muted" />
              </button>
            </div>

            {reportError && (
              <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
                <p className="text-xs text-danger font-medium">{reportError}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-ink-secondary">
                Why are you reporting this listing? *
              </label>
              <div className="space-y-2">
                {[
                  { id: 'FAKE_PRODUCT', label: 'Fake or counterfeit product' },
                  { id: 'WRONG_DESCRIPTION', label: 'Wrong description or misleading' },
                  { id: 'POOR_QUALITY', label: 'Poor quality than described' },
                  { id: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate or offensive content' },
                  { id: 'OTHER', label: 'Other reason' },
                ].map(reason => (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => {
                      setReportReason(reason.id)
                      setReportError('')
                    }}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      reportReason === reason.id
                        ? 'border-danger bg-danger/10 shadow-soft'
                        : 'border-border hover:border-border hover:bg-surface'
                    }`}
                  >
                    <p className="text-sm font-medium text-ink">{reason.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowReportModal(false)
                  setReportReason('')
                  setReportError('')
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-border font-semibold text-ink-secondary hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReportListing}
                disabled={!reportReason || reporting}
                className="flex-1 py-3 px-4 rounded-xl bg-danger text-white font-semibold hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {reporting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {reporting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recently viewed was previously rendered at the top of the page.
          Move it further down so it doesn't push the main product content.
          Render client-side only and keep existing behavior. */}

      {/* ── Top nav ───────────────────────────────────────── */}
      <div
        className={`sticky top-0 z-40 transition-[background-color,border-color] duration-300 ${
          pastHero ? 'ui-chrome-solid border-b border-border' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-12 flex items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className={`flex items-center gap-1 flex-shrink-0 transition-colors ${
              pastHero
                ? 'text-ink-secondary hover:text-primary'
                : 'h-9 w-9 justify-center rounded-full bg-black/45 text-white backdrop-blur-sm sm:bg-transparent sm:text-ink-secondary sm:backdrop-blur-none'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
            <span className={`text-sm font-medium hidden ${pastHero ? 'xs:inline' : ''}`}>Back</span>
          </button>

          <p
            className={`text-[13px] font-semibold text-ink-secondary truncate flex-1 text-center transition-opacity duration-300 ${
              pastHero ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {product.name}
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: product.name, url: window.location.href }).catch(() => {})
                } else {
                  navigator.clipboard.writeText(window.location.href).catch(() => {})
                }
              }}
              aria-label="Share this listing"
              className={`flex items-center justify-center transition-colors ${
                pastHero
                  ? 'w-8 h-8 rounded-lg text-ink-secondary hover:bg-surface'
                  : 'h-9 w-9 rounded-full bg-black/45 text-white backdrop-blur-sm sm:bg-transparent sm:text-ink-secondary sm:backdrop-blur-none'
              }`}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <Link
              href="/cart"
              aria-label="Cart"
              className={`relative flex items-center justify-center transition-colors ${
                pastHero
                  ? 'w-8 h-8 rounded-lg text-ink-secondary hover:bg-surface'
                  : 'h-9 w-9 rounded-full bg-black/45 text-white backdrop-blur-sm sm:bg-transparent sm:text-ink-secondary sm:backdrop-blur-none'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              {items.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger/100 text-white text-[9px] font-semibold rounded-full flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Breadcrumb (tablet+) ───────────────────────────── */}
      {(() => {
        const categoryDisplay = getCategoryDisplayInfo((product as any).categoryKey, (product as any).subcategoryKey, product.category, product.subcategory)
        return (
          <div className="hidden sm:block max-w-5xl mx-auto px-4 py-2">
            <div className="flex items-center gap-1 text-[11px] text-ink-muted">
              <Link href="/marketplace" className="hover:text-primary transition-colors">Marketplace</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="hover:text-primary cursor-pointer transition-colors">{categoryDisplay.category}</span>
              {categoryDisplay.subcategory && (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span className="hover:text-primary cursor-pointer transition-colors">{categoryDisplay.subcategory}</span>
                </>
              )}
              <ChevronRight className="w-3 h-3" />
              <span className="text-ink-secondary font-medium truncate max-w-[200px]">{product.name}</span>
            </div>
          </div>
        )
      })()}

      <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-24 sm:pb-8 space-y-4">

        {/* ── Main product section ───────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-1 sm:gap-2 fade-up items-start">

          {/* LEFT — Images (Sticky) */}
          <div className="space-y-2 sm:sticky sm:top-16 sm:max-h-[calc(100vh-80px)] sm:overflow-y-auto no-scrollbar">
            <div className="relative -mx-3 overflow-hidden bg-card sm:mx-0 sm:border sm:border-border">
              <div className="relative aspect-[4/5] overflow-hidden">
                {product.images?.[activeImg] ? (
                  <img
                    src={product.images[activeImg]}
                    alt={product.name}
                    className={`main-img h-full w-full bg-surface object-cover ${imgSwitching ? 'switching' : ''}`}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface">
                    <Package className="w-16 h-16 text-ink-muted" />
                  </div>
                )}

                <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
                  {isNew && (
                    <span className="bg-success px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white">New</span>
                  )}
                  {product.quantity <= 3 && product.quantity > 0 && (
                    <span className="bg-warning px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white">
                      {product.quantity} left
                    </span>
                  )}
                  {product.quantity === 0 && (
                    <span className="bg-danger px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white">
                      Out of stock
                    </span>
                  )}
                </div>

                {(product.viewCount || 0) > 5 && (
                  <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white backdrop-blur-sm">
                    <Eye className="h-3 w-3" strokeWidth={1.75} />
                    {product.viewCount} views
                  </div>
                )}

                {product.images.length > 1 && (
                  <>
                    <button
                      onClick={() => switchImg((activeImg - 1 + product.images.length) % product.images.length)}
                      aria-label="Previous image"
                      className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => switchImg((activeImg + 1) % product.images.length)}
                      aria-label="Next image"
                      className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/65"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {product.images.length > 1 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
                  {product.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => switchImg(i)}
                      aria-label={`Show image ${i + 1}`}
                      className={`pointer-events-auto h-1.5 transition-all duration-300 ${
                        i === activeImg ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
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
                    className={`img-thumb h-16 w-14 flex-shrink-0 overflow-hidden bg-surface sm:h-[72px] sm:w-16 ${i === activeImg ? 'active' : 'border border-border'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Buy box */}
          <div className="space-y-3">

            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-primary/10 text-primary text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                {(() => {
                  const categoryDisplay = getCategoryDisplayInfo((product as any).categoryKey, (product as any).subcategoryKey, product.category, product.subcategory)
                  return categoryDisplay.subcategory ? `${categoryDisplay.category} › ${categoryDisplay.subcategory}` : categoryDisplay.category
                })()}
              </span>
              <TrustBadge level={product.seller.trustLevel} />
              {(product._count?.orders || 0) >= 5 && (
                <span className="bg-danger/10 text-danger text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Popular
                </span>
              )}
            </div>

            <h1 className="text-[clamp(1.35rem,3vw,2.1rem)] leading-[1.08] text-ink">{product.name}</h1>

            <div className="flex items-center gap-2 flex-wrap">
              <StarRow rating={product.seller.avgRating || 0} size="md" />
              <span className="ui-figure text-sm text-ink">{(product.seller.avgRating || 0).toFixed(1)}</span>
              <span className="text-ink-muted">·</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
                {product._count?.orders || 0} sold
              </span>
              {product.viewCount > 0 && (
                <>
                  <span className="text-sm text-ink-muted">·</span>
                  <span className="text-sm text-ink-secondary flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> {product.viewCount}
                  </span>
                </>
              )}
            </div>

            {/* The price needs no box — at this size and weight it already
                dominates. A tinted panel around it only added a second
                competing rectangle. */}
            <div className="border-y border-border py-4">
              <div className="flex items-baseline gap-3">
                <span className="ui-figure text-[clamp(1.9rem,4.5vw,2.75rem)] leading-none text-ink">
                  {fmt(effectivePrice)}
                </span>
                {product.basePrice && product.basePrice > effectivePrice && (
                  <span className="text-sm font-medium text-ink-muted line-through">{fmt(product.basePrice)}</span>
                )}
              </div>
              {structuredVariants.length > 0 && minStructuredPrice > 0 && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
                  Range {fmt(minStructuredPrice)} — {fmt(maxStructuredPrice)}
                </p>
              )}
              <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                <Shield className="h-3 w-3 text-success" strokeWidth={2} />
                Secure checkout · Buyer protection
              </p>
            </div>

            {stockKnown && effectiveStock > 0 && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${effectiveStock <= 5 ? 'bg-warning' : 'bg-success'}`} />
                <span className={`font-mono text-[10px] uppercase tracking-[0.12em] ${effectiveStock <= 5 ? 'text-warning' : 'text-success'}`}>
                  {effectiveStock <= 5 ? `Only ${effectiveStock} left` : `${effectiveStock} in stock`}
                </span>
              </div>
            )}

            {product.deliveryEstimate && (
              <div>
                <span className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-secondary">
                  <Truck className="h-3.5 w-3.5 text-success" strokeWidth={1.75} /> Delivery {product.deliveryEstimate}
                </span>
              </div>
            )}

            {/* ── NEW: Variant Selector ──────────────────── */}
            {(variantKeys.length > 0 || specAttributes.length > 0) && (
              <div id="variant-selector" className="space-y-4 border border-border bg-card p-4">
                <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <Crown className="w-4 h-4 text-primary" />
                  Options & Specs
                </h3>
                {variantKeys.length > 0 && (
                  <p className="text-[11px] text-ink-secondary -mt-2">
                    Pick all required options to unlock exact stock and pricing.
                  </p>
                )}

                {variantError && (
                  <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-xl px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0" />
                    <p className="text-xs text-danger font-semibold">{variantError}</p>
                  </div>
                )}

                {variantKeys.map(key => {
                  const vals = variants[key]
                  if (!vals || vals.length === 0) return null
                  const isSingleLocked = vals.length === 1
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

                  // Single-value variants are auto-selected by the effect above.
                  // For single variants, show as plain text
                  if (isSingleLocked) {
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <span className="text-ink-secondary font-medium">{label}:</span>
                        <span className="text-ink font-semibold">{vals[0]}</span>
                      </div>
                    )
                  }
                  
                  // For multiple variants, show interactive buttons
                  return (
                    <div key={key} className="rounded-xl border border-border p-3 bg-surface/40">
                      <p className="text-xs font-semibold text-ink-secondary mb-2 flex items-center justify-between">
                        <span>
                          {label}: {selected[key] ? <span className="text-primary">{selected[key]}</span> : <span className="text-ink-muted">Select</span>}
                        </span>
                        <span className="text-[10px] text-ink-muted font-semibold">{vals.length} option{vals.length > 1 ? 's' : ''}</span>
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
                              setSelected(prev => ({ ...prev, [key]: prev[key] === v ? prev[key] : v }))
                              setVariantError('')
                            }}
                            className={`variant-chip rounded-lg border px-3.5 py-2.5 text-left text-xs font-medium transition-colors duration-300 ${
                              chosen
                                ? 'border-ink bg-ink text-background'
                                : available
                                ? 'border-border bg-card text-ink hover:border-ink/40'
                                : 'cursor-not-allowed border-border bg-surface text-ink-muted opacity-70'
                            }`}
                            disabled={!available}
                          >
                            <span className="block truncate">{v}</span>
                            <span className={`block text-[10px] mt-0.5 ${chosen ? 'text-white/80' : available ? 'text-success' : 'text-ink-muted'}`}>
                              {available ? 'Available' : 'Unavailable'}
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
                  <div className="bg-primary/10 rounded-xl px-3 py-2 border border-primary/20">
                    <p className="text-xs text-primary font-semibold">Selected: {variantSummary}</p>
                    {matchedVariant && (
                      <p className="text-xs text-primary font-semibold mt-1">
                        Selected price: {fmt(matchedVariant.price)}
                      </p>
                    )}
                    {structuredVariants.length > 0 && minStructuredPrice > 0 && (
                      <p className="text-[11px] text-primary font-semibold mt-1">
                        Range: {fmt(minStructuredPrice)} – {fmt(maxStructuredPrice)}
                        {product?.basePrice ? ` · Base: ${fmt(product.basePrice)}` : ''}
                      </p>
                    )}
                  </div>
                )}

                {specAttributes.length > 0 && (
                  <div className="rounded-xl border border-border p-3 bg-surface/40">
                    <p className="text-xs font-semibold text-ink-secondary mb-2">Item Specs</p>
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
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-ink-secondary"
                          >
                            <span className="text-ink-secondary">{attr.label || attr.key}:</span>
                            <span className="text-ink">{displayValue}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Note to seller ── */}
            <div className="space-y-2 border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                Note to seller <span className="text-ink-muted font-normal text-xs">(optional)</span>
              </h3>
              {noteSuggestionText && !noteToSeller && (
                <button
                  type="button"
                  onClick={() => setNoteToSeller(noteSuggestionText)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-full px-3 py-1.5 transition-colors"
                >
                  <Crown className="w-3 h-3" /> {noteSuggestionText}
                </button>
              )}
              <textarea
                value={noteToSeller}
                onChange={(e) => setNoteToSeller(e.target.value.slice(0, 300))}
                maxLength={300}
                rows={2}
                placeholder={noteSuggestionText ? `e.g. ${noteSuggestionText} — confirm before delivery` : 'e.g. Please deliver after 4pm, or gift-wrap this…'}
                className="w-full text-sm bg-surface rounded-xl p-3 border border-transparent focus:border-primary focus:bg-card outline-none resize-none transition-colors"
              />
              <p className="text-[11px] text-ink-muted text-right">{noteToSeller.length}/300</p>
            </div>

            {(!stockKnown || effectiveStock > 0) && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-ink-secondary">Qty:</span>
                <div className="flex items-center gap-2 bg-surface rounded-xl p-1 ring-1 ring-border">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="qty-btn w-8 h-8 rounded-lg bg-card ring-1 ring-border flex items-center justify-center text-ink-secondary disabled:opacity-40"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-ink">{qty}</span>
                  <button
                    onClick={() => setQty(q => stockKnown ? Math.min(effectiveStock, q + 1) : q + 1)}
                    disabled={stockKnown && qty >= effectiveStock}
                    className="qty-btn w-8 h-8 rounded-lg bg-card ring-1 ring-border flex items-center justify-center text-ink-secondary disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {stockKnown && <span className="text-xs text-ink-muted">({effectiveStock} available)</span>}
              </div>
            )}

            {isLoggedIn && viewerUniversityId && !canTransact && (
              <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 text-warning text-sm font-medium px-3 py-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>This item isn't available for delivery to your campus — you can still view it, but ordering is limited to buyers at the seller's university.</span>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={handleAddToCart}
                disabled={(stockKnown && effectiveStock === 0) || addingToCart}
                className="add-btn flex flex-1 items-center justify-center gap-2 rounded-lg py-4 font-mono text-[11px] uppercase tracking-[0.14em] transition-transform duration-300 active:scale-[0.99]"
              >
                {addingToCart
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <ShoppingCart className="w-4 h-4" />
                }
                {addingToCart
                  ? 'Adding…'
                  : variantKeys.length > 0 && !allVariantsSelected
                  ? 'Select Options First'
                  : stockKnown && effectiveStock === 0
                  ? 'Out of Stock'
                  : 'Add to Cart'}
              </button>
              {!(stockKnown && effectiveStock === 0) && (
                <button
                  onClick={handleBuyNow}
                  className="buy-btn ui-btn-sweep flex flex-1 items-center justify-center gap-2 rounded-lg py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-white transition-transform duration-300 active:scale-[0.99]"
                >
                  <Zap className="w-4 h-4" />
                  Buy Now
                </button>
              )}
            </div>

            {cartMsg && (
              <div className="flex items-center gap-2 bg-success/10 border border-success/30 text-success text-sm font-medium px-3 py-2 rounded-xl">
                <CheckCircle className="w-4 h-4" />
                {cartMsg}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              disabled={reported}
              className="inline-flex items-center gap-2 text-xs font-semibold text-ink-secondary hover:text-danger disabled:text-success disabled:cursor-default"
            >
              <Flag className="w-3.5 h-3.5" />
              {reported ? 'Listing reported' : 'Report listing'}
            </button>

            {/* Delivery info */}
            <div className="space-y-2 border border-border bg-card p-4">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-success flex-shrink-0" />
                <p className="text-xs text-ink-secondary">Campus delivery available via BataMart riders</p>
              </div>
              {product.deliveryEstimate && (
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-warning flex-shrink-0" />
                  <p className="text-xs text-ink-secondary">Estimated delivery: {product.deliveryEstimate}</p>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-xs text-ink-secondary">Contact the seller to arrange pickup or delivery details</p>
              </div>
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-xs text-ink-secondary">Protected by BataMart buyer guarantee</p>
              </div>
            </div>

            {/* Seller card */}
            <Link
              href={`/seller/${product.seller.id}`}
              className="group flex items-center gap-3 border border-border bg-card p-4 transition-colors duration-300 hover:border-ink/25"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0">
                {product.seller.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-ink truncate">{product.seller.name}</p>
                  {product.seller.trustLevel === 'GOLD' && (
                    <BadgeCheck className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <StarRow rating={product.seller.avgRating || 0} />
                  <span className="text-[11px] text-ink-secondary">{product.seller.completedOrders || 0} orders</span>
                  {(product as any).landmark && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-ink-secondary">
                      <MapPin className="w-3 h-3" /> {(product as any).landmark}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform">
                <span className="text-xs font-semibold hidden sm:block">Visit Shop</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>

        {/* ── Tabs: Description · Details · Reviews ─────── */}
        <div className="bg-card rounded-2xl overflow-hidden shadow-soft fade-up border border-border" style={{ animationDelay: '0.1s' }}>
          <div className="flex border-b border-border">
            {(['desc', 'reviews'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  if (tab === 'reviews') fetchReviews()
                }}
                className={`tab-btn flex-1 py-3 text-sm font-semibold text-ink-secondary transition-all ${activeTab === tab ? 'active' : ''}`}
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
                    <p className="text-xs font-semibold text-ink-secondary mb-2 flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Available Options
                    </p>
                    <div className="space-y-2">
                      {variantKeys.map(key => {
                        const vals = variants[key]
                        if (!vals || vals.length === 0) return null
                        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                        return (
                          <div key={key} className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-ink-secondary w-24 flex-shrink-0">{label}:</span>
                            <div className="flex flex-wrap gap-1">
                              {vals.map(v => (
                                <span key={v} className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{v}</span>
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
                    <p className={`text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap ${!descExpanded && descriptionClean.length > 200 ? 'line-clamp-4' : ''}`}>
                      {descriptionClean}
                    </p>
                    {descriptionClean.length > 200 && (
                      <button
                        onClick={() => setDescExpanded(e => !e)}
                        className="flex items-center gap-1 text-primary text-sm font-semibold mt-2 hover:underline"
                      >
                        {descExpanded ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Read more</>}
                      </button>
                    )}
                  </div>
                ) : variantKeys.length === 0 ? (
                  <p className="text-sm text-ink-muted italic">No description provided.</p>
                ) : null}

                {tags.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-ink-secondary mb-2 flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag, i) => (
                        <span key={i} className="tag-pill bg-surface text-ink-secondary text-xs font-medium px-2.5 py-1 rounded-full cursor-default">
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
                    <MessageCircle className="w-10 h-10 text-ink-muted mx-auto mb-2" />
                    <p className="text-sm text-ink-muted">No reviews yet</p>
                    <p className="text-xs text-ink-muted mt-1">Be the first to buy and review this product</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((r: any) => (
                      <div key={r.id} className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                          {r.reviewer?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-ink">{r.reviewer?.name || 'Buyer'}</p>
                            <StarRow rating={r.rating} />
                          </div>
                          {r.comment && (
                            <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{r.comment}</p>
                          )}
                          <p className="text-[11px] text-ink-muted mt-1">
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

        {/* ── Recently viewed (moved below main content) ─────── */}
        {recentlyViewed.length > 0 && (
          <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Recently viewed</h2>
                <p className="text-xs text-ink-secondary mt-0.5">Items you recently looked at</p>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('batamart_recently_viewed')
                  setRecentlyViewed([])
                }}
                className="text-xs text-ink-secondary hover:underline"
              >
                Clear
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-3">
              {recentlyViewed.map(item => (
                <div key={item.id} className="flex-shrink-0 w-36 sm:w-44 rounded-2xl overflow-hidden bg-card border border-border">
                  <div className="aspect-square bg-surface">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-muted">No image</div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold line-clamp-2">{item.name}</p>
                    <p className="text-sm font-semibold text-primary mt-1">{fmt(item.price)}</p>
                    <button onClick={() => navigateRelatedTracked(item.id)} className="mt-2 text-xs text-primary">View</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Related products: multiple sections ──────── */}
        {((relatedSections && relatedSections.length > 0) || hasRelated) && (
          <div className="fade-up" style={{ animationDelay: '0.15s' }}>
            {(relatedSections && relatedSections.length > 0 ? relatedSections : [
              relatedNameRelated.length ? { title: 'Related', reason: relatedSourceName ? `Similar to "${relatedSourceName}"` : '', products: [...relatedNameRelated, ...relatedOthers] } : null
            ].filter(Boolean) as RelatedSection[]).map((section) => (
              <section key={section.title} className="mt-8">
                <div className="flex items-baseline justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-ink dark:text-white">{section.title}</h2>
                    <p className="text-xs text-ink-secondary mt-0.5">{section.reason}</p>
                  </div>
                  <a href={`/search?sub=${product.subcategoryKey}`} className="text-xs text-primary">See all</a>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible">
                  {section.products.map(p => (
                    <div key={p.id} className="flex-shrink-0 w-40 md:w-full">
                      <RelatedProductCard
                        product={{
                          id: p.id,
                          name: p.name,
                          price: p.price,
                          images: p.images,
                          avgRating: p.seller?.avgRating,
                          totalReviews: 0,
                          isHot: false,
                          isDeal: false,
                          discountPercent: null,
                          seller: p.seller,
                          deliveryEstimate: undefined,
                          matchReason: (p as any).matchReason,
                        }}
                        onOpen={() => navigateRelatedTracked(p.id)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── People Like You Bought ─────────────────────── */}
        {(peopleLikeLoading || peopleLikeYouBought.length > 0) && (
          <div className="fade-up" style={{ animationDelay: '0.18s' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-ink flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                People Like You Bought
              </h2>
            </div>
            {peopleLikeLoading ? (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex-shrink-0 w-36 sm:w-44 rounded-2xl overflow-hidden">
                    <div className="shimmer aspect-square w-full" />
                    <div className="bg-card p-2 space-y-1.5">
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
          <h2 className="text-base sm:text-lg font-semibold text-ink mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-warning" />
            You might also like
          </h2>

          {alsoLikeItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {alsoLikeItems.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigateRelatedTracked(p.id)}
                  className="rv-card ui-tile group cursor-pointer"
                >
                  <div className="aspect-square overflow-hidden bg-surface">
                    {p.images?.[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-ink-muted" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs sm:text-sm font-semibold text-ink line-clamp-2 leading-tight mb-1">
                      {p.name}
                    </p>
                    <p className="text-sm font-semibold text-primary">{fmt(p.price)}</p>
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
                <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border">
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
            <p className="text-center text-xs text-ink-muted mt-4 py-2">You've seen it all!</p>
          )}

          <div ref={alsoLikeSentinelRef} className="h-1 w-full" />
        </div>

      </div>
    </div>
  )
}
