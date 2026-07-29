'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Heart, Gift, ChevronLeft, Search, X, Loader2, CheckCircle,
  Crown, Clock, ShoppingBag, HandHeart,
} from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { CAMPAIGNS, isCampaignWindowOpen } from '@/lib/campaigns'

const CAMPAIGN = CAMPAIGNS.GIRLFRIENDS_DAY
const PAGE_SIZE = 20

const GFD_CSS = `
  @keyframes gfdFadeUp {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .gfd-enter { opacity: 0; animation: gfdFadeUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }
`

function useCountdown(target: string) {
  const [msLeft, setMsLeft] = useState(() => new Date(target).getTime() - Date.now())
  useEffect(() => {
    const id = setInterval(() => setMsLeft(new Date(target).getTime() - Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])
  const clamped = Math.max(0, msLeft)
  const days = Math.floor(clamped / 86400000)
  const hours = Math.floor((clamped % 86400000) / 3600000)
  const minutes = Math.floor((clamped % 3600000) / 60000)
  const seconds = Math.floor((clamped % 60000) / 1000)
  return { days, hours, minutes, seconds, done: clamped <= 0 }
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-white/15 px-2.5 py-2 min-w-[52px]">
      <span className="text-lg font-semibold text-white tabular-nums leading-none">{String(value).padStart(2, '0')}</span>
      <span className="mt-1 text-[9px] font-medium uppercase tracking-wider text-white/70">{label}</span>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white">
      <div className="aspect-square animate-pulse-slow bg-surface" />
      <div className="space-y-2 p-4">
        <div className="h-3.5 w-full animate-pulse-slow rounded-full bg-surface" />
        <div className="h-3.5 w-2/3 animate-pulse-slow rounded-full bg-surface" />
        <div className="h-4 w-1/3 animate-pulse-slow rounded-full bg-surface" />
      </div>
    </div>
  )
}

export default function GirlfriendsDayPage() {
  const router = useRouter()
  const countdown = useCountdown(CAMPAIGN.endsAt)

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (document.getElementById('batamart-gfd-css')) return
    const s = document.createElement('style')
    s.id = 'batamart-gfd-css'
    s.textContent = GFD_CSS
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return }

    setLoading(true)
    fetch(`/api/products?campaignTag=${CAMPAIGN.key}&limit=100&sort=newest`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => setProducts(data.products || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [router])

  const handleProductClick = useCallback((id: string) => {
    const token = localStorage.getItem('token')
    if (!token) { router.push(`/login?redirect=${encodeURIComponent(`/product/${id}`)}`); return }
    fetch(`/api/products/${id}/view`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    router.push(`/product/${id}`)
  }, [router])

  const filtered = useMemo(() => {
    const q = searchInput.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.subcategory?.toLowerCase().includes(q) ||
      p.seller?.name?.toLowerCase().includes(q)
    )
  }, [products, searchInput])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [searchInput])

  useEffect(() => {
    if (!loaderRef.current) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) setVisibleCount((c) => c + PAGE_SIZE)
    }, { threshold: 0.1 })
    obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore])

  const windowOpen = isCampaignWindowOpen(CAMPAIGN.key)

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50/60 to-surface">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-rose-500 via-rose-500 to-pink-600">
        <Heart className="pointer-events-none absolute -top-3 left-[8%] h-10 w-10 text-white/10 animate-float-slow" fill="currentColor" strokeWidth={0} />
        <Heart className="pointer-events-none absolute top-10 right-[14%] h-14 w-14 text-white/10 animate-float-slower" fill="currentColor" strokeWidth={0} />
        <Heart className="pointer-events-none absolute bottom-4 left-[28%] h-8 w-8 text-white/10 animate-float-slow" fill="currentColor" strokeWidth={0} />
        <Heart className="pointer-events-none absolute bottom-10 right-[32%] h-6 w-6 text-white/10 animate-float-slower" fill="currentColor" strokeWidth={0} />
        <Crown className="pointer-events-none absolute top-1/3 right-[6%] h-5 w-5 text-white/20 animate-pulse-slow" />

        <div className="relative mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <button
            onClick={() => router.push('/marketplace')}
            className="flex items-center gap-2 text-sm font-semibold text-white/80 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Marketplace
          </button>
        </div>

        <div className="relative mx-auto max-w-7xl space-y-5 px-4 pb-7 pt-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 animate-scale-in items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30">
                <Heart className="h-6 w-6 animate-heartbeat text-white" strokeWidth={1.75} fill="currentColor" />
              </div>
              <div className="animate-slide-in-left">
                <h1 className="text-2xl font-semibold tracking-tight text-white">{CAMPAIGN.label}</h1>
                <p className="text-sm font-medium text-white/80">{CAMPAIGN.tagline}</p>
              </div>
            </div>

            {!countdown.done && windowOpen && (
              <div className="flex items-center gap-1.5">
                <div className="mr-1 flex items-center gap-1 text-white/70">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Ends in</span>
                </div>
                <CountdownUnit value={countdown.days} label="days" />
                <CountdownUnit value={countdown.hours} label="hrs" />
                <CountdownUnit value={countdown.minutes} label="min" />
                <CountdownUnit value={countdown.seconds} label="sec" />
              </div>
            )}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 ring-1 ring-white/20 transition-colors hover:bg-white/20 focus-within:bg-white/25 focus-within:ring-white/40">
            <Search className="h-4 w-4 flex-shrink-0 text-white/70" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search gifts, categories, sellers…"
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder-white/50"
            />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="text-white/60 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 pb-28 sm:px-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-secondary">
            {loading ? 'Loading gifts…' : `${filtered.length} gift${filtered.length !== 1 ? 's' : ''} tagged for ${CAMPAIGN.label}`}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10">
              <Gift className="h-7 w-7 text-rose-500" strokeWidth={1.75} />
            </div>
            <p className="mb-1 text-lg font-semibold text-ink-secondary">
              {searchInput ? 'No gifts match your search' : 'No gifts tagged yet'}
            </p>
            <p className="mx-auto mb-5 max-w-sm text-sm text-ink-muted">
              {searchInput
                ? 'Try a different search term.'
                : 'Sellers are still adding products to this collection — check back soon.'}
            </p>
            <button
              onClick={() => searchInput ? setSearchInput('') : router.push('/sell')}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-rose-600"
            >
              {searchInput ? <X className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
              {searchInput ? 'Clear search' : 'List a gift for Girlfriend’s Day'}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {visible.map((p, i) => (
                <div key={p.id} className="gfd-enter" style={{ animationDelay: `${(i % PAGE_SIZE) * 30}ms` }}>
                  <ProductCard product={p} onOpen={() => handleProductClick(p.id)} />
                </div>
              ))}
            </div>

            <div ref={loaderRef} className="flex items-center justify-center py-8">
              {hasMore ? (
                <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading more…
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-ink-muted">
                  <CheckCircle className="h-5 w-5" />
                  <p className="text-xs font-semibold">You&apos;ve seen every gift in the collection</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Seller callout ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-200/60 bg-gradient-to-r from-rose-50 to-pink-50 px-5 py-5 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-rose-500/10">
              <HandHeart className="h-5 w-5 text-rose-500" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Selling something gift-worthy?</p>
              <p className="text-xs text-ink-muted">Tag your listing for {CAMPAIGN.label} to appear in this collection — no discount required.</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/sell')}
            className="flex-shrink-0 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
          >
            List a product
          </button>
        </div>
      </div>
    </div>
  )
}
