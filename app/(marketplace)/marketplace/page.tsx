'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Star, Shield, ShoppingBag, Sparkles, Flame,
  TrendingUp, X, ChevronRight,
  Package, Zap, Award, Tag, Eye, Heart, Flag,
  RefreshCw, CheckCircle, Users, Truck, ChevronLeft,
  BadgeCheck, Timer, Percent, Bell, Menu,
  Grid3X3, List, Sliders, Loader2, Copy,
  Gift, Crown, Coffee, BookOpen, Cpu, Shirt, Home,
  Headphones, Camera, Watch, Dumbbell, Music, Gamepad2,
  Wifi, Battery, Monitor, Smartphone, ShoppingCart,
  TrendingDown, BarChart3, Globe, Leaf, Sun, Moon,
  Laptop, Car, Ticket, Baby, Palette, LayoutGrid, UtensilsCrossed,
  Building2, Rocket, Tablet, Footprints, BatteryCharging, GraduationCap,
  RotateCcw, Lock, Tv, type LucideIcon,
  CrownIcon, MapPin,
} from 'lucide-react'
import { isSplashPending } from '@/components/SplashScreen'
import GirlfriendsDayBanner from '@/components/marketplace/GirlfriendsDayBanner'

import { decodeProductData, getCategoryDisplayInfo, getCategoryList, matchesCategoryFilter, resolveCategoryKey } from '@/lib/variants'
import { getClientCache, setClientCache } from '@/lib/client-cache'
import Image from 'next/image'
import {
  BudgetBands,
  CategorySpotlight,
  CategoryTiles,
  FeedHeading,
  PromiseCarousel,
  SellCta,
} from '@/components/marketplace/VisualSections'
import { RevealItem } from '@/components/motion/AppMotion'

// ─────────────────────────────────────────────
// Pull-to-refresh constants
// ─────────────────────────────────────────────
const PULL_THRESHOLD = 80        // visual distance to trigger refresh
const PULL_MAX = 110             // cap how far indicator travels
const PULL_DEAD_ZONE = 8        // ignore tiny jitters
const PULL_RESIST = 0.4         // rubber-band resistance (< 1 = softer)

// ─────────────────────────────────────────────
// CSS – all animations injected once
// ─────────────────────────────────────────────
const ANIM_CSS = `
  /* ── Global scroll quality ── */
  html, body {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: none;
  }

  /* ── Animations ── */
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .card-enter {
    opacity: 0;
    animation: fadeSlideUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes sectionIn {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .section-enter {
    opacity: 0;
    animation: sectionIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  .shimmer {
    background: var(--color-surface);
    animation: pulse-shimmer 1.5s ease-in-out infinite;
  }
  @keyframes pulse-shimmer {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }

  @keyframes pulse-badge {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.85; transform: scale(1.04); }
  }
  .badge-pulse { animation: pulse-badge 2s ease-in-out infinite; }

  @keyframes ticker {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .ticker-inner { animation: ticker 28s linear infinite; }
  .ticker-wrap:hover .ticker-inner { animation-play-state: paused; }

  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 0 0   rgba(99,102,241,0); }
    50%       { box-shadow: 0 0 0 6px rgba(99,102,241,0.15); }
  }
  .glow-pulse { animation: glowPulse 3s ease-in-out infinite; }

  /* ── Product card ── */
  /* Flat card: the border darkens on hover, nothing lifts or bounces. */
  .product-card { transition: border-color 0.2s ease; }
  .product-card:hover { border-color: var(--color-ink); }
  .product-img { transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1); }
  .product-card:hover .product-img { transform: scale(1.03); }

  .quick-actions {
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .product-card:hover .quick-actions {
    opacity: 1;
    transform: translateY(0);
  }

  .btn-press { transition: transform 0.15s cubic-bezier(0.34, 1.4, 0.64, 1); }
  .btn-press:hover  { transform: scale(1.03); }
  .btn-press:active { transform: scale(0.96); }

  .cat-btn {
    transition: background 0.2s ease, color 0.2s ease,
                transform 0.2s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.2s ease;
  }
  .cat-btn:hover:not(.cat-active) { transform: scale(1.05); }
  .cat-btn:active { transform: scale(0.95); }

  .search-input { transition: box-shadow 0.25s ease, background 0.25s ease; }
  .search-input:focus-within {
    box-shadow: 0 0 0 3px rgba(99,102,241,0.25), 0 2px 8px rgba(0,0,0,0.06) !important;
    background: white !important;
  }
  .dark .marketplace-shell .search-input:focus-within {
    box-shadow: 0 0 0 3px rgba(99,102,241,0.35), 0 6px 16px rgba(2,6,23,0.45) !important;
    background: #0f1115 !important;
  }

  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .drop-in { animation: dropIn 0.18s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

  /* ── Horizontal scroll rows – smooth on iOS ── */
  .rv-card {
    transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.3s ease;
  }
  .rv-card:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 12px 28px rgba(0,0,0,0.1); }
  .rv-card:active { transform: scale(0.97); }
  .rv-card:hover .product-img { transform: scale(1.06); }

  .interest-pill {
    transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1),
                background 0.2s ease, box-shadow 0.2s ease,
                color 0.2s ease, border-color 0.2s ease;
  }
  .interest-pill:hover {
    background: var(--color-primary) !important;
    color: white !important;
    border-color: transparent !important;
  }
  .interest-pill:active { transform: scale(0.96); }

  .hot-tag {
    transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1),
                background 0.15s ease, color 0.15s ease;
  }
  .hot-tag:hover { transform: scale(1.07) translateY(-1px); }
  .hot-tag:active { transform: scale(0.95); }

  /* ── Scrollbar hiding (cross-browser) ── */
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;  /* momentum on iOS */
  }

  /* ── Horizontal scroll snap ── */
  .scroll-section {
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .scroll-section > * { scroll-snap-align: start; }

  /* ── Pull-to-refresh indicator ── */
  @keyframes ptr-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .ptr-spinning { animation: ptr-spin 0.7s linear infinite; }

  .ptr-indicator {
    transition: opacity 0.2s ease;
    pointer-events: none;
  }


  /* Design bible: gradients banned, single flat accent everywhere. */
  .section-stripe,
  .section-stripe-orange,
  .section-stripe-emerald { background: var(--color-primary); }
  .dark .marketplace-shell .section-stripe,
  .dark .marketplace-shell .section-stripe-orange,
  .dark .marketplace-shell .section-stripe-emerald { background: var(--color-primary); }

  .discount-badge {
    background: var(--color-danger);
  }

  .float-badge { }

  .promo-bar {
    background: var(--color-primary);
  }
  .dark .marketplace-shell .promo-bar {
    background: var(--color-primary);
  }

  .batamart-header {
    background: var(--color-background);
    border-bottom: 1px solid var(--color-border);
  }
  .dark .marketplace-shell .batamart-header { background: var(--color-background); border-bottom: 1px solid var(--color-border); }

  .cat-tile {
    transition: transform 0.25s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.25s ease;
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
  }
  .cat-tile:hover {
    transform: translateY(-4px) scale(1.04);
    box-shadow: 0 16px 40px rgba(0,0,0,0.12);
  }
  .cat-tile:active { transform: scale(0.97); }

  .deal-card {
    transition: transform 0.3s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.3s ease;
  }
  .deal-card:hover { transform: translateY(-5px); box-shadow: 0 20px 48px rgba(0,0,0,0.13); }
  .deal-card:active { transform: scale(0.97); }
  .deal-card:hover .product-img { transform: scale(1.07); }

  .mini-card:hover .product-img { transform: scale(1.03); }

  .section-header-line::after {
    content: '';
    display: block;
    height: 3px;
    width: 40px;
    background: var(--color-primary);
    border-radius: 2px;
    margin-top: 4px;
  }

  @keyframes spinLoader {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  .spin { animation: spinLoader 0.8s linear infinite; }

  .just-dropped-card {
    transition: transform 0.3s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.3s ease;
  }
  .just-dropped-card:hover  { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,0.1); }
  .just-dropped-card:active { transform: scale(0.97); }
  .just-dropped-card:hover .product-img { transform: scale(1.06); }
  .dark .marketplace-shell .product-card:hover,
  .dark .marketplace-shell .deal-card:hover,
  .dark .marketplace-shell .just-dropped-card:hover,
  .dark .marketplace-shell .mini-card:hover,
  .dark .marketplace-shell .stat-card:hover {
    box-shadow: 0 16px 36px rgba(2, 6, 23, 0.5);
  }

  /* ── iOS rubber-band safe area ── */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
  }

  /* ── New panel animations ── */
  @keyframes countUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .count-up { animation: countUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

  @keyframes marqueeLeft {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .marquee-track { animation: marqueeLeft 20s linear infinite; }
  .marquee-track:hover { animation-play-state: paused; }

  @keyframes livePing {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(1.5); opacity: 0.4; }
  }
  .live-ping { animation: livePing 1.4s ease-in-out infinite; }

  @keyframes floatY {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-5px); }
  }
  .float-y { animation: floatY 3s ease-in-out infinite; }


  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(30px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  .slide-in-right { animation: slideInRight 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

  .stat-card {
    transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.3s ease;
  }
  .stat-card:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 16px 40px rgba(99,102,241,0.15);
  }

  .brand-chip {
    transition: transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1),
                box-shadow 0.2s ease, background 0.2s ease;
  }
  .brand-chip:hover {
    transform: translateY(-2px) scale(1.06);
    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
  }

  .flash-card {
    transition: transform 0.15s ease-out;
  }
  .flash-card:hover {
    transform: translateY(-2px);
  }

  .dark .marketplace-shell .cat-tile,
  .dark .marketplace-shell .flash-card,
  .dark .marketplace-shell .mega-cat-card {
    filter: saturate(0.88) brightness(0.94);
  }

  @keyframes ripple {
    0%   { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(2.4); opacity: 0; }
  }
  .ripple-ring {
    animation: ripple 1.8s ease-out infinite;
  }

  .mosaic-img {
    transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .mosaic-img:hover { transform: scale(1.08); }

  @keyframes borderPulse {
    0%, 100% { border-color: rgba(99,102,241,0.3); }
    50%       { border-color: rgba(99,102,241,0.8); }
  }
  .border-pulse { animation: borderPulse 2s ease-in-out infinite; }

  .seller-card {
    transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.3s ease;
  }
  .seller-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(0,0,0,0.1);
  }

  @keyframes scanLine {
    0%   { top: 0%; }
    100% { top: 100%; }
  }
  .scan-line {
    animation: scanLine 2.5s linear infinite;
  }

  .countdown-digit {
    transition: transform 0.2s ease;
  }
  .countdown-digit:hover { transform: scale(1.1); }
`

// ─────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────
// Design bible section 6 — lucide-react icons only, no emoji. Single accent
// color everywhere, so per-category custom hex accents are dropped.
const CATEGORIES = [
  { name: 'All',                  icon: LayoutGrid },
  { name: 'Electronics',          icon: Smartphone },
  { name: 'Computing',            icon: Laptop },
  { name: 'Fashion',              icon: Shirt },
  { name: 'Home & Kitchen',       icon: Home },
  { name: 'Food & Groceries',     icon: UtensilsCrossed },
  { name: 'Beauty & Health',      icon: Crown},
  { name: 'Sports & Fitness',     icon: Dumbbell },
  { name: 'Vehicles & Transport', icon: Car },
  { name: 'Books & Stationery',   icon: BookOpen },
  { name: 'Tickets & Events',     icon: Ticket },
  { name: 'Kids & Baby',          icon: Baby },
  { name: 'Arts & Crafts',        icon: Palette },
]

const RECENT_SEARCHES_KEY  = 'BATAMART-recent-searches'
const RECENTLY_VIEWED_KEY  = 'BATAMART-recently-viewed'
const FEED_ACTIVITY_KEY = 'BATAMART-feed-activity-v1'
const FEED_CACHE_TTL_MS = 90 * 1000

const MARKETPLACE_VIEW_QUEUE_KEY = 'batamart_product_view_queue_v1'

const JUST_DROPPED_PAGE_SIZE = 12
const SESSION_ID_KEY = 'BATAMART_SESSION_ID'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmt = (p: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(p)

type TimedSignal = { value: string; timestamp: number }

function normalizeSearchHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry
      if (entry && typeof entry === 'object' && typeof (entry as { keyword?: unknown }).keyword === 'string') {
        return (entry as { keyword: string }).keyword
      }
      if (entry && typeof entry === 'object' && typeof (entry as { value?: unknown }).value === 'string') {
        return (entry as { value: string }).value
      }
      return ''
    })
    .filter(Boolean)
}

function ensureSessionId(): string {
  const existing = localStorage.getItem(SESSION_ID_KEY)
  if (existing) return existing
  const generated = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  localStorage.setItem(SESSION_ID_KEY, generated)
  return generated
}

// ─────────────────────────────────────────────
// Small UI atoms
// ─────────────────────────────────────────────
function TrustPill({ level }: { level: string }) {
  // Design bible: status color is reserved for real status, not a "rank" spectrum.
  // Every trust level renders as a neutral badge; GOLD/verified sellers additionally
  // get the primary-colored verified badge elsewhere.
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface text-ink-secondary">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-muted" /> {level}
    </span>
  )
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-semibold ring-1 ring-primary/20">
      <BadgeCheck className="w-2.5 h-2.5" /> Verified
    </span>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-warning fill-warning' : 'text-border fill-border'}`} />
      ))}
      <span className="text-xs font-semibold text-ink-secondary ml-0.5">{rating.toFixed(1)}</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Product Card
// ─────────────────────────────────────────────
function ProductCard({ product, onClick, delay = 0 }: {
  product: any; onClick: () => void; delay?: number
}) {
  // Real discount from the market price check (stored in DB), never computed.
  const discount     = (product.isDeal && product.discountPercent) ? product.discountPercent : 0
  const stockLeft    = Number.isFinite(Number(product.quantity)) && product.quantity > 0 && product.quantity <= 3 ? Number(product.quantity) : null
  const deliveryTag  = product.deliveryEstimate || null
  const originalPrice = (product.isDeal && product.marketPrice && product.marketPrice > product.price)
    ? Math.round(product.marketPrice)
    : null

  // One label at most: the strongest true thing about this listing.
  const label =
    discount > 0 ? `-${discount}%`
    : product.isTrending ? 'Hot'
    : product.isNew ? 'New'
    : null

  const display = getCategoryDisplayInfo(product.categoryKey, product.subcategoryKey, product.category, product.subcategory)

  return (
    <div
      onClick={onClick}
      className="product-card card-enter bg-card overflow-hidden border border-border cursor-pointer flex flex-col group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative aspect-square bg-surface overflow-hidden">
        <img src={product.images[0] || '/placeholder.png'} alt={product.name} className="product-img w-full h-full object-cover" />
        {label && (
          <span className="absolute left-0 top-0 bg-ink px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-background">
            {label}
          </span>
        )}
      </div>

      <div className="p-2.5 sm:p-3 flex flex-col flex-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted mb-1 truncate">
          {display.subcategory ? `${display.category} · ${display.subcategory}` : display.category}
        </p>
        <h3 className="font-medium text-ink line-clamp-2 text-xs sm:text-sm leading-snug flex-1">{product.name}</h3>

        <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
          <span className="text-ink font-semibold text-sm sm:text-base tracking-tight">{fmt(product.price)}</span>
          {originalPrice && <span className="text-ink-muted text-[11px] line-through">{fmt(originalPrice)}</span>}
        </div>

        <p className="mt-1.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
          {[
            deliveryTag ? `Ready ${deliveryTag}` : null,
            product.landmark || null,
            stockLeft ? `${stockLeft} left` : null,
          ].filter(Boolean).join(' · ')}
        </p>

        <div className="mt-2 border-t border-border pt-2">
          <Link
            href={`/seller/${product.seller?.id}`}
            className="block truncate text-[11px] text-ink-secondary hover:text-ink transition-colors"
            onClick={e => e.stopPropagation()}
          >
            {product.seller?.name}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Mini Product Card (recently viewed)
// ─────────────────────────────────────────────
function MiniProductCard({ product, onClick }: { product: any; onClick: () => void }) {
  return (
    <div onClick={onClick} className="mini-card cursor-pointer group">
      <div className="aspect-square overflow-hidden bg-surface mb-2">
        <img src={product.images[0] || '/placeholder.png'} alt={product.name} className="product-img w-full h-full object-cover" />
      </div>
      <p className="text-xs font-semibold text-ink line-clamp-2 leading-snug">{product.name}</p>
      <p className="text-xs font-semibold text-ink mt-0.5">{fmt(product.price)}</p>
    </div>
  )
}

function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div className="card-enter bg-card overflow-hidden border border-border" style={{ animationDelay: `${delay}ms` }}>
      <div className="aspect-square shimmer" />
      <div className="p-3 space-y-2">
        <div className="h-2.5 shimmer w-1/2" />
        <div className="h-3.5 shimmer w-full" />
        <div className="h-3.5 shimmer w-3/4" />
        <div className="h-5 shimmer w-1/3 mt-3" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Trust strip — flat, static, no urgency/emoji (design bible section 1 + 2)
// ─────────────────────────────────────────────
function PromoTicker() {
  const items = ['Secure payments', 'Verified campus sellers', 'Fast delivery', 'Buyer protection']
  return (
    <div className="overflow-hidden border-b border-border bg-card py-2.5">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4">
        {items.map((item, i) => (
          <span key={item} className="flex items-center gap-3">
            {i > 0 && <span aria-hidden className="h-2.5 w-px bg-border" />}
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
              {item}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Seeded shuffle — different order every render, consistent within a render
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// Price-Range Deal Panels (Amazon "Shop X for less" style)
// ─────────────────────────────────────────────
// ── Brand/search chips for the brand spotlight row ─────────────────────────
const BRAND_CHIPS = [
  { label: 'iPhone',      icon: Smartphone, cat: 'Electronics' },
  { label: 'Samsung',     icon: Tv, cat: 'Electronics' },
  { label: 'Sneakers',    icon: Footprints, cat: 'Fashion' },
  { label: 'Laptops',     icon: Laptop, cat: 'Computing' },
  { label: 'Power banks', icon: BatteryCharging, cat: 'Electronics' },
  { label: 'Earbuds',     icon: Headphones, cat: 'Electronics' },
  { label: 'Skincare',    icon: CrownIcon, cat: 'Beauty & Health' },
  { label: 'Textbooks',   icon: BookOpen, cat: 'Books & Stationery' },
  { label: 'Wigs',        icon: CrownIcon, cat: 'Beauty & Health' },
  { label: 'Watches',     icon: Watch, cat: 'Fashion' },
  { label: 'Gaming',      icon: Gamepad2, cat: 'Electronics' },
  { label: 'Food',        icon: UtensilsCrossed, cat: 'Food & Groceries' },
]

// ── Why BataMart trust points ──────────────────────────────────────────────
const TRUST_POINTS = [
  { icon: Lock, title: 'Escrow protected',   desc: 'Money held safely until you confirm delivery' },
  { icon: GraduationCap, title: 'Campus verified',     desc: 'Only students from your university can sell' },
  { icon: Zap, title: 'Fast campus delivery', desc: 'Delivered to your hostel door' },
  { icon: Shield, title: 'Dispute protection', desc: 'Open and track order disputes from your dashboard' },
  { icon: Star, title: 'Ratings & reviews',   desc: 'Buy from trusted, rated sellers only' },
  { icon: RotateCcw, title: 'Easy disputes',       desc: 'Raise an issue, get it resolved fast' },
  { icon: Gift, title: 'Referral rewards', desc: 'Invite friends and earn rewards when they join and buy' },
  { icon: Package, title: 'Order tracking', desc: 'Track order status from confirmation to delivery' },
  { icon: Bell, title: 'Smart notifications', desc: 'Get updates on orders, referrals, and account activity' },
]

// ── Study essentials quick links ────────────────────────────────────────────
// Each carries its own photograph. As eight line icons in a hairline grid
// these read as a settings screen: identical cells you had to finish reading
// before you knew what any of them was. A photo of a lab bench names "lab
// coats" before the caption does.
const STUDY_LINKS = [
  { label: 'Past questions',  query: 'past questions', image: '/images/marketing/study-notes.webp' },
  { label: 'Textbooks',       query: 'textbook',       image: '/images/marketing/study-textbooks.webp' },
  { label: 'Calculators',     query: 'calculator',     image: '/images/marketing/study-calculator.webp' },
  { label: 'Drawing tools',   query: 'drawing',        image: '/images/marketing/study-drafting.webp' },
  { label: 'Lab coats',       query: 'lab coat',       image: '/images/marketing/study-lab.webp' },
  { label: 'Flash drives',    query: 'flash drive',    image: '/images/marketing/study-drive.webp' },
  { label: 'Extension boxes', query: 'extension',      image: '/images/marketing/study-power.webp' },
  { label: 'Stationery',      query: 'stationery',     image: '/images/marketing/study-stationery.webp' },
]

// ── Category mega grid — flat, single accent (design bible: no gradients, no per-item color variety) ──
const MEGA_CATEGORIES: { name: string; icon: LucideIcon; count: string }[] = [
  { name: 'Electronics',          icon: Smartphone, count: '450+' },
  { name: 'Computing',            icon: Laptop, count: '210+' },
  { name: 'Fashion',              icon: Shirt, count: '380+' },
  { name: 'Home & Kitchen',       icon: Home, count: '240+' },
  { name: 'Food & Groceries',     icon: UtensilsCrossed, count: '320+' },
  { name: 'Beauty & Health',      icon: CrownIcon, count: '290+' },
  { name: 'Sports & Fitness',     icon: Dumbbell, count: '180+' },
  { name: 'Vehicles & Transport', icon: Car, count: '70+' },
  { name: 'Books & Stationery',   icon: BookOpen, count: '150+' },
  { name: 'Tickets & Events',     icon: Ticket, count: '90+' },
  { name: 'Kids & Baby',          icon: Baby, count: '130+' },
  { name: 'Arts & Crafts',        icon: Palette, count: '120+' },
]

// ─────────────────────────────────────────────
// Shop by budget: four large tiles, one real listing photo each
// ─────────────────────────────────────────────
const BUDGET_TIERS = [5000, 10000, 20000, 50000]

function BudgetShelf({ allProducts, onSelect, renderSeed }: {
  allProducts: any[]
  onSelect: (maxPrice: number) => void
  renderSeed: number
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px border border-border bg-border">
      {BUDGET_TIERS.map(max => {
        const inTier = allProducts.filter((p: any) => p.price <= max && p.images?.[0])
        const pick = seededShuffle(inTier, renderSeed + max)[0]
        return (
          <button
            key={max}
            onClick={() => onSelect(max)}
            className="group bg-card text-left"
          >
            <div className="aspect-[4/3] overflow-hidden bg-surface">
              {pick && (
                <img src={pick.images[0]} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              )}
            </div>
            <div className="flex items-baseline justify-between px-3 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">Under ₦{max / 1000}k</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">{inTier.length} items</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// Best Sellers Row
// ─────────────────────────────────────────────
function BestSellersRow({ products, onProductClick, onSeeAll, title, subtitle }: {
  products: any[]; onProductClick: (id: string) => void;
  onSeeAll?: () => void; title: string; subtitle?: string
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const scrollBy = (dir: number) => rowRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' })

  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="flex items-end justify-between px-5 pt-5 pb-3 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-ink section-header-line">{title}</h2>
          {subtitle && <p className="text-xs text-ink-muted font-medium mt-1">{subtitle}</p>}
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline">
            See all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="relative group/row px-5 py-4">
        <button onClick={() => scrollBy(-1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-card border border-border items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-primary hover:text-white hover:border-primary">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div ref={rowRef} className="flex gap-4 overflow-x-auto no-scrollbar scroll-section">
          {products.map(p => (
            <div key={p.id} onClick={() => onProductClick(p.id)} className="deal-card flex-shrink-0 w-36 sm:w-44 cursor-pointer group/card">
              <div className="aspect-square overflow-hidden bg-surface mb-2.5">
                <img src={p.images[0] || '/placeholder.png'} alt={p.name} className="product-img w-full h-full object-cover" />
              </div>
              <p className="text-xs font-semibold text-ink line-clamp-2 leading-snug">{p.name}</p>
              <p className="text-xs font-semibold text-ink mt-1">{fmt(p.price)}</p>
            </div>
          ))}
        </div>
        <button onClick={() => scrollBy(1)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-card border border-border items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-primary hover:text-white hover:border-primary">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Deals Section
// ─────────────────────────────────────────────
function DealsSection({ products, onProductClick, onSeeAll, sectionClass, icon, title, subtitle, badge }: {
  products: any[]; onProductClick: (id: string) => void; onSeeAll?: () => void;
  sectionClass: string; icon: React.ReactNode; title: string; subtitle: string; badge?: string
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const scrollBy = (dir: number) => rowRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })
  return (
    <div className="overflow-hidden border border-border">
      <div className={`${sectionClass} px-5 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {icon}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">{title}</h2>
                {badge && <span className="badge-pulse bg-white/20 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">{badge}</span>}
              </div>
              <p className="text-white/70 text-[11px] mt-0.5">{subtitle}</p>
            </div>
          </div>
          {onSeeAll && (
            <button onClick={onSeeAll} className="text-white/80 text-xs font-semibold flex items-center gap-1">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="bg-card px-5 py-4 relative group/row">
        <button onClick={() => scrollBy(-1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-card border border-border items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div ref={rowRef} className="flex gap-3 overflow-x-auto no-scrollbar scroll-section">
          {products.map((p, i) => (
            <div key={p.id} className="flex-shrink-0 w-40 sm:w-44">
              <ProductCard product={p} onClick={() => onProductClick(p.id)} delay={i * 40} />
            </div>
          ))}
        </div>
        <button onClick={() => scrollBy(1)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-card border border-border items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Pull-to-Refresh Indicator
// ─────────────────────────────────────────────
function PullIndicator({ pullDistance, isRefreshing }: { pullDistance: number; isRefreshing: boolean }) {
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1)
  const ready    = pullDistance >= PULL_THRESHOLD
  return (
    <div
      className="ptr-indicator fixed top-0 left-0 right-0 z-50 flex justify-center"
      style={{
        transform: `translateY(${Math.min(pullDistance, PULL_MAX) - 60}px)`,
        transition: isRefreshing || pullDistance === 0
          ? 'transform 0.35s cubic-bezier(0.22,1,0.36,1)'
          : 'none',
        opacity: isRefreshing ? 1 : progress,
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-card shadow-soft border border-border"
        style={{ transform: `scale(${0.85 + progress * 0.15})` }}
      >
        <RefreshCw
          className={`w-4 h-4 text-primary ${isRefreshing ? 'ptr-spinning' : ''}`}
          style={{ transform: isRefreshing ? undefined : `rotate(${progress * 220}deg)` }}
        />
        <span className="text-xs font-semibold text-ink-secondary">
          {isRefreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Live Stats Bar
// ─────────────────────────────────────────────
function LiveStatsBar({ count }: { count: number }) {
  if (!count) return null
  return (
    <div className="flex items-center gap-3 flex-wrap text-[11px] text-ink-secondary font-medium">
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-success rounded-full inline-block" />
        <span className="font-semibold text-ink-secondary">{count}</span> products live
      </span>
      <span className="w-px h-3 bg-border" />
      <span className="flex items-center gap-1">
        <Users className="w-3 h-3 text-primary" strokeWidth={1.75} />
        Students buying now
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Just Dropped Section (infinite vertical scroll)
// ─────────────────────────────────────────────
function JustDroppedSection({ allProducts, onProductClick }: {
  allProducts: any[]; onProductClick: (id: string) => void
}) {
  const [search, setSearch]           = useState('')
  const [visibleCount, setVisibleCount] = useState(JUST_DROPPED_PAGE_SIZE)
  const [loadingMore, setLoadingMore]  = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  const allNew = useMemo(() => allProducts.filter(p => p.isNew), [allProducts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allNew
    return allNew.filter(p => {
      const { variants, tags } = decodeProductData(p.description || '')
      const variantValues = Object.values(variants).flat() as string[]
      return (
        p.name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        (p.subcategory?.toLowerCase() || '').includes(q) ||
        p.seller?.name?.toLowerCase().includes(q) ||
        tags.some((t: string) => t.toLowerCase().includes(q)) ||
        variantValues.some((v: string) => v.toLowerCase().includes(q))
      )
    })
  }, [allNew, search])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  useEffect(() => {
    if (!loaderRef.current) return
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setLoadingMore(true)
          setTimeout(() => {
            setVisibleCount(c => c + JUST_DROPPED_PAGE_SIZE)
            setLoadingMore(false)
          }, 600)
        }
      },
      { threshold: 0.1 }
    )
    obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore, loadingMore])

  useEffect(() => { setVisibleCount(JUST_DROPPED_PAGE_SIZE) }, [search])

  if (allNew.length === 0) return null

  return (
    <div className="overflow-hidden border border-border">
      <div className="section-stripe-emerald px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <CrownIcon className="w-5 h-5 text-white" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Just Dropped</h2>
                <span className="badge-pulse bg-white/20 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">NEW</span>
              </div>
              <p className="text-white/70 text-[11px] mt-0.5">Fresh listings — keep scrolling, more loads as you go</p>
            </div>
          </div>
          <span className="text-white/60 text-[11px] font-semibold">{filtered.length} items</span>
        </div>
        <div className="flex items-center gap-2 bg-white/15 hover:bg-white/20 rounded-xl px-3 py-2.5 transition-colors ring-1 ring-white/20 focus-within:ring-white/40 focus-within:bg-white/25">
          <Search className="w-4 h-4 text-white/70 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search just dropped listings…"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/50 min-w-0"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-white/60 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-card p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <CrownIcon className="w-10 h-10 text-border mx-auto mb-3" />
            <p className="text-ink-muted font-semibold text-sm">No results for &ldquo;{search}&rdquo;</p>
            <button onClick={() => setSearch('')} className="text-primary text-xs font-semibold mt-2 hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
              {visible.map((p, i) => (
                <ProductCard key={p.id} product={p} onClick={() => onProductClick(p.id)} delay={i * 25} />
              ))}
              {loadingMore && Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={`skel-${i}`} delay={i * 60} />
              ))}
            </div>
            <div ref={loaderRef} className="flex justify-center items-center py-8 mt-2">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-ink-muted text-sm font-medium">
                  <Loader2 className="w-4 h-4 spin" /> Loading more…
                </div>
              ) : hasMore ? (
                <div className="w-full h-4" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-ink-muted">
                  <CheckCircle className="w-5 h-5" />
                  <p className="text-xs font-semibold">You&apos;ve seen them all!</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// ══ MAIN PAGE ══
// ─────────────────────────────────────────────
// ── Stats Banner ──────────────────────────────────────────────────────────────
// Figures lead, labels follow. The icons are gone: four blue glyphs repeated
// across a row add no information and pull the eye off the numbers, which are
// the only reason this strip exists.
// ── Brand / Search Spotlight ──────────────────────────────────────────────────
function BrandSpotlight({ onSearch, onCategorySelect }: {
  onSearch: (q: string) => void
  onCategorySelect: (cat: string) => void
}) {
  return (
    <section>
      <p className="ui-eyebrow mb-4">
        <TrendingUp className="w-3.5 h-3.5" strokeWidth={2} />
        Trending on campus
      </p>
      {/* A rail rather than a wrapping block: on a phone these scroll, and on
          a desktop they still read as a single line of options. */}
      <div className="ui-rail">
        {BRAND_CHIPS.map((chip) => (
          <button key={chip.label} onClick={() => onCategorySelect(chip.cat)} className="ui-chip">
            <chip.icon className="w-4 h-4" strokeWidth={1.75} /> {chip.label}
          </button>
        ))}
      </div>
    </section>
  )
}

// ── Study Essentials Quick Links ─────────────────────────────────────────────
function StudyEssentials({ onSearch }: { onSearch: (q: string) => void }) {
  return (
    <section>
      <FeedHeading
        eyebrow="Study essentials"
        title="Everything for"
        accent="lectures & exams."
      />
      <div className="ui-rail -mx-1 px-1 pb-1">
        {STUDY_LINKS.map((link, i) => (
          <RevealItem key={link.label} index={i}>
            <button
              onClick={() => onSearch(link.query)}
              className="group relative block h-[132px] w-[118px] overflow-hidden rounded-lg text-left sm:w-[140px]"
            >
              <Image
                src={link.image}
                alt=""
                fill
                sizes="140px"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.88),rgba(0,0,0,0.15)_58%,transparent)]"
              />
              <span className="absolute inset-x-2.5 bottom-2.5 text-[12.5px] font-semibold leading-tight text-white">
                {link.label}
              </span>
            </button>
          </RevealItem>
        ))}
      </div>
    </section>
  )
}

// ── Mega Category Grid ────────────────────────────────────────────────────────
function MegaCategoryGrid({ onCategorySelect }: { onCategorySelect: (cat: string) => void }) {
  // Photographic tiles. Twelve identical tinted squares each holding a line
  // icon told the reader nothing until they read every label — a photograph
  // names the aisle before the word does, and it is the difference between a
  // shop and a settings screen.
  void onCategorySelect
  return <CategoryTiles categories={MEGA_CATEGORIES.map((c) => c.name.split(' /')[0])} />
}


// ── Why BataMart Trust Banner ─────────────────────────────────────────────────
function TrustBanner() {
  return (
    // A full-bleed dark band, so it uses `slab` rather than `ink`: `bg-ink`
    // inverts to cream in dark mode and would take this white-on-dark text
    // with it.
    <section className="border-y border-border bg-slab px-5 py-8 text-slab-fg sm:py-10">
      <p className="ui-eyebrow mb-6 !text-slab-fg/45">
        <Shield className="h-3.5 w-3.5" strokeWidth={2} />
        Why students trust BataMart
      </p>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
        {TRUST_POINTS.map((point) => (
          <div key={point.title} className="flex items-start gap-3.5">
            <point.icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-slab-fg">{point.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slab-fg/55">{point.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Mosaic Row (large visual product image grid) ─────────────────────────────
function MosaicRow({ products, onProductClick, title, subtitle, sectionClass }: {
  products: any[]
  onProductClick: (id: string) => void
  title: string
  subtitle: string
  sectionClass: string
}) {
  const picks = products.slice(0, 7)
  if (picks.length < 3) return null

  return (
    <div className="overflow-hidden border border-border">
      <div className={`${sectionClass} px-5 py-4`}>
        <h2 className="text-base font-semibold text-background">{title}</h2>
        <p className="text-white/70 text-[11px] mt-0.5">{subtitle}</p>
      </div>
      <div className="bg-card p-3">
        <div className="grid grid-cols-4 grid-rows-2 gap-2" style={{ height: 280 }}>
          {/* Big left tile */}
          <div
            className="col-span-2 row-span-2 rounded-xl overflow-hidden cursor-pointer relative group"
            onClick={() => picks[0] && onProductClick(picks[0].id)}
          >
            <img
              src={picks[0]?.images[0] || '/placeholder.png'}
              alt={picks[0]?.name}
              className="mosaic-img w-full h-full object-cover"
            />
            {picks[0] && (
              <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <div>
                  <p className="text-background text-xs font-medium line-clamp-1">{picks[0].name}</p>
                  <p className="text-white/80 text-[10px] font-medium">₦{picks[0].price?.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
          {/* 4 small tiles */}
          {picks.slice(1, 5).map((p, i) => (
            <div
              key={p.id}
              className="rounded-xl overflow-hidden cursor-pointer relative group"
              onClick={() => onProductClick(p.id)}
            >
              <img
                src={p.images[0] || '/placeholder.png'}
                alt={p.name}
                className="mosaic-img w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </div>
          ))}
        </div>
        {picks[5] && (
          <div className="flex gap-2 mt-2">
            {picks.slice(5, 7).map(p => (
              <div
                key={p.id}
                className="flex-1 h-16 rounded-xl overflow-hidden cursor-pointer relative group"
                onClick={() => onProductClick(p.id)}
              >
                <img src={p.images[0] || '/placeholder.png'} alt={p.name} className="mosaic-img w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Top Sellers Row ───────────────────────────────────────────────────────────
function TopSellersRow({ products, onProductClick }: {
  products: any[]
  onProductClick: (id: string) => void
}) {
  // Group by seller, pick top 8 by product count
  const sellerMap = new Map<string, { seller: any; products: any[]; count: number }>()
  for (const p of products) {
    if (!p.seller) continue
    const key = p.seller.id
    if (!sellerMap.has(key)) sellerMap.set(key, { seller: p.seller, products: [], count: 0 })
    const entry = sellerMap.get(key)!
    entry.products.push(p)
    entry.count++
  }
  const topSellers = [...sellerMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  if (topSellers.length === 0) return null

  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="flex items-end justify-between px-5 pt-5 pb-3 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-ink section-header-line">Top campus sellers</h2>
          <p className="text-xs text-ink-muted font-medium mt-1">Most active sellers on campus right now</p>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
          {topSellers.map(({ seller, products: sellerProds, count }, i) => (
            <div
              key={seller.id}
              className="seller-card card-enter flex-shrink-0 w-28 cursor-pointer text-center"
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => sellerProds[0] && onProductClick(sellerProds[0].id)}
            >
              {/* Avatar */}
              <div className="relative mx-auto mb-2 w-16 h-16">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-primary/10 border border-border">
                  {seller.profilePhoto ? (
                    <img src={seller.profilePhoto} alt={seller.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-primary">
                      {seller.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                {seller.trustLevel === 'GOLD' && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-warning rounded-full flex items-center justify-center">
                    <Crown className="w-3 h-3 text-white" strokeWidth={1.75} />
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-ink line-clamp-1">{seller.name}</p>
              <p className="text-[10px] text-primary font-semibold">{count} listing{count !== 1 ? 's' : ''}</p>
              {seller.avgRating > 0 && (
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <Star className="w-2.5 h-2.5 text-warning fill-warning" />
                  <span className="text-[10px] text-ink-secondary font-semibold">{seller.avgRating.toFixed(1)}</span>
                </div>
              )}
              {/* Mini product previews */}
              <div className="flex gap-1 mt-2 justify-center">
                {sellerProds.slice(0, 2).map(p => (
                  <div key={p.id} className="w-9 h-9 rounded-lg overflow-hidden bg-surface">
                    <img src={p.images[0] || '/placeholder.png'} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Flash Sale Countdown ──────────────────────────────────────────────────────
function FlashSaleCountdown({ products, onProductClick }: {
  products: any[]
  onProductClick: (id: string) => void
}) {
  const picks = products.slice(0, 6)
  if (picks.length === 0) return null

  return (
    <div>
      {/* Design bible bans countdown-timer urgency tactics, so this stays a
          calm section header rather than a ticking clock. */}
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="ui-eyebrow mb-2.5">
            <Zap className="h-3.5 w-3.5" strokeWidth={2} />
            Flash picks today
          </p>
          <h2 className="text-[clamp(1.15rem,2.2vw,1.6rem)] text-ink">A rotating selection of deals</h2>
        </div>
      </div>
      <div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {picks.map((p) => (
            <div
              key={p.id}
              className="flash-card flex-shrink-0 w-36 cursor-pointer"
              onClick={() => onProductClick(p.id)}
            >
              <div className="ui-tile__media relative mb-3 aspect-[4/5] overflow-hidden">
                <img src={p.images[0] || '/placeholder.png'} alt={p.name} className="h-full w-full object-cover" />
                {p.discountPercent && (
                  <span className="absolute left-2 top-2 bg-ink px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-background">
                    -{p.discountPercent}%
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-ink line-clamp-2 leading-tight">{p.name}</p>
              <p className="text-sm font-semibold text-ink mt-1">₦{p.price?.toLocaleString()}</p>
              {p.marketPrice && p.marketPrice > p.price && (
                <p className="text-[10px] text-ink-muted line-through">₦{Math.round(p.marketPrice).toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Live Activity strip — low-key, high-contrast text (design bible section 10) ──
function LiveActivityMarquee({ products }: { products: any[] }) {
  const recent = products.slice(0, 3)
  if (recent.length === 0) return null

  return (
    <div className="bg-surface border border-border rounded-xl py-2.5 px-4">
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-ink-secondary">
        <span className="inline-flex items-center gap-1.5 font-medium text-ink flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Just listed
        </span>
        {recent.map((p, i) => (
          <span key={p.id} className="flex-shrink-0">
            {p.seller?.name || 'A student'} listed &ldquo;{p.name}&rdquo; for ₦{p.price?.toLocaleString()}
            {i < recent.length - 1 && <span className="mx-2 text-ink-muted">·</span>}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const isApp = searchParams.get('app') === 'true' ||
    (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches)

  // Starts true so the first client render matches the server's.
  //
  // This used to call isSplashPending() in the initializer, which reads
  // window.matchMedia — false on the server, true inside an installed PWA. The
  // mismatch made React throw out the hydrated tree in standalone mode only.
  // Nothing flashes by deferring: html.splash-pending hides the page
  // synchronously, before hydration, and the effect below re-gates on mount.
  const [splashDone, setSplashDone] = useState<boolean>(true)

  const [allProducts,       setAllProducts]       = useState<any[]>([])
  const [loading,           setLoading]           = useState(true)
  const [selectedCategory,  setSelectedCategory]  = useState('All')
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null)
  const [viewMode,          setViewMode]          = useState<'feed' | 'grid'>('feed')
  const [recentlyViewed,    setRecentlyViewed]    = useState<any[]>([])
  const [interestCategories,setInterestCategories]= useState<string[]>([])
  const [mounted,           setMounted]           = useState(false)
  const [universityShortName, setUniversityShortName] = useState<string>('')
  const [universityId, setUniversityId] = useState<string>('')
  const [peopleLikeYouBought, setPeopleLikeYouBought] = useState<any[]>([])
  const [renderSeed,          setRenderSeed]          = useState(() => Date.now())
  const [maxPriceFilter,      setMaxPriceFilter]      = useState<number | null>(null)
  const [sortMode,            setSortMode]            = useState<'relevance' | 'price_asc' | 'price_desc' | 'newest'>('relevance')
  const [selectedZone,        setSelectedZone]        = useState<string>('')
  const [availableZones,      setAvailableZones]      = useState<string[]>([])

  // ── Referral popup — shows once per app session, only on first marketplace visit ──
  const [showReferralPopup, setShowReferralPopup] = useState(false)
  const [referralCode, setReferralCode]           = useState('')
  const [referralLink, setReferralLink]           = useState('')
  const [referralCopied, setReferralCopied]       = useState(false)

  // Pull-to-refresh state
  const [pullDistance,  setPullDistance]  = useState(0)
  const [isRefreshing,  setIsRefreshing]  = useState(false)

  // Pull-to-refresh touch tracking (refs avoid stale closure issues)
  const ptrStartY     = useRef(0)
  const ptrDelta      = useRef(0)
  const ptrActive     = useRef(false)
  const ptrLocked     = useRef(false)   // locked = decided this is a vertical pull gesture

  // ── Splash ──
  useEffect(() => {
    if (!isSplashPending()) return
    setSplashDone(false)
    const handler = () => setSplashDone(true)
    window.addEventListener('batamart:splash-done', handler)
    // SplashScreen dispatches at 3s; this only covers it never getting there.
    const fallback = setTimeout(() => setSplashDone(true), 4000)
    return () => { window.removeEventListener('batamart:splash-done', handler); clearTimeout(fallback) }
  }, [])

  // ── Inject CSS ──
  useEffect(() => {
    if (document.getElementById('BATAMART-anim')) return
    const s = document.createElement('style')
    s.id = 'BATAMART-anim'
    s.textContent = ANIM_CSS
    document.head.appendChild(s)
  }, [])

  // ── Init ──
  useEffect(() => {
    setMounted(true)
    try { setRecentlyViewed(JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]')) } catch {}

    fetchPeopleLikeYouBought()
    const token = localStorage.getItem('token')
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          const userUniversityId = d.user?.universityId || ''
          if (d.user?.university?.shortName) setUniversityShortName(d.user.university.shortName)
          if (userUniversityId) setUniversityId(userUniversityId)
          return fetchFeed(userUniversityId)
        })
        .catch(() => fetchFeed())
    } else {
      fetchFeed()
    }
  }, [])

  // ── Referral Popup — once per session, only on first marketplace render ──
  // sessionStorage resets on tab/app close, so popup shows again next open.
  // If user navigates away and comes back within same session, it won't re-show.
  useEffect(() => {
    if (!mounted) return
    const KEY = 'batamart_referral_popup_shown'
    if (sessionStorage.getItem(KEY)) return
    sessionStorage.setItem(KEY, '1')

    const token = localStorage.getItem('token')
    if (!token) return

    fetch('/api/referrals', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        setReferralCode(data.referralCode || '')
        setReferralLink(data.referralLink || '')
        setTimeout(() => setShowReferralPopup(true), 1200)
      })
      .catch(() => {})
  }, [mounted])

  // ── Category change ──
  useEffect(() => {
    if (!mounted) return
    if (selectedCategory === 'All' && !universityId) return
    if (selectedCategory === 'All') { setMaxPriceFilter(null); fetchFeed() } else { fetchByCategory(selectedCategory) }
  }, [selectedCategory, mounted, universityId])

  // ── Delivery zones for the location filter — same picklist used at signup/sell ──
  useEffect(() => {
    if (!universityId) return
    fetch('/api/universities')
      .then(r => r.json())
      .then(d => {
        const uni = (d.universities || []).find((u: any) => u.id === universityId)
        const areas = Array.isArray(uni?.deliveryAreas) ? uni.deliveryAreas : []
        setAvailableZones(areas)
      })
      .catch(() => {})
  }, [universityId])

  // ── Filter recently viewed to remove suspended/deleted products ──
  useEffect(() => {
    if (allProducts.length === 0 || recentlyViewed.length === 0) return
    const productIds = new Set(allProducts.map(p => p.id))
    const filtered = recentlyViewed.filter(p => productIds.has(p.id))
    if (filtered.length !== recentlyViewed.length) {
      setRecentlyViewed(filtered)
      try { localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(filtered)) } catch {}
    }
  }, [allProducts])

  // ─────────────────────────────────────────────
  // Pull-to-Refresh — iOS-safe implementation
  //
  // KEY RULES:
  //   1. Never call preventDefault() on touchmove — that kills iOS momentum.
  //   2. Only show the PTR indicator; let the page scroll freely underneath.
  //   3. Track touch deltas with refs (not state) to avoid re-renders mid-gesture.
  //   4. Only trigger refresh when the user releases at the top of the page.
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (isRefreshing) return   // don't re-attach during active refresh

    function onTouchStart(e: TouchEvent) {
      ptrStartY.current  = e.touches[0].clientY
      ptrDelta.current   = 0
      ptrActive.current  = false
      ptrLocked.current  = false
    }

    function onTouchMove(e: TouchEvent) {
      // Only consider PTR when page is scrolled to the very top
      if (window.scrollY > 0) {
        ptrStartY.current = 0
        ptrActive.current = false
        return
      }

      const delta = e.touches[0].clientY - ptrStartY.current
      if (delta <= 0) return            // scrolling up — ignore
      if (delta < PULL_DEAD_ZONE) return // tiny jitter — ignore

      // First time we cross the dead zone, decide this is a downward pull
      if (!ptrLocked.current) {
        ptrLocked.current = true
        ptrActive.current = true
      }

      ptrDelta.current = delta
      // Rubber-band: visual distance grows slower than finger travel
      const visual = Math.min(delta * PULL_RESIST, PULL_MAX)
      setPullDistance(visual)
      // NOTE: We do NOT call e.preventDefault() here.
      //       iOS will handle the native overscroll; we just overlay our indicator.
    }

    async function onTouchEnd() {
      if (!ptrActive.current) return

      const triggered = ptrDelta.current * PULL_RESIST >= PULL_THRESHOLD
      ptrActive.current  = false
      ptrLocked.current  = false
      ptrStartY.current  = 0

      if (triggered) {
        setIsRefreshing(true)
        setPullDistance(PULL_THRESHOLD)
        await fetchFeed()
        setIsRefreshing(false)
      }
      // Animate indicator back to hidden
      setPullDistance(0)
    }

    // All listeners passive — never block iOS touch handling
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove',  onTouchMove,  { passive: true })
    document.addEventListener('touchend',   onTouchEnd,   { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove',  onTouchMove)
      document.removeEventListener('touchend',   onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefreshing])

  // ── API calls ──
  const enqueueProductView = (id: string) => {
    try {
      const queue = JSON.parse(localStorage.getItem(MARKETPLACE_VIEW_QUEUE_KEY) || '[]') as string[]
      const next = [...queue, id].slice(-100)
      localStorage.setItem(MARKETPLACE_VIEW_QUEUE_KEY, JSON.stringify(next))
    } catch {}
  }

  const flushQueuedProductViews = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const queue = JSON.parse(localStorage.getItem(MARKETPLACE_VIEW_QUEUE_KEY) || '[]') as string[]
      if (!queue.length) return
      const uniqueIds = Array.from(new Set(queue))
      await Promise.allSettled(
        uniqueIds.map(id =>
          fetch(`/api/products/${id}/view`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      )
      localStorage.removeItem(MARKETPLACE_VIEW_QUEUE_KEY)
    } catch {}
  }

  useEffect(() => {
    flushQueuedProductViews()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pushFeedActivitySignal = (kind: 'categories' | 'keywords', value: string) => {
    try {
      const clean = (value || '').trim()
      if (!clean) return
      const now = Date.now()
      const current = JSON.parse(localStorage.getItem(FEED_ACTIVITY_KEY) || '{}') as {
        categories?: TimedSignal[]
        keywords?: TimedSignal[]
      }
      const list = Array.isArray(current[kind]) ? current[kind]! : []
      const deduped = list.filter((entry) => entry.value.toLowerCase() !== clean.toLowerCase())
      const next = [{ value: clean, timestamp: now }, ...deduped].slice(0, 20)
      localStorage.setItem(
        FEED_ACTIVITY_KEY,
        JSON.stringify({
          categories: kind === 'categories' ? next : (current.categories || []),
          keywords: kind === 'keywords' ? next : (current.keywords || []),
        }),
      )
    } catch {}
  }

  const buildFeedSignals = () => {
    let categories: TimedSignal[] = []
    let keywords: TimedSignal[] = []
    try {
      const raw = JSON.parse(localStorage.getItem(FEED_ACTIVITY_KEY) || '{}') as {
        categories?: TimedSignal[]
        keywords?: TimedSignal[]
      }
      categories = Array.isArray(raw.categories) ? raw.categories.filter((x) => x?.value) : []
      keywords = Array.isArray(raw.keywords) ? raw.keywords.filter((x) => x?.value) : []
    } catch {}

    if (!categories.length) {
      try {
        const rv: any[] = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]')
        const seen = new Set<string>()
        categories = rv
          .map((p: any) => ({ value: p?.category, timestamp: typeof p?.createdAt === 'string' ? Date.parse(p.createdAt) : undefined }))
          .filter((entry: any) => entry.value && !seen.has(entry.value) && seen.add(entry.value))
          .slice(0, 12)
      } catch {}
    }

    if (!keywords.length) {
      try {
        const rawSearches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
        keywords = normalizeSearchHistory(rawSearches).slice(0, 12).map((value) => ({ value, timestamp: Date.now() }))
      } catch {}
    }

    return { categories, keywords }
  }

  const fetchFeed = async (universityIdOverride?: string, page = 1) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const feedUniversityId = universityIdOverride || universityId || 'unknown'
      const feedCacheKey = `feed:${feedUniversityId}:${page}`
      const cached = getClientCache<any>(feedCacheKey)
      if (cached) {
        const products = cached.value?.products || []
        setAllProducts(products)
        setRenderSeed(Date.now())
        const cats = Array.from(new Set(
          products.filter((p: any) => p.isPersonalised).map((p: any) => p.category)
        )) as string[]
        setInterestCategories(cats.slice(0, 4))
        setLoading(false)
      }
      const { categories, keywords } = buildFeedSignals()
      const params = new URLSearchParams()
      if (categories.length) {
        params.set('categories', categories.map((c) => c.value).join(','))
        params.set('categorySignals', JSON.stringify(categories))
      }
      if (keywords.length) {
        params.set('keywords', keywords.map((k) => k.value).join(','))
        params.set('keywordSignals', JSON.stringify(keywords))
      }
      params.set('limit', '100')
      if (feedUniversityId !== 'unknown') params.set('universityId', feedUniversityId)
      const res  = await fetch(`/api/products/feed?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        const products = data.products || []
        setClientCache(feedCacheKey, { products }, FEED_CACHE_TTL_MS)
        setAllProducts(products)
        setRenderSeed(Date.now())
        const cats = Array.from(new Set(
          products.filter((p: any) => p.isPersonalised).map((p: any) => p.category)
        )) as string[]
        setInterestCategories(cats.slice(0, 4))
      }
    } catch { /* silent fail */ }
    finally { setLoading(false) }
  }

  const fetchPeopleLikeYouBought = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const res = await fetch('/api/products/people-like-you?mode=top&pageSize=14', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) return
      const items = (data.items || [])
        .map((it: any) => ({
          ...it.product,
          soldCount: it.soldCount,
          isTrending: true,
        }))
        .filter((p: any) => p?.id)
      setPeopleLikeYouBought(items)
    } catch { /* silent fail */ }
  }

  const fetchByCategory = async (category: string) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const categoryKey = resolveCategoryKey(category)
      const params = new URLSearchParams()
      if (categoryKey) params.set('categoryKey', categoryKey)
      if (category && category !== 'All') params.set('category', category)

      const res = await fetch(`/api/products?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        const products = data.products || []
        setAllProducts(products)
      }
    } catch { /* silent fail */ }
    finally { setLoading(false) }
  }

  // ── Interaction handlers ──
  const copyReferralCode = async () => {
    const textToCopy = referralLink || referralCode
    if (!textToCopy) return
    try {
      await navigator.clipboard.writeText(textToCopy)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = textToCopy
      ta.style.cssText = 'position:fixed;opacity:0;'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setReferralCopied(true)
    setTimeout(() => setReferralCopied(false), 2500)
  }

  const shareReferralWhatsApp = () => {
    if (!referralLink) return
    const text = encodeURIComponent(
      `I'm on BataMart — the campus marketplace at ${universityShortName || 'my campus'}.\nSign up with my link and start buying & selling today:\n${referralLink}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  /**
   * Opens the Feed, filtered.
   *
   * This used to filter in place: the whole marketplace was replaced by a
   * grid, so the feed you were reading disappeared and the only way back was a
   * breadcrumb. Browsing is a different activity from reading the feed and now
   * has its own screen, exactly as it does on the mobile client. Everything
   * that names a category — tiles, spotlights, "see all", price bands — lands
   * on the same filtered destination.
   */
  const handleCategorySelect = (cat: string, maxPrice?: number) => {
    const normalizedCategory = cat.trim()
    const categoryKey = normalizedCategory === 'All' ? null : resolveCategoryKey(normalizedCategory)
    const query = new URLSearchParams()
    if (categoryKey) query.set('categoryKey', categoryKey)
    if (maxPrice !== undefined) {
      query.set('maxPrice', String(maxPrice))
      query.set('sort', 'price_asc')
    }
    if (selectedZone) query.set('zone', selectedZone)
    if (isApp) query.set('app', 'true')
    const q = query.toString()
    router.push(`/feed${q ? `?${q}` : ''}`)
  }

  const handleProductClick = (id: string) => {
    const token = localStorage.getItem('token')
    try {
      const viewed  = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]')
      const product = allProducts.find(p => p.id === id)
      if (product) {
        const updated = [product, ...viewed.filter((v: any) => v.id !== id)].slice(0, 20)
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated))
        setRecentlyViewed(updated)
        pushFeedActivitySignal('categories', product.categoryKey || product.category)
      }
    } catch {}
    if (token) {
      fetch('/api/session-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: ensureSessionId(), productId: id, eventType: 'click', meta: { from: 'marketplace' } }),
      }).catch(() => {})
      fetch(`/api/products/${id}/view`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {
        enqueueProductView(id)
      })
    } else {
      enqueueProductView(id)
    }
    window.location.href = token ? `/product/${id}` : '/login'
  }

  // ── Derived data ──
  // Zone filter applies before everything else derived from allProducts, so
  // every section (hot deals, new listings, for you, discover, category rows)
  // respects the buyer's chosen delivery zone.
  const zoneFilteredProducts = useMemo(() => {
    if (!selectedZone) return allProducts
    return allProducts.filter(p => (p.landmark || '').toLowerCase() === selectedZone.toLowerCase())
  }, [allProducts, selectedZone])

  const forYouProducts = useMemo(() => zoneFilteredProducts.filter(p => p.isPersonalised).slice(0, 12), [zoneFilteredProducts])
  // Hot Deals — powered by confirmed campus sales + view signals
  const hotDeals = useMemo(() => {
    return zoneFilteredProducts
      .filter(p => p.isHot)
      .sort((a, b) => {
        return (b.discountPercent || 0) - (a.discountPercent || 0) || (b.viewCount || 0) - (a.viewCount || 0)
      })
  }, [zoneFilteredProducts])
  const trendingProducts = hotDeals.slice(0, 12)
  const newListings = useMemo(() => zoneFilteredProducts.filter(p => p.isNew), [zoneFilteredProducts])
  const discoverProducts = useMemo(() => {
    const shown = new Set([...forYouProducts, ...trendingProducts, ...newListings].map(p => p.id))
    const remaining = zoneFilteredProducts.filter(p => !shown.has(p.id))
    // Always keep an "All Listings" fallback visible even when sections above consume most products.
    return (remaining.length > 0 ? remaining : zoneFilteredProducts).slice(0, 16)
  }, [zoneFilteredProducts, forYouProducts, trendingProducts, newListings])

  const filteredByCategory = useMemo(() => {
    const categoryFilter = selectedCategoryKey || selectedCategory
    let prods = selectedCategory === 'All' ? zoneFilteredProducts : zoneFilteredProducts.filter((p: any) => matchesCategoryFilter(p, categoryFilter))
    if (maxPriceFilter !== null) prods = prods.filter(p => p.price <= maxPriceFilter)
    return prods
  }, [zoneFilteredProducts, selectedCategory, selectedCategoryKey, maxPriceFilter])

  const sortProducts = useCallback((products: any[]) => {
    const next = [...products]
    if (sortMode === 'price_asc') return next.sort((a, b) => (a.price || 0) - (b.price || 0))
    if (sortMode === 'price_desc') return next.sort((a, b) => (b.price || 0) - (a.price || 0))
    if (sortMode === 'newest') return next.sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0))
    return next
  }, [sortMode])

  const sortedFilteredByCategory = useMemo(() => sortProducts(filteredByCategory), [filteredByCategory, sortProducts])
  const sortedAllProducts = useMemo(() => sortProducts(zoneFilteredProducts), [zoneFilteredProducts, sortProducts])

  const productsByCategory = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const cat of CATEGORIES.slice(1)) {
      map[cat.name] = zoneFilteredProducts.filter((p: any) => matchesCategoryFilter(p, cat.name)).slice(0, 10)
    }
    return map
  }, [zoneFilteredProducts])

  if (!splashDone) return <div className="min-h-screen bg-card" />

  return (
    <div className="min-h-screen bg-surface marketplace-shell">
      {/* ── Referral Popup Modal ── */}
      {showReferralPopup && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center px-4 bg-ink/50"
          onClick={() => setShowReferralPopup(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-card shadow-soft"
            onClick={e => e.stopPropagation()}
          >
            {/* Close btn */}
            <button
              onClick={() => setShowReferralPopup(false)}
              aria-label="Close"
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full text-ink-secondary hover:bg-surface transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>

            {/* Content */}
            <div className="p-6 pb-7">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1 mb-4">
                <Gift className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                <span className="text-primary text-xs font-medium tracking-wide">Earn real money</span>
              </div>

              {/* Headline */}
              <h2 className="text-[24px] font-semibold leading-tight text-ink mb-1">
                Refer friends &<br />
                <span className="text-primary">earn ₦120 per order</span>
              </h2>
              <p className="text-ink-secondary text-sm leading-relaxed mb-5">
                Every time someone you refer completes a delivery order on BataMart, ₦120 drops straight into your wallet — no limit.
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-surface rounded-xl p-3 text-center border border-border">
                  <p className="text-2xl font-semibold text-ink">₦120</p>
                  <p className="text-xs text-ink-secondary mt-0.5">per completed order</p>
                </div>
                <div className="bg-surface rounded-xl p-3 text-center border border-border">
                  <p className="text-2xl font-semibold text-ink">Unlimited</p>
                  <p className="text-xs text-ink-secondary mt-0.5">referrals you can make</p>
                </div>
              </div>

              {/* Referral code display */}
              {referralCode && (
                <div className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink-muted mb-0.5">Your referral code</p>
                    <p className="font-semibold text-ink tracking-widest text-sm truncate">{referralCode}</p>
                  </div>
                  <button
                    onClick={copyReferralCode}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-primary text-background font-medium text-xs px-3 py-2 rounded-lg hover:brightness-95 transition-colors"
                  >
                    {referralCopied
                      ? <><CheckCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> Copied</>
                      : <><Copy className="w-3.5 h-3.5" strokeWidth={1.75} /> Copy link</>
                    }
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={shareReferralWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 h-11 rounded-lg font-medium text-sm bg-primary text-background hover:brightness-95 transition-colors"
                >
                  Share on WhatsApp
                </button>
                <button
                  onClick={() => { setShowReferralPopup(false); router.push('/referrals') }}
                  className="px-4 h-11 rounded-lg font-medium text-sm bg-card border border-border text-ink hover:bg-surface transition-colors flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" strokeWidth={1.75} /> View
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <PullIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      )}

      {/* Promo ticker */}
      <PromoTicker />

      {/* ══ CATEGORY BAR (trust strip above is the first thing on the page) ══ */}
      <header
        className={`batamart-header marketplace-header sticky top-0 z-40 ${isApp ? 'shadow-[0_8px_24px_rgba(15,23,42,0.16)]' : 'shadow-soft'}`}
        style={{
          // Subtle push-down effect during PTR — keeps header anchored-feeling
          transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance * 0.15, 16)}px)` : undefined,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.35s cubic-bezier(0.22,1,0.36,1)' : 'none',
        }}
      >
        <div className={`marketplace-header-inner ${isApp ? 'max-w-5xl' : 'max-w-7xl'} mx-auto px-3 sm:px-6`}>
          {/* Category browsing moved to /feed — a horizontal strip fits three
              of twelve categories on a phone and leaves subcategories nowhere
              to live. What stays here is what filters the feed you are reading:
              delivery zone and how it is laid out. */}
          <div className="marketplace-categories flex items-center justify-between gap-2 py-2.5">
            <Link
              href={isApp ? '/feed?app=true' : '/feed'}
              className="group flex min-w-0 flex-1 items-center gap-2 text-ink-secondary transition-colors duration-300 hover:text-ink"
            >
              <LayoutGrid className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} />
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em]">
                Browse all categories
              </span>
              <ChevronRight
                className="h-3.5 w-3.5 flex-shrink-0 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </Link>
            {availableZones.length > 0 && (
              <div className="relative flex-shrink-0">
                <MapPin className="w-3.5 h-3.5 text-ink-muted absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                <select
                  value={selectedZone}
                  onChange={e => setSelectedZone(e.target.value)}
                  className={`appearance-none rounded-lg border py-2 pl-7 pr-3 text-[11px] font-medium outline-none transition-colors duration-300 ${
                    selectedZone
                      ? 'border-primary/40 bg-primary/8 text-primary'
                      : 'border-border bg-card text-ink-secondary hover:border-ink/25'
                  }`}
                >
                  <option value="">All zones</option>
                  {availableZones.map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-shrink-0 items-center rounded-lg border border-border bg-card">
              {(['feed', 'grid'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  aria-label={mode === 'feed' ? 'List view' : 'Grid view'}
                  className={`px-2.5 py-2 text-[11px] font-medium capitalize transition-colors duration-300 ${
                    viewMode === mode ? 'bg-ink text-background' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {mode === 'feed' ? <List className="w-3.5 h-3.5" strokeWidth={1.75} /> : <Grid3X3 className="w-3.5 h-3.5" strokeWidth={1.75} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className={`marketplace-feed ${isApp ? 'max-w-5xl' : 'max-w-7xl'} mx-auto px-3 sm:px-6 ${isApp ? 'py-3 sm:py-4' : 'py-4 sm:py-5'} pb-28 safe-bottom space-y-4`}>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} delay={i * 60} />)}
          </div>

        ) : viewMode === 'grid' ? (
          /* ── GRID VIEW ── */
          <div>
            <div className="flex items-center justify-between mb-3 bg-card px-4 py-3 border border-border gap-2">
              <LiveStatsBar count={allProducts.length} />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as 'relevance' | 'price_asc' | 'price_desc' | 'newest')}
                className="text-xs font-semibold border border-border rounded-lg px-2 py-1 bg-card text-ink-secondary outline-none"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
            {peopleLikeYouBought.length > 0 && (
              <div className="mb-4">
                <BestSellersRow
                  products={peopleLikeYouBought}
                  onProductClick={handleProductClick}
                  onSeeAll={() => router.push('/most-bought')}
                  title="People Like You Bought"
                  subtitle="Popular with students who shop like you"
                />
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {sortedAllProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} onClick={() => handleProductClick(p.id)} delay={i * 30} />
              ))}
            </div>
          </div>

        ) : (
          /* ══ PERSONALISED FEED ══ */
          <div className="space-y-4">

            {allProducts.length > 0 && (
              <div className="bg-card border border-border px-4 py-3">
                <LiveStatsBar count={allProducts.length} />
              </div>
            )}

            {/* ── Live Activity Marquee ── */}
            {allProducts.length > 0 && (
              <LiveActivityMarquee products={allProducts} />
            )}

            {/* ── Campus promises ── */}
            {/* Photography leads, not figures. Two rows of stat boxes used to
                open the feed — "2,400+ products listed" is neither verifiable
                nor actionable on arrival. These are the platform's actual
                guarantees, over photographs, and each one is something the
                reader can go and use. */}
            <PromiseCarousel />

            {/* ── Seasonal Campaign Banner ── */}
            <GirlfriendsDayBanner />

            {/* ── Flash Deals (highest % off first) ── */}
            {trendingProducts.length > 0 && (
              <DealsSection
                products={trendingProducts}
                onProductClick={handleProductClick}
                onSeeAll={() => router.push('/marketplace/deals')}
                sectionClass="section-stripe-orange"
                icon={<Flame className="w-5 h-5 text-white" />}
                title="Hot Deals"
                subtitle="Biggest discounts on campus right now"
                badge="HOT"
              />
            )}

            {/* ── Trending / Brand Spotlight ── */}
            {allProducts.length > 0 && (
              <BrandSpotlight
                onSearch={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)}
                onCategorySelect={handleCategorySelect}
              />
            )}

            {/* ── Picked for You ── */}
            {forYouProducts.length > 0 && (
              <BestSellersRow
                products={forYouProducts}
                onProductClick={handleProductClick}
                onSeeAll={() => handleCategorySelect('All')}
                title="Picked for You"
                subtitle="Based on what you browse, search, and order"
              />
            )}

            {/* ── Flash Sale Countdown (newest products) ── */}
            {allProducts.length > 0 && (
              <FlashSaleCountdown
                products={allProducts.filter(p => p.isDeal || p.isNew).slice(0, 6).length > 0
                  ? allProducts.filter(p => p.isDeal || p.isNew).slice(0, 6)
                  : allProducts.slice(0, 6)
                }
                onProductClick={handleProductClick}
              />
            )}

            {/* ── Study Essentials ── */}
            <StudyEssentials
              onSearch={(q) => router.push(`/search?q=${encodeURIComponent(q)}`)}
            />

            {/* ── Price-range deal panels ── */}
            {allProducts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-ink section-header-line">Shop by budget</h2>
                </div>
                <BudgetShelf allProducts={allProducts} onSelect={(max) => handleCategorySelect('All', max)} renderSeed={renderSeed} />
              </div>
            )}

            {/* ── People Like You Bought ── */}
            {peopleLikeYouBought.length > 0 && (
              <BestSellersRow
                products={peopleLikeYouBought}
                onProductClick={handleProductClick}
                onSeeAll={() => router.push('/most-bought')}
                title="People Like You Bought"
                subtitle="Popular with students who shop like you"
              />
            )}

            {/* ── Recently Viewed ── */}
            {recentlyViewed.length > 0 && (
              <div className="bg-card border border-border overflow-hidden">
                <div className="flex items-end justify-between px-5 pt-5 pb-3 border-b border-border">
                  <div>
                    <h2 className="text-base font-semibold text-ink section-header-line">Recently Viewed</h2>
                    <p className="text-xs text-ink-muted font-medium mt-1">Pick up where you left off</p>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                    {recentlyViewed.slice(0, 8).map(p => (
                      <MiniProductCard key={p.id} product={p} onClick={() => handleProductClick(p.id)} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Best Sellers: Electronics ── */}
            {(productsByCategory['Electronics']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Electronics']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Electronics')} title="Best Sellers in Tech" subtitle="Top picks from campus techies" />
            )}

            {/* ── Electronics Mosaic ── */}
            {(productsByCategory['Electronics']?.length >= 3) && (
              <MosaicRow
                products={productsByCategory['Electronics']}
                onProductClick={handleProductClick}
                title="Tech on campus"
                subtitle="See what students are selling in electronics"
                sectionClass="section-stripe"
              />
            )}

            {/* ── Best Sellers: Fashion ── */}
            {(productsByCategory['Fashion']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Fashion']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Fashion')} title="Best Sellers in Campus Fashion" subtitle="Style up your university life" />
            )}

            {/* ── Fashion Mosaic ── */}
            {(productsByCategory['Fashion']?.length >= 3) && (
              <MosaicRow
                products={productsByCategory['Fashion']}
                onProductClick={handleProductClick}
                title="Campus Style"
                subtitle="What students are wearing this season"
                sectionClass="section-stripe-orange"
              />
            )}

            {/* ── Best Sellers: Food ── */}
            {(productsByCategory['Food & Groceries']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Food & Groceries']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Food & Groceries')} title="Best Sellers in Food & Groceries" subtitle="Eat well, study harder" />
            )}

            {/* ── Top Campus Sellers ── */}
            {allProducts.length > 0 && (
              <TopSellersRow products={allProducts} onProductClick={handleProductClick} />
            )}

            {/* ── Your Interests ── */}
            {interestCategories.length > 0 && (
              <div className="bg-card rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  <h2 className="text-[16px] font-semibold text-ink">Your interests</h2>
                  <span className="text-[10px] text-ink-muted font-medium">Based on your browsing</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {interestCategories.map((cat) => {
                    const catObj = CATEGORIES.find(c => c.name === cat)
                    const Icon = catObj?.icon
                    return (
                      <button
                        key={cat}
                        onClick={() => handleCategorySelect(cat)}
                        className="interest-pill flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-lg text-sm font-medium text-ink-secondary"
                      >
                        {Icon && <Icon className="w-4 h-4" strokeWidth={1.75} />} {cat}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Best Sellers: Beauty & Health ── */}
            {(productsByCategory['Beauty & Health']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Beauty & Health']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Beauty & Health')} title="Best Sellers in Beauty & Health" subtitle="Top-rated by campus students" />
            )}

            {/* ── Trust Banner ── */}
            <TrustBanner />

            {/* ── Beauty Mosaic ── */}
            {(productsByCategory['Beauty & Health']?.length >= 3) && (
              <MosaicRow
                products={productsByCategory['Beauty & Health']}
                onProductClick={handleProductClick}
                title="Beauty & glow"
                subtitle="Top beauty picks from campus sellers"
                sectionClass="section-stripe-emerald"
              />
            )}

            {/* ── Best Sellers: Sports & Fitness ── */}
            {(productsByCategory['Sports & Fitness']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Sports & Fitness']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Sports & Fitness')} title="Best Sellers in Sports & Fitness" subtitle="Stay active with top campus picks" />
            )}

            {/* ── Category tiles ── */}
            <MegaCategoryGrid onCategorySelect={handleCategorySelect} />

            {/* ── Shop to a budget ── */}
            <BudgetBands />

            {/* ── Category spotlights. Full-bleed photography with the
                 subcategories as chips over the image — the web counterpart of
                 the mobile client's spotlight panels. ── */}
            <CategorySpotlight label="Electronics" image="/images/marketing/spot-electronics.webp" />
            <CategorySpotlight label="Fashion" image="/images/marketing/spot-fashion.webp" />

            

            {/* ── Best Sellers: Home & Kitchen ── */}
            {(productsByCategory['Home & Kitchen']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Home & Kitchen']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Home & Kitchen')} title="Finds for Your Room" subtitle="Make your hostel feel like home" />
            )}

            {/* ── Home Mosaic ── */}
            {(productsByCategory['Home & Kitchen']?.length >= 3) && (
              <MosaicRow
                products={productsByCategory['Home & Kitchen']}
                onProductClick={handleProductClick}
                title="Room Goals"
                subtitle="Make your hostel feel like home"
                sectionClass="section-stripe"
              />
            )}

            {/* ── Second Live Marquee ── */}
            {allProducts.length > 0 && (
              <LiveActivityMarquee products={allProducts.slice(8, 16)} />
            )}

            {/* ── Just Dropped — always last ── */}
            <JustDroppedSection allProducts={allProducts} onProductClick={handleProductClick} />

            {allProducts.length === 0 && (
              <div className="text-center py-20 bg-card rounded-2xl border border-border">
                <ShoppingBag className="w-14 h-14 text-border mx-auto mb-4" />
                <p className="text-ink-secondary font-semibold text-lg mb-1">No products yet</p>
                <p className="text-ink-muted text-sm mb-6">Be the first seller on your campus!</p>
                <Link href="/sell" className="btn-press inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-semibold text-sm shadow-soft shadow-soft">
                  <CrownIcon className="w-4 h-4" /> List a Product
                </Link>
              </div>
            )}

            {/* ── All Listings ── */}
            {discoverProducts.length > 0 && (
              <div className="bg-card border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-ink section-header-line">All Listings</h2>
                    <p className="text-xs text-ink-muted mt-1">Everything currently live in your campus marketplace</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {discoverProducts.map((p, i) => (
                    <ProductCard key={p.id} product={p} onClick={() => handleProductClick(p.id)} delay={i * 25} />
                  ))}
                </div>
              </div>
            )}

            {/* Closing prompt. Someone who has scrolled this far is engaged;
                this is the right moment to ask them to list something. */}
            <SellCta />
          </div>
        )}
      </div>

      {/* Floating sell action. Ink rather than accent-with-a-pulse: a glowing
          blue pill parked over the content competed with every product photo
          on the page, which is the opposite of what a shortcut should do. */}
      {!isApp && (
        <div className="fixed bottom-20 right-4 z-40 sm:right-6">
          <Link
            href="/sell"
            className="btn-press flex items-center gap-2 rounded-lg bg-ink px-5 py-3.5 font-mono text-[10px] uppercase tracking-[0.16em] text-background shadow-[0_8px_30px_-10px_rgba(19,19,17,0.55)] transition-colors duration-300 hover:bg-primary"
          >
            Sell an item
          </Link>
        </div>
      )}
    </div>
  )
}

