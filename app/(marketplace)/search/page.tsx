'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpDown, ChevronLeft, Filter, Grid2x2, List, Loader2, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { CATEGORY_TREE } from '@/lib/variants'
import { authFetch } from '@/lib/auth-client'
import SearchAutocomplete from '@/components/SearchAutocomplete'
import FilterGroup from '@/components/FilterGroup'
import PriceRangeSlider from '@/components/PriceRangeSlider'
import ProductCard from '@/components/ProductCard'

type Product = {
  id: string
  name: string
  price: number
  priceDisplay?: string | null
  images?: string[]
  isHot?: boolean
  isNew?: boolean
  isDeal?: boolean
  deliveryEstimate?: string | null
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
  sortBy: string
  page: number
  viewMode: 'grid' | 'list'
}

const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)
const ALL_CATEGORIES = [{ key: 'all', label: 'All', icon: '🛍️' }, ...Object.entries(CATEGORY_TREE).map(([key, cat]) => ({ key, label: cat.label, icon: cat.icon }))]
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
  const skip = new Set(['q', 'search', 'categoryKey', 'category', 'subcategoryKey', 'sub', 'sellerId', 'page', 'limit', 'sort', 'sortBy', 'minPrice', 'maxPrice', 'minRating', 'rating', 'inStock', 'delivery', 'view', 'attributes', 'hostel', 'fastDelivery'])
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
  if (state.sortBy !== 'relevance') params.set('sortBy', state.sortBy)
  if (state.page > 1) params.set('page', String(state.page))
  if (state.viewMode === 'list') params.set('view', 'list')
  Object.entries(state.filters).forEach(([key, values]) => values.forEach((value) => params.append(`${key}[]`, value)))
  return params
}

function countActive(filters: Record<string, string[]>, priceRange: [number, number], bounds: { min: number; max: number }, minRating: number, inStockOnly: boolean, deliveryFast: boolean) {
  return Object.values(filters).filter((arr) => arr.length > 0).length + (priceRange[0] > bounds.min || priceRange[1] < bounds.max ? 1 : 0) + (minRating > 0 ? 1 : 0) + (inStockOnly ? 1 : 0) + (deliveryFast ? 1 : 0)
}

function SkeletonCard() { return <div className="h-[360px] animate-pulse rounded-3xl bg-gray-100 dark:bg-[#141821]" /> }

function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-[70] md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-auto rounded-t-[28px] bg-white p-4 shadow-2xl transition-transform dark:bg-[#0f1115] ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-[#272b33]" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900 dark:text-[#e5e7eb]">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"><X className="h-4 w-4" /></button>
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
  const activeCount = countActive(filters, [minPrice, maxPrice], priceBounds, minRating, inStockOnly, deliveryFast)
  const suggestion = didYouMean(query)
  const filterPayload = useMemo(() => buildParams({ query, categoryKey, subcategoryKey, sellerId, filters, minPrice, maxPrice, minRating, inStockOnly, deliveryFast, sortBy, page, viewMode }), [query, categoryKey, subcategoryKey, sellerId, filters, minPrice, maxPrice, minRating, inStockOnly, deliveryFast, sortBy, page, viewMode])

  useEffect(() => {
    if (searchParamsString === lastUrlRef.current) return
    setQuery(parsed.query)
    setCategoryKey(parsed.categoryKey)
    setSubcategoryKey(parsed.subcategoryKey)
    setSellerId(parsed.sellerId)
    setFilters(parsed.filters)
    setMinPrice(parsed.minPrice)
    setMaxPrice(parsed.maxPrice)
    setMinRating(parsed.minRating)
    setInStockOnly(parsed.inStockOnly)
    setDeliveryFast(parsed.deliveryFast)
    setSortBy(parsed.sortBy)
    setPage(parsed.page)
    setViewMode(parsed.viewMode)
  }, [searchParamsString, parsed])

  useEffect(() => {
    const next = buildParams({ query, categoryKey, subcategoryKey, sellerId, filters, minPrice, maxPrice, minRating, inStockOnly, deliveryFast, sortBy, page, viewMode })
    const nextString = next.toString()
    if (nextString === searchParamsString) return
    lastUrlRef.current = nextString
    router.replace(`${pathname}${nextString ? `?${nextString}` : ''}`, { scroll: false })
  }, [query, categoryKey, subcategoryKey, sellerId, filters, minPrice, maxPrice, minRating, inStockOnly, deliveryFast, sortBy, page, viewMode])

  useEffect(() => {
    const loadBounds = async () => {
      try {
        const res = await authFetch(`/api/product-filters?${filterPayload.toString()}`)
        const data = await res.json()
        setAvailableFilters(data.filters || [])
        const bounds = data.price || { min: 0, max: 0 }
        setPriceBounds(bounds)
        if (!parsed.minPrice && !parsed.maxPrice && bounds.max > 0 && page === 1) {
          setMinPrice(bounds.min)
          setMaxPrice(bounds.max)
        }
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
        setTopProducts(data.products || [])
      } catch {
        setTopProducts([])
      }
    }
    loadTop()
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
    setMinPrice(priceBounds.min)
    setMaxPrice(priceBounds.max)
    setMinRating(0)
    setInStockOnly(false)
    setDeliveryFast(false)
    setSortBy('relevance')
    setPage(1)
  }

  const filterPanel = (
    <div className="space-y-4">
      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#272b33] dark:bg-[#0f1115]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-gray-900 dark:text-[#e5e7eb]">Filters</h2>
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white">{activeCount}</span>
          </div>
          {activeCount > 0 && <button onClick={clearAll} className="text-xs font-black text-indigo-600 hover:underline">Clear all</button>}
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Category</p>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {ALL_CATEGORIES.map((cat) => (
                <button key={cat.key} type="button" onClick={() => updateCategory(cat.key)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black transition ${categoryKey === cat.key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#1a1f2a] dark:text-[#cbd5e1]'}`}>
                  <span className="mr-1">{cat.icon}</span>{cat.label}
                </button>
              ))}
            </div>
          </div>

          {categoryKey !== 'all' && knownSubcategories.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wider text-gray-400">Subcategory</p>
              <div className="grid grid-cols-2 gap-2">
                {knownSubcategories.map(([key, sub]) => (
                  <button key={key} type="button" onClick={() => updateSubcategory(key)} className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${subcategoryKey === key ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-[#272b33] dark:bg-[#0b0d12] dark:text-[#cbd5e1]'}`}>
                    {sub.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <PriceRangeSlider min={priceBounds.min} max={priceBounds.max} value={[minPrice || priceBounds.min, maxPrice || priceBounds.max]} onChange={(next) => { setMinPrice(next[0]); setMaxPrice(next[1]); setPage(1) }} />

          <FilterGroup title="Condition" options={CONDITION_OPTIONS} selectedValues={filters.condition || []} onChange={(value) => toggleFilterValue('condition', value)} />

          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#272b33] dark:bg-[#0f1115]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 dark:text-[#e5e7eb]">Rating</h3>
              {minRating > 0 && <button onClick={() => { setMinRating(0); setPage(1) }} className="text-xs font-black text-indigo-600 hover:underline">Clear</button>}
            </div>
            <div className="space-y-2">
              {[4, 3, 2].map((rating) => (
                <label key={rating} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-[#cbd5e1] dark:hover:bg-white/5">
                  <input type="radio" checked={minRating === rating} onChange={() => { setMinRating(rating); setPage(1) }} className="h-4 w-4 accent-indigo-600" />
                  <span>{rating}★ & above</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-[#272b33] dark:bg-[#0f1115]">
            <span><span className="block text-sm font-black text-gray-900 dark:text-[#e5e7eb]">In stock only</span><span className="block text-xs text-gray-400 dark:text-[#72819a]">Hide out-of-stock listings</span></span>
            <input type="checkbox" checked={inStockOnly} onChange={(e) => { setInStockOnly(e.target.checked); setPage(1) }} className="h-5 w-5 rounded border-gray-300 text-indigo-600" />
          </label>

          <label className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-[#272b33] dark:bg-[#0f1115]">
            <span><span className="block text-sm font-black text-gray-900 dark:text-[#e5e7eb]">Fast delivery</span><span className="block text-xs text-gray-400 dark:text-[#72819a]">Prioritize quicker delivery estimates</span></span>
            <input type="checkbox" checked={deliveryFast} onChange={(e) => { setDeliveryFast(e.target.checked); setPage(1) }} className="h-5 w-5 rounded border-gray-300 text-indigo-600" />
          </label>

          {dynamicFilters.length > 0 && <div className="space-y-3"><p className="text-xs font-black uppercase tracking-wider text-gray-400">More filters</p>{dynamicFilters.map((filter) => (<FilterGroup key={filter.key} title={filter.label} options={filter.options} selectedValues={filters[filter.key] || filter.selectedValues || []} onChange={(value) => toggleFilterValue(filter.key, value)} />))}</div>}
        </div>
      </div>
    </div>
  )
  return (
    <div className="min-h-screen bg-[#f0f2f5] text-gray-900 dark:bg-[#090b10] dark:text-[#e5e7eb]">
      <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur dark:border-[#272b33] dark:bg-[#0f1115]/95">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/marketplace')} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm dark:border-[#272b33] dark:bg-[#0b0d12] dark:text-[#e5e7eb]"><ChevronLeft className="h-4 w-4" /></button>
            <div className="min-w-0 flex-1"><SearchAutocomplete value={query} onChange={(next) => { setQuery(next); setPage(1) }} onSubmit={() => setPage(1)} onSelect={(text) => { setQuery(text); setPage(1) }} /></div>
          </div>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {ALL_CATEGORIES.map((cat) => (<button key={cat.key} type="button" onClick={() => updateCategory(cat.key)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition ${categoryKey === cat.key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-[#1a1f2a] dark:text-[#cbd5e1]'}`}><span className="mr-1">{cat.icon}</span>{cat.label}</button>))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 md:hidden">
            <button onClick={() => setFilterSheetOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 shadow-sm dark:border-[#272b33] dark:bg-[#0b0d12] dark:text-[#e5e7eb]"><Filter className="h-4 w-4" /> Filter {activeCount > 0 && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">{activeCount}</span>}</button>
            <button onClick={() => setSortSheetOpen(true)} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-black text-gray-700 shadow-sm dark:border-[#272b33] dark:bg-[#0b0d12] dark:text-[#e5e7eb]"><SlidersHorizontal className="h-4 w-4" /> Sort</button>
            <div className="flex items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm dark:border-[#272b33] dark:bg-[#0b0d12]"><button onClick={() => setViewMode('grid')} className={`rounded-xl p-2 ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}><Grid2x2 className="h-4 w-4" /></button><button onClick={() => setViewMode('list')} className={`rounded-xl p-2 ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}><List className="h-4 w-4" /></button></div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
        <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
          <aside className="sticky top-[132px] hidden max-h-[calc(100vh-150px)] overflow-auto rounded-3xl md:block">{filterPanel}</aside>
          <main className="min-w-0">
            <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#272b33] dark:bg-[#0f1115]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-sm font-black text-gray-900 dark:text-[#e5e7eb]">Showing {Math.min((page - 1) * 40 + 1, total)}-{Math.min(page * 40, total)} of {total} results</p><p className="mt-1 text-xs text-gray-400 dark:text-[#72819a]">{query ? <>for &quot;{query}&quot;</> : 'Browse campus products'} {searchWithinSeller}</p></div>
                <div className="hidden items-center gap-2 md:flex">
                  <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1 dark:border-[#272b33] dark:bg-[#0b0d12]">{SORT_OPTIONS.map((option) => (<button key={option.value} type="button" onClick={() => { setSortBy(option.value); setPage(1) }} className={`rounded-xl px-3 py-2 text-xs font-black transition ${sortBy === option.value ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-600 hover:bg-white dark:text-[#cbd5e1] dark:hover:bg-white/5'}`}>{option.label}</button>))}</div>
                  <div className="inline-flex items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm dark:border-[#272b33] dark:bg-[#0b0d12]"><button onClick={() => setViewMode('grid')} className={`rounded-xl p-2 ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}><Grid2x2 className="h-4 w-4" /></button><button onClick={() => setViewMode('list')} className={`rounded-xl p-2 ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}><List className="h-4 w-4" /></button></div>
                </div>
              </div>
            </div>

            {suggestion && query && suggestion !== query.toLowerCase() && (<div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">Did you mean <button className="font-black underline" onClick={() => { setQuery(suggestion); setPage(1) }}>{suggestion}</button>?</div>)}

            {loading && page === 1 ? (
              <div className={`mt-4 grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : products.length === 0 ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm dark:border-[#272b33] dark:bg-[#0f1115]"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-[#1a1f2a]"><Search className="h-8 w-8 text-gray-300" /></div><h2 className="text-xl font-black text-gray-900 dark:text-[#e5e7eb]">No results for &quot;{query || 'your search'}&quot;</h2><p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-[#94a3b8]">Try broadening the search, switching categories, or clearing filters.</p>{suggestion && suggestion !== query.toLowerCase() && <div className="mt-4"><button onClick={() => { setQuery(suggestion); setPage(1) }} className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20">Did you mean {suggestion}?</button></div>}<div className="mt-5 flex flex-wrap justify-center gap-2"><button onClick={clearAll} className="rounded-2xl bg-gray-100 px-4 py-2.5 text-sm font-black text-gray-700 dark:bg-[#1a1f2a] dark:text-[#e5e7eb]">Broaden search</button><Link href="/marketplace" className="rounded-2xl bg-indigo-50 px-4 py-2.5 text-sm font-black text-indigo-700">Browse marketplace</Link></div></div>
                {topProducts.length > 0 && <div><div className="mb-3 flex items-center gap-2 text-sm font-black text-gray-900 dark:text-[#e5e7eb]"><Sparkles className="h-4 w-4 text-indigo-600" /> Popular right now</div><div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>{topProducts.slice(0, 4).map((product) => (<ProductCard key={product.id} product={product} layout={viewMode} onOpen={() => router.push(`/product/${product.id}`)} />))}</div></div>}
              </div>
            ) : (
              <>
                <div className={`mt-4 grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>{products.map((product) => (<ProductCard key={product.id} product={product} layout={viewMode} onOpen={() => router.push(`/product/${product.id}`)} />))}</div>
                {loadingMore && <div className={`mt-4 grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>}
                {hasMore && <div className="mt-6 flex justify-center"><button onClick={() => setPage((current) => current + 1)} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-gray-800 shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-[#0f1115] dark:text-[#e5e7eb] dark:ring-[#272b33]">{loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpDown className="h-4 w-4" />} Load more</button></div>}
              </>
            )}
          </main>
        </div>
      </div>

      <Sheet open={filterSheetOpen} title="Filters" onClose={() => setFilterSheetOpen(false)}>{filterPanel}</Sheet>
      <Sheet open={sortSheetOpen} title="Sort by" onClose={() => setSortSheetOpen(false)}><div className="space-y-2">{SORT_OPTIONS.map((option) => (<label key={option.value} className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 ${sortBy === option.value ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700 dark:border-[#272b33] dark:bg-[#0f1115] dark:text-[#e5e7eb]'}`}><span className="text-sm font-bold">{option.label}</span><input type="radio" checked={sortBy === option.value} onChange={() => { setSortBy(option.value); setPage(1); setSortSheetOpen(false) }} className="h-4 w-4 accent-indigo-600" /></label>))}</div></Sheet>
    </div>
  )
}

export default function SearchPageWrapper() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f0f2f5] dark:bg-[#090b10]"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}><SearchPage /></Suspense>
}
