'use client'

import LoadedImage from '@/components/LoadedImage'
import { BadgeCheck, Flame, Star, Truck } from 'lucide-react'
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
// The whole card is one click target to its product page — no separate CTA button.
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
      <article
        onClick={onOpen}
        className={`group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-white transition-transform duration-150 ease-out hover:-translate-y-0.5 sm:flex-row ${className}`}
      >
        <div className="relative aspect-square w-full flex-shrink-0 bg-surface sm:w-52">
          <LoadedImage src={image} alt={product.name} className="transition duration-500 group-hover:scale-105" wrapperClassName="h-full w-full" priority={priority} />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {product.isHot && <Badge status="warning" icon={Flame}>Hot</Badge>}
            {product.isNew && <Badge status="new">New</Badge>}
            {product.isDeal && <Badge status="success">Deal</Badge>}
          </div>
        </div>
        <div className="flex-1 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-[16px] font-medium leading-snug text-ink">{product.name}</h3>
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
            {product.deliveryEstimate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 font-semibold text-success">
                <Truck className="h-3 w-3" strokeWidth={1.75} /> Delivery: {product.deliveryEstimate}
              </span>
            )}
            {stock === 0 && <Badge status="out-of-stock">Out of stock</Badge>}
            {stock > 0 && stock <= 5 && <Badge status="low-stock">Only {stock} left</Badge>}
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      onClick={onOpen}
      className={`group cursor-pointer overflow-hidden rounded-xl border border-border bg-white transition-transform duration-150 ease-out hover:-translate-y-0.5 ${className}`}
    >
      <div className="relative aspect-square w-full bg-surface">
        <LoadedImage src={image} alt={product.name} className="transition duration-500 group-hover:scale-105" wrapperClassName="h-full w-full" priority={priority} />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.isHot && <Badge status="warning" icon={Flame}>Hot</Badge>}
          {product.isNew && <Badge status="new">New</Badge>}
          {product.isDeal && <Badge status="success">Deal</Badge>}
        </div>
        <div className="absolute bottom-3 left-3 rounded-md bg-white/92 px-2.5 py-1 text-[11px] font-medium text-ink-secondary backdrop-blur">
          {stock > 0 ? `${stock} left` : 'Out of stock'}
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{product.name}</h3>
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
        {product.deliveryEstimate && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
              <Truck className="h-2.5 w-2.5" strokeWidth={1.75} /> Delivery: {product.deliveryEstimate}
            </span>
          </div>
        )}
        {stock === 0 ? (
          <div className="mt-2">
            <Badge status="out-of-stock">Out of stock</Badge>
          </div>
        ) : stock <= 5 ? (
          <div className="mt-2">
            <Badge status="low-stock">Only {stock} left</Badge>
          </div>
        ) : null}
      </div>
    </article>
  )
}
