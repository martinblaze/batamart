'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Filter, Loader2, Search, X } from 'lucide-react'
import { CATEGORY_TREE } from '@/lib/variants'
import FilterGroup from '@/components/FilterGroup'

type Product = {
  id: string
  name: string
  price: number
  priceDisplay?: string
  images?: string[]
  isHot?: boolean
  isNew?: boolean
  isDeal?: boolean
  seller?: { name?: string; trustLevel?: string }
}

type FilterDef = {
  key: string
  label: string
  type: string
  source?: 'attribute' | 'variant' | 'merged'
  options: Array<{ value: string; count: number }>
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'electronics', label: 'Phones' },
  { key: 'computing', label: 'Laptops' },
  { key: 'fashion', label: 'Clothes' },
  { key: 'groceries-food-fast-food', label: 'Food' },
  { key: 'home-kitchen', label: 'Room' },
]

const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get('q') || ''

  const [products, setProducts] = useState<Product[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [availableFilters, setAvailableFilters] = useState<FilterDef[]>([])
  const [categoryKey, setCategoryKey] = useState('all')
  const [subcategoryKey, setSubcategoryKey] = useState<string | null>(null)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000000])
  const [priceInput, setPriceInput] = useState<[number, number]>([0, 1000000])
  const [priceBounds, setPriceBounds] = useState<{ min: number; max: number }>({ min: 0, max: 1000000 })
  const [sortBy, setSortBy] = useState('relevance')
  const [searchQuery, setSearchQuery] = useState(initialQ)
  const [inputQuery, setInputQuery] = useState(initialQ)
  const [isLoading, setIsLoading] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterCache, setFilterCache] = useState<Record<string, { filters: FilterDef[]; price: { min: number; max: number } }>>({})

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const cacheKey = `${categoryKey}::${subcategoryKey || ''}::${normalizedQuery}`
  const subcategories = useMemo(() => {
    if (categoryKey === 'all') return []
    return Object.entries(CATEGORY_TREE[categoryKey]?.subcategories || {}).map(([key, sub]) => ({ key, label: sub.label }))
  }, [categoryKey])

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(inputQuery.trim()), 400)
    return () => clearTimeout(t)
  }, [inputQuery])

  useEffect(() => {
    const t = setTimeout(() => setPriceRange(priceInput), 300)
    return () => clearTimeout(t)
  }, [priceInput])

  useEffect(() => {
    const fetchFilters = async () => {
      const cached = filterCache[cacheKey]
      if (cached) {
        setAvailableFilters(cached.filters)
        setPriceBounds(cached.price)
        return
      }
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const params = new URLSearchParams()
        if (categoryKey !== 'all') params.append('categoryKey', categoryKey)
        if (subcategoryKey) params.append('subcategoryKey', subcategoryKey)
        if (searchQuery.trim()) params.append('q', searchQuery.trim())
        const res = await fetch(`/api/product-filters?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        const nextFilters: FilterDef[] = data.filters || []
        const nextPrice = data.price || { min: 0, max: 1000000 }
        setAvailableFilters(nextFilters)
        setPriceBounds(nextPrice)
        setFilterCache((prev) => ({ ...prev, [cacheKey]: { filters: nextFilters, price: nextPrice } }))
      } catch {}
    }
    fetchFilters()
  }, [categoryKey, subcategoryKey, searchQuery, cacheKey, filterCache])

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true)
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          router.push('/login')
          return
        }
        const params = new URLSearchParams()
        if (categoryKey !== 'all') params.append('categoryKey', categoryKey)
        if (subcategoryKey) params.append('subcategoryKey', subcategoryKey)
        if (searchQuery) params.append('q', searchQuery)
        params.append('minPrice', String(priceRange[0]))
        params.append('maxPrice', String(priceRange[1]))
        params.append('sortBy', sortBy)
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value)
        })
        const res = await fetch(`/api/products?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        setProducts(data.products || [])
      } catch {
        setProducts([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchProducts()
  }, [categoryKey, subcategoryKey, searchQuery, priceRange, sortBy, JSON.stringify(filters), router])

  const onCategoryChange = (next: string) => {
    setCategoryKey(next)
    setSubcategoryKey(null)
    setFilters({})
    setPriceInput([priceBounds.min, priceBounds.max])
    setPriceRange([priceBounds.min, priceBounds.max])
  }

  const clearAll = () => {
    setFilters({})
    setSubcategoryKey(null)
    setSortBy('relevance')
    setPriceInput([priceBounds.min, priceBounds.max])
    setPriceRange([priceBounds.min, priceBounds.max])
  }

  const activeChips = Object.entries(filters).filter(([, v]) => Boolean(v))

  const basicFilters = availableFilters.filter((f) => ['condition', 'conditionType'].includes(f.key))
  const variantFilters = availableFilters.filter((f) => f.source === 'variant' || f.source === 'merged')
  const attributeFilters = availableFilters.filter((f) => !basicFilters.includes(f) && !variantFilters.includes(f))

  const filterPanel = (
    <div className="space-y-4">
      <div className="border border-gray-100 dark:border-[#272b33] rounded-xl p-3">
        <p className="text-xs font-bold text-gray-500 dark:text-[#94a3b8] uppercase mb-2">Basic Filters</p>
        <div className="space-y-2">
          <select
            value={subcategoryKey || ''}
            onChange={(e) => setSubcategoryKey(e.target.value || null)}
            disabled={categoryKey === 'all'}
            className="w-full rounded-xl border border-gray-200 dark:border-[#272b33] px-3 py-2 text-sm bg-white dark:bg-[#0f1115] text-gray-900 dark:text-[#e5e7eb]"
          >
            <option value="">All subcategories</option>
            {subcategories.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={priceInput[0]} onChange={(e) => setPriceInput(([_, max]) => [Number(e.target.value || 0), max])} className="rounded-xl border border-gray-200 dark:border-[#272b33] px-3 py-2 text-sm bg-white dark:bg-[#0f1115] text-gray-900 dark:text-[#e5e7eb]" />
            <input type="number" value={priceInput[1]} onChange={(e) => setPriceInput(([min]) => [min, Number(e.target.value || priceBounds.max)])} className="rounded-xl border border-gray-200 dark:border-[#272b33] px-3 py-2 text-sm bg-white dark:bg-[#0f1115] text-gray-900 dark:text-[#e5e7eb]" />
          </div>
          {basicFilters.map((f) => (
            <FilterGroup key={f.key} title={f.label} type={f.type} options={f.options} selectedValue={filters[f.key]} onChange={(value) => setFilters((prev) => ({ ...prev, [f.key]: value }))} defaultOpen={false} />
          ))}
        </div>
      </div>

      {attributeFilters.length > 0 && (
        <div className="border border-gray-100 dark:border-[#272b33] rounded-xl p-3">
          <p className="text-xs font-bold text-gray-500 dark:text-[#94a3b8] uppercase mb-2">Product Attributes</p>
          <div className="space-y-2">
            {attributeFilters.map((f) => (
              <FilterGroup key={f.key} title={f.label} type={f.type} options={f.options} selectedValue={filters[f.key]} onChange={(value) => setFilters((prev) => ({ ...prev, [f.key]: value }))} defaultOpen={false} />
            ))}
          </div>
        </div>
      )}

      {variantFilters.length > 0 && (
        <div className="border border-gray-100 dark:border-[#272b33] rounded-xl p-3">
          <p className="text-xs font-bold text-gray-500 dark:text-[#94a3b8] uppercase mb-2">Variant Filters</p>
          <div className="space-y-2">
            {variantFilters.map((f) => (
              <FilterGroup key={f.key} title={f.label} type={f.type} options={f.options} selectedValue={filters[f.key]} onChange={(value) => setFilters((prev) => ({ ...prev, [f.key]: value }))} defaultOpen={false} />
            ))}
          </div>
        </div>
      )}

      <button onClick={clearAll} className="w-full rounded-xl border border-gray-200 dark:border-[#272b33] py-2 text-sm font-semibold text-gray-700 dark:text-[#cbd5e1]">Clear All</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f3f4f8] dark:bg-[#000000]">
      <div className="sticky top-0 z-30 border-b border-gray-200 dark:border-[#272b33] bg-white/95 dark:bg-[#0f1115]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/marketplace')} className="h-9 w-9 rounded-xl border border-gray-200 dark:border-[#272b33] text-gray-700 dark:text-[#cbd5e1] flex items-center justify-center">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 rounded-xl border border-gray-200 dark:border-[#272b33] bg-white dark:bg-[#0f1115] px-3 py-2 flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-400 dark:text-[#94a3b8]" />
              <input value={inputQuery} onChange={(e) => setInputQuery(e.target.value)} placeholder="Search products" className="w-full bg-transparent text-sm text-gray-900 dark:text-[#e5e7eb] placeholder:text-gray-400 dark:placeholder:text-[#72819a] outline-none" />
              {inputQuery && <button onClick={() => setInputQuery('')}><X className="h-4 w-4 text-gray-400" /></button>}
            </div>
            <button onClick={() => setIsFilterOpen(true)} className="md:hidden h-9 rounded-xl border border-gray-200 dark:border-[#272b33] text-gray-700 dark:text-[#cbd5e1] px-3 text-sm font-semibold flex items-center gap-1">
              <Filter className="h-4 w-4" /> Filter
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => onCategoryChange(tab.key)} className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold ${categoryKey === tab.key ? 'bg-indigo-600 text-white border-transparent' : 'bg-white dark:bg-[#0f1115] text-gray-600 dark:text-[#cbd5e1] border-gray-200 dark:border-[#272b33]'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          {activeChips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {activeChips.map(([key, value]) => (
                <button key={key} onClick={() => setFilters((prev) => ({ ...prev, [key]: '' }))} className="rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold px-2.5 py-1">
                  {value} ✕
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 md:grid md:grid-cols-[280px_1fr] md:gap-4">
        <aside className="hidden md:block rounded-2xl border border-gray-200 dark:border-[#272b33] bg-white dark:bg-[#0f1115] p-4 h-fit sticky top-24">
          {filterPanel}
        </aside>
        <main>
          <div className="mb-3">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-xl border border-gray-200 dark:border-[#272b33] px-3 py-2 text-sm bg-white dark:bg-[#0f1115] text-gray-900 dark:text-[#e5e7eb]">
              <option value="relevance">Most Relevant</option>
              <option value="newest">Newest</option>
              <option value="priceLow">Price: Low to High</option>
              <option value="priceHigh">Price: High to Low</option>
            </select>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-200 dark:border-[#272b33] bg-white dark:bg-[#0f1115] p-2 animate-pulse">
                  <div className="aspect-square rounded-xl bg-gray-100 dark:bg-[#1a1f2a]" />
                  <div className="mt-2 h-3 w-4/5 bg-gray-100 dark:bg-[#1a1f2a] rounded" />
                  <div className="mt-2 h-3 w-2/5 bg-gray-100 dark:bg-[#1a1f2a] rounded" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-[#272b33] bg-white dark:bg-[#0f1115] py-16 text-center">
              <p className="text-gray-600 dark:text-[#cbd5e1] font-semibold">No products found</p>
              <button onClick={clearAll} className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <button key={p.id} onClick={() => router.push(`/product/${p.id}`)} className="rounded-2xl border border-gray-200 dark:border-[#272b33] bg-white dark:bg-[#0f1115] overflow-hidden text-left">
                  <div className="relative aspect-square bg-gray-100 dark:bg-[#1a1f2a]">
                    {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" /> : null}
                    <div className="absolute left-2 top-2 flex gap-1">
                      {p.isHot && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">HOT</span>}
                      {p.isNew && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>}
                      {p.isDeal && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">DEAL</span>}
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="line-clamp-2 text-xs font-bold text-gray-900 dark:text-[#e5e7eb]">{p.name}</p>
                    <p className="mt-1 text-sm font-black text-indigo-600">{p.priceDisplay || fmt(p.price)}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="truncate text-[10px] text-gray-400 dark:text-[#94a3b8]">{p.seller?.name || 'Seller'}</p>
                      {p.seller?.trustLevel ? <span className="rounded-full bg-gray-100 dark:bg-[#1a1f2a] px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:text-[#cbd5e1]">{p.seller.trustLevel}</span> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      {isFilterOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsFilterOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-sm bg-white dark:bg-[#0f1115] p-4 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-[#e5e7eb]">Filters</h3>
              <button onClick={() => setIsFilterOpen(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            {filterPanel}
            <button onClick={() => setIsFilterOpen(false)} className="mt-4 w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white">Apply Filters</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SearchPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f3f4f8] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>}>
      <SearchPage />
    </Suspense>
  )
}
