import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  ArrowRight,
  BadgeCheck,
  Crown,
  MapPin,
  Package,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

// Design bible: status colors reserved for true status only — trust tiers use
// neutral ink/border tones plus warning for the top (GOLD) tier, no per-tier hue variety.
const TRUST_CONFIG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  VERIFIED: { label: 'Verified', text: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  GOLD: { label: 'Gold', text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
  SILVER: { label: 'Silver', text: 'text-ink-secondary', bg: 'bg-surface', border: 'border-border' },
  BRONZE: { label: 'Bronze', text: 'text-ink-secondary', bg: 'bg-surface', border: 'border-border' },
}

function TrustPill({ level }: { level: string }) {
  const config = TRUST_CONFIG[level] || TRUST_CONFIG.BRONZE
  const icon = level === 'VERIFIED' ? <Shield className="w-3 h-3" /> : level === 'GOLD' ? <Crown className="w-3 h-3" /> : null
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${config.text} ${config.bg} ${config.border}`}>
      {icon}
      {config.label}
    </span>
  )
}

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string
  value: string
  icon: React.ReactNode
  sub: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-soft p-4">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 text-primary">
        {icon}
      </div>
      <p className="text-2xl font-semibold text-ink tabular-nums">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary mt-0.5">{label}</p>
      <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
    </div>
  )
}

export default async function SellerLandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>
}) {
  const resolved = (await searchParams) || {}
  const q = (resolved.q || '').trim().toLowerCase()

  const sellers = await prisma.user.findMany({
    where: {
      isDeleted: false,
      isSuspended: false,
      isSellerMode: true,
      products: {
        some: {
          isDeleted: false,
          isActive: true,
        },
      },
    },
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
          images: true,
          category: true,
          quantity: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 3,
      },
    },
    orderBy: [
      { completedOrders: 'desc' },
      { avgRating: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 24,
  })

  const sellersWithCounts = await Promise.all(
    sellers.map(async (seller) => {
      const activeProducts = await prisma.product.count({
        where: {
          sellerId: seller.id,
          isDeleted: false,
          isActive: true,
        },
      })

      const totalProducts = await prisma.product.count({
        where: {
          sellerId: seller.id,
          isDeleted: false,
        },
      })

      return {
        ...seller,
        activeProducts,
        totalProducts,
      }
    })
  )

  const filteredSellers = sellersWithCounts.filter((seller) => {
    if (!q) return true
    const terms = [
      seller.name,
      seller.bio || '',
      seller.hostelName || '',
      seller.landmark || '',
      seller.university?.shortName || '',
      ...seller.products.map((product) => product.name),
      ...seller.products.map((product) => product.category),
    ]
      .join(' ')
      .toLowerCase()
    return terms.includes(q)
  })

  const totalActiveListings = sellersWithCounts.reduce((sum, seller) => sum + seller.activeProducts, 0)
  const topRatedCount = sellersWithCounts.filter((seller) => seller.avgRating >= 4.5 && seller.totalReviews >= 3).length

  const spotlight = filteredSellers[0]

  return (
    <div className="min-h-screen bg-surface">
      <div className="relative overflow-hidden bg-primary">
        <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-5 sm:px-6 sm:pb-16">
          <div className="flex flex-wrap items-center gap-2 text-sm text-white/45">
            <Link href="/marketplace" className="font-semibold hover:text-white/80 transition">
              Marketplace
            </Link>
            <span>/</span>
            <span className="font-semibold text-white/75">Sellers</span>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Trusted campus sellers, ready to ship
              </div>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
                Discover the sellers behind the best campus listings.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
                Browse trusted sellers, compare ratings, and jump straight into their full catalog.
              </p>

              <form action="/seller" method="get" className="mt-6 max-w-2xl">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/12 p-2 shadow-soft shadow-black/10 backdrop-blur">
                  <Search className="ml-2 h-4 w-4 text-white/55" />
                  <input
                    name="q"
                    defaultValue={resolved.q || ''}
                    placeholder="Search sellers, hostels, products, or categories"
                    className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-medium text-white placeholder:text-white/45 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:scale-[1.02]"
                  >
                    Search
                  </button>
                </div>
              </form>

              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white/90 backdrop-blur-sm">
                  <p className="text-2xl font-semibold tabular-nums">{filteredSellers.length}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Sellers shown</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white/90 backdrop-blur-sm">
                  <p className="text-2xl font-semibold tabular-nums">{totalActiveListings}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Live listings</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white/90 backdrop-blur-sm">
                  <p className="text-2xl font-semibold tabular-nums">{topRatedCount}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">Top rated</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <StatCard
                label="Campus trust"
                value="Built in"
                sub="Ratings, reviews, and seller history"
                icon={<BadgeCheck className="h-5 w-5" />}
              />
              <StatCard
                label="Fast browsing"
                value="Instant"
                sub="Jump from seller to product catalog"
                icon={<ShoppingBag className="h-5 w-5" />}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active sellers"
            value={String(filteredSellers.length)}
            sub="Sellers with live products"
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="Listings"
            value={String(totalActiveListings)}
            sub="Current active products"
            icon={<Package className="h-5 w-5" />}
          />
          <StatCard
            label="Trusted"
            value={String(topRatedCount)}
            sub="4.5+ rating with real reviews"
            icon={<Star className="h-5 w-5" />}
          />
          <StatCard
            label="Marketplace"
            value="Live"
            sub="Ready for browsing and buying"
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-border bg-white p-5 shadow-soft">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Featured sellers</h2>
                  <p className="mt-1 text-sm text-ink-secondary">
                    {q ? `Results for "${resolved.q}"` : 'The best active sellers on BataMart right now'}
                  </p>
                </div>
                <Link href="/marketplace" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                  Browse products <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {filteredSellers.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
                {filteredSellers.map((seller, index) => (
                  <article
                    key={seller.id}
                    className="overflow-hidden rounded-3xl border border-border bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-soft"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="relative bg-primary px-5 py-5">
                      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                          {seller.profilePhoto ? (
                            <img src={seller.profilePhoto} alt={seller.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-white/80">
                              {seller.name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-white">{seller.name}</h3>
                            <TrustPill level={seller.trustLevel} />
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-xs text-white/65">
                            {seller.university?.shortName && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {seller.university.shortName}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3 w-3 fill-warning text-warning" />
                              {Number(seller.avgRating || 0).toFixed(1)} · {seller.totalReviews || 0} reviews
                            </span>
                          </div>
                        </div>
                      </div>

                      {seller.bio && <p className="mt-4 text-sm leading-relaxed text-white/75 line-clamp-3">{seller.bio}</p>}
                    </div>

                    <div className="p-5">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-surface p-3 text-center">
                          <p className="text-lg font-semibold text-ink">{seller.activeProducts}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">Live</p>
                        </div>
                        <div className="rounded-2xl bg-surface p-3 text-center">
                          <p className="text-lg font-semibold text-ink">{seller.totalProducts}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">Total</p>
                        </div>
                        <div className="rounded-2xl bg-surface p-3 text-center">
                          <p className="text-lg font-semibold text-ink">{seller.completedOrders || 0}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">Orders</p>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Link
                          href={`/seller/${seller.id}`}
                          className="flex-1 rounded-2xl bg-primary/10 px-4 py-3 text-center text-sm font-semibold text-primary transition hover:bg-primary/15"
                        >
                          View profile
                        </Link>
                        <Link
                          href={`/seller/${seller.id}/products`}
                          className="flex-1 rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-soft shadow-soft transition hover:scale-[1.01]"
                        >
                          Products
                        </Link>
                      </div>

                      {seller.products.length > 0 && (
                        <div className="mt-4 flex gap-2">
                          {seller.products.map((product) => (
                            <Link
                              key={product.id}
                              href={`/product/${product.id}`}
                              className="group h-14 w-14 overflow-hidden rounded-2xl border border-border bg-surface"
                            >
                              <img
                                src={product.images[0] || '/placeholder.png'}
                                alt={product.name}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-white px-6 py-16 text-center shadow-soft">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface">
                  <ShoppingBag className="h-8 w-8 text-ink-muted" />
                </div>
                <h3 className="text-xl font-semibold text-ink">No sellers matched your search</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink-secondary">
                  Try a different keyword, or clear the search to see all active sellers.
                </p>
                <div className="mt-6">
                  <Link href="/seller" className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft shadow-soft">
                    View all sellers <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-border bg-white p-5 shadow-soft">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-warning/10 text-warning">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-ink">Why this page exists</h2>
                  <p className="text-xs text-ink-muted">A better seller discovery entry point</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-ink-secondary">
                <p>• Find trusted sellers faster, without bouncing through the marketplace feed.</p>
                <p>• Compare ratings, completed orders, and live listings in one place.</p>
                <p>• Jump straight into each seller’s catalog or profile with a single tap.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-white p-5 shadow-soft">
              <h2 className="text-base font-semibold text-ink">Spotlight seller</h2>
              <p className="mt-1 text-xs text-ink-muted">Top result from the current list</p>
              {spotlight ? (
                <div className="mt-4 rounded-2xl bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white shadow-soft">
                      {spotlight.profilePhoto ? (
                        <img src={spotlight.profilePhoto} alt={spotlight.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-primary">
                          {spotlight.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{spotlight.name}</p>
                      <p className="text-xs text-ink-secondary">{spotlight.activeProducts} active listings</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/seller/${spotlight.id}`} className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-primary shadow-soft">
                      Open profile
                    </Link>
                    <Link href={`/seller/${spotlight.id}/products`} className="rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-soft shadow-soft">
                      View products
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-5 text-center text-sm text-ink-secondary">
                  No spotlight available.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
