'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/lib/cart-store'
import {
  ShoppingCart, Trash2, Plus, Minus, ChevronLeft,
  Package, Lock, Truck, Shield, ArrowRight, X,
  Sparkles, MapPin, BadgeCheck, Zap, Tag,
} from 'lucide-react'
// variants import not needed in cart - variant data comes from cart store's selectedVariants field

const CART_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.2s ease-out forwards; }

  .cart-item { transition: background 0.15s ease-out; }
  .cart-item:hover { background: var(--color-surface); }

  .qty-btn {
    transition: background 0.15s ease-out;
  }
  .qty-btn:hover:not(:disabled) { background: var(--color-surface); }

  .checkout-btn {
    background: var(--color-primary);
    transition: filter 0.15s ease-out;
  }
  .checkout-btn:hover {
    filter: brightness(0.95);
  }
`

export default function CartPage() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const { items, updateQuantity, removeItem, clearCart, getTotalPrice, updateVariants } = useCartStore()

  useEffect(() => {
    if (document.getElementById('cart-anim')) return
    const s = document.createElement('style'); s.id = 'cart-anim'; s.textContent = CART_CSS
    document.head.appendChild(s)
  }, [])

  useEffect(() => { setIsClient(true) }, [])

  const fmt = (price: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price)

  const handleCheckout = () => {
    if (items.length === 0) return
    sessionStorage.setItem('checkout_cart', JSON.stringify(items))
    router.push('/checkout')
  }

  if (!isClient) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="animate-pulse space-y-3 w-full max-w-lg px-4">
        <div className="h-8 bg-border rounded-lg" />
        <div className="h-32 bg-border rounded-xl" />
        <div className="h-32 bg-border rounded-xl" />
      </div>
    </div>
  )

  if (items.length === 0) return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="fade-up text-center bg-white rounded-2xl p-12 sm:p-16 border border-border max-w-md w-full">
        <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6 bg-primary/10">
          <ShoppingCart className="w-8 h-8 text-primary" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-semibold text-ink mb-2">Your cart is empty</h1>
        <p className="text-ink-muted text-sm mb-8 leading-relaxed">Browse products and add items you love</p>
        <button
          onClick={() => router.push('/marketplace')}
          className="checkout-btn inline-flex items-center gap-2.5 text-white px-8 h-11 rounded-lg font-medium text-[15px]"
        >
          Start shopping
        </button>
      </div>
    </div>
  )

  const uniqueSellers = new Set(items.map(i => i.sellerId)).size
  const deliveryFee   = 800 * Math.max(1, uniqueSellers)
  const subtotal      = getTotalPrice()
  const total         = subtotal + deliveryFee

  return (
    <div className="min-h-screen bg-surface pb-24">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.push('/marketplace')}
            className="w-9 h-9 rounded-lg text-ink-secondary hover:bg-surface flex items-center justify-center transition-colors flex-shrink-0">
            <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-ink">
              My cart <span className="text-ink-muted font-medium text-sm">({items.length} item{items.length !== 1 ? 's' : ''})</span>
            </h1>
            <p className="text-ink-muted text-xs">{uniqueSellers} seller{uniqueSellers !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={clearCart}
            className="flex items-center gap-1.5 bg-danger/10 hover:bg-danger/20 text-danger text-xs font-medium px-3 py-2 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Clear
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="fade-up bg-white rounded-xl border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {items.map((item) => {
                  const variantEntries = Object.entries(item.selectedVariants || {}).filter(([, v]) => v)
                  return (
                    <div key={item.id} className="cart-item p-4 sm:p-5">
                      <div className="flex gap-3 sm:gap-4">
                        <Link href={`/product/${item.productId}`} className="flex-shrink-0">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-colors">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link href={`/product/${item.productId}`}
                                className="font-medium text-ink hover:text-primary transition-colors text-sm sm:text-base line-clamp-2">
                                {item.name}
                              </Link>
                              <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
                                <BadgeCheck className="w-3 h-3 text-primary" strokeWidth={1.75} />
                                <Link href={`/seller/${item.sellerId}`} className="text-primary font-medium hover:underline">{item.sellerName}</Link>
                              </p>
                              {item.deliveryEstimate && (
                                <p className="text-[11px] text-ink-secondary font-medium mt-1">Delivery: {item.deliveryEstimate}</p>
                              )}

                              {/* ── Variant Chips ── */}
                              {variantEntries.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {variantEntries.map(([key, val]) => (
                                    <span key={key} className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary font-medium px-2.5 py-0.5 rounded-full">
                                      <Tag className="w-2.5 h-2.5" strokeWidth={1.75} />
                                      {String(val)}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Change Variants link */}
                              <Link href={`/product/${item.productId}`}
                                className="text-[10px] text-ink-muted hover:text-primary font-medium mt-1 inline-block transition-colors">
                                {variantEntries.length > 0 ? 'Change options' : '+ Select options'}
                              </Link>
                            </div>
                            <button onClick={() => removeItem(item.productId)}
                              aria-label="Remove item"
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-colors flex-shrink-0">
                              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <p className="font-semibold text-ink text-base">{fmt(item.price * item.quantity)}</p>
                            <div className="flex items-center gap-2 bg-surface rounded-lg p-1">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                aria-label="Decrease quantity"
                                className="qty-btn w-7 h-7 rounded-md bg-white flex items-center justify-center text-ink-secondary font-medium transition-all"
                              >
                                <Minus className="w-3 h-3" strokeWidth={1.75} />
                              </button>
                              <span className="font-medium text-ink w-6 text-center text-sm">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                disabled={item.quantity >= item.maxQuantity}
                                aria-label="Increase quantity"
                                className="qty-btn w-7 h-7 rounded-md bg-white flex items-center justify-center text-ink-secondary font-medium transition-all disabled:opacity-40"
                              >
                                <Plus className="w-3 h-3" strokeWidth={1.75} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="fade-up bg-white rounded-xl border border-border p-5">
              <h2 className="font-semibold text-ink mb-4">Order summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Subtotal</span>
                  <span className="font-medium text-ink">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Delivery fee</span>
                  <span className="font-medium text-ink">{fmt(deliveryFee)}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="font-semibold text-ink">Total</span>
                  <span className="font-semibold text-ink text-lg">{fmt(total)}</span>
                </div>
              </div>

              <button onClick={handleCheckout}
                className="checkout-btn w-full mt-5 h-11 rounded-lg text-white font-medium flex items-center justify-center gap-2.5">
                <Lock className="w-4 h-4" strokeWidth={1.75} /> Secure checkout
              </button>

              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Shield className="w-3.5 h-3.5 text-success" strokeWidth={1.75} />
                  <span>Escrow protected</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Truck className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                  <span>Fast delivery</span>
                </div>
              </div>
            </div>

            <Link href="/marketplace"
              className="fade-up flex items-center justify-center gap-2 h-11 bg-white rounded-lg border border-border text-sm font-medium text-ink-secondary hover:text-primary hover:border-primary/20 transition-all">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
