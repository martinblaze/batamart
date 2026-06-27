'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCartStore } from '@/lib/cart-store'
import { BadgeCheck, Flame, ShoppingCart, Star } from 'lucide-react'

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
  variantId?: string
  selectedVariants?: Record<string, string>
}

function fmt(price: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price)
}

function TrustBadge({ trustLevel }: { trustLevel?: string }) {
  if (!trustLevel) return null
  const label = trustLevel === 'VERIFIED' ? 'Verified' : trustLevel === 'GOLD' ? 'Top Seller' : trustLevel
  const tone =
    trustLevel === 'VERIFIED'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : trustLevel === 'GOLD'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${tone}`}>
      <BadgeCheck className="h-3 w-3" />
      {label}
    </span>
  )
}

export default function ProductCard({
  product,
  layout = 'grid',
  onOpen,
  showSeller = true,
  className = '',
}: {
  product: ProductCardProduct
  layout?: 'grid' | 'list'
  onOpen?: () => void
  showSeller?: boolean
  className?: string
}) {
  const addItem = useCartStore((state) => state.addItem)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  const image = product.images?.[0] || '/placeholder.png'
  const rating = product.avgRating ?? product.seller?.avgRating ?? 0
  const price = product.priceDisplay || fmt(product.price)
  const stock = product.quantity ?? 0

  const handleQuickAdd = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to add')

      addItem({
        productId: product.id,
        variantId: product.variantId,
        name: product.name,
        price: product.price,
        quantity: 1,
        maxQuantity: stock || 1,
        image,
        sellerId: product.seller?.id || '',
        sellerName: product.seller?.name || 'Seller',
        selectedVariants: product.selectedVariants,
        category: product.category,
        subcategory: product.subcategory || undefined,
        deliveryEstimate: product.deliveryEstimate || undefined,
      })
      setToast('Added!')
      setTimeout(() => setToast(''), 1500)
    } catch {
      setToast('Failed')
      setTimeout(() => setToast(''), 1500)
    } finally {
      setLoading(false)
    }
  }

  if (layout === 'list') {
    return (
      <article className={`group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-[#272b33] dark:bg-[#0f1115] ${className}`}>
        <div className="flex flex-col sm:flex-row">
          <button type="button" onClick={onOpen} className="relative aspect-square w-full sm:w-52 flex-shrink-0 bg-gray-50 text-left">
            <img src={image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              {product.isHot && <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-black text-white shadow-lg"><Flame className="h-3 w-3" />Hot</span>}
              {product.isNew && <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">NEW</span>}
              {product.isDeal && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">DEAL</span>}
            </div>
          </button>
          <div className="flex-1 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button type="button" onClick={onOpen} className="text-left">
                  <h3 className="line-clamp-2 text-base font-black leading-snug text-gray-900 dark:text-[#e5e7eb]">{product.name}</h3>
                </button>
                {showSeller && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-[#94a3b8]">
                    <span className="font-semibold text-gray-700 dark:text-[#cbd5e1]">{product.seller?.name || 'Seller'}</span>
                    <TrustBadge trustLevel={product.seller?.trustLevel} />
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-indigo-600">{price}</p>
                {rating > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-[#94a3b8]">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {rating.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-[#94a3b8]">
              {product.deliveryEstimate && <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700">{product.deliveryEstimate}</span>}
              <span className="rounded-full bg-gray-50 px-2.5 py-1 font-bold">{stock > 0 ? `${stock} in stock` : 'Out of stock'}</span>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={handleQuickAdd} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:scale-[1.01] active:scale-95">
                <ShoppingCart className="h-4 w-4" />
                {loading ? 'Adding...' : 'Add to cart'}
              </button>
              <button type="button" onClick={onOpen} className="rounded-2xl bg-gray-100 px-4 py-2.5 text-sm font-black text-gray-700 transition hover:bg-gray-200 dark:bg-[#272b33] dark:text-[#e5e7eb] dark:hover:bg-[#323744]">
                View
              </button>
            </div>
            {toast && <p className="mt-2 text-xs font-bold text-emerald-600">{toast}</p>}
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={`group overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-[#272b33] dark:bg-[#0f1115] ${className}`}>
      <button type="button" onClick={onOpen} className="relative aspect-square w-full bg-gray-50 text-left">
        <img src={image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.isHot && <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-black text-white shadow-lg"><Flame className="h-3 w-3" />Hot</span>}
          {product.isNew && <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">NEW</span>}
          {product.isDeal && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">DEAL</span>}
        </div>
        <div className="absolute bottom-3 left-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black text-gray-800 shadow backdrop-blur dark:bg-black/70 dark:text-[#e5e7eb]">
          {product.deliveryEstimate || (stock > 0 ? `${stock} left` : 'Out of stock')}
        </div>
        <div className="absolute bottom-3 right-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black text-gray-800 shadow backdrop-blur dark:bg-black/70 dark:text-[#e5e7eb]">
          {toast || ''}
        </div>
      </button>

      <div className="p-4">
        <button type="button" onClick={onOpen} className="text-left">
          <h3 className="line-clamp-2 text-sm font-black leading-snug text-gray-900 dark:text-[#e5e7eb]">{product.name}</h3>
        </button>
        {showSeller && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-[#94a3b8]">
            <span className="font-semibold text-gray-700 dark:text-[#cbd5e1]">{product.seller?.name || 'Seller'}</span>
            <TrustBadge trustLevel={product.seller?.trustLevel} />
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-lg font-black text-indigo-600">{price}</p>
          {rating > 0 && (
            <div className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 dark:text-[#94a3b8]">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)}
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-[#94a3b8]">
          {product.deliveryEstimate && <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-bold text-indigo-700">{product.deliveryEstimate}</span>}
          <span className="rounded-full bg-gray-50 px-2.5 py-1 font-bold">{stock > 0 ? `${stock} in stock` : 'Out of stock'}</span>
        </div>
        <button type="button" onClick={handleQuickAdd} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:scale-[1.01] active:scale-95">
          <ShoppingCart className="h-4 w-4" />
          {loading ? 'Adding...' : 'Add to cart'}
        </button>
      </div>
    </article>
  )
}
