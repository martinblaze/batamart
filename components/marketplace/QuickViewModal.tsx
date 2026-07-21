'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Minus, Plus, ShoppingCart, X } from 'lucide-react'
import { useCartStore } from '@/lib/cart-store'
import { decodeProductData } from '@/lib/variants'

type StructuredVariant = {
  id: string
  combination: Record<string, string>
  price: number
  stock: number
  imageUrl?: string | null
}

type QuickViewProduct = {
  id: string
  name: string
  description: string
  price: number
  basePrice?: number | null
  images: string[]
  quantity: number
  category?: string
  subcategory?: string | null
  deliveryEstimate?: string | null
  variantsEnabled?: boolean
  variants?: StructuredVariant[]
  seller: { id: string; name: string }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

export default function QuickViewModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const addItem = useCartStore((state) => state.addItem)
  const [product, setProduct] = useState<QuickViewProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [variants, setVariants] = useState<Record<string, string[]>>({})
  const [structuredVariants, setStructuredVariants] = useState<StructuredVariant[]>([])
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/products/${productId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!res.ok) { setError('Product not found'); return }
        const data = await res.json()
        const p = data.product || data
        setProduct(p)

        if (p.variantsEnabled && Array.isArray(p.variants) && p.variants.length > 0) {
          setStructuredVariants(p.variants)
          const map: Record<string, Set<string>> = {}
          for (const v of p.variants) {
            for (const [k, val] of Object.entries((v.combination || {}) as Record<string, string>)) {
              if (!val) continue
              if (!map[k]) map[k] = new Set()
              map[k].add(String(val))
            }
          }
          setVariants(Object.fromEntries(Object.entries(map).map(([k, vals]) => [k, Array.from(vals)])))
        } else {
          setStructuredVariants([])
          setVariants(decodeProductData(p.description || '').variants)
        }
      } catch {
        setError('Failed to load product')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [productId])

  const variantKeys = Object.keys(variants)
  const requiredVariants = variantKeys.filter((k) => variants[k].length > 0)
  const allSelected = requiredVariants.length === 0 || requiredVariants.every((k) => selected[k])
  const matchedVariant = structuredVariants.find((v) => requiredVariants.every((k) => (v.combination || {})[k] === selected[k]))
  const effectivePrice = matchedVariant?.price ?? product?.price ?? 0
  const effectiveStock = matchedVariant?.stock ?? product?.quantity ?? 0
  const isStructured = structuredVariants.length > 0

  // Auto-select single-value variant fields
  useEffect(() => {
    if (variantKeys.length === 0) return
    setSelected((prev) => {
      let changed = false
      const next = { ...prev }
      for (const key of variantKeys) {
        const vals = variants[key] || []
        if (vals.length === 1 && next[key] !== vals[0]) {
          next[key] = vals[0]
          changed = true
        }
      }
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantKeys.join('|'), JSON.stringify(variants)])

  const isOptionAvailable = (key: string, value: string) => {
    if (!isStructured) return true
    return structuredVariants.some((v) => {
      const combo = (v.combination || {}) as Record<string, string>
      if ((combo[key] || '') !== value) return false
      if ((v.stock || 0) <= 0) return false
      for (const [k, val] of Object.entries(selected)) {
        if (!val || k === key) continue
        if ((combo[k] || '') !== val) return false
      }
      return true
    })
  }

  const handleAddToCart = () => {
    if (!product) return
    if (!allSelected) { setError('Please select all options before adding to cart'); return }
    if (isStructured && requiredVariants.length > 0 && !matchedVariant) { setError('Selected combination is unavailable'); return }
    setError('')
    setAdding(true)
    try {
      addItem({
        productId: product.id,
        variantId: matchedVariant?.id,
        name: product.name,
        price: effectivePrice,
        image: product.images?.[0] || '',
        sellerId: product.seller.id,
        sellerName: product.seller.name,
        maxQuantity: effectiveStock || 1,
        quantity: qty,
        selectedVariants: selected,
        category: product.category,
        subcategory: product.subcategory || undefined,
        deliveryEstimate: product.deliveryEstimate || undefined,
      })
      setMessage('Added to cart')
      setTimeout(() => { setMessage(''); onClose() }, 900)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-soft">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/95 text-ink-secondary hover:bg-surface shadow-soft">
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : error && !product ? (
          <div className="p-8 text-center text-sm font-medium text-ink-secondary">{error}</div>
        ) : product ? (
          <div className="p-5 sm:p-6 space-y-4">
            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-surface">
              <img src={product.images?.[0] || '/placeholder.png'} alt={product.name} className="w-full h-full object-cover" />
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink leading-snug line-clamp-2">{product.name}</h2>
              <p className="text-xl font-semibold text-primary mt-1">{fmt(effectivePrice)}</p>
              {effectiveStock > 0 && effectiveStock <= 5 && (
                <p className="text-xs font-semibold text-warning mt-0.5">Only {effectiveStock} left</p>
              )}
            </div>

            {variantKeys.map((key) => {
              const vals = variants[key]
              if (!vals || vals.length <= 1) return null
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
              return (
                <div key={key} className="rounded-xl border border-border p-3 bg-surface/40">
                  <p className="text-xs font-semibold text-ink-secondary mb-2">
                    {label}{selected[key] ? <span className="text-primary">: {selected[key]}</span> : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {vals.map((v) => {
                      const available = isOptionAvailable(key, v)
                      const chosen = selected[key] === v
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={!available}
                          onClick={() => { setSelected((prev) => ({ ...prev, [key]: v })); setError('') }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                            chosen
                              ? 'bg-primary text-white border-primary'
                              : available
                              ? 'border-border bg-white text-ink hover:border-primary/50'
                              : 'border-border bg-surface text-ink-muted cursor-not-allowed opacity-60'
                          }`}
                        >
                          {v}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {error && <p className="text-xs font-semibold text-danger">{error}</p>}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 border border-border rounded-lg px-1">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center text-ink-secondary hover:text-primary">
                  <Minus className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
                <span className="w-6 text-center text-sm font-semibold text-ink">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(effectiveStock || 1, q + 1))} className="w-8 h-8 flex items-center justify-center text-ink-secondary hover:text-primary">
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={adding || effectiveStock === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
              >
                <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
                {message ? message : adding ? 'Adding…' : effectiveStock === 0 ? 'Out of stock' : 'Add to cart'}
              </button>
            </div>

            <Link href={`/product/${product.id}`} className="block text-center text-xs font-semibold text-primary hover:underline">
              View full details
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
