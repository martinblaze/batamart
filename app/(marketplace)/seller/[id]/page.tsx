import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import RatingBadge from '@/components/reviews/RatingBadge'
import ReviewList from '@/components/reviews/ReviewList'
import { User, Package, Star, ShoppingBag, Calendar, Shield, ChevronRight, BadgeCheck, Award, TrendingUp, Eye, Zap, Search } from 'lucide-react'
import Link from 'next/link'
import { Product } from '@prisma/client'

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

// Design bible: status colors reserved for true status only — trust tiers use
// neutral ink/border tones plus warning for the top (GOLD) tier, no per-tier hue variety.
const TRUST_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  VERIFIED: { label: 'Verified', color: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  GOLD:     { label: 'Gold',     color: 'text-warning',  bg: 'bg-warning/10', border: 'border-warning/30' },
  SILVER:   { label: 'Silver',   color: 'text-ink-secondary', bg: 'bg-surface', border: 'border-border' },
  BRONZE:   { label: 'Bronze',   color: 'text-ink-secondary', bg: 'bg-surface', border: 'border-border' },
}

export default async function SellerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await refreshSellerStats(id)

  const seller = await prisma.user.findUnique({
    where: { id },
    include: {
      products: {
        where: { isActive: true },
        take: 8,
        orderBy: { createdAt: 'desc' },
      },
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
  const totalSales    = await prisma.order.count({ where: { sellerId: id, status: { in: ['DELIVERED', 'COMPLETED'] } } })
  const joinDate      = new Date(seller.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  const satisfactionRate = seller.avgRating ? Math.round((seller.avgRating / 5) * 100) : 0
  const trust = TRUST_CONFIG[seller.trustLevel || 'BRONZE']

  const fmt = (p: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(p)

  return (
    <div className="min-h-screen bg-surface">

      {/* ── Header banner ── */}
      <div className="relative overflow-hidden bg-primary">
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/10 blur-xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-10 sm:pb-16">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
            <Link href="/marketplace" className="hover:text-white/70 transition font-medium">Marketplace</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/seller" className="hover:text-white/70 transition font-medium">Sellers</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white/70 font-semibold">{seller.name}</span>
          </div>

          {/* Seller identity */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {seller.profilePhoto ? (
                <img src={seller.profilePhoto} alt={seller.name || 'Seller'} className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover border-2 border-white/20 shadow-soft" />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/10 border-2 border-white/20 flex items-center justify-center shadow-soft backdrop-blur-sm">
                  <User className="w-9 h-9 sm:w-11 sm:h-11 text-white/60" />
                </div>
              )}
              {seller.trustLevel === 'VERIFIED' && (
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-success flex items-center justify-center border-2 border-white shadow-soft">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <h1 className="text-2xl sm:text-3xl font-semibold text-white">{seller.name}</h1>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-semibold border ${trust.bg} ${trust.color} ${trust.border}`}>
                  {seller.trustLevel === 'VERIFIED' && <Shield className="w-3 h-3" />}
                  {trust.label}
                </span>
              </div>
              {seller.bio && (
                <p className="text-white/60 text-sm mb-4 max-w-xl leading-relaxed">{seller.bio}</p>
              )}
              <form action="/search" method="get" className="mb-4 max-w-xl">
                <input type="hidden" name="sellerId" value={id} />
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 p-2 backdrop-blur-sm">
                  <Search className="ml-1 h-4 w-4 flex-shrink-0 text-white/50" />
                  <input
                    name="q"
                    placeholder="Search within this seller"
                    className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm font-medium text-white placeholder:text-white/35 outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-xs font-semibold text-primary transition hover:bg-primary/10"
                  >
                    Search
                  </button>
                </div>
              </form>
              {/* Quick stats */}
              <div className="flex flex-wrap gap-4 sm:gap-6">
                {[
                  { icon: <ShoppingBag className="w-3.5 h-3.5" />, value: totalSales, label: 'sales' },
                  { icon: <Package className="w-3.5 h-3.5" />, value: totalProducts, label: 'products' },
                  { icon: <Star className="w-3.5 h-3.5" />, value: seller.avgRating?.toFixed(1) || '—', label: `(${seller.totalReviews || 0} reviews)` },
                  { icon: <Calendar className="w-3.5 h-3.5" />, value: joinDate, label: '' },
                ].map(({ icon, value, label }, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm text-white/70">
                    <span className="text-white/40">{icon}</span>
                    <span className="font-semibold text-white">{value}</span>
                    {label && <span>{label}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Rating chip */}
            <div className="hidden sm:flex flex-col items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-4 flex-shrink-0">
              <p className="text-4xl font-semibold text-white tabular-nums">{seller.avgRating?.toFixed(1) || '0.0'}</p>
              <div className="flex items-center gap-0.5 my-1.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className={`w-3.5 h-3.5 ${star <= Math.floor(seller.avgRating || 0) ? 'fill-warning text-warning' : 'text-white/20 fill-white/20'}`} />
                ))}
              </div>
              <p className="text-[11px] text-white/50 font-semibold">{seller.totalReviews || 0} reviews</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats cards (overlap the header) ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 mt-4 sm:-mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Avg Rating', value: `${(Math.round((seller.avgRating || 0) * 100) / 100).toFixed(2)}/5`, sub: 'out of 5 stars', icon: <Star className="w-5 h-5 text-warning" />, bg: 'bg-warning/10' },
            { label: 'Reviews', value: String(seller.totalReviews || 0), sub: 'from buyers', icon: <BadgeCheck className="w-5 h-5 text-primary" />, bg: 'bg-primary/10' },
            { label: 'Items Sold', value: String(totalSales), sub: 'completed orders', icon: <TrendingUp className="w-5 h-5 text-success" />, bg: 'bg-success/10' },
            { label: 'Satisfaction', value: `${satisfactionRate}%`, sub: 'happy buyers', icon: <Zap className="w-5 h-5 text-primary" />, bg: 'bg-primary/10' },
          ].map(({ label, value, sub, icon, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-border shadow-soft px-4 py-4 hover:shadow-soft transition-shadow">
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
              <p className="text-2xl font-semibold text-ink tabular-nums">{value}</p>
              <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mt-0.5">{label}</p>
              <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Products + Reviews ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Products — 2 cols */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">Products for Sale</h2>
                  <p className="text-xs text-ink-muted mt-0.5">{totalProducts} active listing{totalProducts !== 1 ? 's' : ''}</p>
                </div>
                {totalProducts > 8 && (
                  <Link href={`/seller/${id}/products`} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {seller.products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-px bg-surface p-2 sm:p-0">
                  {seller.products.map((product: Product) => (
                    <Link key={product.id} href={`/product/${product.id}`}
                      className="group bg-white p-2 sm:p-4 hover:bg-primary/10/30 transition-colors rounded-lg sm:rounded-none">
                      {product.images?.[0] && (
                        <div className="w-full aspect-square rounded-lg sm:rounded-xl overflow-hidden mb-2 sm:mb-3 bg-surface">
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                      )}
                      <h3 className="text-xs sm:text-sm font-semibold text-ink group-hover:text-primary transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-[9px] sm:text-xs text-ink-muted mt-0.5 sm:mt-1 line-clamp-1">{product.description?.split(' | ').slice(0, 2).join(' · ')}</p>
                      <div className="flex items-center justify-between mt-1.5 sm:mt-2.5">
                        <span className="text-xs sm:text-sm font-semibold text-primary">{fmt(product.price)}</span>
                        <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-semibold ${
                          product.quantity > 10 ? 'bg-success/10 text-success'
                          : product.quantity > 0 ? 'bg-warning/10 text-warning'
                          : 'bg-danger/10 text-danger'
                        }`}>
                          {product.quantity > 0 ? `${product.quantity} left` : 'Out of stock'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4 ring-1 ring-border">
                    <Package className="w-8 h-8 text-ink-muted" />
                  </div>
                  <p className="text-sm font-semibold text-ink-secondary">No products listed yet</p>
                  <p className="text-xs text-ink-muted mt-1">Check back soon.</p>
                </div>
              )}
            </div>
          </div>

          {/* Reviews — 1 col */}
          <div>
            <div className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden sticky top-6">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-base font-semibold text-ink">Customer Reviews</h2>
                <p className="text-xs text-ink-muted mt-0.5">{seller.totalReviews || 0} verified purchase{(seller.totalReviews || 0) !== 1 ? 's' : ''}</p>
              </div>

              {/* Rating breakdown */}
              <div className="px-5 py-4 border-b border-border">
                <div className="flex items-center gap-4">
                  <div className="text-center flex-shrink-0">
                    <p className="text-4xl font-semibold text-ink">{seller.avgRating?.toFixed(1) || '0.0'}</p>
                    <div className="flex items-center justify-center gap-0.5 mt-1.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} className={`w-3 h-3 ${star <= Math.floor(seller.avgRating || 0) ? 'fill-warning text-warning' : 'text-border fill-border'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = seller.reviewsReceived.filter(r => r.rating === star).length
                      const pct = seller.totalReviews ? Math.round((count / seller.totalReviews) * 100) : 0
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs text-ink-muted font-semibold w-2.5">{star}</span>
                          <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                            <div className="h-full bg-warning rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-ink-muted w-5 text-right font-semibold">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                <ReviewList
                  reviews={seller.reviewsReceived.filter(r => r.comment !== null) as any}
                  emptyMessage={
                    <div className="text-center py-10">
                      <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-3 ring-1 ring-border">
                        <Star className="w-6 h-6 text-ink-muted" />
                      </div>
                      <p className="text-sm font-semibold text-ink-secondary">No reviews yet</p>
                      <p className="text-xs text-ink-muted mt-1">Be the first to review this seller</p>
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


