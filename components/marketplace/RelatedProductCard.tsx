import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowDownRight, ShoppingCart, Sparkles, Star, Truck } from 'lucide-react'

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

export default function RelatedProductCard({
  product,
  onOpen,
  onAddToCart,
  compact = false,
}: {
  product: RelatedProductCardProduct
  onOpen?: () => void
  onAddToCart?: () => void
  compact?: boolean
}) {
  const originalPrice = useMemo(() => {
    if (!product.discountPercent || product.discountPercent <= 0) return null
    const estimate = product.price / (1 - product.discountPercent / 100)
    return Number.isFinite(estimate) ? estimate : null
  }, [product.discountPercent, product.price])

  const card = (
    <div className={`group relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#272b33] dark:bg-[#0f1115] ${compact ? 'w-40 sm:w-full' : 'w-full'}`}>
      <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-[#0b0d12]">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Sparkles className="h-8 w-8 text-gray-300" />
          </div>
        )}
        {product.isHot && (
          <span className="absolute left-2 top-2 rounded-full bg-orange-500 px-2 py-1 text-[10px] font-black text-white shadow-lg shadow-orange-500/20">
            Hot
          </span>
        )}
        {(product.isDeal || (product.discountPercent ?? 0) > 0) && (
          <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black text-white shadow-lg shadow-rose-500/20">
            {product.discountPercent ? `${product.discountPercent}% OFF` : 'Deal'}
          </span>
        )}
        {onAddToCart && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onAddToCart()
            }}
            className="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-gray-900 shadow-lg ring-1 ring-black/5 transition hover:bg-indigo-50 hover:text-indigo-700"
            aria-label="Add to cart"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2 p-3">
        {product.matchReason && (
          <div className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-600 dark:bg-white/5 dark:text-[#cbd5e1]">
            {product.matchReason}
          </div>
        )}
        <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-gray-900 dark:text-[#e5e7eb]">
          {product.name}
        </p>
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span className="text-[11px] font-semibold text-gray-600 dark:text-[#94a3b8]">
            {(product.avgRating || 0).toFixed(1)}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-[#64748b]">·</span>
          <span className="text-[11px] text-gray-500 dark:text-[#94a3b8]">
            {product.totalReviews || 0} reviews
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
            {product.priceDisplay || formatPrice(product.price)}
          </span>
          {originalPrice && (
            <span className="text-[11px] text-gray-400 line-through">
              {formatPrice(originalPrice)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-[#94a3b8]">
          <Truck className="h-3.5 w-3.5 text-emerald-500" />
          <span>{product.deliveryEstimate || 'Delivery info available'}</span>
        </div>
        {product.seller?.name && (
          <p className="truncate text-[11px] text-gray-400 dark:text-[#64748b]">
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