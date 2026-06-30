'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Flame, ChevronLeft, Percent, Star, BadgeCheck, Tag,
  Truck, Timer, SlidersHorizontal, X, Search, Loader2,
  CheckCircle, ShoppingBag, Sparkles, Heart, Eye, ArrowUpDown,
  ChevronDown, Filter,
} from 'lucide-react'

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const DEALS_PAGE_SIZE = 16
const HOT_DEAL_MIN_PERCENT = 12

const DEALS_CSS = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .dc-enter { opacity: 0; animation: fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }

  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .dc-shimmer {
    background: linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%);
    background-size: 1200px 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .dc-card {
    transition: transform 0.3s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.3s ease;
    will-change: transform;
  }
  .dc-card:hover { transform: translateY(-4px) scale(1.015); box-shadow: 0 20px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(239,68,68,0.08); }
  .dc-card:active { transform: scale(0.97); transition: transform 0.1s ease; }
  .dc-card:hover .dc-img { transform: scale(1.08); }
  .dc-img { transition: transform 0.5s cubic-bezier(0.22,1,0.36,1); }

  .dc-quick { opacity:0; transform:translateY(6px); transition: opacity 0.2s ease, transform 0.2s ease; }
  .dc-card:hover .dc-quick { opacity:1; transform:translateY(0); }

  @keyframes floatBadge {
    0%,100% { transform: translateY(0) rotate(-2deg); }
    50%      { transform: translateY(-2px) rotate(-2deg); }
  }
  .dc-float { animation: floatBadge 3s ease-in-out infinite; }

  @keyframes badgePulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.85; transform:scale(1.04); }
  }
  .dc-badge-pulse { animation: badgePulse 2s ease-in-out infinite; }

  @keyframes spinLoader {
    from { transform:rotate(0deg); }
    to   { transform:rotate(360deg); }
  }
  .dc-spin { animation: spinLoader 0.8s linear infinite; }

  .dc-filter-panel {
    transition: max-height 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease;
  }

  .dc-range-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #ef4444;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(239,68,68,0.4);
  }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; }
  input[type=range] { -webkit-appearance:none; appearance:none; background:transparent; }
  input[type=range]::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, #ef4444 var(--val, 50%), #e5e7eb var(--val, 50%));
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #ef4444;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(239,68,68,0.4);
    margin-top: -7px;
  }

  .no-scrollbar::-webkit-scrollbar { display:none; }
  .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }

  .dc-pill {
    transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.18s cubic-bezier(0.34,1.4,0.64,1);
  }
  .dc-pill:hover { transform: scale(1.04); }
  .dc-pill:active { transform: scale(0.96); }

  .dc-hero {
    background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 40%, #f97316 100%);
  }

  @keyframes viewerCount {
    0%,100% { color:#ef4444; }
    50%      { color:#f97316; }
  }
  .dc-viewer { animation: viewerCount 2.5s ease-in-out infinite; }
`

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmt = (p: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(p)

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getDiscountTier(pct: number): { label: string; color: string; bg: string; ring: string } {
  if (pct >= 30) return { label: `${pct}% OFF`, color: 'text-red-700', bg: 'bg-red-100', ring: 'ring-red-300' }
  if (pct >= 20) return { label: `${pct}% OFF`, color: 'text-orange-700', bg: 'bg-orange-100', ring: 'ring-orange-300' }
  return { label: `${pct}% OFF`, color: 'text-amber-700', bg: 'bg-amber-100', ring: 'ring-amber-300' }
}

const CATEGORIES = [
  'All', 'Electronics', 'Computing', 'Fashion', 'Home & Kitchen',
  'Food & Groceries', 'Beauty & Health', 'Sports & Fitness',
  'Vehicles & Transport', 'Books & Stationery', 'Tickets & Events',
  'Kids & Baby', 'Arts & Crafts',
]

const CATEGORY_ICONS: Record<string, string> = {
  'All': '🛍️', 'Electronics': '📱', 'Computing': '💻', 'Fashion': '👔', 'Home & Kitchen': '🏠',
  'Food & Groceries': '🍔', 'Beauty & Health': '💄', 'Sports & Fitness': '⚽',
  'Vehicles & Transport': '🚗', 'Books & Stationery': '📚', 'Tickets & Events': '🎟️',
  'Kids & Baby': '🧸', 'Arts & Crafts': '🎨',
}

// ─────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
      <span className="text-xs font-semibold text-gray-400 ml-0.5">{rating.toFixed(1)}</span>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className="aspect-square dc-shimmer" />
      <div className="p-3 space-y-2">
        <div className="h-2.5 dc-shimmer rounded-full w-1/2" />
        <div className="h-3.5 dc-shimmer rounded-full w-full" />
        <div className="h-3.5 dc-shimmer rounded-full w-3/4" />
        <div className="h-5   dc-shimmer rounded-full w-1/3 mt-3" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Deal Card
// ─────────────────────────────────────────────
function DealCard({ product, onClick, delay = 0 }: { product: any; onClick: () => void; delay?: number }) {
  const discount = (product.isDeal && product.discountPercent) ? product.discountPercent : 0
  const isHot = product.isHot ?? false
  const tier = getDiscountTier(discount)
  const originalPrice = product.marketPrice && product.marketPrice > product.price ? product.marketPrice : null
  const savings = originalPrice ? originalPrice - product.price : 0

  return (
    <div
      onClick={onClick}
      className="dc-card dc-enter bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer flex flex-col group"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Image */}
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        <img src={product.images?.[0] || '/placeholder.png'} alt={product.name} className="dc-img w-full h-full object-cover" />

        {/* Discount badge — floating animated */}
        {discount > 0 && (
          <div className="dc-float absolute top-2.5 right-2.5">
            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 shadow-lg ring-2 ring-white">
              <span className="text-white font-black text-[13px] leading-none">-{discount}%</span>
              <span className="text-white/80 font-bold text-[8px] leading-none mt-0.5">OFF</span>
            </div>
          </div>
        )}

        {/* Label badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {isHot && !product.isDeal && (
            <span className="dc-badge-pulse inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black rounded-lg shadow-md">
              🔥 HOT
            </span>
          )}
          {discount >= 30 && (
            <span className="dc-badge-pulse inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-red-600 to-red-500 text-white text-[10px] font-black rounded-lg shadow-md">
              🔥 MEGA DEAL
            </span>
          )}
          {discount >= 20 && discount < 30 && (
            <span className="dc-badge-pulse inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black rounded-lg shadow-md">
              ⚡ HOT DEAL
            </span>
          )}
          {discount >= 12 && discount < 20 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-400 text-white text-[10px] font-black rounded-lg shadow-md">
              🏷️ DEAL
            </span>
          )}
        </div>

        {product.images?.length > 1 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/50 text-white text-[10px] font-bold backdrop-blur-sm">
            {product.images.length} photos
          </div>
        )}

        {/* Quick actions */}
        <div className="dc-quick absolute bottom-2 left-2 flex gap-1.5">
          <button onClick={e => e.stopPropagation()} className="w-7 h-7 bg-white/95 hover:bg-red-50 rounded-lg flex items-center justify-center shadow-sm transition-colors">
            <Heart className="w-3.5 h-3.5 text-gray-500 hover:text-red-500" />
          </button>
          <button onClick={e => { e.stopPropagation(); onClick() }} className="w-7 h-7 bg-white/95 rounded-lg flex items-center justify-center shadow-sm transition-colors">
            <Eye className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
          {(() => {
            const display = getCategoryDisplayInfo(product.categoryKey, product.subcategoryKey, product.category, product.subcategory)
            return display.subcategory ? `${display.category} · ${display.subcategory}` : display.category
          })()}
        </p>
        <h3 className="font-bold text-gray-900 line-clamp-2 text-xs sm:text-sm leading-snug flex-1">{product.name}</h3>

        {/* Savings pill */}
        {savings > 0 && (
          <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full ring-1 ${tier.bg} ${tier.color} ${tier.ring} text-[10px] font-black self-start`}>
            <Tag className="w-2.5 h-2.5" /> Save {fmt(savings)}
          </div>
        )}

        {/* Price row */}
        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          <span className="text-red-600 font-black text-sm sm:text-base tracking-tight">{fmt(product.price)}</span>
          {originalPrice && (
            <span className="text-gray-400 font-medium text-[11px] line-through">{fmt(originalPrice)}</span>
          )}
        </div>

        <StarRating rating={product.seller?.avgRating || 0} />

        {/* Seller row */}
        <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-gray-50">
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[10px] font-semibold text-gray-500 truncate">{product.seller?.name}</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold ring-1 ring-blue-100 flex-shrink-0">
              <BadgeCheck className="w-2.5 h-2.5" /> Verified
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Filter Panel
// ─────────────────────────────────────────────
interface Filters {
  category: string
  minPrice: number
  maxPrice: number
  minDiscount: number
  maxDiscount: number
}

const DEFAULT_FILTERS: Filters = {
  category: 'All',
  minPrice: 0,
  maxPrice: 500000,
  minDiscount: HOT_DEAL_MIN_PERCENT,
  maxDiscount: 100,
}

function FilterPanel({
  filters, onChange, allDeals, onClose
}: {
  filters: Filters
  onChange: (f: Filters) => void
  allDeals: any[]
  onClose: () => void
}) {
  const maxPossiblePrice = useMemo(() => {
    const prices = allDeals.map(p => p.price)
    return prices.length ? Math.ceil(Math.max(...prices) / 10000) * 10000 : 500000
  }, [allDeals])

  const maxPossibleDiscount = useMemo(() => {
    const discs = allDeals.map(p => p.discountPercent || 0)
    return discs.length ? Math.max(...discs) : 100
  }, [allDeals])

  const set = (key: keyof Filters, val: string | number) => onChange({ ...filters, [key]: val })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-red-500" />
          <span className="font-black text-gray-900 text-sm">Filter Deals</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-[11px] font-bold text-gray-400 hover:text-red-500 transition-colors"
          >
            Reset all
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="text-xs font-black text-gray-700 mb-2">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => set('category', cat)}
              className={`dc-pill flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                filters.category === cat
                  ? 'bg-red-500 text-white border-red-500 shadow-sm'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600'
              }`}
            >
              <span>{CATEGORY_ICONS[cat] || '🛍️'}</span>
              <span className="hidden sm:inline">{cat}</span>
              <span className="sm:hidden">{cat.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-black text-gray-700">Price Range</p>
          <span className="text-[11px] font-bold text-red-500">
            {fmt(filters.minPrice)} — {filters.maxPrice >= maxPossiblePrice ? 'Any' : fmt(filters.maxPrice)}
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Min price</label>
            <input
              type="range"
              min={0}
              max={maxPossiblePrice}
              step={1000}
              value={filters.minPrice}
              onChange={e => set('minPrice', Number(e.target.value))}
              style={{ '--val': `${(filters.minPrice / maxPossiblePrice) * 100}%` } as React.CSSProperties}
              className="w-full h-1 accent-red-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Max price</label>
            <input
              type="range"
              min={0}
              max={maxPossiblePrice}
              step={1000}
              value={filters.maxPrice}
              onChange={e => set('maxPrice', Number(e.target.value))}
              style={{ '--val': `${(filters.maxPrice / maxPossiblePrice) * 100}%` } as React.CSSProperties}
              className="w-full h-1 accent-red-500"
            />
          </div>
        </div>
        {/* Quick price presets */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {[5000, 10000, 20000, 50000, 100000].map(v => (
            <button
              key={v}
              onClick={() => onChange({ ...filters, minPrice: 0, maxPrice: v })}
              className={`dc-pill px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                filters.maxPrice === v && filters.minPrice === 0
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-red-300'
              }`}
            >
              Under {fmt(v)}
            </button>
          ))}
        </div>
      </div>

      {/* Discount range */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-black text-gray-700">Discount Range</p>
          <span className="text-[11px] font-bold text-red-500">
            {filters.minDiscount}% — {filters.maxDiscount >= maxPossibleDiscount ? 'Max' : `${filters.maxDiscount}%`} OFF
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Min discount</label>
            <input
              type="range"
              min={HOT_DEAL_MIN_PERCENT}
              max={maxPossibleDiscount}
              step={1}
              value={filters.minDiscount}
              onChange={e => set('minDiscount', Number(e.target.value))}
              style={{ '--val': `${((filters.minDiscount - HOT_DEAL_MIN_PERCENT) / (maxPossibleDiscount - HOT_DEAL_MIN_PERCENT)) * 100}%` } as React.CSSProperties}
              className="w-full h-1 accent-red-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 mb-1 block">Max discount</label>
            <input
              type="range"
              min={HOT_DEAL_MIN_PERCENT}
              max={maxPossibleDiscount}
              step={1}
              value={filters.maxDiscount}
              onChange={e => set('maxDiscount', Number(e.target.value))}
              style={{ '--val': `${((filters.maxDiscount - HOT_DEAL_MIN_PERCENT) / (maxPossibleDiscount - HOT_DEAL_MIN_PERCENT)) * 100}%` } as React.CSSProperties}
              className="w-full h-1 accent-red-500"
            />
          </div>
        </div>
        {/* Quick discount presets */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {[
            { label: '12%+',  min: 12, max: 100 },
            { label: '20%+',  min: 20, max: 100 },
            { label: '30%+',  min: 30, max: 100 },
            { label: '50%+',  min: 50, max: 100 },
          ].map(p => (
            <button
              key={p.label}
              onClick={() => onChange({ ...filters, minDiscount: p.min, maxDiscount: p.max })}
              className={`dc-pill px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                filters.minDiscount === p.min && filters.maxDiscount === p.max
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-red-300'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Stats strip
// ─────────────────────────────────────────────
function DealsStatsStrip({ deals }: { deals: any[] }) {
  const avgDiscount = deals.length
    ? Math.round(deals.reduce((s, p) => s + (p.discountPercent || 0), 0) / deals.length)
    : 0
  const maxDiscount = deals.length ? Math.max(...deals.map(p => p.discountPercent || 0)) : 0
  const totalSavings = deals.reduce((s, p) => s + (p.marketPrice > p.price ? p.marketPrice - p.price : 0), 0)

  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: 'Deals Live', value: deals.length.toString(), sub: 'active right now', icon: '🔥' },
        { label: 'Avg Discount', value: `${avgDiscount}%`, sub: 'off market price', icon: '📉' },
        { label: 'Max Deal',  value: `${maxDiscount}%`, sub: 'biggest saving', icon: '🏆' },
      ].map(s => (
        <div key={s.label} className="bg-white/15 border border-white/20 rounded-2xl p-3 text-center">
          <p className="text-lg font-black text-white">{s.icon} {s.value}</p>
          <p className="text-[10px] font-bold text-white/70 mt-0.5">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function DealsPage() {
  const router = useRouter()

  const [allDeals, setAllDeals]             = useState<any[]>([])
  const [loading, setLoading]               = useState(true)
  const [filters, setFilters]               = useState<Filters>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters]       = useState(false)
  const [searchInput, setSearchInput]       = useState('')
  const [visibleCount, setVisibleCount]     = useState(DEALS_PAGE_SIZE)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [renderSeed]                        = useState(() => Date.now())
  const loaderRef                           = useRef<HTMLDivElement>(null)

  // ── Inject CSS ──
  useEffect(() => {
    if (document.getElementById('batamart-deals-css')) return
    const s = document.createElement('style')
    s.id = 'batamart-deals-css'
    s.textContent = DEALS_CSS
    document.head.appendChild(s)
  }, [])

  // ── Fetch deals ──
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }

    setLoading(true)
    fetch('/api/products/feed', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const products: any[] = data.products || []
        const deals = products
          .filter(p => p.isHot)
          .sort((a, b) => {
            const priority = { BOTH: 3, DEAL: 2, VIEWS: 1 }
            const aPri = priority[a.hotReason as keyof typeof priority] || 0
            const bPri = priority[b.hotReason as keyof typeof priority] || 0
            if (bPri !== aPri) return bPri - aPri
            if (a.hotReason !== 'VIEWS' && b.hotReason !== 'VIEWS') {
              return (b.discountPercent || 0) - (a.discountPercent || 0)
            }
            return (b.viewCount || 0) - (a.viewCount || 0)
          })
        setAllDeals(deals)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  // ── Product click ──
  const handleProductClick = (id: string) => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    fetch(`/api/products/${id}/view`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    window.location.href = `/product/${id}`
  }

  // ── Filtered + shuffled deals ──
  const filteredDeals = useMemo(() => {
    const q = searchInput.trim().toLowerCase()
    let list = allDeals.filter(p => {
      if (filters.category !== 'All' && p.category !== filters.category) return false
      if (p.price < filters.minPrice || p.price > filters.maxPrice) return false
      const pct = p.discountPercent || 0
      if (pct < filters.minDiscount || pct > filters.maxDiscount) return false
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          (p.subcategory?.toLowerCase() || '').includes(q) ||
          p.seller?.name?.toLowerCase().includes(q)
        )
      }
      return true
    })
    // Shuffle randomly (seed changes only on page load, not on filter change)
    return seededShuffle(list, renderSeed)
  }, [allDeals, filters, searchInput, renderSeed])

  const visible = filteredDeals.slice(0, visibleCount)
  const hasMore = visibleCount < filteredDeals.length

  // Reset pagination on filter change
  useEffect(() => { setVisibleCount(DEALS_PAGE_SIZE) }, [filters, searchInput])

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        setLoadingMore(true)
        setTimeout(() => { setVisibleCount(c => c + DEALS_PAGE_SIZE); setLoadingMore(false) }, 500)
      }
    }, { threshold: 0.1 })
    obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore, loadingMore])

  // Active filter count
  const activeFilterCount = [
    filters.category !== 'All',
    filters.minPrice > 0,
    filters.maxPrice < 500000,
    filters.minDiscount > HOT_DEAL_MIN_PERCENT,
    filters.maxDiscount < 100,
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* ── Hero ── */}
      <div className="dc-hero">
        {/* Back nav */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors font-bold text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Marketplace
          </button>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-6 space-y-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center ring-2 ring-white/30">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Hot Deals</h1>
              <p className="text-white/70 text-sm font-medium">Campus discounts — 12% to 50%+ off</p>
            </div>
          </div>

          {/* Stats */}
          {!loading && allDeals.length > 0 && <DealsStatsStrip deals={allDeals} />}

          {/* Search */}
          <div className="flex items-center gap-2 bg-white/15 hover:bg-white/20 rounded-xl px-4 py-2.5 transition-colors ring-1 ring-white/20 focus-within:ring-white/40 focus-within:bg-white/25">
            <Search className="w-4 h-4 text-white/70 flex-shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search deals by name, category, seller…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/50 min-w-0"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="text-white/60 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 pb-28 space-y-4">

        {/* Filter toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm border transition-all ${
              showFilters || activeFilterCount > 0
                ? 'bg-red-500 text-white border-red-500 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-red-300 hover:text-red-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-red-500 text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Active filter chips */}
          {filters.category !== 'All' && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-gray-200 text-[11px] font-bold text-gray-700 shadow-sm">
              {CATEGORY_ICONS[filters.category]} {filters.category}
              <button onClick={() => setFilters(f => ({ ...f, category: 'All' }))} className="text-gray-400 hover:text-red-500 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {(filters.minPrice > 0 || filters.maxPrice < 500000) && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-gray-200 text-[11px] font-bold text-gray-700 shadow-sm">
              💰 {fmt(filters.minPrice)} — {fmt(filters.maxPrice)}
              <button onClick={() => setFilters(f => ({ ...f, minPrice: 0, maxPrice: 500000 }))} className="text-gray-400 hover:text-red-500 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {(filters.minDiscount > HOT_DEAL_MIN_PERCENT || filters.maxDiscount < 100) && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border border-gray-200 text-[11px] font-bold text-gray-700 shadow-sm">
              <Percent className="w-3 h-3 text-red-500" /> {filters.minDiscount}% — {filters.maxDiscount}% OFF
              <button onClick={() => setFilters(f => ({ ...f, minDiscount: HOT_DEAL_MIN_PERCENT, maxDiscount: 100 }))} className="text-gray-400 hover:text-red-500 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <div className="ml-auto text-[11px] text-gray-400 font-medium">
            {loading ? 'Loading…' : `${filteredDeals.length} deal${filteredDeals.length !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            allDeals={allDeals}
            onClose={() => setShowFilters(false)}
          />
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-5xl mb-4">🏷️</div>
            <p className="text-gray-700 font-black text-lg mb-1">No deals match your filters</p>
            <p className="text-gray-400 text-sm mb-5">Try adjusting the category, price or discount range</p>
            <button
              onClick={() => { setFilters(DEFAULT_FILTERS); setSearchInput('') }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm shadow-md hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" /> Clear all filters
            </button>
          </div>
        ) : (
          <>
            {/* Discount tier legend */}
            <div className="flex gap-2 flex-wrap text-[10px] font-bold">
              <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-full ring-1 ring-red-300">🔥 MEGA DEAL = 30%+ off</span>
              <span className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full ring-1 ring-orange-300">⚡ HOT DEAL = 20–29% off</span>
              <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full ring-1 ring-amber-300">🏷️ DEAL = 12–19% off</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {visible.map((p, i) => (
                <DealCard
                  key={p.id}
                  product={p}
                  onClick={() => handleProductClick(p.id)}
                  delay={i * 30}
                />
              ))}
              {loadingMore && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`skel-${i}`} />)}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={loaderRef} className="flex justify-center items-center py-8">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                  <Loader2 className="w-4 h-4 dc-spin" /> Loading more deals…
                </div>
              ) : hasMore ? (
                <div className="w-full h-4" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-300">
                  <CheckCircle className="w-5 h-5" />
                  <p className="text-xs font-semibold">You&apos;ve seen all the deals!</p>
                  <button
                    onClick={() => router.back()}
                    className="mt-2 text-xs font-bold text-red-500 hover:underline flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3 h-3" /> Back to Marketplace
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
