'use client'

import LoadedImage from '@/components/LoadedImage'
import { BadgeCheck, Eye, Flame, Star } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

type ProductCardProduct = {
  id: string
  name: string
  price: number
  priceDisplay?: string | null
  images?: string[]
  isHot?: boolean
  isNew?: boolean
  isDeal?: boolean
  deliveryEstimate?: string | null
  seller?: { id?: string; name?: string; trustLevel?: string; avgRating?: number }
  avgRating?: number
  totalReviews?: number
  quantity?: number
  category?: string
  subcategory?: string | null
  categoryKey?: string | null
  subcategoryKey?: string | null
  variantId?: string
  selectedVariants?: Record<string, string>
}

function fmt(price: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price)
}

function TrustBadge({ trustLevel }: { trustLevel?: string }) {
  if (!trustLevel) return null
  const label = trustLevel === 'VERIFIED' ? 'Verified' : trustLevel === 'GOLD' ? 'Top seller' : trustLevel
  return (
    <Badge status="verified" icon={BadgeCheck} className="text-[10px]">
      {label}
    </Badge>
  )
}

// Design bible section 8 — Product card. Element order: photo → title →
// seller/verified → rating → price → delivery badge → stock status.
// (Wishlist toggle is omitted: there is no wishlist API/store in this app yet,
// and a heart icon with no destination would violate the "no dead buttons" rule.)
export default function ProductCard({
  product,
  layout = 'grid',
  onOpen,
  showSeller = true,
  className = '',
  priority = false,
}: {
  product: ProductCardProduct
  layout?: 'grid' | 'list'
  onOpen?: () => void
  showSeller?: boolean
  className?: string
  priority?: boolean
}) {
  const image = product.images?.[0] || '/placeholder.png'
  const rating = product.avgRating ?? product.seller?.avgRating ?? 0
  const price = product.priceDisplay || fmt(product.price)
  const stock = product.quantity ?? 0

  if (layout === 'list') {
    return (
      <article className={`group overflow-hidden rounded-xl border border-border bg-white transition-transform duration-150 ease-out hover:-translate-y-0.5 ${className}`}>
        <div className="flex flex-col sm:flex-row">
          <button type="button" onClick={onOpen} className="relative aspect-square w-full sm:w-52 flex-shrink-0 bg-surface text-left">
            <LoadedImage src={image} alt={product.name} className="transition duration-500 group-hover:scale-105" wrapperClassName="h-full w-full" priority={priority} />
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              {product.isHot && <Badge status="warning" icon={Flame}>Hot</Badge>}
              {product.isNew && <Badge status="new">New</Badge>}
              {product.isDeal && <Badge status="success">Deal</Badge>}
            </div>
          </button>
          <div className="flex-1 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button type="button" onClick={onOpen} className="text-left">
                  <h3 className="line-clamp-2 text-[16px] font-medium leading-snug text-ink">{product.name}</h3>
                </button>
                {showSeller && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
                    <span className="font-medium text-ink-secondary">{product.seller?.name || 'Seller'}</span>
                    <TrustBadge trustLevel={product.seller?.trustLevel} />
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-[18px] font-semibold text-ink">{price}</p>
                {rating > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-ink-secondary">
                    <Star className="h-3 w-3 fill-warning text-warning" strokeWidth={1.75} />
                    {rating.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {product.deliveryEstimate && <span className="rounded-md bg-surface px-2.5 py-1 font-medium text-ink-secondary">{product.deliveryEstimate}</span>}
              {stock === 0 && <Badge status="out-of-stock">Out of stock</Badge>}
              {stock > 0 && stock <= 5 && <Badge status="low-stock">Only {stock} left</Badge>}
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onOpen} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:brightness-95 active:scale-[0.98]">
                <Eye className="h-4 w-4" strokeWidth={1.75} />
                View product
              </button>
            </div>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={`group overflow-hidden rounded-xl border border-border bg-white transition-transform duration-150 ease-out hover:-translate-y-0.5 ${className}`}>
      <button type="button" onClick={onOpen} className="relative aspect-square w-full bg-surface text-left">
        <LoadedImage src={image} alt={product.name} className="transition duration-500 group-hover:scale-105" wrapperClassName="h-full w-full" priority={priority} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.isHot && <Badge status="warning" icon={Flame}>Hot</Badge>}
          {product.isNew && <Badge status="new">New</Badge>}
          {product.isDeal && <Badge status="success">Deal</Badge>}
        </div>
        <div className="absolute bottom-3 left-3 rounded-md bg-white/92 px-2.5 py-1 text-[11px] font-medium text-ink-secondary backdrop-blur">
          {product.deliveryEstimate || (stock > 0 ? `${stock} left` : 'Out of stock')}
        </div>
      </button>

      <div className="p-4">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{product.name}</h3>
        </button>
        {showSeller && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
            <span className="font-medium text-ink-secondary">{product.seller?.name || 'Seller'}</span>
            <TrustBadge trustLevel={product.seller?.trustLevel} />
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[17px] font-semibold text-ink">{price}</p>
          {rating > 0 && (
            <div className="inline-flex items-center gap-1 text-xs font-medium text-ink-secondary">
              <Star className="h-3 w-3 fill-warning text-warning" strokeWidth={1.75} />
              {rating.toFixed(1)}
            </div>
          )}
        </div>
        {stock === 0 ? (
          <div className="mt-3">
            <Badge status="out-of-stock">Out of stock</Badge>
          </div>
        ) : stock <= 5 ? (
          <div className="mt-3">
            <Badge status="low-stock">Only {stock} left</Badge>
          </div>
        ) : null}
        <button type="button" onClick={onOpen} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:brightness-95 active:scale-[0.98]">
          <Eye className="h-4 w-4" strokeWidth={1.75} />
          View product
        </button>
      </div>
    </article>
  )
}
