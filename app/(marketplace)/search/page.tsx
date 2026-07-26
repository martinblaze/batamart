'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpDown, ChevronLeft, Filter, Grid2x2, List, Loader2, MapPin, Search, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react'
import { CATEGORY_TREE } from '@/lib/variants'
import { getCategoryIcon } from '@/lib/category-icons'
import { authFetch } from '@/lib/auth-client'
import SearchAutocomplete from '@/components/SearchAutocomplete'
import FilterGroup from '@/components/FilterGroup'
import PriceRangeSlider from '@/components/PriceRangeSlider'
import ProductCard from '@/components/ProductCard'
import { primeImageBatch } from '@/lib/image-cache'
import GirlfriendsDayBanner from '@/components/marketplace/GirlfriendsDayBanner'

type Product = {
  id: string
  name: string
  price: number
  priceDisplay?: string | null
  images?: string[]
  isHot?: boolean
  isNew?: boolean
  isDeal?: boolean
  campaignTag?: string | null
  campaignExpiresAt?: string | null
  deliveryEstimate?: string | null
  landmark?: string | null
  avgRating?: number
  totalReviews?: number
  quantity?: number
  category?: string
  subcategory?: string | null
  seller?: { id?: string; name?: string; trustLevel?: string; avgRating?: number }
}

type FilterDef = {
  key: string
  label: string
  type: 'select' | 'multi_select' | 'boolean' | 'range'
  source: 'attribute' | 'variant' | 'merged'
  options: Array<{ value: string; count: number }>
  selectedValues: string[]
}

type SearchState = {
  query: string
  categoryKey: string
  subcategoryKey: string
  sellerId: string
  filters: Record<string, string[]>
  minPrice: number
  maxPrice: number
  minRating: number
  inStockOnly: boolean
  deliveryFast: boolean
  zone: string
  sortBy: string
  page: number
  viewMode: 'grid' | 'list'
}

const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)
const ALL_CATEGORIES = [{ key: 'all', label: 'All' }, ...Object.entries(CATEGORY_TREE).map(([key, cat]) => ({ key, label: cat.label }))]
const SORT_OPTIONS = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Newest', value: 'newest' },
  { label: 'Top Rated', value: 'rating' },
  { label: 'Most Popular', value: 'popular' },
]
const CONDITION_OPTIONS = [
  { value: 'Brand New', count: 0 },
  { value: 'UK Used', count: 0 },
  { value: 'Nigerian Used', count: 0 },
  { value: 'Refurbished', count: 0 },
]
const COMMON_TERMS = ['samsung', 'iphone', 'laptop', 'headphones', 'shoes', 'sneakers', 'backpack', 'fridge', 'tv', 'mouse', ...Object.values(CATEGORY_TREE).map((cat) => cat.label.toLowerCase()), ...Object.values(CATEGORY_TREE).flatMap((cat) => Object.values(cat.subcategories).map((sub) => sub.label.toLowerCase()))]

function levenshtein(a: string, b: string) {
  const s = a.toLowerCase(), t = b.toLowerCase()
  const dp: number[][] = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0))
  for (let i = 0; i <= s.length; i++) dp[i][0] = i
  for (let j = 0; j <= t.length; j++) dp[0][j] = j
  for (let i = 1; i <= s.length; i++) for (let j = 1; j <= t.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1))
  return dp[s.length][t.length]
}

function didYouMean(query: string) {
  const q = query.trim().toLowerCase()
  if (!q || q.length < 3) return ''
  let best = '', bestScore = Infinity
  for (const term of COMMON_TERMS) {
    const score = levenshtein(q, term)
    if (score < bestScore) { bestScore = score; best = term }
  }
  return bestScore <= 2 ? best : ''
}

function parseArrayParams(params: URLSearchParams): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const skip = new Set(['q', 'search', 'categoryKey', 'category', 'subcategoryKey', 'sub', 'sellerId', 'page', 'limit', 'sort', 'sortBy', 'minPrice', 'maxPrice', 'minRating', 'rating', 'inStock', 'delivery', 'view', 'attributes', 'hostel', 'zone', 'fastDelivery'])
  const raw = params.get('attributes')
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') for (const [key, value] of Object.entries(parsed)) out[key] = [...new Set((Array.isArray(value) ? value : [value]).map(String).map((v) => v.trim()).filter(Boolean))]
    } catch {}
  }
  params.forEach((value, key) => {
    if (skip.has(key)) return
    const cleanKey = key.endsWith('[]') ? key.slice(0, -2) : key
    const values = value.split(',').map((v) => v.trim()).filter(Boolean)
    if (values.length) out[cleanKey] = [...new Set([...(out[cleanKey] || []), ...values])]
  })
  return out
}

function stateFromParams(params: URLSearchParams): SearchState {
  return {
    query: params.get('q') || params.get('search') || '',
    categoryKey: params.get('categoryKey') || params.get('category') || 'all',
    subcategoryKey: params.get('subcategoryKey') || params.get('sub') || '',
    sellerId: params.get('sellerId') || '',
    filters: parseArrayParams(params),
    minPrice: Number(params.get('minPrice') || '0') || 0,
    maxPrice: Number(params.get('maxPrice') || '0') || 0,
    minRating: Number(params.get('minRating') || params.get('rating') || '0') || 0,
    inStockOnly: (params.get('inStock') || '').toLowerCase() === 'true',
    deliveryFast: (params.get('delivery') || '').toLowerCase() === 'fast',
    zone: params.get('zone') || '',
    sortBy: params.get('sortBy') || params.get('sort') || 'relevance',
    page: Math.max(1, Number(params.get('page') || '1') || 1),
    viewMode: params.get('view') === 'list' ? 'list' : 'grid',
  }
}

function buildParams(state: SearchState) {
  const params = new URLSearchParams()
  if (state.query.trim()) params.set('q', state.query.trim())
  if (state.categoryKey !== 'all') params.set('categoryKey', state.categoryKey)
  if (state.subcategoryKey) params.set('subcategoryKey', state.subcategoryKey)
  if (state.sellerId) params.set('sellerId', state.sellerId)
  if (state.minPrice > 0) params.set('minPrice', String(state.minPrice))
  if (state.maxPrice > 0) params.set('maxPrice', String(state.maxPrice))
  if (state.minRating > 0) params.set('minRating', String(state.minRating))
  if (state.inStockOnly) params.set('inStock', 'true')
  if (state.deliveryFast) params.set('delivery', 'fast')
  if (state.zone) params.set('zone', state.zone)
  if (state.sortBy !== 'relevance') params.set('sortBy', state.sortBy)
  if (state.page > 1) params.set('page', String(state.page))
  if (state.viewMode === 'list') params.set('view', 'list')
  Object.entries(state.filters).forEach(([key, values]) => values.forEach((value) => params.append(`${key}[]`, value)))
  return params
}

function countActive(filters: Record<string, string[]>, priceRange: [number, number], bounds: { min: number; max: number }, minRating: number, inStockOnly: boolean, deliveryFast: boolean, zone: string) {
  return Object.values(filters).filter((arr) => arr.length > 0).length + (priceRange[0] > bounds.min || priceRange[1] < bounds.max ? 1 : 0) + (minRating > 0 ? 1 : 0) + (inStockOnly ? 1 : 0) + (deliveryFast ? 1 : 0) + (zone ? 1 : 0)
}

function SkeletonCard() { return <div className="h-[360px] animate-pulse rounded-3xl bg-surface" /> }

function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-[70] md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-auto rounded-t-[28px] bg-white p-4 shadow-soft transition-transform ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-ink-secondary hover:bg-surface"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
function SearchPage() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const searchParamsString = params.toString()
  const lastUrlRef = useRef(searchParamsString)
  const parsed = useMemo(() => stateFromParams(params), [searchParamsString])

  const [query, setQuery] = useState(parsed.query)
  // Text shown in the on-page mobile search box as you type — separate from
  // `query` (which actually drives the results fetch) so typing doesn't fire
  // a search on every keystroke. Only committed to `query` on submit, on
  // clicking a dropdown suggestion, or on the explicit Search button.
  const [queryDraft, setQueryDraft] = useState(parsed.query)
  const [categoryKey, setCategoryKey] = useState(parsed.categoryKey)
  const [subcategoryKey, setSubcategoryKey] = useState(parsed.subcategoryKey)
  const [sellerId, setSellerId] = useState(parsed.sellerId)
  const [filters, setFilters] = useState<Record<string, string[]>>(parsed.filters)
  const [minPrice, setMinPrice] = useState(parsed.minPrice)
  const [maxPrice, setMaxPrice] = useState(parsed.maxPrice)
  const [priceBounds, setPriceBounds] = useState({ min: 0, max: 0 })
  const [minRating, setMinRating] = useState(parsed.minRating)
  const [inStockOnly, setInStockOnly] = useState(parsed.inStockOnly)
  const [deliveryFast, setDeliveryFast] = useState(parsed.deliveryFast)
  const [zone, setZone] = useState(parsed.zone)
  const [availableZones, setAvailableZones] = useState<string[]>([])
  const [sortBy, setSortBy] = useState(parsed.sortBy)
  const [page, setPage] = useState(parsed.page)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(parsed.viewMode)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [availableFilters, setAvailableFilters] = useState<FilterDef[]>([])
  const [topProducts, setTopProducts] = useState<Product[]>([])
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)

  const subcategories = useMemo(() => {
    if (categoryKey === 'all') return []
    return Object.entries(CATEGORY_TREE[categoryKey]?.subcategories || {}).map(([key, sub]) => ({ key, label: sub.label }))
  }, [categoryKey])
  const dynamicFilters = useMemo(() => availableFilters.filter((f) => f.key !== 'condition' && f.key !== 'conditionType'), [availableFilters])
  // Condition always shows this fixed set of options, but with real counts from the live data
  // instead of the hardcoded 0s it used to ship with.
  const conditionOptions = useMemo(() => {
    const live = availableFilters.find((f) => f.key === 'condition' || f.key === 'conditionType')
    const countMap = new Map((live?.options || []).map((o) => [o.value, o.count]))
    return CONDITION_OPTIONS.map((opt) => ({ value: opt.value, count: countMap.get(opt.value) ?? 0 }))
  }, [availableFilters])
  const activeCount = countActive(filters, [minPrice, maxPrice], priceBounds, minRating, inStockOnly, deliveryFast, zone)
  const suggestion = didYouMean(query)
  const filterPayload = useMemo(() => buildParams({ query, categoryKey, subcategoryKey, sellerId, filters, minPrice, maxPrice, minRating, inStockOnly, deliveryFast, zone, sortBy, page, viewMode }), [query, categoryKey, subcategoryKey, sellerId, filters, minPrice, maxPrice, minRating, inStockOnly, deliveryFast, zone, sortBy, page, viewMode])

  useEffect(() => {
    if (searchParamsString === lastUrlRef.current) return
    setQuery(parsed.query)
    setQueryDraft(parsed.query)
    setCategoryKey(parsed.categoryKey)
    setSubcategoryKey(parsed.subcategoryKey)
    setSellerId(parsed.sellerId)
    setFilters(parsed.filters)
    setMinPrice(parsed.minPrice)
    setMaxPrice(parsed.maxPrice)
    setMinRating(parsed.minRating)
    setInStockOnly(parsed.inStockOnly)
    setDeliveryFast(parsed.deliveryFast)
    setZone(parsed.zone)
    setSortBy(parsed.sortBy)
    setPage(parsed.page)
    setViewMode(parsed.viewMode)
  }, [searchParamsString, parsed])

  useEffect(() => {
    const next = buildParams({ query, categoryKey, subcategoryKey, sellerId, filters, minPrice, maxPrice, minRating, inStockOnly, deliveryFast, zone, sortBy, page, viewMode })
    const nextString = next.toString()
    if (nextString === searchParamsString) return
    lastUrlRef.current = nextString
    router.replace(`${pathname}${nextString ? `?${nextString}` : ''}`, { scroll: false })
  }, [query, categoryKey, subcategoryKey, sellerId, filters, minPrice, maxPrice, minRating, inStockOnly, deliveryFast, zone, sortBy, page, viewMode])

  useEffect(() => {
    const loadBounds = async () => {
      try {
        const res = await authFetch(`/api/product-filters?${filterPayload.toString()}`)
        const data = await res.json()
        setAvailableFilters(data.filters || [])
        const bounds = data.price || { min: 0, max: 0 }
        setPriceBounds(bounds)

      } catch {
        setAvailableFilters([])
      }
    }
    loadBounds()
  }, [filterPayload.toString(), categoryKey, subcategoryKey, sellerId])

  useEffect(() => {
    const loadTop = async () => {
      try {
        const res = await authFetch('/api/products/feed?mode=top&pageSize=4')
        const data = await res.json()
        const top = data.products || []
        setTopProducts(top)
        primeImageBatch(top.map((product: Product) => product.images?.[0]), 4)
      } catch {
        setTopProducts([])
      }
    }
    loadTop()
  }, [])

  useEffect(() => {
    const loadZones = async () => {
      try {
        const meRes = await authFetch('/api/auth/me')
        const meData = await meRes.json()
        const universityId = meData?.user?.universityId
        if (!universityId) return
        const uniRes = await fetch('/api/universities')
        const uniData = await uniRes.json()
        const uni = (uniData.universities || []).find((u: any) => u.id === universityId)
        setAvailableZones(Array.isArray(uni?.deliveryAreas) ? uni.deliveryAreas : [])
      } catch {
        setAvailableZones([])
      }
    }
    loadZones()
  }, [])

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await authFetch(`/api/products?${filterPayload.toString()}`)
        const data = await res.json()
        setTotal(data.total || 0)
        setHasMore(Boolean(data.hasMore))
        const next = data.products || []
        if (page === 1) setProducts(next)
        else setProducts((prev) => [...prev, ...next])
        primeImageBatch(next.map((product: Product) => product.images?.[0]), 10)
      } catch {
        if (page === 1) setProducts([])
        setHasMore(false)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    }
    if (page === 1) setLoading(true)
    else setLoadingMore(true)
    loadProducts()
  }, [filterPayload.toString(), page])

  const knownSubcategories = categoryKey !== 'all' ? Object.entries(CATEGORY_TREE[categoryKey]?.subcategories || {}) : []
  const searchWithinSeller = sellerId ? 'within this seller' : ''

  const updateCategory = (next: string) => {
    setCategoryKey(next)
    setSubcategoryKey('')
    setFilters({})
    setPage(1)
  }
  const updateSubcategory = (next: string) => { setSubcategoryKey((current) => (current === next ? '' : next)); setPage(1) }
  const toggleFilterValue = (key: string, value: string) => {
    setFilters((prev) => {
      const next = new Set(prev[key] || [])
      next.has(value) ? next.delete(value) : next.add(value)
      return { ...prev, [key]: Array.from(next) }
    })
    setPage(1)
  }
  const clearAll = () => {
    setFilters({})
    setMinPrice(0)
    setMaxPrice(0)
    setMinRating(0)
    setInStockOnly(false)
    setDeliveryFast(false)
    setZone('')
    setSortBy('relevance')
    setPage(1)
  }

  const filterPanel = (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-white p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-ink">Filters</h2>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">{activeCount}</span>
          </div>
          {activeCount > 0 && <button onClick={clearAll} className="text-xs font-semibold text-primary hover:underline">Clear all</button>}
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Category</p>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {ALL_CATEGORIES.map((cat) => {
                const Icon = getCategoryIcon(cat.key)
                return (
                <button key={cat.key} type="button" onClick={() => updateCategory(cat.key)} className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition ${categoryKey === cat.key ? 'bg-primary text-white' : 'bg-surface text-ink-secondary hover:bg-border'}`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />{cat.label}
                </button>
                )
              })}
            </div>
          </div>

          {categoryKey !== 'all' && knownSubcategories.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Subcategory</p>
              <div className="grid grid-cols-2 gap-2">
                {knownSubcategories.map(([key, sub]) => (
                  <button key={key} type="button" onClick={() => updateSubcategory(key)} className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${subcategoryKey === key ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-white text-ink-secondary hover:bg-surface'}`}>
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <PriceRangeSlider min={priceBounds.min} max={priceBounds.max} value={[minPrice || priceBounds.min, maxPrice || priceBounds.max]} onChange={(next) => { setMinPrice(next[0]); setMaxPrice(next[1]); setPage(1) }} />

          <FilterGroup title="Condition" options={conditionOptions} selectedValues={filters.condition || []} onChange={(value) => toggleFilterValue('condition', value)} />

          <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Rating</h3>
              {minRating > 0 && <button onClick={() => { setMinRating(0); setPage(1) }} className="text-xs font-semibold text-primary hover:underline">Clear</button>}
            </div>
            <div className="space-y-2">
              {[4, 3, 2].map((rating) => (
                <label key={rating} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-ink-secondary hover:bg-surface">
                  <input type="radio" checked={minRating === rating} onChange={() => { setMinRating(rating); setPage(1) }} className="h-4 w-4 accent-primary" />
                  <span className="inline-flex items-center gap-1">{rating}<Star className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} /> & above</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 shadow-soft">
            <span><span className="block text-sm font-semibold text-ink">In stock only</span><span className="block text-xs text-ink-muted">Hide out-of-stock listings</span></span>
            <input type="checkbox" checked={inStockOnly} onChange={(e) => { setInStockOnly(e.target.checked); setPage(1) }} className="h-5 w-5 rounded border-border text-primary" />
          </label>

          <label className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 shadow-soft">
            <span><span className="block text-sm font-semibold text-ink">Fast delivery</span><span className="block text-xs text-ink-muted">Prioritize quicker delivery estimates</span></span>
            <input type="checkbox" checked={deliveryFast} onChange={(e) => { setDeliveryFast(e.target.checked); setPage(1) }} className="h-5 w-5 rounded border-border text-primary" />
          </label>

          {availableZones.length > 0 && (
            <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink"><MapPin className="h-4 w-4 text-ink-muted" /> Delivery zone</h3>
                {zone && <button onClick={() => { setZone(''); setPage(1) }} className="text-xs font-semibold text-primary hover:underline">Clear</button>}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableZones.map((z) => (
                  <button key={z} type="button" onClick={() => { setZone((current) => (current === z ? '' : z)); setPage(1) }} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${zone === z ? 'bg-primary text-white' : 'bg-surface text-ink-secondary hover:bg-border'}`}>
                    {z}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dynamicFilters.length > 0 && <div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">More filters</p>{dynamicFilters.map((filter) => (<FilterGroup key={filter.key} title={filter.label} options={filter.options} selectedValues={filters[filter.key] || filter.selectedValues || []} onChange={(value) => toggleFilterValue(filter.key, value)} />))}</div>}
        </div>
      </div>
    </div>
  )
  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur/95">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/marketplace')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-ink-secondary shadow-soft"><ChevronLeft className="h-4 w-4" /></button>
            {/* Desktop already has a search bar in the navbar — only show this one on mobile, where the navbar collapses to an icon. */}
            <div className="min-w-0 flex-1 md:hidden">
              <SearchAutocomplete
                value={queryDraft}
                onChange={setQueryDraft}
                onSubmit={() => { setQuery(queryDraft); setPage(1) }}
                onSelect={(text) => { setQueryDraft(text); setQuery(text); setPage(1) }}
                autoFocus={params.get('focus') === '1'}
              />
            </div>
            <button
              type="button"
              onClick={() => { setQuery(queryDraft); setPage(1) }}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-soft md:hidden"
              aria-label="Search"
            >
              <Search className="h-4 w-4" strokeWidth={1.75} />
            </button>
            {query && <p className="hidden md:block min-w-0 flex-1 truncate text-sm font-medium text-ink-secondary">Results for &quot;{query}&quot;</p>}
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {ALL_CATEGORIES.map((cat) => {
              const Icon = getCategoryIcon(cat.key)
              return (<button key={cat.key} type="button" onClick={() => updateCategory(cat.key)} className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition ${categoryKey === cat.key ? 'bg-primary text-white' : 'bg-surface text-ink-secondary hover:bg-border'}`}><Icon className="h-3.5 w-3.5" strokeWidth={1.75} />{cat.label}</button>)
            })}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 md:hidden">
            <button onClick={() => setFilterSheetOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink-secondary shadow-soft"><Filter className="h-4 w-4" /> Filter {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">{activeCount}</span>}</button>
            <button onClick={() => setSortSheetOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink-secondary shadow-soft"><SlidersHorizontal className="h-4 w-4" /> Sort</button>
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-white p-1 shadow-soft"><button onClick={() => setViewMode('grid')} className={`rounded-xl p-2 ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-ink-secondary'}`}><Grid2x2 className="h-4 w-4" /></button><button onClick={() => setViewMode('list')} className={`rounded-xl p-2 ${viewMode === 'list' ? 'bg-primary text-white' : 'text-ink-secondary'}`}><List className="h-4 w-4" /></button></div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
        <div className="mb-4"><GirlfriendsDayBanner /></div>
        <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
          <aside className="sticky top-[132px] hidden max-h-[calc(100vh-150px)] overflow-auto rounded-3xl md:block">{filterPanel}</aside>
          <main className="min-w-0">
            <div className="rounded-3xl border border-border bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-sm font-semibold text-ink">Showing {Math.min((page - 1) * 40 + 1, total)}-{Math.min(page * 40, total)} of {total} results</p><p className="mt-1 text-xs text-ink-muted">{query ? <>for &quot;{query}&quot;</> : 'Browse campus products'} {searchWithinSeller}</p></div>
                <div className="hidden items-center gap-2 md:flex">
                  <div className="inline-flex rounded-2xl border border-border bg-surface p-1">{SORT_OPTIONS.map((option) => (<button key={option.value} type="button" onClick={() => { setSortBy(option.value); setPage(1) }} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${sortBy === option.value ? 'bg-primary text-white shadow-soft shadow-soft' : 'text-ink-secondary hover:bg-white'}`}>{option.label}</button>))}</div>
                  <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-white p-1 shadow-soft"><button onClick={() => setViewMode('grid')} className={`rounded-xl p-2 ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-ink-secondary'}`}><Grid2x2 className="h-4 w-4" /></button><button onClick={() => setViewMode('list')} className={`rounded-xl p-2 ${viewMode === 'list' ? 'bg-primary text-white' : 'text-ink-secondary'}`}><List className="h-4 w-4" /></button></div>
                </div>
              </div>
            </div>

            {suggestion && query && suggestion !== query.toLowerCase() && (<div className="mt-3 rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning shadow-soft">Did you mean <button className="font-semibold underline" onClick={() => { setQuery(suggestion); setQueryDraft(suggestion); setPage(1) }}>{suggestion}</button>?</div>)}

            {loading && page === 1 ? (
              <div className={`mt-4 grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : products.length === 0 ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-3xl border border-dashed border-border bg-white p-8 text-center shadow-soft"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface"><Search className="h-8 w-8 text-ink-muted" /></div><h2 className="text-xl font-semibold text-ink">No results for &quot;{query || 'your search'}&quot;</h2><p className="mx-auto mt-2 max-w-lg text-sm text-ink-secondary">Try broadening the search, switching categories, or clearing filters.</p>{suggestion && suggestion !== query.toLowerCase() && <div className="mt-4"><button onClick={() => { setQuery(suggestion); setQueryDraft(suggestion); setPage(1) }} className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft shadow-soft">Did you mean {suggestion}?</button></div>}<div className="mt-5 flex flex-wrap justify-center gap-2"><button onClick={clearAll} className="rounded-2xl bg-surface px-4 py-2.5 text-sm font-semibold text-ink-secondary">Broaden search</button><Link href="/marketplace" className="rounded-2xl bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary">Browse marketplace</Link></div></div>
                {topProducts.length > 0 && <div><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles className="h-4 w-4 text-primary" /> Popular right now</div><div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>{topProducts.slice(0, 4).map((product, index) => (<ProductCard key={product.id} product={product} layout={viewMode} onOpen={() => router.push(`/product/${product.id}`)} priority={index < 2} />))}</div></div>}
              </div>
            ) : (
              <>
                <div className={`mt-4 grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>{products.map((product, index) => (<ProductCard key={product.id} product={product} layout={viewMode} onOpen={() => router.push(`/product/${product.id}`)} priority={page === 1 && index < 4} />))}</div>
                {loadingMore && <div className={`mt-4 grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>}
                {hasMore && <div className="mt-6 flex justify-center"><button onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-soft">{loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpDown className="h-4 w-4" />} Load more</button></div>}
              </>
            )}
          </main>
        </div>
      </div>

      <Sheet open={filterSheetOpen} title="Filters" onClose={() => setFilterSheetOpen(false)}>{filterPanel}</Sheet>
      <Sheet open={sortSheetOpen} title="Sort by" onClose={() => setSortSheetOpen(false)}><div className="space-y-2">{SORT_OPTIONS.map((option) => (<label key={option.value} className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 ${sortBy === option.value ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-white text-ink-secondary'}`}><span className="text-sm font-semibold">{option.label}</span><input type="radio" checked={sortBy === option.value} onChange={() => { setSortBy(option.value); setPage(1); setSortSheetOpen(false) }} className="h-4 w-4 accent-primary" /></label>))}</div></Sheet>
    </div>
  )
}

export default function SearchPageWrapper() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-surface"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}><SearchPage /></Suspense>
}

