import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCategoryDisplayInfo } from '@/lib/variants'
import {
  ChevronRight,
  Clock3,
  MapPin,
  Package,
  Search,
  Shield,
  ShoppingBag,
  Star,
} from 'lucide-react'
import { Shell, EmptyState } from '@/components/ui/Shell'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

function TrustPill({ level }: { level: string }) {
  if (level === 'VERIFIED') return <Badge status="verified" icon={Shield}>Verified</Badge>
  if (level === 'GOLD') return <Badge status="warning">Gold</Badge>
  return <Badge status="neutral">{level === 'SILVER' ? 'Silver' : 'Bronze'}</Badge>
}

function fmt(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

function ProductTile({
  product,
}: {
  product: {
    id: string
    name: string
    price: number
    quantity: number
    images: string[]
    category: string
    categoryKey: string | null
    subcategory: string | null
    subcategoryKey: string | null
    landmark: string
    deliveryEstimate: string | null
    avgRating: number
    totalReviews: number
    viewCount: number
    isDeal: boolean
    discountPercent: number | null
    conditionType: string | null
    createdAt: Date
  }
}) {
  const display = getCategoryDisplayInfo(
    product.categoryKey,
    product.subcategoryKey,
    product.category,
    product.subcategory
  )

  return (
    <Link href={`/product/${product.id}`} className="ui-tile group">
      <div className="ui-tile__media aspect-[4/5]">
        <img
          src={product.images[0] || '/placeholder.png'}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />

        <div className="ui-tile__flags">
          {product.isDeal && <Badge status="danger">Deal</Badge>}
          {product.quantity === 0 ? (
            <Badge status="out-of-stock">Sold out</Badge>
          ) : product.quantity < 5 ? (
            <Badge status="low-stock">{product.quantity} left</Badge>
          ) : null}
        </div>

        {product.deliveryEstimate && (
          <div className="ui-tile__peek">
            <span className="ui-mono ui-mono-sm inline-flex items-center gap-1.5 bg-ink px-2.5 py-1.5 text-background">
              <Clock3 className="h-3 w-3" strokeWidth={2} />
              {product.deliveryEstimate}
            </span>
          </div>
        )}
      </div>

      <div className="pt-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="ui-mono ui-mono-sm line-clamp-1 text-ink-muted">
            {display.subcategory ? `${display.category} · ${display.subcategory}` : display.category}
          </p>
          {product.totalReviews > 0 && (
            <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] tabular-nums text-ink-secondary">
              <Star className="h-3 w-3 fill-warning text-warning" strokeWidth={0} />
              {Number(product.avgRating || 0).toFixed(1)}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-ink">
          {product.name}
        </h3>

        <div className="mt-2.5 flex items-baseline gap-2.5">
          <p className="ui-figure text-base text-ink">{fmt(product.price)}</p>
          {product.discountPercent ? (
            <span className="text-[11px] font-medium text-success">−{product.discountPercent}%</span>
          ) : null}
        </div>

        {product.landmark && (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-muted">
            <MapPin className="h-3 w-3" strokeWidth={1.75} />
            {product.landmark}
          </p>
        )}
      </div>
    </Link>
  )
}

export default async function SellerProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ q?: string; sort?: string; category?: string }>
}) {
  const { id } = await params
  const resolved = (await searchParams) || {}
  const q = (resolved.q || '').trim().toLowerCase()
  const sort = resolved.sort || 'newest'
  const category = resolved.category || 'all'

  const seller = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      profilePhoto: true,
      bio: true,
      trustLevel: true,
      avgRating: true,
      totalReviews: true,
      completedOrders: true,
      hostelName: true,
      landmark: true,
      createdAt: true,
      university: { select: { shortName: true } },
      products: {
        where: { isDeleted: false, isActive: true },
        select: {
          id: true,
          name: true,
          price: true,
          quantity: true,
          images: true,
          category: true,
          categoryKey: true,
          subcategory: true,
          subcategoryKey: true,
          landmark: true,
          deliveryEstimate: true,
          avgRating: true,
          totalReviews: true,
          viewCount: true,
          isDeal: true,
          discountPercent: true,
          conditionType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!seller) notFound()

  const products = seller.products
  const categories = Array.from(
    new Set(products.map((product) => product.category).filter(Boolean))
  ).sort()

  const filteredProducts = products.filter((product) => {
    const haystack = [
      product.name,
      product.category,
      product.subcategory || '',
      product.deliveryEstimate || '',
      product.conditionType || '',
    ]
      .join(' ')
      .toLowerCase()

    const matchesQuery = !q || haystack.includes(q)
    const matchesCategory = category === 'all' || product.category === category
    return matchesQuery && matchesCategory
  })

  filteredProducts.sort((a, b) => {
    if (sort === 'price-asc') return a.price - b.price
    if (sort === 'price-desc') return b.price - a.price
    if (sort === 'top-rated') return (b.avgRating || 0) - (a.avgRating || 0)
    if (sort === 'stock') return b.quantity - a.quantity
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const lowStock = products.filter((p) => p.quantity > 0 && p.quantity < 5).length

  const stats = [
    { value: String(products.length), label: 'Listings' },
    { value: String(lowStock), label: 'Low stock' },
    { value: String(seller.totalReviews || 0), label: 'Reviews' },
    { value: String(seller.completedOrders || 0), label: 'Orders' },
  ]

  const selectClass =
    'h-10 border border-border bg-card px-3 text-sm text-ink transition-colors hover:border-ink/25 focus:border-ink/40 focus:outline-none'

  return (
    <div className="min-h-screen bg-surface pb-20">
      {/* ── Seller identity ───────────────────────────────────────────── */}
      <div className="border-b border-border bg-card">
        <Shell width="wide" className="pt-6 pb-8">
          <nav className="ui-mono ui-mono-sm mb-8 flex items-center gap-2 text-ink-muted">
            <Link href="/seller" className="transition-colors hover:text-ink">Sellers</Link>
            <ChevronRight className="h-3 w-3" strokeWidth={2} />
            <Link href={`/seller/${seller.id}`} className="truncate transition-colors hover:text-ink">
              {seller.name}
            </Link>
            <ChevronRight className="h-3 w-3" strokeWidth={2} />
            <span className="text-ink">Catalogue</span>
          </nav>

          <div className="flex items-start gap-5">
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden bg-ink">
              {seller.profilePhoto ? (
                <img src={seller.profilePhoto} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-background">
                  {seller.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="ui-eyebrow mb-3 max-w-[15rem]">Catalogue</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h1 className="text-[clamp(1.6rem,3.4vw,2.4rem)] leading-[1.02] text-ink">
                  {seller.name}
                </h1>
                <TrustPill level={seller.trustLevel} />
              </div>

              <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-secondary">
                {seller.landmark && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
                    {seller.landmark}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" strokeWidth={0} />
                  {Number(seller.avgRating || 0).toFixed(1)}
                  <span className="text-ink-muted">({seller.totalReviews || 0})</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
                  {seller.completedOrders || 0} completed orders
                </span>
              </div>

              {seller.bio && (
                <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ink-secondary">
                  {seller.bio}
                </p>
              )}
            </div>
          </div>
        </Shell>
      </div>

      {/* ── Stat rail ─────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card">
        <Shell width="wide">
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-card px-4 py-4 sm:px-5">
                <p className="ui-figure text-[clamp(1.35rem,2.8vw,1.85rem)] leading-none text-ink">
                  {stat.value}
                </p>
                <p className="ui-mono ui-mono-sm mt-2 text-ink-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </Shell>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <Shell width="wide">
          <form
            action={`/seller/${seller.id}/products`}
            method="get"
            className="flex flex-wrap items-center gap-2.5 py-3.5"
          >
            <div className="flex h-10 min-w-[13rem] flex-1 items-center gap-2.5 border border-border bg-card px-3.5 transition-colors focus-within:border-ink/30">
              <Search className="h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
              <input
                name="q"
                defaultValue={resolved.q || ''}
                placeholder="Search this catalogue"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
              />
            </div>

            <select name="sort" defaultValue={sort} className={selectClass} aria-label="Sort by">
              <option value="newest">Newest</option>
              <option value="top-rated">Top rated</option>
              <option value="price-asc">Price low to high</option>
              <option value="price-desc">Price high to low</option>
              <option value="stock">Most stock</option>
            </select>

            <select name="category" defaultValue={category} className={selectClass} aria-label="Category">
              <option value="all">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <button
              type="submit"
              className="ui-mono ui-mono-sm h-10 bg-ink px-5 text-background transition-colors hover:bg-ink/90"
            >
              Apply
            </button>

            {(q || category !== 'all' || sort !== 'newest') && (
              <Link
                href={`/seller/${seller.id}/products`}
                className="ui-mono ui-mono-sm inline-flex h-10 items-center border border-border bg-card px-4 text-ink-secondary transition-colors hover:border-ink/25 hover:text-ink"
              >
                Reset
              </Link>
            )}
          </form>
        </Shell>
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────── */}
      <Shell width="wide" className="pt-10 sm:pt-12">
        <div className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-5">
          <div>
            <h2 className="text-[clamp(1.15rem,2.2vw,1.45rem)] leading-tight text-ink">
              {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
            </h2>
            <p className="mt-1.5 text-sm text-ink-secondary">
              {q || category !== 'all'
                ? 'Filtered view of this catalogue'
                : 'Everything this seller has live right now'}
            </p>
          </div>
          <Link
            href={`/seller/${seller.id}`}
            className="ui-mono ui-mono-sm flex-shrink-0 text-ink-secondary transition-colors hover:text-ink"
          >
            Seller profile
          </Link>
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductTile key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="No products match this filter"
            description="Try another search term, or switch the category back to all products."
            action={
              <Link
                href={`/seller/${seller.id}/products`}
                className="inline-flex items-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-ink/90"
              >
                Clear filters
              </Link>
            }
          />
        )}
      </Shell>
    </div>
  )
}
