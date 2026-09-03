'use client'

import LoadedImage from '@/components/LoadedImage'
import { BadgeCheck, Flame, Heart, MapPin, Star, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { CAMPAIGNS, isCampaignActive } from '@/lib/campaigns'

type ProductCardProduct = {
  id: string
  name: string
  price: number
  priceDisplay?: string | null
  images?: string[]
  isHot?: boolean
  isNew?: boolean
  isDeal?: boolean
  campaignTag?: string | null
  campaignExpiresAt?: string | Date | null
  deliveryEstimate?: string | null
  landmark?: string | null
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
    <span className="inline-flex items-center gap-1 text-primary">
      <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
      <span className="font-mono text-[10px] uppercase tracking-[0.1em]">{label}</span>
    </span>
  )
}

/**
 * Product card.
 *
 * Reworked around the photograph. The image is a tall 4:5 frame with no card
 * border or fill boxing it in, and the metadata sits underneath on the page
 * ground — the difference between a retail grid and a table of records.
 *
 * Order stays as the design bible sets it: photo → title → seller → rating →
 * price → delivery → stock. The whole card is one click target; the only
 * chrome that appears on hover is the delivery/stock strip sliding over the
 * bottom of the image, and only on devices that actually have a pointer.
 */
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
  const campaignActive = isCampaignActive(product.campaignTag, product.campaignExpiresAt)
  const campaignLabel = campaignActive ? CAMPAIGNS[product.campaignTag as keyof typeof CAMPAIGNS]?.label : null
  const soldOut = stock === 0

  const flags = (
    <div className="ui-tile__flags">
      {campaignLabel && <Badge status="campaign" icon={Heart}>{campaignLabel}</Badge>}
      {product.isHot && <Badge status="warning" icon={Flame}>Hot</Badge>}
      {product.isNew && <Badge status="ink">New</Badge>}
      {product.isDeal && <Badge status="success">Deal</Badge>}
    </div>
  )

  const sellerLine = showSeller ? (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-secondary">
      <span className="truncate">{product.seller?.name || 'Seller'}</span>
      <TrustBadge trustLevel={product.seller?.trustLevel} />
      {product.landmark && (
        <span className="inline-flex items-center gap-1 text-ink-muted">
          <MapPin className="h-3 w-3" strokeWidth={1.75} /> {product.landmark}
        </span>
      )}
    </div>
  ) : null

  if (layout === 'list') {
    return (
      <article
        onClick={onOpen}
        className={`ui-tile ui-card ui-card-hover group flex cursor-pointer flex-col overflow-hidden sm:flex-row ${className}`}
      >
        <div className="ui-tile__media aspect-square w-full flex-shrink-0 sm:aspect-[4/5] sm:w-48">
          <LoadedImage
            src={image}
            alt={product.name}
            wrapperClassName="h-full w-full"
            priority={priority}
          />
          {flags}
          {soldOut && (
            <div className="absolute inset-0 grid place-items-center bg-card/70">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink">Sold out</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-3 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{product.name}</h3>
              {sellerLine}
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="ui-figure text-lg text-ink">{price}</p>
              {rating > 0 && (
                <div className="mt-1 inline-flex items-center gap-1 text-xs text-ink-secondary">
                  <Star className="h-3 w-3 fill-warning text-warning" strokeWidth={1.75} />
                  {rating.toFixed(1)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {product.deliveryEstimate && (
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-secondary">
                <Truck className="h-3 w-3" strokeWidth={1.75} /> {product.deliveryEstimate}
              </span>
            )}
            {!soldOut && stock <= 5 && <Badge status="low-stock">Only {stock} left</Badge>}
          </div>
        </div>
      </article>
    )
  }

  return (
    <article onClick={onOpen} className={`ui-tile group cursor-pointer ${className}`}>
      <div className="ui-tile__media aspect-[4/5] w-full">
        <LoadedImage
          src={image}
          alt={product.name}
          wrapperClassName="h-full w-full"
          priority={priority}
        />
        {flags}

        {soldOut ? (
          <div className="absolute inset-0 grid place-items-center bg-card/70">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink">Sold out</span>
          </div>
        ) : (
          <div className="ui-tile__peek">
            <div className="flex items-center justify-between gap-2 bg-slab/92 px-3 py-2 backdrop-blur-sm">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-slab-fg/85">
                {product.deliveryEstimate ? `Delivery ${product.deliveryEstimate}` : 'View item'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-slab-fg/60">
                {stock} left
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-[14px] font-medium leading-snug text-ink">{product.name}</h3>
          {rating > 0 && (
            <span className="inline-flex flex-shrink-0 items-center gap-1 pt-0.5 text-xs text-ink-secondary">
              <Star className="h-3 w-3 fill-warning text-warning" strokeWidth={1.75} />
              {rating.toFixed(1)}
            </span>
          )}
        </div>

        {sellerLine}

        <div className="mt-2.5 flex items-center gap-2">
          <p className="ui-figure text-[17px] text-ink">{price}</p>
          {!soldOut && stock <= 5 && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-warning">
              {stock} left
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
