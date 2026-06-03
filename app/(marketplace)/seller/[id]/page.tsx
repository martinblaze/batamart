import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import RatingBadge from '@/components/reviews/RatingBadge'
import ReviewList from '@/components/reviews/ReviewList'
import { User, Package, Star, ShoppingBag, Calendar, Shield, ChevronRight, BadgeCheck, Award, TrendingUp, Eye, Zap } from 'lucide-react'
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

const TRUST_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; gradient: string }> = {
  VERIFIED: { label: 'Verified', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-500 to-teal-500' },
  GOLD:     { label: 'Gold',     color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   gradient: 'from-amber-400 to-orange-500' },
  SILVER:   { label: 'Silver',   color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200',   gradient: 'from-slate-400 to-gray-500'   },
  BRONZE:   { label: 'Bronze',   color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200',  gradient: 'from-orange-400 to-amber-500'  },
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
    <div className="min-h-screen bg-[#f0f2f5]">

      {/* ── Header banner ── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-violet-500/10 blur-xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-10 sm:pb-16">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-white/40 mb-6">
            <Link href="/marketplace" className="hover:text-white/70 transition font-medium">Marketplace</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/sellers" className="hover:text-white/70 transition font-medium">Sellers</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-white/70 font-semibold">{seller.name}</span>
          </div>

          {/* Seller identity */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {seller.profilePhoto ? (
                <img src={seller.profilePhoto} alt={seller.name || 'Seller'} className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover border-2 border-white/20 shadow-2xl" />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/10 border-2 border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-sm">
                  <User className="w-9 h-9 sm:w-11 sm:h-11 text-white/60" />
                </div>
              )}
              {seller.trustLevel === 'VERIFIED' && (
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center border-2 border-white shadow-lg">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{seller.name}</h1>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black border ${trust.bg} ${trust.color} ${trust.border}`}>
                  {seller.trustLevel === 'VERIFIED' && <Shield className="w-3 h-3" />}
                  {trust.label}
                </span>
              </div>
              {seller.bio && (
                <p className="text-white/60 text-sm mb-4 max-w-xl leading-relaxed">{seller.bio}</p>
              )}
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
                    <span className="font-bold text-white">{value}</span>
                    {label && <span>{label}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Rating chip */}
            <div className="hidden sm:flex flex-col items-center bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-4 flex-shrink-0">
              <p className="text-4xl font-black text-white tabular-nums">{seller.avgRating?.toFixed(1) || '0.0'}</p>
              <div className="flex items-center gap-0.5 my-1.5">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className={`w-3.5 h-3.5 ${star <= Math.floor(seller.avgRating || 0) ? 'fill-amber-400 text-amber-400' : 'text-white/20 fill-white/20'}`} />
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
            { label: 'Avg Rating', value: `${(Math.round((seller.avgRating || 0) * 100) / 100).toFixed(2)}/5`, sub: 'out of 5 stars', icon: <Star className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50' },
            { label: 'Reviews', value: String(seller.totalReviews || 0), sub: 'from buyers', icon: <BadgeCheck className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50' },
            { label: 'Items Sold', value: String(totalSales), sub: 'completed orders', icon: <TrendingUp className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50' },
            { label: 'Satisfaction', value: `${satisfactionRate}%`, sub: 'happy buyers', icon: <Zap className="w-5 h-5 text-violet-500" />, bg: 'bg-violet-50' },
          ].map(({ label, value, sub, icon, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
              <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-0.5">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Products + Reviews ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Products — 2 cols */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-gray-900">Products for Sale</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{totalProducts} active listing{totalProducts !== 1 ? 's' : ''}</p>
                </div>
                {totalProducts > 8 && (
                  <Link href={`/seller/${id}/products`} className="text-xs text-indigo-600 font-black hover:underline flex items-center gap-1">
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {seller.products.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
                  {seller.products.map((product: Product) => (
                    <Link key={product.id} href={`/product/${product.id}`}
                      className="group bg-white p-4 hover:bg-indigo-50/30 transition-colors">
                      {product.images?.[0] && (
                        <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 bg-gray-50">
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                      )}
                      <h3 className="text-sm font-black text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{product.description?.split(' | ').slice(0, 2).join(' · ')}</p>
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-sm font-black text-indigo-600">{fmt(product.price)}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                          product.quantity > 10 ? 'bg-emerald-50 text-emerald-700'
                          : product.quantity > 0 ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-600'
                        }`}>
                          {product.quantity > 0 ? `${product.quantity} left` : 'Out of stock'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 ring-1 ring-gray-100">
                    <Package className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-600">No products listed yet</p>
                  <p className="text-xs text-gray-400 mt-1">Check back soon.</p>
                </div>
              )}
            </div>
          </div>

          {/* Reviews — 1 col */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-6">
              <div className="px-5 py-4 border-b border-gray-50">
                <h2 className="text-base font-black text-gray-900">Customer Reviews</h2>
                <p className="text-xs text-gray-400 mt-0.5">{seller.totalReviews || 0} verified purchase{(seller.totalReviews || 0) !== 1 ? 's' : ''}</p>
              </div>

              {/* Rating breakdown */}
              <div className="px-5 py-4 border-b border-gray-50">
                <div className="flex items-center gap-4">
                  <div className="text-center flex-shrink-0">
                    <p className="text-4xl font-black text-gray-900">{seller.avgRating?.toFixed(1) || '0.0'}</p>
                    <div className="flex items-center justify-center gap-0.5 mt-1.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} className={`w-3 h-3 ${star <= Math.floor(seller.avgRating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {[5, 4, 3, 2, 1].map(star => {
                      const count = seller.reviewsReceived.filter(r => r.rating === star).length
                      const pct = seller.totalReviews ? Math.round((count / seller.totalReviews) * 100) : 0
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-bold w-2.5">{star}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 w-5 text-right font-semibold">{count}</span>
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
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3 ring-1 ring-gray-100">
                        <Star className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="text-sm font-bold text-gray-600">No reviews yet</p>
                      <p className="text-xs text-gray-400 mt-1">Be the first to review this seller</p>
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
