'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Flame, ChevronLeft, Percent, Star, BadgeCheck, Tag,
  Truck, Timer, SlidersHorizontal, X, Search, Loader2,
  CheckCircle, ShoppingBag, ChessQueen, Heart, Eye, ArrowUpDown,
  ChevronDown, Filter, LayoutGrid, Smartphone, Laptop, Shirt, Home,
  UtensilsCrossed, Dumbbell, Car, BookOpen, Ticket, Baby, Palette,
  Zap, TrendingDown, Trophy, Wallet, type LucideIcon,
} from 'lucide-react'
import { getCategoryDisplayInfo } from '@/lib/variants'
import { Badge } from '@/components/ui/Badge'

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

  .dc-shimmer {
    background: var(--color-surface);
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }

  .dc-card {
    transition: transform 0.3s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.3s ease;
    will-change: transform;
  }
  .dc-card:hover { transform: translateY(-2px); }
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

  input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; }
  input[type=range] { -webkit-appearance:none; appearance:none; background:transparent; }
  input[type=range]::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--color-primary) var(--val, 50%), var(--color-border) 0%);
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: var(--color-primary);
    cursor: pointer;
    border: 2px solid white;
    margin-top: -7px;
  }

  .no-scrollbar::-webkit-scrollbar { display:none; }
  .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }

  .dc-pill {
    transition: background 0.15s ease-out, color 0.15s ease-out, border-color 0.15s ease-out;
  }

  .dc-hero {
    background: var(--ui-slab);
  }
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
  if (pct >= 30) return { label: `${pct}% OFF`, color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/30' }
  if (pct >= 20) return { label: `${pct}% OFF`, color: 'text-warning', bg: 'bg-warning/10', ring: 'ring-warning/30' }
  return { label: `${pct}% OFF`, color: 'text-warning', bg: 'bg-warning/10', ring: 'ring-warning/30' }
}

const CATEGORIES = [
  'All', 'Electronics', 'Computing', 'Fashion', 'Home & Kitchen',
  'Food & Groceries', 'Beauty & Health', 'Sports & Fitness',
  'Vehicles & Transport', 'Books & Stationery', 'Tickets & Events',
  'Kids & Baby', 'Arts & Crafts',
]

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'All': LayoutGrid, 'Electronics': Smartphone, 'Computing': Laptop, 'Fashion': Shirt, 'Home & Kitchen': Home,
  'Food & Groceries': UtensilsCrossed, 'Beauty & Health': ChessQueen, 'Sports & Fitness': Dumbbell,
  'Vehicles & Transport': Car, 'Books & Stationery': BookOpen, 'Tickets & Events': Ticket,
  'Kids & Baby': Baby, 'Arts & Crafts': Palette,
}

// ─────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? 'fill-warning text-warning' : 'fill-border text-border'}`} strokeWidth={0} />
      ))}
      <span className="ml-1 text-[11px] tabular-nums text-ink-muted">{rating.toFixed(1)}</span>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div>
      <div className="ui-skeleton aspect-[4/5]" />
      <div className="mt-3.5 space-y-2">
        <div className="ui-skeleton h-2.5 w-1/2" />
        <div className="ui-skeleton h-3.5 w-full" />
        <div className="ui-skeleton h-3.5 w-3/4" />
        <div className="ui-skeleton mt-3 h-5 w-1/3" />
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
      className="ui-tile dc-enter group flex cursor-pointer flex-col"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Image */}
      <div className="ui-tile__media aspect-[4/5]">
        <img
          src={product.images?.[0] || '/placeholder.png'}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />

        {/* One flag, not four. The discount is the story on this page, so the
            percentage carries it and the tier words are dropped. */}
        <div className="ui-tile__flags">
          {discount > 0 ? (
            <Badge status="ink">
              <Tag className="h-2.5 w-2.5" strokeWidth={2} /> {discount}% off
            </Badge>
          ) : isHot ? (
            <Badge status="ink">
              <Flame className="h-2.5 w-2.5" strokeWidth={2} /> Hot
            </Badge>
          ) : null}
        </div>

        {product.images?.length > 1 && (
          <div className="ui-mono ui-mono-sm absolute bottom-2 right-2 bg-ink/70 px-2 py-1 text-background backdrop-blur-sm">
            {product.images.length}
          </div>
        )}

        {/* Quick look — desktop hover only, via .ui-tile__peek */}
        <div className="ui-tile__peek">
          <button
            onClick={e => { e.stopPropagation(); onClick() }}
            className="ui-mono ui-mono-sm inline-flex w-full items-center justify-center gap-1.5 bg-ink px-3 py-2 text-background"
          >
            <Eye className="h-3 w-3" strokeWidth={2} /> Quick look
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col pt-3.5">
        <p className="ui-mono ui-mono-sm line-clamp-1 text-ink-muted">
          {(() => {
            const display = getCategoryDisplayInfo(product.categoryKey, product.subcategoryKey, product.category, product.subcategory)
            return display.subcategory ? `${display.category} · ${display.subcategory}` : display.category
          })()}
        </p>
        <h3 className="mt-1.5 line-clamp-2 flex-1 text-[13px] font-medium leading-snug text-ink sm:text-sm">
          {product.name}
        </h3>

        {/* Price row */}
        <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
          <span className="ui-figure text-base text-ink">{fmt(product.price)}</span>
          {originalPrice && (
            <span className="text-[11px] text-ink-muted line-through">{fmt(originalPrice)}</span>
          )}
        </div>

        {savings > 0 && (
          <p className="mt-1 text-[11px] font-medium text-success">Save {fmt(savings)}</p>
        )}

        <div className="mt-2.5">
          <StarRating rating={product.seller?.avgRating || 0} />
        </div>

        {/* Seller row */}
        <div className="mt-3 flex min-w-0 items-center gap-1.5 border-t border-border pt-3">
          <span className="ui-mono ui-mono-sm truncate text-ink-muted">{product.seller?.name}</span>
          <BadgeCheck className="h-3 w-3 flex-shrink-0 text-primary" strokeWidth={2} />
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
    <div className="bg-card rounded-2xl border border-border shadow-soft p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span className="font-semibold text-ink text-sm">Filter Deals</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-[11px] font-semibold text-ink-muted hover:text-primary transition-colors"
          >
            Reset all
          </button>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface hover:bg-border transition-colors">
            <X className="w-3.5 h-3.5 text-ink-secondary" />
          </button>
        </div>
      </div>

      {/* Category */}
      <div>
        <p className="text-xs font-semibold text-ink-secondary mb-2">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => {
            const Icon = CATEGORY_ICONS[cat] || LayoutGrid
            return (
            <button
              key={cat}
              onClick={() => set('category', cat)}
              className={`dc-pill flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${
                filters.category === cat
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-ink-secondary border-border hover:border-primary/30 hover:text-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">{cat}</span>
              <span className="sm:hidden">{cat.split(' ')[0]}</span>
            </button>
            )
          })}
        </div>
      </div>

      {/* Price range */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-ink-secondary">Price Range</p>
          <span className="text-[11px] font-semibold text-primary">
            {fmt(filters.minPrice)} — {filters.maxPrice >= maxPossiblePrice ? 'Any' : fmt(filters.maxPrice)}
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-ink-muted mb-1 block">Min price</label>
            <input
              type="range"
              min={0}
              max={maxPossiblePrice}
              step={1000}
              value={filters.minPrice}
              onChange={e => set('minPrice', Number(e.target.value))}
              style={{ '--val': `${(filters.minPrice / maxPossiblePrice) * 100}%` } as React.CSSProperties}
              className="w-full h-1 accent-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-muted mb-1 block">Max price</label>
            <input
              type="range"
              min={0}
              max={maxPossiblePrice}
              step={1000}
              value={filters.maxPrice}
              onChange={e => set('maxPrice', Number(e.target.value))}
              style={{ '--val': `${(filters.maxPrice / maxPossiblePrice) * 100}%` } as React.CSSProperties}
              className="w-full h-1 accent-primary"
            />
          </div>
        </div>
        {/* Quick price presets */}
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {[5000, 10000, 20000, 50000, 100000].map(v => (
            <button
              key={v}
              onClick={() => onChange({ ...filters, minPrice: 0, maxPrice: v })}
              className={`dc-pill px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                filters.maxPrice === v && filters.minPrice === 0
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-ink-secondary border-border hover:border-primary/30'
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
          <p className="text-xs font-semibold text-ink-secondary">Discount Range</p>
          <span className="text-[11px] font-semibold text-primary">
            {filters.minDiscount}% — {filters.maxDiscount >= maxPossibleDiscount ? 'Max' : `${filters.maxDiscount}%`} OFF
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-ink-muted mb-1 block">Min discount</label>
            <input
              type="range"
              min={HOT_DEAL_MIN_PERCENT}
              max={maxPossibleDiscount}
              step={1}
              value={filters.minDiscount}
              onChange={e => set('minDiscount', Number(e.target.value))}
              style={{ '--val': `${((filters.minDiscount - HOT_DEAL_MIN_PERCENT) / (maxPossibleDiscount - HOT_DEAL_MIN_PERCENT)) * 100}%` } as React.CSSProperties}
              className="w-full h-1 accent-primary"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-muted mb-1 block">Max discount</label>
            <input
              type="range"
              min={HOT_DEAL_MIN_PERCENT}
              max={maxPossibleDiscount}
              step={1}
              value={filters.maxDiscount}
              onChange={e => set('maxDiscount', Number(e.target.value))}
              style={{ '--val': `${((filters.maxDiscount - HOT_DEAL_MIN_PERCENT) / (maxPossibleDiscount - HOT_DEAL_MIN_PERCENT)) * 100}%` } as React.CSSProperties}
              className="w-full h-1 accent-primary"
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
              className={`dc-pill px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                filters.minDiscount === p.min && filters.maxDiscount === p.max
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface text-ink-secondary border-border hover:border-primary/30'
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
    <div className="grid grid-cols-3 gap-px bg-white/20">
      {[
        { label: 'Deals live', value: deals.length.toString(), sub: 'right now' },
        { label: 'Avg discount', value: `${avgDiscount}%`, sub: 'off market' },
        { label: 'Max deal',  value: `${maxDiscount}%`, sub: 'biggest saving' },
      ].map(s => (
        <div key={s.label} className="bg-transparent px-3 py-4 backdrop-blur-sm">
          <p className="ui-figure text-[clamp(1.35rem,3vw,1.9rem)] leading-none text-white">{s.value}</p>
          <p className="ui-mono ui-mono-sm mt-2.5 text-white/85">{s.label}</p>
          <p className="mt-1 text-[10px] text-white/55">{s.sub}</p>
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
    if (!token) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return }

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
    if (!token) { router.push(`/login?redirect=${encodeURIComponent(`/product/${id}`)}`); return }
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
    <div className="min-h-screen bg-surface">
      {/* ── Hero ── */}
      <div className="dc-hero">
        {/* Back nav */}
        <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
          <button
            onClick={() => router.back()}
            className="group ui-mono ui-mono-sm inline-flex items-center gap-2 text-white/70 transition-colors hover:text-white"
          >
            <ChevronLeft
              className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
              strokeWidth={2}
            />
            Marketplace
          </button>
        </div>

        <div className="mx-auto max-w-7xl space-y-7 px-4 pb-8 pt-7 sm:px-6">
          {/* Title */}
          <div>
            <p className="ui-mono ui-mono-sm mb-4 flex items-center gap-2 text-white/60">
              <Flame className="h-3.5 w-3.5" strokeWidth={2} />
              Live discounts
            </p>
            <h1 className="text-[clamp(2rem,6vw,3.25rem)] font-bold leading-[0.98] tracking-[-0.04em] text-white">
              Hot deals
            </h1>
            <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-white/70">
              Campus prices cut between 12% and 50% — while the stock lasts.
            </p>
          </div>

          {/* Stats */}
          {!loading && allDeals.length > 0 && <DealsStatsStrip deals={allDeals} />}

          {/* Search */}
          <div className="flex items-center gap-2.5 border border-white/25 bg-white/10 px-4 py-3 transition-colors focus-within:border-white/50 focus-within:bg-white/15">
            <Search className="h-4 w-4 flex-shrink-0 text-white/60" strokeWidth={1.75} />
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
            data-active={showFilters || activeFilterCount > 0}
            className="ui-chip h-10"
          >
            <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ui-mono ui-mono-sm opacity-70">{activeFilterCount}</span>
            )}
          </button>

          {/* Active filter chips */}
          {filters.category !== 'All' && (
            <span className="ui-chip h-10">
              {filters.category}
              <button onClick={() => setFilters(f => ({ ...f, category: 'All' }))} className="text-ink-muted hover:text-primary ml-0.5">
                <X className="w-3 h-3" strokeWidth={1.75} />
              </button>
            </span>
          )}
          {(filters.minPrice > 0 || filters.maxPrice < 500000) && (
            <span className="ui-chip h-10">
              {fmt(filters.minPrice)} – {fmt(filters.maxPrice)}
              <button onClick={() => setFilters(f => ({ ...f, minPrice: 0, maxPrice: 500000 }))} className="text-ink-muted hover:text-primary ml-0.5">
                <X className="w-3 h-3" strokeWidth={1.75} />
              </button>
            </span>
          )}
          {(filters.minDiscount > HOT_DEAL_MIN_PERCENT || filters.maxDiscount < 100) && (
            <span className="ui-chip h-10">
              <Percent className="h-3 w-3" strokeWidth={2} /> {filters.minDiscount}–{filters.maxDiscount}%
              <button onClick={() => setFilters(f => ({ ...f, minDiscount: HOT_DEAL_MIN_PERCENT, maxDiscount: 100 }))} className="text-ink-muted hover:text-primary ml-0.5">
                <X className="w-3 h-3" strokeWidth={1.75} />
              </button>
            </span>
          )}

          <div className="ui-mono ui-mono-sm ml-auto text-ink-muted">
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-xl border border-border">
            <Tag className="w-10 h-10 text-ink-muted mx-auto mb-4" strokeWidth={1.75} />
            <p className="text-ink-secondary font-semibold text-lg mb-1">No deals match your filters</p>
            <p className="text-ink-muted text-sm mb-5">Try adjusting the category, price or discount range</p>
            <button
              onClick={() => { setFilters(DEFAULT_FILTERS); setSearchInput('') }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm shadow-soft hover:brightness-95 transition-colors"
            >
              <X className="w-4 h-4" /> Clear all filters
            </button>
          </div>
        ) : (
          <>
            {/* Discount tier legend */}
            <div className="flex gap-2 flex-wrap text-[10px] font-semibold">
              <span className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                <Flame className="w-3 h-3" strokeWidth={1.75} /> MEGA DEAL = 30%+ off
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                <Zap className="w-3 h-3" strokeWidth={1.75} /> HOT DEAL = 20-29% off
              </span>
              <span className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full">
                <Tag className="w-3 h-3" strokeWidth={1.75} /> DEAL = 12-19% off
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 md:grid-cols-4 lg:grid-cols-5">
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
                <div className="flex items-center gap-2 text-ink-muted text-sm font-medium">
                  <Loader2 className="w-4 h-4 dc-spin" /> Loading more deals…
                </div>
              ) : hasMore ? (
                <div className="w-full h-4" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-ink-muted">
                  <CheckCircle className="w-5 h-5" />
                  <p className="text-xs font-semibold">You&apos;ve seen all the deals!</p>
                  <button
                    onClick={() => router.back()}
                    className="mt-2 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
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
