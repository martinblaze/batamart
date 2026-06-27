import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  Clock3,
  Filter,
  MapPin,
  Package,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Flame,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const TRUST_CONFIG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  VERIFIED: { label: 'Verified', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  GOLD: { label: 'Gold', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  SILVER: { label: 'Silver', text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
  BRONZE: { label: 'Bronze', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
}

function TrustPill({ level }: { level: string }) {
  const config = TRUST_CONFIG[level] || TRUST_CONFIG.BRONZE
  const icon = level === 'VERIFIED' ? <Shield className="w-3 h-3" /> : null
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${config.text} ${config.bg} ${config.border}`}>
      {icon}
      {config.label}
    </span>
  )
}

function fmt(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

function ProductCard({
  product,
}: {
  product: {
    id: string
    name: string
    price: number
    quantity: number
    images: string[]
    category: string
    subcategory: string | null
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
  const stockLabel =
    product.quantity === 0
      ? 'Out of stock'
      : product.quantity < 5
        ? `${product.quantity} left`
        : `${product.quantity} in stock`

  const stockClass =
    product.quantity === 0
      ? 'bg-red-50 text-red-700 border-red-200'
      : product.quantity < 5
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200'

  return (
    <Link
      href={`/product/${product.id}`}
      className="group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-square bg-gray-50">
        <img
          src={product.images[0] || '/placeholder.png'}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.isDeal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">
              <Flame className="h-3 w-3" />
              Deal
            </span>
          )}
          {product.conditionType && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-gray-700 shadow-sm backdrop-blur">
              {product.conditionType}
            </span>
          )}
        </div>
        <div className="absolute bottom-3 right-3">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black ${stockClass}`}>
            {stockLabel}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 line-clamp-1">
            {product.subcategory ? `${product.category} · ${product.subcategory}` : product.category}
          </p>
          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {Number(product.avgRating || 0).toFixed(1)}
          </div>
        </div>

        <h3 className="mt-1 text-sm font-black leading-snug text-gray-900 line-clamp-2 group-hover:text-indigo-700">
          {product.name}
        </h3>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-lg font-black text-indigo-600">{fmt(product.price)}</p>
          {product.discountPercent ? (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
              -{product.discountPercent}%
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-600">
            <ShoppingBag className="h-3 w-3" />
            {product.totalReviews} reviews
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-600">
            <Package className="h-3 w-3" />
            {product.viewCount} views
          </span>
          {product.deliveryEstimate && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
              <Clock3 className="h-3 w-3" />
              {product.deliveryEstimate}
            </span>
          )}
        </div>
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
      university: {
        select: {
          shortName: true,
        },
      },
      products: {
        where: {
          isDeleted: false,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          quantity: true,
          images: true,
          category: true,
          subcategory: true,
          deliveryEstimate: true,
          avgRating: true,
          totalReviews: true,
          viewCount: true,
          isDeal: true,
          discountPercent: true,
          conditionType: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  if (!seller) notFound()

  const products = seller.products
  const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort()

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

  const activeProducts = products.length
  const lowStock = products.filter((product) => product.quantity > 0 && product.quantity < 5).length
  const sellThrough = seller.completedOrders || 0

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#1e1b4b_0%,#312e81_50%,#4c1d95_100%)]">
        <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6 sm:pb-14">
          <div className="flex items-center gap-2 text-sm text-white/45">
            <Link href="/seller" className="font-semibold hover:text-white/80 transition">
              Sellers
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/seller/${seller.id}`} className="font-semibold hover:text-white/80 transition">
              {seller.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-semibold text-white/75">Products</span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="flex gap-4">
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-2xl">
                {seller.profilePhoto ? (
                  <img src={seller.profilePhoto} alt={seller.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-black text-white/80">
                    {seller.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-black text-white sm:text-4xl">{seller.name}</h1>
                  <TrustPill level={seller.trustLevel} />
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
                  Full product catalog for this seller. Browse active listings, compare prices, and open any product for the normal BataMart purchase flow.
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/60">
                  {seller.university?.shortName && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {seller.university.shortName}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {Number(seller.avgRating || 0).toFixed(1)} rating
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" />
                    {sellThrough} completed orders
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-white backdrop-blur-sm">
                <p className="text-2xl font-black tabular-nums">{activeProducts}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">Active products</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-white backdrop-blur-sm">
                <p className="text-2xl font-black tabular-nums">{lowStock}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">Low stock</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-white backdrop-blur-sm">
                <p className="text-2xl font-black tabular-nums">{seller.totalReviews || 0}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/55">Reviews</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-3">
              <Package className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-gray-900">{activeProducts}</p>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500 mt-0.5">Listings</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
              <BadgeCheck className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-gray-900">{seller.avgRating.toFixed(1)}</p>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500 mt-0.5">Seller rating</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
              <TrendingUp className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-gray-900">{sellThrough}</p>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500 mt-0.5">Completed orders</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-2xl font-black text-gray-900">{seller.totalReviews || 0}</p>
            <p className="text-xs font-black uppercase tracking-wider text-gray-500 mt-0.5">Buyer reviews</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <Filter className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-900">Filter products</h2>
                  <p className="text-xs text-gray-400">Search and sort this seller’s listings</p>
                </div>
              </div>

              <form action={`/seller/${seller.id}/products`} method="get" className="mt-4 space-y-3">
                <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    name="q"
                    defaultValue={resolved.q || ''}
                    placeholder="Search products"
                    className="w-full bg-transparent text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    name="sort"
                    defaultValue={sort}
                    className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="newest">Newest</option>
                    <option value="top-rated">Top rated</option>
                    <option value="price-asc">Price low-high</option>
                    <option value="price-desc">Price high-low</option>
                    <option value="stock">Most stock</option>
                  </select>

                  <select
                    name="category"
                    defaultValue={category}
                    className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="all">All categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:scale-[1.01]"
                >
                  Apply filters
                </button>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/seller/${seller.id}/products`}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-black text-gray-600 transition hover:bg-gray-200"
                >
                  Reset
                </Link>
                <Link
                  href={`/seller/${seller.id}`}
                  className="rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-black text-indigo-700 transition hover:bg-indigo-100"
                >
                  Seller profile
                </Link>
                <Link
                  href={`/sellers/${seller.id}/reviews`}
                  className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-700 transition hover:bg-amber-100"
                >
                  Reviews
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-gray-900">Seller snapshot</h2>
              <div className="mt-4 space-y-3 text-sm text-gray-600">
                {seller.bio && <p className="leading-relaxed">{seller.bio}</p>}
                <p className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  {seller.hostelName || 'Campus seller'}{seller.landmark ? ` · ${seller.landmark}` : ''}
                </p>
                <p className="inline-flex items-center gap-2">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {seller.avgRating.toFixed(1)} average from {seller.totalReviews || 0} reviews
                </p>
              </div>
              <div className="mt-4 rounded-2xl bg-[linear-gradient(135deg,#eef2ff_0%,#fdf2f8_100%)] p-4">
                <p className="text-sm font-black text-gray-900">Why it feels native</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  The palette, rounded cards, and strong status chips match the existing marketplace UI so the seller view feels like part of the same product.
                </p>
              </div>
            </div>
          </aside>

          <section className="space-y-4">
            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900">
                    {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {q || category !== 'all' ? 'Filtered catalog view' : 'All active product listings from this seller'}
                  </p>
                </div>
                <Link href={`/seller/${seller.id}`} className="inline-flex items-center gap-1 text-sm font-black text-indigo-600 hover:underline">
                  <ArrowLeft className="h-4 w-4" />
                  Back to profile
                </Link>
              </div>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50">
                  <Package className="h-8 w-8 text-gray-300" />
                </div>
                <h3 className="text-xl font-black text-gray-900">No products match this filter</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                  Try another search term or switch the category filter back to all products.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
