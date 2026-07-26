import { useMemo } from 'react'
import { Crown, Star, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

export type RelatedProductCardProduct = {
  id: string
  name: string
  price: number
  priceDisplay?: string
  images?: string[]
  avgRating?: number
  totalReviews?: number
  isHot?: boolean
  isDeal?: boolean
  discountPercent?: number | null
  seller?: {
    id: string
    name: string
    trustLevel?: string | null
    avgRating?: number | null
  }
  deliveryEstimate?: string | null
  matchReason?: string
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

// Thin sibling of components/ProductCard.tsx tuned for narrow related-product
// rails. Same flat design-bible tokens; kept separate because the data shape
// (matchReason, discountPercent) differs from the main product card.
export default function RelatedProductCard({
  product,
  onOpen,
  compact = false,
}: {
  product: RelatedProductCardProduct
  onOpen?: () => void
  compact?: boolean
}) {
  const originalPrice = useMemo(() => {
    if (!product.discountPercent || product.discountPercent <= 0) return null
    const estimate = product.price / (1 - product.discountPercent / 100)
    return Number.isFinite(estimate) ? estimate : null
  }, [product.discountPercent, product.price])

  const card = (
    <div className={`group relative overflow-hidden rounded-xl border border-border bg-white transition-transform duration-150 ease-out hover:-translate-y-0.5 ${compact ? 'w-40 sm:w-full' : 'w-full'}`}>
      <div className="relative aspect-square overflow-hidden bg-surface">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Crown className="h-8 w-8 text-ink-muted" strokeWidth={1.75} />
          </div>
        )}
        {product.isHot && (
          <span className="absolute left-2 top-2">
            <Badge status="warning">Hot</Badge>
          </span>
        )}
        {(product.isDeal || (product.discountPercent ?? 0) > 0) && (
          <span className="absolute right-2 top-2">
            <Badge status="danger">{product.discountPercent ? `${product.discountPercent}% off` : 'Deal'}</Badge>
          </span>
        )}
      </div>

      <div className="space-y-2 p-3">
        {product.matchReason && (
          <div className="inline-flex rounded-md bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-secondary">
            {product.matchReason}
          </div>
        )}
        <p className="line-clamp-2 text-[13px] font-medium leading-5 text-ink">
          {product.name}
        </p>
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-warning text-warning" strokeWidth={1.75} />
          <span className="text-[11px] font-medium text-ink-secondary">
            {(product.avgRating || 0).toFixed(1)}
          </span>
          <span className="text-[11px] text-ink-muted">·</span>
          <span className="text-[11px] text-ink-secondary">
            {product.totalReviews || 0} reviews
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-ink">
            {product.priceDisplay || formatPrice(product.price)}
          </span>
          {originalPrice && (
            <span className="text-[11px] text-ink-muted line-through">
              {formatPrice(originalPrice)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-ink-secondary">
          <Truck className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
          <span>{product.deliveryEstimate || 'Delivery info available'}</span>
        </div>
        {product.seller?.name && (
          <p className="truncate text-[11px] text-ink-muted">
            Sold by {product.seller.name}
          </p>
        )}
      </div>
    </div>
  )

  if (!onOpen) return card

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left"
    >
      {card}
    </button>
  )
}
