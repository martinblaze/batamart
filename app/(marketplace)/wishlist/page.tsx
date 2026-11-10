'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, TrendingDown, PackageX } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { Badge } from '@/components/ui/Badge'
import { Shell, PageHeader, EmptyState, ProductGridSkeleton } from '@/components/ui/Shell'
import { useSavedIds } from '@/lib/wishlist/client'

interface WishlistItem {
  productId: string
  savedAt: string
  priceWhenSaved: number
  product: {
    id: string
    name: string
    price: number
    originalPrice?: number | null
    discountPercent?: number | null
    image: string | null
    category: string
    sellerName?: string | null
    inStock: boolean
    isActive: boolean
    quantity: number
  }
  priceDropped: boolean
  dropPercent: number | null
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

export default function WishlistPage() {
  const router = useRouter()
  const [items, setItems] = useState<WishlistItem[] | null>(null)
  const [error, setError] = useState('')
  const savedIds = useSavedIds()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent('/wishlist')}`)
      return
    }
    fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async r => {
        if (r.status === 401) {
          router.replace(`/login?redirect=${encodeURIComponent('/wishlist')}`)
          return
        }
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d?.error || 'Could not load your wishlist')
        setItems(d.items || [])
      })
      .catch(e => setError(e.message || 'Could not load your wishlist'))
  }, [router])

  // Hearts on this page remove the item: once an item has been seen as saved
  // and then is not, drop it from the grid.
  const seen = useRef(new Set<string>())
  useEffect(() => {
    savedIds.forEach(id => seen.current.add(id))
    setItems(prev => {
      if (!prev) return prev
      const next = prev.filter(i => savedIds.has(i.productId) || !seen.current.has(i.productId))
      return next.length === prev.length ? prev : next
    })
  }, [savedIds])
  const visible = items

  return (
    <div className="min-h-screen bg-surface py-8 dark:bg-[#000000]">
      <Shell>
        <PageHeader
          eyebrow={visible ? `${visible.length} saved` : 'Saved items'}
          title="Wishlist"
          description="Items you have saved. We tell you when the price drops or stock runs low."
        />

        <div className="mt-8">
          {error ? (
            <EmptyState icon={Heart} title="Could not load your wishlist" description={error} />
          ) : visible === null ? (
            <ProductGridSkeleton count={8} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Nothing saved yet"
              description="Tap the heart on any item to keep it here and get alerted when its price drops."
              action={
                <Link href="/marketplace" className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white">
                  Browse the marketplace
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {visible.map(i => (
                <div key={i.productId} className={i.product.isActive ? '' : 'opacity-70'}>
                  <ProductCard
                    onOpen={() => router.push(`/product/${i.productId}`)}
                    product={{
                      id: i.product.id,
                      name: i.product.name,
                      price: i.product.price,
                      images: i.product.image ? [i.product.image] : [],
                      category: i.product.category,
                      isDeal: !!i.product.discountPercent,
                      discountPercent: i.product.discountPercent,
                      quantity: i.product.inStock ? i.product.quantity : 0,
                      seller: i.product.sellerName ? { name: i.product.sellerName } : undefined,
                    }}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {i.priceDropped && i.dropPercent != null && (
                      <Badge status="success" icon={TrendingDown}>
                        Price dropped {i.dropPercent}%
                      </Badge>
                    )}
                    {!i.product.inStock && (
                      <Badge status="neutral" icon={PackageX}>
                        {i.product.isActive ? 'Out of stock' : 'No longer available'}
                      </Badge>
                    )}
                  </div>
                  {i.priceDropped && (
                    <p className="mt-1.5 text-xs text-ink-secondary">
                      Was {fmt(i.priceWhenSaved)} when you saved it
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Shell>
    </div>
  )
}
