'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search, Star, Shield, ShoppingBag, Sparkles, Flame,
  AlertCircle, Clock, TrendingUp, X, ChevronRight,
  Package, Zap, Award, ArrowRight, Tag, Eye, Heart,
  RefreshCw, CheckCircle, Users, Truck, ChevronLeft,
  BadgeCheck, Timer, Percent, MapPin, Bell, Menu,
  ChevronDown, Grid3X3, List, Sliders, Loader2, Copy,
  Gift, Crown, Coffee, BookOpen, Cpu, Shirt, Home,
  Headphones, Camera, Watch, Dumbbell, Music, Gamepad2,
  Wifi, Battery, Monitor, Smartphone, ShoppingCart,
  TrendingDown, BarChart3, Globe, Leaf, Sun, Moon,
} from 'lucide-react'
import { isSplashPending } from '@/components/SplashScreen'

import { decodeProductData, getCategoryList } from '@/lib/variants'
import { getClientCache, setClientCache } from '@/lib/client-cache'

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

  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .shimmer {
    background: linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%);
    background-size: 1200px 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }
  .dark .marketplace-shell .shimmer {
    background: linear-gradient(90deg, #1f2937 25%, #273449 50%, #1f2937 75%);
    background-size: 1200px 100%;
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
  .product-card {
    transition: transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.3s ease;
    -webkit-transform: translateZ(0);   /* GPU layer on iOS */
    transform: translateZ(0);
    will-change: transform;
  }
  .product-card:hover {
    transform: translateY(-4px) scale(1.015);
    box-shadow: 0 20px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(99,102,241,0.08);
  }
  .product-card:active {
    transform: scale(0.97);
    transition: transform 0.12s ease;
  }
  .product-img { transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1); }
  .product-card:hover .product-img { transform: scale(1.08); }

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
    transform: scale(1.05) translateY(-1px);
    background: #6366f1 !important;
    color: white !important;
    border-color: transparent !important;
    box-shadow: 0 8px 20px rgba(99,102,241,0.25);
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

  /* ── Misc ── */
  @keyframes viewerCount {
    0%, 100% { color: #ef4444; }
    50%       { color: #f97316; }
  }
  .viewer-anim { animation: viewerCount 2.5s ease-in-out infinite; }

  .section-stripe         { background: linear-gradient(135deg, #6366f1 0%, #4c1d95 100%); }
  .section-stripe-orange  { background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); }
  .section-stripe-emerald { background: linear-gradient(135deg, #059669 0%, #0891b2 100%); }
  .dark .marketplace-shell .section-stripe         { background: linear-gradient(135deg, #0d1016 0%, #171c26 100%); }
  .dark .marketplace-shell .section-stripe-orange  { background: linear-gradient(135deg, #1a1311 0%, #241a17 100%); }
  .dark .marketplace-shell .section-stripe-emerald { background: linear-gradient(135deg, #0f1515 0%, #162024 100%); }

  .discount-badge {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 2px 8px rgba(239,68,68,0.4);
  }

  @keyframes floatBadge {
    0%, 100% { transform: translateY(0)   rotate(-2deg); }
    50%       { transform: translateY(-2px) rotate(-2deg); }
  }
  .float-badge { animation: floatBadge 3s ease-in-out infinite; }

  .promo-bar {
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1);
    background-size: 200% 100%;
    animation: shimmerBg 4s linear infinite;
  }
  .dark .marketplace-shell .promo-bar {
    background: linear-gradient(90deg, #0f1115, #1a1f2a, #0f1115);
    background-size: 200% 100%;
  }
  @keyframes shimmerBg {
    0%   { background-position:   0% 50%; }
    100% { background-position: 200% 50%; }
  }

  .batamart-header {
    background: linear-gradient(135deg, #4c1d95 0%, #6366f1 60%, #4c1d95 100%);
  }
  .dark .marketplace-shell .batamart-header { background: linear-gradient(135deg, #0c0f15 0%, #171c26 60%, #0c0f15 100%); }

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

  .mini-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .mini-card:hover { transform: scale(1.03); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
  .mini-card:active { transform: scale(0.97); }
  .mini-card:hover .product-img { transform: scale(1.05); }

  .section-header-line::after {
    content: '';
    display: block;
    height: 3px;
    width: 40px;
    background: #6366f1;
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

  @keyframes gradientShift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .gradient-animated {
    background-size: 200% 200%;
    animation: gradientShift 5s ease infinite;
  }

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
    transition: transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.25s ease;
  }
  .flash-card:hover {
    transform: translateY(-5px) scale(1.03);
    box-shadow: 0 20px 48px rgba(0,0,0,0.14);
  }

  .trust-bar {
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
    background-size: 200% 100%;
    animation: shimmerBg 3s linear infinite;
  }
  .dark .marketplace-shell .trust-bar {
    background: linear-gradient(90deg, #161a22, #232937, #161a22);
    background-size: 200% 100%;
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
// ── UPGRADED: Category list now matches the full variant system ──────────────
const CATEGORIES = [
  { name: 'All',                      icon: '🛍️', color: '#6366f1' },
  { name: 'Electronics',              icon: '📱', color: '#7c3aed' },
  { name: 'Fashion',                  icon: '👔', color: '#ec4899' },
  { name: 'Home & Kitchen',           icon: '🏠', color: '#0891b2' },
  { name: 'Beauty & Personal Care',   icon: '💄', color: '#db2777' },
  { name: 'Groceries / Food / Fast Food', icon: '🍔', color: '#f97316' },
  { name: 'Computing',                icon: '💻', color: '#2563eb' },
  { name: 'Gaming',                   icon: '🎮', color: '#16a34a' },
  { name: 'Automotive',               icon: '🚗', color: '#d97706' },
  { name: 'Baby Products',            icon: '👶', color: '#0d9488' },
  { name: 'Pets',                     icon: '🐾', color: '#7c3aed' },
]

const TRENDING_SEARCHES  = ['iPhone', 'Sneakers', 'Laptop', 'Jollof Rice', 'Textbooks', 'Earbuds', 'Braids', 'Power Bank']
const RECENT_SEARCHES_KEY  = 'BATAMART-recent-searches'
const RECENTLY_VIEWED_KEY  = 'BATAMART-recently-viewed'
const FEED_ACTIVITY_KEY = 'BATAMART-feed-activity-v1'
const FEED_CACHE_TTL_MS = 90 * 1000

const MARKETPLACE_VIEW_QUEUE_KEY = 'batamart_product_view_queue_v1'

const ACTIVITY_SIGNALS = [
  { icon: '🔥', text: (n: number) => `${n} viewing now` },
  { icon: '🛒', text: (n: number) => `${n} sold today`  },
  { icon: '⚡', text: () => 'Selling fast'               },
  { icon: '👀', text: () => 'Recently added'             },
]

const CATEGORY_SPOTLIGHTS = [
  { title: 'Level up your Tech',  categories: ['Phones','Laptops','Earbuds','Power Banks'],   icon: '📱', bg: 'from-violet-50 to-indigo-50', accent: '#6366f1', catFilter: 'Electronics' },
  { title: 'Campus Fashion',      categories: ['Sneakers','Bags','Watches','Accessories'],     icon: '👔', bg: 'from-pink-50 to-rose-50',    accent: '#ec4899', catFilter: 'Fashion' },
  { title: 'Home & Kitchen',      categories: ['Furniture','Appliances','Bedding','Decor'],    icon: '🏠', bg: 'from-sky-50 to-blue-50',     accent: '#0891b2', catFilter: 'Home & Kitchen' },
  { title: 'Food & Snacks',       categories: ['Jollof Rice','Snacks','Drinks','Fast Food'],   icon: '🍔', bg: 'from-orange-50 to-amber-50', accent: '#f97316', catFilter: 'Groceries / Food / Fast Food' },
  { title: 'Gaming Zone',         categories: ['PS5','Xbox','Controllers','Games'],            icon: '🎮', bg: 'from-emerald-50 to-green-50', accent: '#16a34a', catFilter: 'Gaming' },
  { title: 'Beauty & Care',       categories: ['Skincare','Makeup','Hair','Perfume'],          icon: '💄', bg: 'from-fuchsia-50 to-pink-50', accent: '#db2777', catFilter: 'Beauty & Personal Care' },
]

const JUST_DROPPED_PAGE_SIZE = 12
const SESSION_ID_KEY = 'BATAMART_SESSION_ID'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function getSignal(productId: string, index: number) {
  const hash = productId.charCodeAt(0) + productId.charCodeAt(productId.length - 1)
  const signalIndex = (hash + index) % ACTIVITY_SIGNALS.length
  const signal = ACTIVITY_SIGNALS[signalIndex]
  const count = 5 + ((hash * 7 + index * 3) % 28)
  return { icon: signal.icon, text: signal.text(count) }
}

function getStockLevel(productId: string) {
  const hash = productId.charCodeAt(0) + productId.charCodeAt(1)
  return [null, null, null, 3, 5, 7, null, null][hash % 8]
}

function getDeliveryTag(productId: string) {
  const hash = productId.charCodeAt(0)
  return ['Campus Pickup', 'Fast Delivery', 'Free Delivery', null, null][hash % 5]
}

// ── UPGRADED: handles both legacy pipe-tags AND new VARIANTS_V2 format ────────
function parseTags(description: string): string[] {
  const { tags, variants } = decodeProductData(description)
  // Show top variant values as chips (max 3 total)
  const variantValues = Object.values(variants).flat().slice(0, 3) as string[]
  const allChips = [...variantValues, ...tags].filter(Boolean)
  // Deduplicate and limit
  return [...new Set(allChips)].slice(0, 5)
}

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
  const tone =
    level === 'GOLD'   ? { bg: 'bg-amber-50', text: 'text-amber-700',  ring: 'ring-amber-200',  dot: 'bg-amber-400'  } :
    level === 'SILVER' ? { bg: 'bg-slate-50',  text: 'text-slate-600',  ring: 'ring-slate-200',  dot: 'bg-slate-400'  } :
                         { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', dot: 'bg-orange-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} /> {level}
    </span>
  )
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold ring-1 ring-blue-100">
      <BadgeCheck className="w-2.5 h-2.5" /> Verified
    </span>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} />
      ))}
      <span className="text-xs font-semibold text-gray-500 ml-0.5">{rating.toFixed(1)}</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Product Card
// ─────────────────────────────────────────────
function ProductCard({ product, onClick, delay = 0, showSignal = true }: {
  product: any; onClick: () => void; delay?: number; showSignal?: boolean
}) {
  // Use real discount from market price check (stored in DB), not a fake computed value
  const discount     = (product.isDeal && product.discountPercent) ? product.discountPercent : 0
  const stockLeft    = getStockLevel(product.id)
  const deliveryTag  = getDeliveryTag(product.id)
  const signal       = showSignal ? getSignal(product.id, delay) : null
  // Show the actual market price as the "original" crossed-out price when it's a deal
  const originalPrice = (product.isDeal && product.marketPrice && product.marketPrice > product.price)
    ? Math.round(product.marketPrice)
    : null

  return (
    <div
      onClick={onClick}
      className="product-card card-enter bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm cursor-pointer flex flex-col group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        <img src={product.images[0] || '/placeholder.png'} alt={product.name} className="product-img w-full h-full object-cover" />
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isTrending && (
            <span className="badge-pulse inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black rounded-lg shadow-md">
              <Flame className="w-2.5 h-2.5" /> HOT
            </span>
          )}
          {product.isNew && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[10px] font-black rounded-lg shadow-md">
              <Sparkles className="w-2.5 h-2.5" /> NEW
            </span>
          )}
          {product.isPersonalised && !product.isTrending && !product.isNew && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[10px] font-black rounded-lg shadow-md">
              <Heart className="w-2.5 h-2.5 fill-white" /> FOR YOU
            </span>
          )}
        </div>
        {discount > 0 && (
          <div className="float-badge absolute top-2 right-2 discount-badge text-white text-[11px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
            <Percent className="w-2.5 h-2.5" />-{discount}%
          </div>
        )}
        {product.images?.length > 1 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/50 text-white text-[10px] font-bold backdrop-blur-sm">
            {product.images.length} photos
          </div>
        )}
        <div className="quick-actions absolute bottom-2 left-2 flex gap-1.5">
          <button onClick={e => e.stopPropagation()} className="w-7 h-7 bg-white/95 hover:bg-red-50 rounded-lg flex items-center justify-center shadow-sm transition-colors">
            <Heart className="w-3.5 h-3.5 text-gray-500 hover:text-red-500" />
          </button>
          <button onClick={e => { e.stopPropagation(); onClick() }} className="w-7 h-7 bg-white/95 rounded-lg flex items-center justify-center shadow-sm transition-colors">
            <Eye className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="p-2.5 sm:p-3 flex flex-col flex-1">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
          {product.subcategory ? `${product.category} · ${product.subcategory}` : product.category}
        </p>
        <h3 className="font-bold text-gray-900 line-clamp-2 text-xs sm:text-sm leading-snug flex-1">{product.name}</h3>

        <div className="mt-2">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-BATAMART-primary font-black text-sm sm:text-base tracking-tight">{fmt(product.price)}</span>
            {originalPrice && <span className="text-gray-400 font-medium text-[11px] line-through">{fmt(originalPrice)}</span>}
          </div>
          <StarRating rating={product.seller?.avgRating || 0} />
          <p className="text-[10px] text-gray-500 font-semibold mt-0.5">50+ bought in past week</p>
        </div>

        {deliveryTag && (
          <div className="mt-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <Truck className="w-2.5 h-2.5" /> {deliveryTag}
            </span>
          </div>
        )}

        {stockLeft && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500">
              <Timer className="w-2.5 h-2.5" /> Only {stockLeft} left
            </span>
          </div>
        )}

        {signal && (
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[10px] viewer-anim font-semibold text-gray-500">{signal.icon} {signal.text}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-gray-100">
          <div className="min-w-0 flex items-center gap-1 flex-wrap">
            <Link
              href={`/seller/${product.seller?.id}`}
              className="text-[10px] font-semibold text-gray-500 hover:text-BATAMART-primary truncate transition-colors"
              onClick={e => e.stopPropagation()}
            >
              {product.seller?.name}
            </Link>
            <VerifiedBadge />
          </div>
          <TrustPill level={product.seller?.trustLevel || 'BRONZE'} />
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
      <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 mb-2">
        <img src={product.images[0] || '/placeholder.png'} alt={product.name} className="product-img w-full h-full object-cover" />
      </div>
      <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{product.name}</p>
      <p className="text-xs font-black text-BATAMART-primary mt-0.5">{fmt(product.price)}</p>
    </div>
  )
}

function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div className="card-enter bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm" style={{ animationDelay: `${delay}ms` }}>
      <div className="aspect-square shimmer" />
      <div className="p-3 space-y-2">
        <div className="h-2.5 shimmer rounded-full w-1/2" />
        <div className="h-3.5 shimmer rounded-full w-full" />
        <div className="h-3.5 shimmer rounded-full w-3/4" />
        <div className="h-5   shimmer rounded-full w-1/3 mt-3" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Promo Ticker
// ─────────────────────────────────────────────
function PromoTicker() {
  const items = [
    '🔥 Hot Deals — Up to 40% OFF',
    '⚡ Flash Sale — Limited stock',
    '🚀 Free Delivery on orders over ₦30,000',
    '🎓 Verified Campus Sellers Only',
    '💳 Secure Payments — Wallet Protected',
    '📦 Campus Pickup Available',
    '⭐ Top Rated Products on Campus',
    '🛡️ Buyer Protection Guaranteed',
  ]
  const doubled = [...items, ...items]
  return (
    <div className="promo-bar overflow-hidden py-1.5 ticker-wrap">
      <div className="ticker-inner flex whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="text-white text-[11px] font-bold mx-6 flex-shrink-0">{item}</span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Category Spotlight Grid
// ─────────────────────────────────────────────
function CategorySpotlightGrid({ allProducts, onCategorySelect }: {
  allProducts: any[]
  onCategorySelect: (cat: string) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {CATEGORY_SPOTLIGHTS.map(spot => {
        const catProducts = allProducts.filter(p => p.category === spot.catFilter).slice(0, 4)
        return (
          <div
            key={spot.title}
            className={`cat-tile card-enter bg-gradient-to-br ${spot.bg} rounded-2xl overflow-hidden border border-white shadow-sm cursor-pointer`}
            onClick={() => onCategorySelect(spot.catFilter)}
          >
            <div className="p-3 pb-1">
              <p className="text-sm font-black text-gray-900 leading-tight">{spot.title}</p>
            </div>
            {catProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-1 p-2 pt-1">
                {catProducts.map(p => (
                  <div
                    key={p.id}
                    onClick={e => { e.stopPropagation(); onCategorySelect(spot.catFilter) }}
                    className="aspect-square rounded-lg overflow-hidden bg-white shadow-sm"
                  >
                    <img src={p.images[0] || '/placeholder.png'} alt={p.name} className="w-full h-full object-cover" />
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 4 - catProducts.length) }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-white/60 flex items-center justify-center text-2xl">{spot.icon}</div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 p-2 pt-1">
                {spot.categories.slice(0, 4).map((cat, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-white/70 flex flex-col items-center justify-center p-1">
                    <span className="text-lg">{spot.icon}</span>
                    <span className="text-[8px] font-bold text-gray-600 text-center leading-tight mt-0.5">{cat}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="px-3 pb-3">
              <span style={{ color: spot.accent }} className="text-[11px] font-black flex items-center gap-1">
                Shop now <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        )
      })}
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
const PRICE_PANELS = [
  {
    title: 'Shop Fashion for Less',
    category: 'Fashion',
    catFilter: 'Fashion',
    tiers: [
      { label: 'Under ₦10k',  max: 10000 },
      { label: 'Under ₦20k',  max: 20000 },
      { label: 'Under ₦30k',  max: 30000 },
      { label: 'Under ₦50k',  max: 50000 },
    ],
    bg: 'from-pink-50 to-rose-50',
    accent: '#ec4899',
    icon: '👔',
  },
  {
    title: 'Tech Deals on Campus',
    category: 'Electronics',
    catFilter: 'Electronics',
    tiers: [
      { label: 'Under ₦20k',  max: 20000 },
      { label: 'Under ₦50k',  max: 50000 },
      { label: 'Under ₦100k', max: 100000 },
      { label: 'Under ₦200k', max: 200000 },
    ],
    bg: 'from-violet-50 to-indigo-50',
    accent: '#6366f1',
    icon: '📱',
  },
  {
    title: 'Beauty Picks for Less',
    category: 'Beauty & Personal Care',
    catFilter: 'Beauty & Personal Care',
    tiers: [
      { label: 'Under ₦5k',   max: 5000 },
      { label: 'Under ₦10k',  max: 10000 },
      { label: 'Under ₦20k',  max: 20000 },
      { label: 'Under ₦30k',  max: 30000 },
    ],
    bg: 'from-fuchsia-50 to-pink-50',
    accent: '#db2777',
    icon: '💄',
  },
  {
    title: 'Food & Snacks Under Budget',
    category: 'Groceries / Food / Fast Food',
    catFilter: 'Groceries / Food / Fast Food',
    tiers: [
      { label: 'Under ₦2k',   max: 2000 },
      { label: 'Under ₦5k',   max: 5000 },
      { label: 'Under ₦10k',  max: 10000 },
      { label: 'Under ₦20k',  max: 20000 },
    ],
    bg: 'from-orange-50 to-amber-50',
    accent: '#f97316',
    icon: '🍔',
  },
]

// ── Campus Stats (animated numbers shown in the stats banner) ──────────────
const CAMPUS_STATS = [
  { label: 'Products Listed',  value: '2,400+', icon: '📦', color: 'text-violet-600' },
  { label: 'Campus Sellers',   value: '380+',   icon: '🧑‍💼', color: 'text-emerald-600' },
  { label: 'Orders Delivered', value: '5,100+', icon: '🚀', color: 'text-orange-500' },
  { label: 'Happy Buyers',     value: '1,200+', icon: '⭐', color: 'text-amber-500' },
]

// ── Brand/search chips for the brand spotlight row ─────────────────────────
const BRAND_CHIPS = [
  { label: 'iPhone',      icon: '📱', cat: 'Electronics' },
  { label: 'Samsung',     icon: '📺', cat: 'Electronics' },
  { label: 'Sneakers',    icon: '👟', cat: 'Fashion' },
  { label: 'Laptops',     icon: '💻', cat: 'Computing' },
  { label: 'Power Banks', icon: '🔋', cat: 'Electronics' },
  { label: 'Earbuds',     icon: '🎧', cat: 'Electronics' },
  { label: 'Skincare',    icon: '✨', cat: 'Beauty & Personal Care' },
  { label: 'Textbooks',   icon: '📚', cat: 'Computing' },
  { label: 'Wigs',        icon: '💇', cat: 'Beauty & Personal Care' },
  { label: 'Watches',     icon: '⌚', cat: 'Fashion' },
  { label: 'Gaming',      icon: '🎮', cat: 'Gaming' },
  { label: 'Food',        icon: '🍔', cat: 'Groceries / Food / Fast Food' },
]

// ── Why BataMart trust points ──────────────────────────────────────────────
const TRUST_POINTS = [
  { icon: '🔒', title: 'Escrow Protected',   desc: 'Money held safely until you confirm delivery' },
  { icon: '🎓', title: 'Campus Verified',     desc: 'Only students from your university can sell' },
  { icon: '⚡', title: 'Fast Campus Delivery', desc: 'Delivered to your hostel door' },
  { icon: '🛡️', title: 'Dispute Protection', desc: 'Open and track order disputes from your dashboard' },
  { icon: '⭐', title: 'Ratings & Reviews',   desc: 'Buy from trusted, rated sellers only' },
  { icon: '🔄', title: 'Easy Disputes',       desc: 'Raise an issue, get it resolved fast' },
  { icon: '🎁', title: 'Referral Rewards', desc: 'Invite friends and earn rewards when they join and buy' },
  { icon: '📦', title: 'Order Tracking', desc: 'Track order status from confirmation to delivery' },
  { icon: '🔔', title: 'Smart Notifications', desc: 'Get updates on orders, referrals, and account activity' },

]

// ── Study essentials quick links ────────────────────────────────────────────
const STUDY_LINKS = [
  { label: 'Past Questions', icon: '📋', query: 'past questions' },
  { label: 'Textbooks',      icon: '📗', query: 'textbook' },
  { label: 'Calculators',    icon: '🔢', query: 'calculator' },
  { label: 'Drawing Tools',  icon: '📐', query: 'drawing' },
  { label: 'Lab Coats',      icon: '🥼', query: 'lab coat' },
  { label: 'Flash Drives',   icon: '💾', query: 'flash drive' },
  { label: 'Extension Boxes',icon: '🔌', query: 'extension' },
  { label: 'Stationery',     icon: '✏️', query: 'stationery' },
]

// ── Category mega grid ──────────────────────────────────────────────────────
const MEGA_CATEGORIES = [
  { name: 'Electronics',                  icon: '📱', bg: 'from-violet-500 to-indigo-600',   count: '450+' },
  { name: 'Fashion',                      icon: '👔', bg: 'from-pink-500 to-rose-600',        count: '380+' },
  { name: 'Computing',                    icon: '💻', bg: 'from-blue-500 to-cyan-600',        count: '210+' },
  { name: 'Groceries / Food / Fast Food', icon: '🍔', bg: 'from-orange-500 to-amber-500',     count: '320+' },
  { name: 'Beauty & Personal Care',       icon: '💄', bg: 'from-fuchsia-500 to-pink-500',     count: '290+' },
  { name: 'Gaming',                       icon: '🎮', bg: 'from-green-500 to-emerald-600',    count: '160+' },
  { name: 'Home & Kitchen',               icon: '🏠', bg: 'from-sky-500 to-blue-500',         count: '240+' },
  { name: 'Baby Products',                icon: '👶', bg: 'from-teal-500 to-cyan-500',        count: '80+' },
  { name: 'Automotive',                   icon: '🚗', bg: 'from-yellow-500 to-orange-500',    count: '70+' },
  { name: 'Pets',                         icon: '🐾', bg: 'from-purple-500 to-violet-500',    count: '50+' },
]

function PricePanelsRow({ allProducts, onCategorySelect, renderSeed }: {
  allProducts: any[]
  onCategorySelect: (cat: string, maxPrice?: number) => void
  renderSeed: number
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {PRICE_PANELS.map((panel, pi) => {
        const catProds = allProducts.filter(p => p.category === panel.catFilter)
        return (
          <div key={panel.title} className={`bg-gradient-to-br ${panel.bg} rounded-2xl border border-white shadow-sm overflow-hidden`}>
            <div className="p-3 pb-2">
              <p className="text-sm font-black text-gray-900 leading-tight">{panel.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-1 px-2 pb-1">
              {panel.tiers.map((tier, ti) => {
                const tierProds = catProds.filter(p => p.price <= tier.max)
                const shuffled = seededShuffle(tierProds, renderSeed + pi * 100 + ti)
                const pick = shuffled[0]
                return (
                  <div
                    key={tier.label}
                    onClick={() => onCategorySelect(panel.catFilter, tier.max)}
                    className="cursor-pointer group"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-white shadow-sm mb-1 relative">
                      {pick ? (
                        <img src={pick.images[0] || '/placeholder.png'} alt={pick.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">{panel.icon}</div>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-gray-600 text-center leading-tight pb-1">{tier.label}</p>
                  </div>
                )
              })}
            </div>
            <div className="px-3 pb-3">
              <button
                onClick={() => onCategorySelect(panel.catFilter)}
                style={{ color: panel.accent }}
                className="text-[11px] font-black flex items-center gap-1 hover:underline"
              >
                See all deals <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────
// Amazon-style Category Showcase Panels
// ─────────────────────────────────────────────
const SHOWCASE_PANELS = [
  {
    title: 'Level up your Tech',
    catFilter: 'Electronics',
    subcats: ['Phones', 'Laptops', 'Earbuds', 'Power Banks'],
    bg: 'from-violet-50 to-indigo-50',
    accent: '#6366f1',
    icon: '📱',
    cta: 'Explore Tech',
  },
  {
    title: 'Campus Fashion',
    catFilter: 'Fashion',
    subcats: ['Sneakers', 'Bags', 'Watches', 'Accessories'],
    bg: 'from-pink-50 to-rose-50',
    accent: '#ec4899',
    icon: '👔',
    cta: 'Shop Fashion',
  },
  {
    title: 'Home & Kitchen',
    catFilter: 'Home & Kitchen',
    subcats: ['Furniture', 'Appliances', 'Bedding', 'Decor'],
    bg: 'from-sky-50 to-blue-50',
    accent: '#0891b2',
    icon: '🏠',
    cta: 'Shop Home',
  },
  {
    title: 'Food & Snacks',
    catFilter: 'Groceries / Food / Fast Food',
    subcats: ['Jollof Rice', 'Snacks', 'Drinks', 'Fast Food'],
    bg: 'from-orange-50 to-amber-50',
    accent: '#f97316',
    icon: '🍔',
    cta: 'Order Food',
  },
  {
    title: 'Gaming Zone',
    catFilter: 'Gaming',
    subcats: ['PS5', 'Xbox', 'Controllers', 'Games'],
    bg: 'from-emerald-50 to-green-50',
    accent: '#16a34a',
    icon: '🎮',
    cta: 'Game On',
  },
  {
    title: 'Beauty & Care',
    catFilter: 'Beauty & Personal Care',
    subcats: ['Skincare', 'Makeup', 'Hair', 'Perfume'],
    bg: 'from-fuchsia-50 to-pink-50',
    accent: '#db2777',
    icon: '💄',
    cta: 'Shop Beauty',
  },
]

function ShowcasePanels({ allProducts, onCategorySelect, renderSeed }: {
  allProducts: any[]
  onCategorySelect: (cat: string) => void
  renderSeed: number
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {SHOWCASE_PANELS.map((panel, pi) => {
        const catProds = allProducts.filter(p => p.category === panel.catFilter)
        // Pick 4 random products, shuffled differently each render
        const shuffled = seededShuffle(catProds, renderSeed + pi * 37)
        const picks = shuffled.slice(0, 4)
        return (
          <div
            key={panel.title}
            className={`bg-gradient-to-br ${panel.bg} rounded-2xl border border-white shadow-sm overflow-hidden cursor-pointer group`}
            onClick={() => onCategorySelect(panel.catFilter)}
          >
            <div className="p-3 pb-1">
              <p className="text-sm font-black text-gray-900 leading-tight">{panel.title}</p>
            </div>
            {picks.length > 0 ? (
              <div className="grid grid-cols-2 gap-1 px-2 pb-1">
                {picks.map((p, i) => (
                  <div key={p.id + i} className="aspect-square rounded-lg overflow-hidden bg-white shadow-sm">
                    <img src={p.images[0] || '/placeholder.png'} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 px-2 pb-1">
                {panel.subcats.map((sub, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-white/70 flex flex-col items-center justify-center p-1">
                    <span className="text-lg">{panel.icon}</span>
                    <span className="text-[8px] font-bold text-gray-600 text-center leading-tight mt-0.5">{sub}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="px-3 pb-3">
              <span style={{ color: panel.accent }} className="text-[11px] font-black flex items-center gap-1">
                {panel.cta} <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-end justify-between px-5 pt-5 pb-3 border-b border-gray-50">
        <div>
          <h2 className="text-lg font-black text-gray-900 section-header-line">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 font-medium mt-1">{subtitle}</p>}
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-xs font-bold text-BATAMART-primary flex items-center gap-1 hover:underline">
            See all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="relative group/row px-5 py-4">
        <button onClick={() => scrollBy(-1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border border-gray-200 rounded-full shadow items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-BATAMART-primary hover:text-white hover:border-BATAMART-primary">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div ref={rowRef} className="flex gap-4 overflow-x-auto no-scrollbar scroll-section">
          {products.map(p => (
            <div key={p.id} onClick={() => onProductClick(p.id)} className="deal-card flex-shrink-0 w-36 sm:w-44 cursor-pointer group/card">
              <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 mb-2.5">
                <img src={p.images[0] || '/placeholder.png'} alt={p.name} className="product-img w-full h-full object-cover" />
              </div>
              <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{p.name}</p>
              <p className="text-xs font-black text-BATAMART-primary mt-1">{fmt(p.price)}</p>
              {p.seller?.avgRating > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] text-gray-500 font-medium">{p.seller.avgRating.toFixed(1)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => scrollBy(1)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border border-gray-200 rounded-full shadow items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-BATAMART-primary hover:text-white hover:border-BATAMART-primary">
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
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className={`${sectionClass} px-5 py-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {icon}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">{title}</h2>
                {badge && <span className="badge-pulse bg-white/20 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{badge}</span>}
              </div>
              <p className="text-white/70 text-[11px] mt-0.5">{subtitle}</p>
            </div>
          </div>
          {onSeeAll && (
            <button onClick={onSeeAll} className="text-white/80 text-xs font-bold flex items-center gap-1">
              See all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="bg-white px-5 py-4 relative group/row">
        <button onClick={() => scrollBy(-1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border border-gray-200 rounded-full shadow items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
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
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white border border-gray-200 rounded-full shadow items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
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
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white shadow-lg border border-gray-100"
        style={{ transform: `scale(${0.85 + progress * 0.15})` }}
      >
        <RefreshCw
          className={`w-4 h-4 text-BATAMART-primary ${isRefreshing ? 'ptr-spinning' : ''}`}
          style={{ transform: isRefreshing ? undefined : `rotate(${progress * 220}deg)` }}
        />
        <span className="text-xs font-bold text-gray-600">
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
    <div className="flex items-center gap-3 flex-wrap text-[11px] text-gray-500 font-medium">
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
        <span className="font-bold text-gray-700">{count}</span> products live
      </span>
      <span className="w-px h-3 bg-gray-200" />
      <span className="viewer-anim font-bold">🔴 LIVE marketplace</span>
      <span className="w-px h-3 bg-gray-200" />
      <span className="flex items-center gap-1">
        <Users className="w-3 h-3 text-violet-400" />
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
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className="section-stripe-emerald px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-white" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">Just Dropped</h2>
                <span className="badge-pulse bg-white/20 text-white text-[9px] font-black px-2 py-0.5 rounded-full">NEW</span>
              </div>
              <p className="text-white/70 text-[11px] mt-0.5">Fresh listings — keep scrolling, more loads as you go</p>
            </div>
          </div>
          <span className="text-white/60 text-[11px] font-bold">{filtered.length} items</span>
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

      <div className="bg-white p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-semibold text-sm">No results for &ldquo;{search}&rdquo;</p>
            <button onClick={() => setSearch('')} className="text-BATAMART-primary text-xs font-bold mt-2 hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {visible.map((p, i) => (
                <ProductCard key={p.id} product={p} onClick={() => onProductClick(p.id)} delay={i * 25} />
              ))}
              {loadingMore && Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={`skel-${i}`} delay={i * 60} />
              ))}
            </div>
            <div ref={loaderRef} className="flex justify-center items-center py-8 mt-2">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                  <Loader2 className="w-4 h-4 spin" /> Loading more…
                </div>
              ) : hasMore ? (
                <div className="w-full h-4" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-300">
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
function StatsBanner() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
        {CAMPUS_STATS.map((stat, i) => (
          <div
            key={stat.label}
            className="stat-card flex flex-col items-center justify-center p-4 text-center gap-1"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <span className="text-2xl">{stat.icon}</span>
            <p className={`text-xl font-black ${stat.color} count-up`} style={{ animationDelay: `${i * 120}ms` }}>
              {stat.value}
            </p>
            <p className="text-[11px] text-gray-400 font-medium leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Brand / Search Spotlight ──────────────────────────────────────────────────
function BrandSpotlight({ onSearch, onCategorySelect }: {
  onSearch: (q: string) => void
  onCategorySelect: (cat: string) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-violet-500" />
        <h2 className="text-base font-black text-gray-900">Trending on Campus</h2>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-red-500">
          <span className="live-ping w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
          LIVE
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {BRAND_CHIPS.map((chip, i) => (
          <button
            key={chip.label}
            onClick={() => onCategorySelect(chip.cat)}
            className="brand-chip card-enter flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-violet-50 border border-gray-200 hover:border-violet-200 rounded-xl text-sm font-bold text-gray-700 hover:text-violet-700 shadow-sm"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span>{chip.icon}</span> {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Study Essentials Quick Links ─────────────────────────────────────────────
function StudyEssentials({ onSearch }: { onSearch: (q: string) => void }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-[#12161f] dark:to-[#1b2230] px-5 py-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-white" />
          <div>
            <h2 className="text-base font-black text-white">Study Essentials</h2>
            <p className="text-white/70 text-[11px] mt-0.5">Everything you need for lectures & exams</p>
          </div>
        </div>
      </div>
      <div className="bg-white px-5 py-4">
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {STUDY_LINKS.map((link, i) => (
            <button
              key={link.label}
              onClick={() => onSearch(link.query)}
              className="card-enter flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-violet-50 border border-gray-100 hover:border-violet-200 transition-all group"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-2xl group-hover:scale-110 transition-transform duration-200">{link.icon}</span>
              <p className="text-[10px] font-bold text-gray-600 group-hover:text-violet-600 text-center leading-tight">{link.label}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Mega Category Grid ────────────────────────────────────────────────────────
function MegaCategoryGrid({ onCategorySelect }: { onCategorySelect: (cat: string) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-black text-gray-800 section-header-line">All Categories</h2>
        <span className="text-[11px] text-gray-400 font-medium">Browse everything</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {MEGA_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => onCategorySelect(cat.name)}
            className={`mega-cat-card card-enter relative overflow-hidden rounded-2xl bg-gradient-to-br ${cat.bg} p-4 text-left group cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="text-3xl mb-2 block group-hover:scale-110 transition-transform duration-300">{cat.icon}</span>
            <p className="text-white font-black text-sm leading-tight">{cat.name.split(' /')[0]}</p>
            <p className="text-white/70 text-[10px] font-bold mt-0.5">{cat.count} items</p>
            <div className="absolute -bottom-3 -right-3 w-16 h-16 rounded-full bg-white/10 group-hover:scale-150 transition-transform duration-500" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Why BataMart Trust Banner ─────────────────────────────────────────────────
function TrustBanner() {
  return (
    <div className="rounded-2xl overflow-hidden border border-violet-100 shadow-sm">
      <div className="trust-bar px-5 py-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-white" />
          <h2 className="text-base font-black text-white">Why Students Trust BataMart</h2>
        </div>
      </div>
      <div className="bg-white p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {TRUST_POINTS.map((point, i) => (
            <div
              key={point.title}
              className="card-enter flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-violet-200 hover:bg-violet-50 transition-all"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{point.icon}</span>
              <div>
                <p className="text-xs font-black text-gray-900">{point.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{point.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className={`${sectionClass} px-5 py-4`}>
        <h2 className="text-base font-black text-white">{title}</h2>
        <p className="text-white/70 text-[11px] mt-0.5">{subtitle}</p>
      </div>
      <div className="bg-white p-3">
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
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <div>
                  <p className="text-white text-xs font-black line-clamp-1">{picks[0].name}</p>
                  <p className="text-white/80 text-[10px] font-bold">₦{picks[0].price?.toLocaleString()}</p>
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-end justify-between px-5 pt-5 pb-3 border-b border-gray-50">
        <div>
          <h2 className="text-base font-black text-gray-900 section-header-line">🏆 Top Campus Sellers</h2>
          <p className="text-xs text-gray-400 font-medium mt-1">Most active sellers on campus right now</p>
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
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-100 to-indigo-100 border-2 border-violet-200">
                  {seller.profilePhoto ? (
                    <img src={seller.profilePhoto} alt={seller.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-black text-violet-400">
                      {seller.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                {seller.trustLevel === 'GOLD' && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-[9px]">👑</span>
                )}
              </div>
              <p className="text-xs font-black text-gray-900 line-clamp-1">{seller.name}</p>
              <p className="text-[10px] text-violet-600 font-bold">{count} listing{count !== 1 ? 's' : ''}</p>
              {seller.avgRating > 0 && (
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] text-gray-500 font-bold">{seller.avgRating.toFixed(1)}</span>
                </div>
              )}
              {/* Mini product previews */}
              <div className="flex gap-1 mt-2 justify-center">
                {sellerProds.slice(0, 2).map(p => (
                  <div key={p.id} className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100">
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
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 })

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const midnight = new Date()
      midnight.setHours(24, 0, 0, 0)
      const diff = Math.max(0, midnight.getTime() - now.getTime())
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setTimeLeft({ h, m, s })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const picks = products.slice(0, 6)
  if (picks.length === 0) return null

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 dark:from-[#151313] dark:via-[#201a18] dark:to-[#151313] gradient-animated px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-base font-black text-white">⚡ Flash Picks Today</h2>
              <p className="text-white/75 text-[11px] mt-0.5">Grab them before they&apos;re gone</p>
            </div>
          </div>
          {/* Countdown */}
          <div className="flex items-center gap-1 bg-black/20 rounded-xl px-3 py-1.5">
            {[pad(timeLeft.h), pad(timeLeft.m), pad(timeLeft.s)].map((val, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <span className="countdown-digit text-white font-black text-sm tabular-nums">{val}</span>
                {i < 2 && <span className="text-white/60 font-black text-sm">:</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Products */}
      <div className="bg-white px-5 py-4">
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {picks.map((p, i) => (
            <div
              key={p.id}
              className="flash-card card-enter flex-shrink-0 w-36 cursor-pointer"
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => onProductClick(p.id)}
            >
              <div className="aspect-square rounded-xl overflow-hidden bg-gray-50 mb-2 relative">
                <img src={p.images[0] || '/placeholder.png'} alt={p.name} className="w-full h-full object-cover" />
                {p.discountPercent && (
                  <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-lg">
                    -{p.discountPercent}%
                  </span>
                )}
              </div>
              <p className="text-xs font-black text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
              <p className="text-sm font-black text-BATAMART-primary mt-1">₦{p.price?.toLocaleString()}</p>
              {p.marketPrice && p.marketPrice > p.price && (
                <p className="text-[10px] text-gray-400 line-through">₦{Math.round(p.marketPrice).toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Live Activity Marquee ─────────────────────────────────────────────────────
function LiveActivityMarquee({ products }: { products: any[] }) {
  const items = [
    ...products.slice(0, 8).map(p => `🛒 ${p.seller?.name || 'A student'} listed "${p.name}" for ₦${p.price?.toLocaleString()}`),
    '🔥 Hot deals updated — check the deals page',
    '⭐ Campus marketplace is LIVE — buy safely with escrow',
    '🚀 New listings drop every day — check back often',
    '💬 Chat sellers directly before buying',
  ]
  const doubled = [...items, ...items]

  return (
    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-[#12161f] dark:to-[#1b2230] rounded-2xl overflow-hidden py-2.5 px-0">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex-shrink-0 flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-r-xl">
          <span className="live-ping w-2 h-2 rounded-full bg-green-400 inline-block" />
          <span className="text-white text-[11px] font-black whitespace-nowrap">LIVE</span>
        </div>
        <div className="overflow-hidden flex-1">
          <div className="marquee-track flex gap-8 whitespace-nowrap">
            {doubled.map((item, i) => (
              <span key={i} className="text-white/90 text-[11px] font-medium flex-shrink-0">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const isApp = searchParams.get('app') === 'true' ||
    (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches)

  const [splashDone, setSplashDone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return !isSplashPending()
  })

  const [allProducts,       setAllProducts]       = useState<any[]>([])
  const [loading,           setLoading]           = useState(true)
  const [selectedCategory,  setSelectedCategory]  = useState('All')
  const [viewMode,          setViewMode]          = useState<'feed' | 'grid'>('feed')
  const [recentlyViewed,    setRecentlyViewed]    = useState<any[]>([])
  const [interestCategories,setInterestCategories]= useState<string[]>([])
  const [searchInput,       setSearchInput]       = useState('')
  const [recentSearches,    setRecentSearches]    = useState<string[]>([])
  const [showSuggestions,   setShowSuggestions]   = useState(false)
  const [mounted,           setMounted]           = useState(false)
  const [dropdownPos,       setDropdownPos]       = useState({ top: 0, left: 0, width: 0 })
  const [universityShortName, setUniversityShortName] = useState<string>('')
  const [universityId, setUniversityId] = useState<string>('')
  const [peopleLikeYouBought, setPeopleLikeYouBought] = useState<any[]>([])
  const [renderSeed,          setRenderSeed]          = useState(() => Date.now())
  const [maxPriceFilter,      setMaxPriceFilter]      = useState<number | null>(null)
  const [sortMode,            setSortMode]            = useState<'relevance' | 'price_asc' | 'price_desc' | 'newest'>('relevance')

  // ── Referral popup — shows once per app session, only on first marketplace visit ──
  const [showReferralPopup, setShowReferralPopup] = useState(false)
  const [referralCode, setReferralCode]           = useState('')
  const [referralLink, setReferralLink]           = useState('')
  const [referralCopied, setReferralCopied]       = useState(false)

  // Pull-to-refresh state
  const [pullDistance,  setPullDistance]  = useState(0)
  const [isRefreshing,  setIsRefreshing]  = useState(false)

  const inputRef    = useRef<HTMLInputElement>(null)
  const searchRef   = useRef<HTMLDivElement>(null)
  const isClickingSuggestionRef = useRef(false)

  // Pull-to-refresh touch tracking (refs avoid stale closure issues)
  const ptrStartY     = useRef(0)
  const ptrDelta      = useRef(0)
  const ptrActive     = useRef(false)
  const ptrLocked     = useRef(false)   // locked = decided this is a vertical pull gesture

  // ── Splash ──
  useEffect(() => {
    if (splashDone) return
    const handler = () => setSplashDone(true)
    window.addEventListener('batamart:splash-done', handler)
    const fallback = setTimeout(() => setSplashDone(true), 4000)
    return () => { window.removeEventListener('batamart:splash-done', handler); clearTimeout(fallback) }
  }, [splashDone])

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
    try {
      const rawSearches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
      setRecentSearches(normalizeSearchHistory(rawSearches))
    } catch {}

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

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (isClickingSuggestionRef.current) return
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // ── Category change ──
  useEffect(() => {
    if (!mounted) return
    if (selectedCategory === 'All' && !universityId) return
    if (selectedCategory === 'All') { setMaxPriceFilter(null); fetchFeed() } else { fetchByCategory(selectedCategory) }
  }, [selectedCategory, mounted, universityId])

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

  // ── Search dropdown position ──
  const updateDropdownPos = useCallback(() => {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropdownPos({ top: r.bottom + 8, left: r.left, width: r.width })
  }, [])

  useEffect(() => {
    window.addEventListener('resize', updateDropdownPos)
    window.addEventListener('scroll', updateDropdownPos)
    return () => {
      window.removeEventListener('resize', updateDropdownPos)
      window.removeEventListener('scroll', updateDropdownPos)
    }
  }, [updateDropdownPos])

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
      const res  = await fetch(`/api/products?category=${encodeURIComponent(category)}`, { headers: { Authorization: `Bearer ${token}` } })
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
      `🔥 I'm on BATAMART — the hottest campus marketplace at ${universityShortName || 'my campus'}!\nSign up with my link and start buying & selling today:\n${referralLink}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleCategorySelect = (cat: string, maxPrice?: number) => {
    setSelectedCategory(cat)
    if (maxPrice !== undefined) {
      setMaxPriceFilter(maxPrice)
    } else {
      setMaxPriceFilter(null)
    }
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

  const handleSearch = (searchTerm?: string) => {
    const q = (searchTerm || searchInput).trim()
    if (!q) return
    try {
      const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 8)
      setRecentSearches(updated)
      const now = Date.now()
      const timed = updated.map((keyword) => ({ keyword, timestamp: now }))
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(timed))
      pushFeedActivitySignal('keywords', q)
    } catch {}
    try {
      const token = localStorage.getItem('token')
      if (token) {
        fetch('/api/session-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId: ensureSessionId(), eventType: 'search', meta: { query: q } }),
        }).catch(() => {})
      }
    } catch {}
    setShowSuggestions(false)
    router.push(`/search?q=${encodeURIComponent(q)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch() }
  }

  // ── Derived data ──
  const forYouProducts = useMemo(() => allProducts.filter(p => p.isPersonalised).slice(0, 12), [allProducts])
  // Hot Deals — powered by confirmed campus sales + view signals
  const hotDeals = useMemo(() => {
    return allProducts
      .filter(p => p.isHot)
      .sort((a, b) => {
        return (b.discountPercent || 0) - (a.discountPercent || 0) || (b.viewCount || 0) - (a.viewCount || 0)
      })
  }, [allProducts])
  const trendingProducts = hotDeals.slice(0, 12)
  const newListings = useMemo(() => allProducts.filter(p => p.isNew), [allProducts])
  const discoverProducts = useMemo(() => {
    const shown = new Set([...forYouProducts, ...trendingProducts, ...newListings].map(p => p.id))
    const remaining = allProducts.filter(p => !shown.has(p.id))
    // Always keep an "All Listings" fallback visible even when sections above consume most products.
    return (remaining.length > 0 ? remaining : allProducts).slice(0, 16)
  }, [allProducts, forYouProducts, trendingProducts, newListings])

  const filteredByCategory = useMemo(() => {
    let prods = selectedCategory === 'All' ? allProducts : allProducts.filter(p => p.category === selectedCategory)
    if (maxPriceFilter !== null) prods = prods.filter(p => p.price <= maxPriceFilter)
    return prods
  }, [allProducts, selectedCategory, maxPriceFilter])

  const sortProducts = useCallback((products: any[]) => {
    const next = [...products]
    if (sortMode === 'price_asc') return next.sort((a, b) => (a.price || 0) - (b.price || 0))
    if (sortMode === 'price_desc') return next.sort((a, b) => (b.price || 0) - (a.price || 0))
    if (sortMode === 'newest') return next.sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0))
    return next
  }, [sortMode])

  const sortedFilteredByCategory = useMemo(() => sortProducts(filteredByCategory), [filteredByCategory, sortProducts])
  const sortedAllProducts = useMemo(() => sortProducts(allProducts), [allProducts, sortProducts])

  const productsByCategory = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const cat of CATEGORIES.slice(1)) {
      map[cat.name] = allProducts.filter(p => p.category === cat.name).slice(0, 10)
    }
    return map
  }, [allProducts])

  const suggestions = useMemo(() => {
    const q = searchInput.trim().toLowerCase()
    if (!q) return recentSearches.slice(0, 6).map(s => ({ type: 'recent', label: s }))
    const productMatches = allProducts
      .filter(p => {
        const tags = parseTags(p.description || '')
        return p.name.toLowerCase().includes(q) || tags.some((t: string) => t.toLowerCase().includes(q))
      })
      .slice(0, 5)
      .map(p => ({ type: 'product', label: p.name, sublabel: fmt(p.price), id: p.id, image: p.images[0] }))
    const trendingMatches = TRENDING_SEARCHES
      .filter(s => s.toLowerCase().includes(q))
      .slice(0, 3)
      .map(s => ({ type: 'trending', label: s }))
    return [...productMatches, ...trendingMatches]
  }, [searchInput, allProducts, recentSearches])

  // ── Search suggestions portal ──
  const SuggestionsDropdown = mounted && showSuggestions && suggestions.length > 0
    ? createPortal(
        <div
          className="drop-in fixed z-[9998] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: '320px', overflowY: 'auto' }}
        >
          <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {!searchInput.trim() ? 'Recent Searches' : 'Suggestions'}
            </span>
            {!searchInput.trim() && recentSearches.length > 0 && (
              <span className="text-[10px] text-BATAMART-primary font-bold">RECENT</span>
            )}
          </div>
          {suggestions.map((s: any, i) => (
            <button
              key={i}
              onMouseDown={e => { e.preventDefault(); isClickingSuggestionRef.current = true }}
              onClick={() => {
                isClickingSuggestionRef.current = false
                if (s.type === 'product') { handleProductClick(s.id); return }
                handleSearch(s.label)
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              {s.type === 'product' && s.image
                ? <img src={s.image} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" alt="" />
                : s.type === 'recent'
                  ? <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <TrendingUp className="w-4 h-4 text-BATAMART-primary flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{s.label}</p>
                {s.sublabel && <p className="text-xs text-BATAMART-primary font-bold">{s.sublabel}</p>}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            </button>
          ))}
          {searchInput.trim() && (
            <button
              onMouseDown={e => { e.preventDefault(); isClickingSuggestionRef.current = true }}
              onClick={() => { isClickingSuggestionRef.current = false; handleSearch() }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-BATAMART-primary/5 hover:bg-BATAMART-primary/10 transition-colors border-t border-gray-50"
            >
              <div className="w-8 h-8 rounded-lg bg-BATAMART-primary/10 flex items-center justify-center flex-shrink-0">
                <Search className="w-4 h-4 text-BATAMART-primary" />
              </div>
              <span className="text-sm font-bold text-BATAMART-primary">Search for "{searchInput}"</span>
              <ArrowRight className="w-3.5 h-3.5 text-BATAMART-primary flex-shrink-0 ml-auto" />
            </button>
          )}
        </div>,
        document.body
      )
    : null

  if (!splashDone) return <div className="min-h-screen bg-white" />

  return (
    <div className={`${isApp ? 'min-h-screen bg-[#e7ebf2]' : 'min-h-screen bg-[#f0f2f5]'} marketplace-shell`}>
      {SuggestionsDropdown}

      {/* ── Referral Popup Modal ── */}
      {showReferralPopup && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9990] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          onClick={() => setShowReferralPopup(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(145deg, #121212 0%, #1E1E1E 50%, #0ea5e9 100%)',
              animation: 'referralPopIn 0.45s cubic-bezier(0.34,1.4,0.64,1) both',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Glow orbs */}
            <div style={{ position:'absolute', top:'-40px', right:'-40px', width:'150px', height:'150px', borderRadius:'50%', background:'rgba(14,165,233,0.25)', filter:'blur(40px)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', bottom:'-30px', left:'-30px', width:'120px', height:'120px', borderRadius:'50%', background:'rgba(99,102,241,0.2)', filter:'blur(35px)', pointerEvents:'none' }} />

            {/* Close btn */}
            <button
              onClick={() => setShowReferralPopup(false)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Content */}
            <div className="p-6 pb-7 text-white relative z-[1]">
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 bg-yellow-400/20 border border-yellow-400/40 rounded-full px-3 py-1 mb-4">
                <span className="text-yellow-300 text-xs font-bold tracking-wide">🎁 EARN REAL MONEY</span>
              </div>

              {/* Headline */}
              <h2 className="text-2xl font-black leading-tight mb-1">
                Refer Friends &<br />
                <span className="text-[#0ea5e9]">Earn ₦120 Per Order!</span>
              </h2>
              <p className="text-blue-200 text-sm leading-relaxed mb-5">
                Every time someone you refer completes a delivery order on BataMart, <span className="text-white font-semibold">₦120 drops straight into your wallet</span> — no limit, no stress. Stack up referrals, stack up cash. 💰
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-white/10 rounded-2xl p-3 text-center border border-white/10">
                  <p className="text-2xl font-black text-yellow-300">₦120</p>
                  <p className="text-xs text-blue-200 mt-0.5">per completed order</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 text-center border border-white/10">
                  <p className="text-2xl font-black text-green-300">Unlimited</p>
                  <p className="text-xs text-blue-200 mt-0.5">referrals you can make</p>
                </div>
              </div>

              {/* Referral code display */}
              {referralCode && (
                <div className="bg-white/10 border border-white/20 rounded-2xl p-3 flex items-center gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-blue-300 mb-0.5">Your referral code</p>
                    <p className="font-black text-white tracking-widest text-sm truncate">{referralCode}</p>
                  </div>
                  <button
                    onClick={copyReferralCode}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-white text-[#1E1E1E] font-bold text-xs px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors"
                  >
                    {referralCopied
                      ? <><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Copied!</>
                      : <><Copy className="w-3.5 h-3.5" /> Copy Link</>
                    }
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={shareReferralWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm"
                  style={{ background: '#25D366', color: '#fff' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Share on WhatsApp
                </button>
                <button
                  onClick={() => { setShowReferralPopup(false); router.push('/referrals') }}
                  className="px-4 py-3 rounded-2xl font-bold text-sm bg-white/15 border border-white/20 text-white hover:bg-white/25 transition-colors flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" /> View
                </button>
              </div>
            </div>
          </div>

          <style>{`
            @keyframes referralPopIn {
              from { opacity: 0; transform: scale(0.85) translateY(20px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>,
        document.body
      )}

      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <PullIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      )}

      {/* Promo ticker */}
      <PromoTicker />

      {/* ══ HEADER ══ */}
      <header
        className={`batamart-header marketplace-header sticky top-0 z-40 ${isApp ? 'shadow-[0_8px_24px_rgba(15,23,42,0.16)]' : 'shadow-lg'}`}
        style={{
          // Subtle push-down effect during PTR — keeps header anchored-feeling
          transform: pullDistance > 0 ? `translateY(${Math.min(pullDistance * 0.15, 16)}px)` : undefined,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.35s cubic-bezier(0.22,1,0.36,1)' : 'none',
        }}
      >
        <div className={`marketplace-header-inner ${isApp ? 'max-w-5xl' : 'max-w-7xl'} mx-auto px-3 sm:px-6`}>

          {/* Top row */}
          <div className={`marketplace-top-row flex items-center gap-2 sm:gap-4 ${isApp ? 'py-3.5' : 'py-3'}`}>
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-white font-black text-lg leading-none tracking-tight">BATAMART</p>
                {universityShortName && (
                  <p className="text-white/60 text-[10px] font-semibold flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" /> {universityShortName}
                  </p>
                )}
              </div>
            </div>

            {/* Search bar */}
            <div ref={searchRef} className="flex-1 min-w-0">
              <div className="marketplace-search-input search-input flex items-center gap-2 bg-white rounded-xl shadow-md px-3 sm:px-4 ring-2 ring-transparent">
                <div
                  className="hidden sm:flex items-center gap-1 border-r border-gray-200 pr-3 mr-1 flex-shrink-0 cursor-pointer hover:text-BATAMART-primary transition-colors"
                  onClick={() => {}}
                >
                  <span className="text-xs font-bold text-gray-500 whitespace-nowrap">All</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </div>
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); updateDropdownPos(); setShowSuggestions(true) }}
                  onFocus={() => { updateDropdownPos(); setShowSuggestions(true) }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search products, sellers, categories..."
                  className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400 py-3 min-w-0"
                  autoComplete="off"
                />
                {searchInput && (
                  <button onClick={() => { setSearchInput(''); setShowSuggestions(false) }} className="text-gray-400 hover:text-gray-600 p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleSearch()}
                  className="flex-shrink-0 px-4 py-2 bg-BATAMART-primary hover:bg-BATAMART-dark text-white rounded-lg font-black text-sm transition-colors"
                >
                  <span className="hidden sm:inline">Search</span>
                  <Search className="w-4 h-4 sm:hidden" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <Link href="/sell"
                className="btn-press glow-pulse hidden sm:flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3.5 py-2 rounded-xl font-bold text-xs ring-1 ring-white/20 transition-colors">
                <Sparkles className="w-3.5 h-3.5" /> Sell
              </Link>
              <Link href="/report"
                className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/80 px-3 py-2 rounded-xl font-semibold text-xs ring-1 ring-white/10 transition-colors">
                <AlertCircle className="w-3.5 h-3.5" />
              </Link>
              {!isApp && (
                <Link href="/sell" className="btn-press sm:hidden flex items-center justify-center w-10 h-10 bg-white/15 rounded-xl">
                  <Sparkles className="w-4 h-4 text-white" />
                </Link>
              )}
            </div>
          </div>

          {/* Category nav */}
          <div className="marketplace-categories flex items-center justify-between gap-2 pb-2 border-t border-white/10 pt-2">
            <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => handleCategorySelect(cat.name)}
                  className={`cat-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold whitespace-nowrap text-[11px] sm:text-xs flex-shrink-0 transition-all ${
                    selectedCategory === cat.name
                      ? 'cat-active bg-white text-BATAMART-primary shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="hidden sm:inline">{cat.name}</span>
                  <span className="sm:hidden">{cat.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5 flex-shrink-0">
              {(['feed', 'grid'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-2.5 py-1.5 rounded-md text-[11px] font-bold capitalize transition-all"
                  style={viewMode === mode ? { background: 'white', color: '#6366f1' } : { color: 'rgba(255,255,255,0.65)' }}
                >
                  {mode === 'feed' ? <List className="w-3.5 h-3.5" /> : <Grid3X3 className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Trending chips */}
          <div className="flex items-center gap-2 pb-2.5 overflow-hidden">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-wider flex-shrink-0 flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" />
            </span>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {TRENDING_SEARCHES.map(tag => (
                <button
                  key={tag}
                  onClick={() => router.push(`/search?q=${encodeURIComponent(tag)}`)}
                  className="hot-tag flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white text-white/80 hover:text-BATAMART-primary rounded-full text-[10px] font-bold whitespace-nowrap flex-shrink-0 transition-all"
                >
                  {tag}
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

        ) : selectedCategory !== 'All' ? (
          /* ── CATEGORY FILTER VIEW ── */
          <div>
            <div className="flex items-center gap-2 mb-4 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <button
                onClick={() => handleCategorySelect('All')}
                className="text-xs font-bold text-gray-400 hover:text-BATAMART-primary transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> All
              </button>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-bold text-gray-700">{selectedCategory}</span>
              {maxPriceFilter !== null && (
                <span className="flex items-center gap-1 ml-1 px-2 py-0.5 bg-BATAMART-primary/10 text-BATAMART-primary rounded-full text-[11px] font-black">
                  <Tag className="w-3 h-3" /> Under {fmt(maxPriceFilter)}
                  <button onClick={() => setMaxPriceFilter(null)} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as 'relevance' | 'price_asc' | 'price_desc' | 'newest')}
                  className="text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 outline-none"
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
                <span className="text-[11px] text-gray-400 font-medium">{sortedFilteredByCategory.length} items</span>
              </div>
            </div>
            {sortedFilteredByCategory.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-semibold mb-4">Nothing here yet</p>
                <Link href="/sell" className="btn-press inline-flex items-center gap-2 px-5 py-2.5 bg-BATAMART-primary text-white rounded-xl font-bold text-sm shadow-md">
                  <Sparkles className="w-4 h-4" /> List a Product
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {sortedFilteredByCategory.map((p, i) => (
                  <ProductCard key={p.id} product={p} onClick={() => handleProductClick(p.id)} delay={i * 40} />
                ))}
              </div>
            )}
          </div>

        ) : viewMode === 'grid' ? (
          /* ── GRID VIEW ── */
          <div>
            <div className="flex items-center justify-between mb-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm gap-2">
              <LiveStatsBar count={allProducts.length} />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as 'relevance' | 'price_asc' | 'price_desc' | 'newest')}
                className="text-xs font-semibold border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 outline-none"
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
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                <LiveStatsBar count={allProducts.length} />
              </div>
            )}

            {/* ── Live Activity Marquee ── */}
            {allProducts.length > 0 && (
              <LiveActivityMarquee products={allProducts} />
            )}

            {/* ── Campus Stats Banner ── */}
            <StatsBanner />

            {/* ── Shop by Category (showcase panels) ── */}
            {allProducts.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-black text-gray-800 section-header-line">Shop by Category</h2>
                </div>
                <ShowcasePanels allProducts={allProducts} onCategorySelect={handleCategorySelect} renderSeed={renderSeed} />
              </div>
            )}

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
                  <h2 className="text-base font-black text-gray-800 section-header-line">Campus Deals by Budget</h2>
                  <span className="text-[11px] text-gray-400 font-medium">Tap a price to filter</span>
                </div>
                <PricePanelsRow allProducts={allProducts} onCategorySelect={handleCategorySelect} renderSeed={renderSeed} />
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
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-end justify-between px-5 pt-5 pb-3 border-b border-gray-50">
                  <div>
                    <h2 className="text-base font-black text-gray-900 section-header-line">Recently Viewed</h2>
                    <p className="text-xs text-gray-400 font-medium mt-1">Pick up where you left off</p>
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
                title="📱 Tech on Campus"
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
                title="👔 Campus Style"
                subtitle="What students are wearing this season"
                sectionClass="section-stripe-orange"
              />
            )}

            {/* ── Best Sellers: Food ── */}
            {(productsByCategory['Groceries / Food / Fast Food']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Groceries / Food / Fast Food']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Groceries / Food / Fast Food')} title="Best Sellers in Food & Snacks" subtitle="Eat well, study harder" />
            )}

            {/* ── Top Campus Sellers ── */}
            {allProducts.length > 0 && (
              <TopSellersRow products={allProducts} onProductClick={handleProductClick} />
            )}

            {/* ── Your Interests ── */}
            {interestCategories.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-violet-500" />
                  <h2 className="text-base font-black text-gray-900">Your Interests</h2>
                  <span className="text-[10px] text-gray-400 font-medium">Based on your browsing</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {interestCategories.map((cat, i) => {
                    const catObj = CATEGORIES.find(c => c.name === cat)
                    return (
                      <button
                        key={cat}
                        onClick={() => handleCategorySelect(cat)}
                        className="interest-pill card-enter flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 shadow-sm"
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        <span>{catObj?.icon}</span> {cat}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Best Sellers: Beauty ── */}
            {(productsByCategory['Beauty & Personal Care']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Beauty & Personal Care']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Beauty & Personal Care')} title="Best Sellers in Beauty & Care" subtitle="Top-rated by campus students" />
            )}

            {/* ── Trust Banner ── */}
            <TrustBanner />

            {/* ── Beauty Mosaic ── */}
            {(productsByCategory['Beauty & Personal Care']?.length >= 3) && (
              <MosaicRow
                products={productsByCategory['Beauty & Personal Care']}
                onProductClick={handleProductClick}
                title="💄 Beauty & Glow"
                subtitle="Top beauty picks from campus sellers"
                sectionClass="section-stripe-emerald"
              />
            )}

            {/* ── Best Sellers: Gaming ── */}
            {(productsByCategory['Gaming']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Gaming']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Gaming')} title="Best Sellers in Gaming" subtitle="Level up your setup" />
            )}

            {/* ── Mega Category Grid ── */}
            <MegaCategoryGrid onCategorySelect={handleCategorySelect} />

            

            {/* ── Best Sellers: Home & Kitchen ── */}
            {(productsByCategory['Home & Kitchen']?.length > 0) && (
              <BestSellersRow products={productsByCategory['Home & Kitchen']} onProductClick={handleProductClick} onSeeAll={() => handleCategorySelect('Home & Kitchen')} title="Finds for Your Room" subtitle="Make your hostel feel like home" />
            )}

            {/* ── Home Mosaic ── */}
            {(productsByCategory['Home & Kitchen']?.length >= 3) && (
              <MosaicRow
                products={productsByCategory['Home & Kitchen']}
                onProductClick={handleProductClick}
                title="🏠 Room Goals"
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
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                <ShoppingBag className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 font-black text-lg mb-1">No products yet</p>
                <p className="text-gray-400 text-sm mb-6">Be the first seller on your campus!</p>
                <Link href="/sell" className="btn-press inline-flex items-center gap-2 px-6 py-3 bg-BATAMART-primary text-white rounded-xl font-black text-sm shadow-lg shadow-BATAMART-primary/25">
                  <Sparkles className="w-4 h-4" /> List a Product
                </Link>
              </div>
            )}

            {/* ── All Listings ── */}
            {discoverProducts.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-black text-gray-900 section-header-line">All Listings</h2>
                    <p className="text-xs text-gray-400 mt-1">Everything currently live in your campus marketplace</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {discoverProducts.map((p, i) => (
                    <ProductCard key={p.id} product={p} onClick={() => handleProductClick(p.id)} delay={i * 25} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Sell Button (mobile) */}
      {!isApp && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-40">
          <Link href="/sell" className="btn-press glow-pulse flex items-center gap-2 px-5 py-3 bg-BATAMART-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-BATAMART-primary/40">
            <Sparkles className="w-4 h-4" /> Sell
          </Link>
        </div>
      )}
    </div>
  )
}

