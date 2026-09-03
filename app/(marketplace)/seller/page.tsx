import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  ArrowRight,
  Crown,
  MapPin,
  Search,
  Shield,
  ShoppingBag,
  Star,
} from 'lucide-react'
import { Shell, PageHeader, EmptyState } from '@/components/ui/Shell'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

// Trust tiers are not order status, so they stay in the neutral instrument
// voice — only the top tier earns a colour, and only warning.
function TrustPill({ level }: { level: string }) {
  if (level === 'VERIFIED') return <Badge status="verified" icon={Shield}>Verified</Badge>
  if (level === 'GOLD') return <Badge status="warning" icon={Crown}>Gold</Badge>
  return <Badge status="neutral">{level === 'SILVER' ? 'Silver' : 'Bronze'}</Badge>
}

/** Mono label under a display figure — the stat voice used across the app. */
function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-card px-4 py-4 sm:px-6">
      <p className="ui-figure text-[clamp(1.35rem,3vw,1.9rem)] leading-none text-ink">{value}</p>
      <p className="ui-mono ui-mono-sm mt-2 text-ink-muted">{label}</p>
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
      products: { some: { isDeleted: false, isActive: true } },
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
      university: { select: { shortName: true } },
      products: {
        where: { isDeleted: false, isActive: true },
        select: { id: true, name: true, price: true, images: true, category: true, quantity: true },
        orderBy: { createdAt: 'desc' },
        take: 4,
      },
    },
    orderBy: [{ completedOrders: 'desc' }, { avgRating: 'desc' }, { createdAt: 'desc' }],
    take: 24,
  })

  const sellersWithCounts = await Promise.all(
    sellers.map(async (seller) => ({
      ...seller,
      activeProducts: await prisma.product.count({
        where: { sellerId: seller.id, isDeleted: false, isActive: true },
      }),
    }))
  )

  const filteredSellers = sellersWithCounts.filter((seller) => {
    if (!q) return true
    return [
      seller.name,
      seller.bio || '',
      seller.hostelName || '',
      seller.landmark || '',
      seller.university?.shortName || '',
      ...seller.products.map((p) => p.name),
      ...seller.products.map((p) => p.category),
    ]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })

  const totalActiveListings = sellersWithCounts.reduce((sum, s) => sum + s.activeProducts, 0)
  const topRatedCount = sellersWithCounts.filter(
    (s) => s.avgRating >= 4.5 && s.totalReviews >= 3
  ).length

  return (
    <div className="min-h-screen bg-surface pb-20">
      <Shell className="pt-8 sm:pt-12">
        <PageHeader
          eyebrow="Directory"
          back={{ href: '/marketplace', label: 'Marketplace' }}
          title={
            <>
              Campus <span className="ui-serif">sellers</span>
            </>
          }
          description="Traders already delivering on your campus. Compare ratings, see what they have live, and jump straight into a catalogue."
          actions={
            <form action="/seller" method="get" className="w-full sm:w-[19rem]">
              <div className="flex items-center gap-2.5 border border-border bg-card px-3.5 py-2.5 transition-colors focus-within:border-ink/30">
                <Search className="h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                <input
                  name="q"
                  defaultValue={resolved.q || ''}
                  placeholder="Search sellers, zones, products…"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
                />
              </div>
            </form>
          }
        />

        {/* Hairline stat strip — gap-px over the border colour draws the rules. */}
        <div className="grid grid-cols-3 gap-px border-b border-border bg-border">
          <Figure value={String(filteredSellers.length)} label="Sellers" />
          <Figure value={String(totalActiveListings)} label="Listings" />
          <Figure value={String(topRatedCount)} label="Top rated" />
        </div>

        <div className="mt-10 sm:mt-14">
          {filteredSellers.length > 0 ? (
            <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {filteredSellers.map((seller) => (
                <article key={seller.id} className="group relative flex flex-col bg-card">
                  <Link href={`/seller/${seller.id}`} className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-start gap-3.5">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden bg-ink">
                        {seller.profilePhoto ? (
                          <img
                            src={seller.profilePhoto}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-background">
                            {seller.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-semibold leading-snug text-ink">
                          {seller.name}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-secondary">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Star className="h-3 w-3 fill-warning text-warning" strokeWidth={0} />
                            {Number(seller.avgRating || 0).toFixed(1)}
                            <span className="text-ink-muted">({seller.totalReviews || 0})</span>
                          </span>
                          {seller.landmark && (
                            <span className="inline-flex min-w-0 items-center gap-1 text-ink-muted">
                              <MapPin className="h-3 w-3 flex-shrink-0" strokeWidth={1.75} />
                              <span className="truncate">{seller.landmark}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <TrustPill level={seller.trustLevel} />
                    </div>

                    {seller.bio && (
                      <p className="mt-4 line-clamp-2 text-[13px] leading-relaxed text-ink-secondary">
                        {seller.bio}
                      </p>
                    )}

                    {seller.products.length > 0 && (
                      <div className="mt-5 grid grid-cols-4 gap-1.5">
                        {seller.products.map((product) => (
                          <div key={product.id} className="aspect-square overflow-hidden bg-surface">
                            <img
                              src={product.images[0] || '/placeholder.png'}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="ui-mono ui-mono-sm mt-auto flex items-center gap-5 pt-5 text-ink-muted">
                      <span>
                        <span className="ui-figure mr-1 text-[13px] tracking-normal text-ink">
                          {seller.activeProducts}
                        </span>
                        Live
                      </span>
                      <span>
                        <span className="ui-figure mr-1 text-[13px] tracking-normal text-ink">
                          {seller.completedOrders || 0}
                        </span>
                        Orders
                      </span>
                    </div>
                  </Link>

                  <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
                    <Link
                      href={`/seller/${seller.id}`}
                      className="ui-mono ui-mono-sm bg-card py-3 text-center text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
                    >
                      Profile
                    </Link>
                    <Link
                      href={`/seller/${seller.id}/products`}
                      className="group/cta ui-mono ui-mono-sm inline-flex items-center justify-center gap-1.5 bg-card py-3 text-ink transition-colors hover:bg-ink hover:text-background"
                    >
                      Shop all
                      <ArrowRight
                        className="h-3 w-3 transition-transform duration-300 ease-out group-hover/cta:translate-x-0.5"
                        strokeWidth={2}
                      />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ShoppingBag}
              title="No sellers matched that search"
              description="Try a different keyword, or clear the search to see everyone trading on campus right now."
              action={
                <Link
                  href="/seller"
                  className="inline-flex items-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-ink/90"
                >
                  View all sellers <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              }
            />
          )}
        </div>
      </Shell>
    </div>
  )
}
