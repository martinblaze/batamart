import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  ArrowRight,
  Crown,
  MapPin,
  Package,
  Search,
  Shield,
  ShoppingBag,
  Star,
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.text} ${config.bg} ${config.border}`}>
      {icon}
      {config.label}
    </span>
  )
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-semibold text-ink tabular-nums">{value}</p>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      </div>
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
        take: 4,
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

      return {
        ...seller,
        activeProducts,
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

  const fmt = (p: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(p)

  return (
    <div className="min-h-screen bg-surface">
      <div className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <Link href="/marketplace" className="font-semibold hover:text-primary transition">Marketplace</Link>
            <span>/</span>
            <span className="font-semibold text-ink-secondary">Sellers</span>
          </div>

          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-ink sm:text-3xl">Campus sellers</h1>
              <p className="mt-1.5 text-sm text-ink-secondary">
                Browse trusted sellers, compare ratings, and jump straight into their catalog.
              </p>
            </div>

            <form action="/seller" method="get" className="w-full sm:max-w-xs">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 focus-within:border-primary/40 focus-within:bg-white transition">
                <Search className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                <input
                  name="q"
                  defaultValue={resolved.q || ''}
                  placeholder="Search sellers, zones, products…"
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink placeholder:text-ink-muted focus:outline-none"
                />
              </div>
            </form>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            <StatChip icon={<Users className="h-4 w-4" />} value={String(filteredSellers.length)} label="Sellers" />
            <StatChip icon={<Package className="h-4 w-4" />} value={String(totalActiveListings)} label="Listings" />
            <StatChip icon={<Star className="h-4 w-4" />} value={String(topRatedCount)} label="Top rated" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {filteredSellers.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSellers.map((seller) => (
              <article
                key={seller.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all hover:-translate-y-0.5 hover:shadow-soft"
              >
                <Link href={`/seller/${seller.id}`} className="flex flex-1 flex-col p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-primary">
                      {seller.profilePhoto ? (
                        <img src={seller.profilePhoto} alt={seller.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white">
                          {seller.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-[15px] font-semibold text-ink group-hover:text-primary transition-colors">{seller.name}</h3>
                        <TrustPill level={seller.trustLevel} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-ink-secondary">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          {Number(seller.avgRating || 0).toFixed(1)} ({seller.totalReviews || 0})
                        </span>
                        {seller.landmark && (
                          <span className="inline-flex items-center gap-1 text-ink-muted">
                            <MapPin className="h-3 w-3" /> {seller.landmark}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {seller.bio && <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-ink-secondary">{seller.bio}</p>}

                  <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs text-ink-secondary">
                    <span><span className="font-semibold text-ink">{seller.activeProducts}</span> live</span>
                    <span><span className="font-semibold text-ink">{seller.completedOrders || 0}</span> orders</span>
                  </div>

                  {seller.products.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      {seller.products.map((product) => (
                        <div key={product.id} className="aspect-square overflow-hidden rounded-lg bg-surface">
                          <img
                            src={product.images[0] || '/placeholder.png'}
                            alt={product.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Link>

                <div className="flex border-t border-border">
                  <Link
                    href={`/seller/${seller.id}`}
                    className="flex-1 py-2.5 text-center text-xs font-semibold text-ink-secondary transition hover:bg-surface hover:text-primary"
                  >
                    Profile
                  </Link>
                  <div className="w-px bg-border" />
                  <Link
                    href={`/seller/${seller.id}/products`}
                    className="flex flex-1 items-center justify-center gap-1 py-2.5 text-center text-xs font-semibold text-primary transition hover:bg-primary/5"
                  >
                    Shop all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface">
              <ShoppingBag className="h-7 w-7 text-ink-muted" />
            </div>
            <h3 className="text-lg font-semibold text-ink">No sellers matched your search</h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-secondary">
              Try a different keyword, or clear the search to see all active sellers.
            </p>
            <div className="mt-5">
              <Link href="/seller" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-soft">
                View all sellers <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
