import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import ReviewList from '@/components/reviews/ReviewList'
import {
  User, Package, Star, Calendar, Shield, ChevronRight,
  Search, MapPin, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { Product } from '@prisma/client'
import { Shell } from '@/components/ui/Shell'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

async function refreshSellerStats(sellerId: string) {
  try {
    const reviews = await prisma.review.findMany({ where: { revieweeId: sellerId, type: 'SELLER' } })
    if (reviews.length === 0) return
    const avgRating = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    const totalReviews = reviews.length
    let trustLevel = 'BRONZE'
    if (totalReviews >= 3) {
      if (avgRating >= 4.5 && totalReviews >= 10) trustLevel = 'VERIFIED'
      else if (avgRating >= 4.0 && totalReviews >= 5) trustLevel = 'GOLD'
      else if (avgRating >= 3.5) trustLevel = 'SILVER'
    }
    await prisma.user.update({ where: { id: sellerId }, data: { avgRating, totalReviews, trustLevel: trustLevel as any } })
  } catch (error) { console.error('Error updating seller stats:', error) }
}

function TrustPill({ level }: { level: string }) {
  if (level === 'VERIFIED') return <Badge status="verified" icon={Shield}>Verified</Badge>
  if (level === 'GOLD') return <Badge status="warning">Gold</Badge>
  return <Badge status="neutral">{level === 'SILVER' ? 'Silver' : 'Bronze'}</Badge>
}

export default async function SellerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await refreshSellerStats(id)

  const seller = await prisma.user.findUnique({
    where: { id },
    include: {
      products: { where: { isActive: true }, take: 9, orderBy: { createdAt: 'desc' } },
      reviewsReceived: {
        where: { type: 'SELLER' },
        include: {
          reviewer: { select: { id: true, name: true, profilePhoto: true } },
          order: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!seller) notFound()

  const totalProducts = await prisma.product.count({ where: { sellerId: id, isActive: true } })
  const totalSales = await prisma.order.count({ where: { sellerId: id, status: { in: ['DELIVERED', 'COMPLETED'] } } })
  const joinDate = new Date(seller.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  const satisfactionRate = seller.avgRating ? Math.round((seller.avgRating / 5) * 100) : 0

  const fmt = (p: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(p)

  const stats = [
    { label: 'Avg rating', value: `${(Math.round((seller.avgRating || 0) * 100) / 100).toFixed(2)}`, sub: 'out of five' },
    { label: 'Reviews', value: String(seller.totalReviews || 0), sub: 'from buyers' },
    { label: 'Items sold', value: String(totalSales), sub: 'completed orders' },
    { label: 'Satisfaction', value: `${satisfactionRate}%`, sub: 'happy buyers' },
  ]

  return (
    <div className="min-h-screen bg-surface pb-20">
      {/* ── Identity ──────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card">
        <Shell className="pt-6 pb-8 sm:pt-8 sm:pb-10">
          <nav className="ui-mono ui-mono-sm mb-8 flex items-center gap-2 text-ink-muted">
            <Link href="/marketplace" className="transition-colors hover:text-ink">Marketplace</Link>
            <ChevronRight className="h-3 w-3" strokeWidth={2} />
            <Link href="/seller" className="transition-colors hover:text-ink">Sellers</Link>
            <ChevronRight className="h-3 w-3" strokeWidth={2} />
            <span className="truncate text-ink">{seller.name}</span>
          </nav>

          <div className="flex flex-col items-start gap-6 sm:flex-row sm:gap-8">
            <div className="relative flex-shrink-0">
              {seller.profilePhoto ? (
                <img
                  src={seller.profilePhoto}
                  alt=""
                  className="h-24 w-24 border border-border object-cover sm:h-28 sm:w-28"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center bg-slab sm:h-28 sm:w-28">
                  <User className="h-10 w-10 text-slab-fg/70" strokeWidth={1.25} />
                </div>
              )}
              {seller.trustLevel === 'VERIFIED' && (
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center border-2 border-white bg-success">
                  <Shield className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="ui-eyebrow mb-3 max-w-[16rem]">Seller</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h1 className="text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.02] text-ink">
                  {seller.name}
                </h1>
                <TrustPill level={seller.trustLevel || 'BRONZE'} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-secondary">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" strokeWidth={0} />
                  <span className="font-semibold text-ink">{seller.avgRating?.toFixed(1) || '0.0'}</span>
                  <span className="text-ink-muted">({seller.totalReviews || 0})</span>
                </span>
                {seller.landmark && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} /> {seller.landmark}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} /> Joined {joinDate}
                </span>
              </div>

              {seller.bio && (
                <p className="mt-5 max-w-[58ch] text-[15px] leading-relaxed text-ink-secondary">
                  {seller.bio}
                </p>
              )}

              <form action="/search" method="get" className="mt-7 max-w-xl">
                <input type="hidden" name="sellerId" value={id} />
                <div className="flex items-center gap-2.5 border border-border bg-surface px-3.5 py-2.5 transition-colors focus-within:border-ink/30 focus-within:bg-card">
                  <Search className="h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                  <input
                    name="q"
                    placeholder="Search within this seller"
                    className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
                  />
                  <button
                    type="submit"
                    className="ui-mono ui-mono-sm inline-flex h-8 flex-shrink-0 items-center bg-ink px-4 text-background transition-colors hover:bg-ink/90"
                  >
                    Search
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Shell>
      </div>

      {/* ── Stat rail ─────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card">
        <Shell>
          <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-card px-4 py-5 sm:px-6 sm:py-6">
                <p className="ui-figure text-[clamp(1.5rem,3.2vw,2.1rem)] leading-none text-ink">
                  {stat.value}
                </p>
                <p className="ui-mono ui-mono-sm mt-3 text-ink">{stat.label}</p>
                <p className="mt-1 text-xs text-ink-muted">{stat.sub}</p>
              </div>
            ))}
          </div>
        </Shell>
      </div>

      {/* ── Catalogue + reviews ───────────────────────────────────────── */}
      <Shell className="pt-12 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-3 lg:gap-10">
          <section className="lg:col-span-2">
            <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
              <div>
                <p className="ui-eyebrow mb-3 max-w-[14rem]">Catalogue</p>
                <h2 className="text-[clamp(1.25rem,2.4vw,1.6rem)] leading-tight text-ink">
                  Products for sale
                </h2>
                <p className="ui-mono ui-mono-sm mt-2 text-ink-muted">
                  {totalProducts} active listing{totalProducts !== 1 ? 's' : ''}
                </p>
              </div>
              {totalProducts > 9 && (
                <Link
                  href={`/seller/${id}/products`}
                  className="group ui-mono ui-mono-sm inline-flex flex-shrink-0 items-center gap-1.5 text-ink transition-colors hover:text-ink-secondary"
                >
                  View all
                  <ArrowRight
                    className="h-3 w-3 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </Link>
              )}
            </div>

            {seller.products.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-3">
                {seller.products.map((product: Product) => (
                  <Link key={product.id} href={`/product/${product.id}`} className="ui-tile group">
                    <div className="ui-tile__media aspect-[4/5]">
                      <img
                        src={product.images?.[0] || '/placeholder.png'}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <div className="ui-tile__flags">
                        {product.quantity <= 0 ? (
                          <Badge status="out-of-stock">Sold out</Badge>
                        ) : product.quantity <= 10 ? (
                          <Badge status="low-stock">{product.quantity} left</Badge>
                        ) : null}
                      </div>
                    </div>
                    <h3 className="mt-3.5 line-clamp-1 text-[13px] font-medium text-ink sm:text-sm">
                      {product.name}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-[11px] text-ink-muted">
                      {product.description?.split(' | ').slice(0, 2).join(' · ')}
                    </p>
                    <p className="ui-figure mt-2 text-[15px] text-ink">{fmt(product.price)}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center border border-dashed border-border bg-card px-6 py-20 text-center">
                <Package className="mb-5 h-7 w-7 text-ink-muted" strokeWidth={1.5} />
                <p className="text-base text-ink">Nothing listed yet</p>
                <p className="mt-1.5 text-sm text-ink-secondary">Check back soon.</p>
              </div>
            )}
          </section>

          {/* Reviews */}
          <section>
            <div className="lg:sticky lg:top-6">
              <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
                <div>
                  <p className="ui-eyebrow mb-3 max-w-[14rem]">Feedback</p>
                  <h2 className="text-[clamp(1.25rem,2.4vw,1.6rem)] leading-tight text-ink">Reviews</h2>
                  <p className="ui-mono ui-mono-sm mt-2 text-ink-muted">
                    {seller.totalReviews || 0} verified purchase{(seller.totalReviews || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                {(seller.totalReviews || 0) > 0 && (
                  <Link
                    href={`/sellers/${id}/reviews`}
                    className="group ui-mono ui-mono-sm inline-flex flex-shrink-0 items-center gap-1.5 text-ink transition-colors hover:text-ink-secondary"
                  >
                    See all
                    <ArrowRight
                      className="h-3 w-3 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                      strokeWidth={2}
                    />
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-6 border-b border-border py-6">
                <div className="flex-shrink-0 text-center">
                  <p className="ui-figure text-[2.75rem] leading-none text-ink">
                    {seller.avgRating?.toFixed(1) || '0.0'}
                  </p>
                  <div className="mt-2.5 flex items-center justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3 w-3 ${
                          star <= Math.floor(seller.avgRating || 0)
                            ? 'fill-warning text-warning'
                            : 'fill-border text-border'
                        }`}
                        strokeWidth={0}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = seller.reviewsReceived.filter((r) => r.rating === star).length
                    const pct = seller.totalReviews ? Math.round((count / seller.totalReviews) * 100) : 0
                    return (
                      <div key={star} className="flex items-center gap-2.5">
                        <span className="ui-mono ui-mono-sm w-2 text-ink-muted">{star}</span>
                        <div className="h-[3px] flex-1 overflow-hidden bg-surface">
                          <div
                            className="h-full bg-warning transition-[width] duration-700 ease-out"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="ui-mono ui-mono-sm w-4 text-right text-ink-muted">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="pt-6">
                <ReviewList
                  reviews={seller.reviewsReceived.filter((r) => r.comment !== null) as any}
                  emptyMessage={
                    <div className="border border-dashed border-border bg-card px-5 py-14 text-center">
                      <Star className="mx-auto mb-4 h-6 w-6 text-ink-muted" strokeWidth={1.5} />
                      <p className="text-sm text-ink">No reviews yet</p>
                      <p className="mt-1 text-xs text-ink-secondary">Be the first to review this seller.</p>
                    </div>
                  }
                />
              </div>
            </div>
          </section>
        </div>
      </Shell>
    </div>
  )
}
