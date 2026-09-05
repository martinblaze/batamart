'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, LayoutGrid, Loader2, SlidersHorizontal, Tag, X } from 'lucide-react'
import { CATEGORY_TREE } from '@/lib/variants'
import { authFetch } from '@/lib/auth-client'
import ProductCard from '@/components/ProductCard'
import { categoryImage } from '@/components/marketplace/VisualSections'
import { PageHeader } from '@/components/marketplace/DetailChrome'
import { primeImageBatch } from '@/lib/image-cache'

/**
 * Feed — the catalogue.
 *
 * A port of the Flutter client's browse tab, which is the version that works.
 * The marketplace page used to do this job itself with a horizontal strip of
 * category buttons: only three fit on a phone, the rest were found by guessing
 * there was more to the right, and subcategories had nowhere to live at all.
 * Worse, choosing a category replaced the whole marketplace with a filtered
 * grid, so the feed you were reading vanished and the only way back was a
 * breadcrumb.
 *
 * Browsing now lives here instead. The rail runs down the left edge — the
 * shape every large catalogue converges on, because it shows ten categories at
 * once and still leaves the full width for results — and every piece of state
 * is in the URL, so a card on the marketplace can link straight to a filtered
 * view and the back button behaves.
 */

const SORTS: { value: string; label: string }[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Best rated' },
]

const PRICE_BANDS = [5000, 10000, 20000, 30000, 50000]

type Product = {
  id: string
  name: string
  price: number
  priceDisplay?: string | null
  images?: string[]
  quantity?: number
  avgRating?: number
  totalReviews?: number
  landmark?: string | null
  seller?: { id?: string; name?: string; avgRating?: number }
}

const CATEGORIES = Object.entries(CATEGORY_TREE).map(([key, cat]) => ({
  key,
  label: cat.label,
}))

function FeedInner() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const paramString = params.toString()

  const isApp = params.get('app') === 'true'
  const categoryKey = params.get('categoryKey') || ''
  const subcategoryKey = params.get('subcategoryKey') || ''
  const sort = params.get('sort') || 'popular'
  const minPrice = params.get('minPrice') || ''
  const maxPrice = params.get('maxPrice') || ''
  const zone = params.get('zone') || ''

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent(`${pathname}${paramString ? `?${paramString}` : ''}`)}`)
      return
    }
    setCheckingAuth(false)
  }, [])

  /**
   * Writes one param and drops the rest of the query untouched, so app mode
   * and every other filter survive a category tap.
   */
  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(paramString)
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    })
    const q = next.toString()
    router.replace(`${pathname}${q ? `?${q}` : ''}`, { scroll: false })
  }

  const subcategories = useMemo(() => {
    if (!categoryKey) return []
    return Object.entries(CATEGORY_TREE[categoryKey]?.subcategories || {}).map(
      ([key, sub]) => ({ key, label: (sub as { label: string }).label }),
    )
  }, [categoryKey])

  const apiQuery = useMemo(() => {
    const q = new URLSearchParams()
    if (categoryKey) q.set('categoryKey', categoryKey)
    if (subcategoryKey) q.set('subcategoryKey', subcategoryKey)
    if (minPrice) q.set('minPrice', minPrice)
    if (maxPrice) q.set('maxPrice', maxPrice)
    if (zone) q.set('zone', zone)
    q.set('sortBy', sort)
    q.set('limit', '48')
    return q.toString()
  }, [categoryKey, subcategoryKey, minPrice, maxPrice, zone, sort])

  useEffect(() => {
    if (checkingAuth) return
    let cancelled = false
    setLoading(true)
    authFetch(`/api/products?${apiQuery}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const next: Product[] = data.products || []
        setProducts(next)
        setTotal(data.total ?? next.length)
        primeImageBatch(next.map((p) => p.images?.[0]), 10)
      })
      .catch(() => {
        if (!cancelled) { setProducts([]); setTotal(0) }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [checkingAuth, apiQuery])

  const activeFilters =
    (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (zone ? 1 : 0)

  // The installed shell scrolls its own element, and that element already
  // starts 56px below the top bar — so a `top: 56` sticky inside it sits at
  // 112 and leaves a dead band above the controls. In a browser tab the page
  // scrolls under a fixed 56px navbar and the offset is real.
  const stickyTop = isApp ? 0 : 56
  const currentCategory = categoryKey ? CATEGORY_TREE[categoryKey]?.label : null

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      {!isApp && (
        <PageHeader
          variant="title"
          title="Browse"
          back={false}
          eyebrow={currentCategory ? `${currentCategory}${subcategoryKey ? ' · filtered' : ''}` : 'Everything on campus'}
        />
      )}

      <div className="flex min-h-[70vh] items-stretch">
        {/* ── Category rail ───────────────────────────────────────────────
            96px, photographs rather than icons: at this size a picture names
            the aisle faster than the label under it does. */}
        <nav
          aria-label="Categories"
          className="w-[92px] flex-shrink-0 self-start overflow-y-auto border-r border-border bg-surface no-scrollbar sm:w-[104px]"
          style={{
            position: 'sticky',
            top: stickyTop,
            maxHeight: isApp ? 'calc(100vh - 140px)' : 'calc(100vh - 72px)',
          }}
        >
          <RailItem
            label="All"
            selected={!categoryKey}
            onClick={() => setParam({ categoryKey: null, subcategoryKey: null })}
          />
          {CATEGORIES.map((cat) => (
            <RailItem
              key={cat.key}
              label={cat.label}
              image={categoryImage(cat.label)}
              selected={categoryKey === cat.key}
              // Changing category drops the subcategory — otherwise the old
              // child silently filters the new parent down to nothing.
              onClick={() => setParam({ categoryKey: cat.key, subcategoryKey: null })}
            />
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          {/* Controls and subcategories stick together as one block. Sticking
              only the filter bar meant it slid over the subcategory strip as
              soon as you scrolled, hiding the row you had just used. */}
          <div className="sticky z-20 bg-card" style={{ top: stickyTop }}>
          <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
            <button
              onClick={() => setSortOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <ArrowUpDown className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
              <span className="truncate text-xs text-ink">
                {SORTS.find((s) => s.value === sort)?.label || 'Sort'}
              </span>
            </button>
            <span className="h-4 w-px flex-shrink-0 bg-border" />
            <button
              onClick={() => setFilterOpen(true)}
              className="flex flex-shrink-0 items-center gap-2"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
              <span className="text-xs text-ink">Filters</span>
              {activeFilters > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center bg-primary px-1 font-mono text-[9px] text-white">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {/* ── Subcategories ──────────────────────────────────────────────
              Narrows what is already on screen rather than navigating away.
              Tapping the active one clears it, so there is always a way back
              up to the whole category. */}
          {subcategories.length > 0 && (
            <div className="flex gap-4 overflow-x-auto border-b border-border px-4 py-2.5 no-scrollbar">
              {subcategories.map((sub) => {
                const active = subcategoryKey === sub.key
                return (
                  <button
                    key={sub.key}
                    onClick={() => setParam({ subcategoryKey: active ? null : sub.key })}
                    className={`flex-shrink-0 whitespace-nowrap text-xs transition-colors duration-200 ${
                      active
                        ? 'font-bold text-ink underline decoration-2 underline-offset-4'
                        : 'text-ink-secondary hover:text-ink'
                    }`}
                  >
                    {sub.label}
                  </button>
                )
              })}
            </div>
          )}
          </div>

          {/* ── Results ── */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="ui-skeleton h-[300px]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="px-4 py-20 text-center">
              <span className="mx-auto mb-6 flex h-12 w-12 items-center justify-center border border-border bg-card">
                <Tag className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
              </span>
              <p className="ui-eyebrow mb-3 justify-center before:hidden after:hidden">Nothing here</p>
              <h2 className="mb-3 text-xl text-ink">
                {currentCategory ? `No items in ${currentCategory} yet` : 'No items yet'}
              </h2>
              <p className="mx-auto mb-7 max-w-[34ch] text-sm leading-relaxed text-ink-secondary">
                {currentCategory
                  ? 'Nothing listed in this category on your campus right now.'
                  : 'Nothing is listed on your campus right now. Check back shortly.'}
              </p>
              {(categoryKey || activeFilters > 0) && (
                <button
                  onClick={() => setParam({ categoryKey: null, subcategoryKey: null, minPrice: null, maxPrice: null, zone: null })}
                  className="inline-flex h-11 items-center bg-ink px-6 font-mono text-[10px] uppercase tracking-[0.14em] text-background transition-colors duration-300 hover:bg-primary"
                >
                  Show everything
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="px-4 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                {total} {total === 1 ? 'item' : 'items'}
              </p>
              <div className="grid grid-cols-2 gap-3 p-4 pb-28 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((product, i) => (
                  <ProductCard
                    key={product.id}
                    product={product as never}
                    layout="grid"
                    priority={i < 4}
                    onOpen={() => router.push(`/product/${product.id}${isApp ? '?app=true' : ''}`)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {sortOpen && (
        <Sheet title="Sort by" onClose={() => setSortOpen(false)}>
          {SORTS.map((option) => (
            <button
              key={option.value}
              onClick={() => { setParam({ sort: option.value }); setSortOpen(false) }}
              className={`flex w-full items-center justify-between border-b border-border px-1 py-3.5 text-left text-sm last:border-0 ${
                sort === option.value ? 'font-semibold text-ink' : 'text-ink-secondary'
              }`}
            >
              {option.label}
              {sort === option.value && <span className="h-1.5 w-1.5 bg-primary" />}
            </button>
          ))}
        </Sheet>
      )}

      {filterOpen && (
        <Sheet title="Filters" onClose={() => setFilterOpen(false)}>
          <p className="ui-eyebrow mb-3">Max price</p>
          <div className="mb-6 flex flex-wrap gap-2">
            {PRICE_BANDS.map((band) => {
              const active = maxPrice === String(band)
              return (
                <button
                  key={band}
                  onClick={() => setParam({ maxPrice: active ? null : String(band) })}
                  className={`border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-200 ${
                    active
                      ? 'border-ink bg-ink text-background'
                      : 'border-border text-ink-secondary hover:border-ink/30'
                  }`}
                >
                  Under ₦{band.toLocaleString('en-NG')}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => { setParam({ minPrice: null, maxPrice: null, zone: null }); setFilterOpen(false) }}
            className="mb-2 w-full border border-border py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors duration-200 hover:border-ink/30 hover:text-ink"
          >
            Clear filters
          </button>
          <button
            onClick={() => setFilterOpen(false)}
            className="w-full bg-ink py-3.5 font-mono text-[10px] uppercase tracking-[0.14em] text-background transition-colors duration-300 hover:bg-primary"
          >
            Show {total} {total === 1 ? 'item' : 'items'}
          </button>
        </Sheet>
      )}
    </div>
  )
}

function RailItem({
  label,
  image,
  selected,
  onClick,
}: {
  label: string
  image?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={`flex w-full flex-col items-center gap-1.5 border-l-[2.5px] px-1.5 py-3 transition-colors duration-300 ${
        // A marker on the leading edge rather than a filled pill: in a list
        // this long, a filled row reads as a button, not as a position.
        selected ? 'border-primary bg-card' : 'border-transparent hover:bg-card/60'
      }`}
    >
      {image ? (
        <span className="relative block h-10 w-10 overflow-hidden bg-surface">
          <Image src={image} alt="" fill sizes="40px" className="object-cover" />
        </span>
      ) : (
        <span className="flex h-10 w-10 items-center justify-center border border-border">
          <LayoutGrid className="h-4 w-4 text-ink" strokeWidth={1.75} />
        </span>
      )}
      <span
        className={`line-clamp-2 text-center text-[10.5px] leading-[1.25] ${
          selected ? 'font-semibold text-ink' : 'text-ink-secondary'
        }`}
      >
        {label}
      </span>
    </button>
  )
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto bg-card p-5"
        style={{ paddingBottom: 'calc(20px + max(env(safe-area-inset-bottom), 16px))' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-ink-muted hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <FeedInner />
    </Suspense>
  )
}
