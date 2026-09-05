'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/lib/cart-store'
import { Magnetic } from '@/components/ui/button'
import { EmptyFigure, PageHeader } from '@/components/marketplace/DetailChrome'
import { Reveal } from '@/components/motion/AppMotion'
import { Plus, Minus, Lock, Truck, Shield, X, BadgeCheck, Tag } from 'lucide-react'
// variants import not needed in cart - variant data comes from cart store's selectedVariants field

const CART_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.2s ease-out forwards; }

  .cart-item { transition: background 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  .cart-item:hover { background: var(--color-surface); }

  .qty-btn {
    transition: background 0.15s ease-out;
  }
  .qty-btn:hover:not(:disabled) { background: var(--color-surface); }

  .checkout-btn {
    background: var(--ui-slab);
    transition: background 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .checkout-btn:hover { background: var(--color-primary); }
`

export default function CartPage() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [serverDeliveryFee, setServerDeliveryFee] = useState<number | null>(null)
  const { items, updateQuantity, removeItem, clearCart, getTotalPrice, updateVariants } = useCartStore()

  useEffect(() => {
    if (document.getElementById('cart-anim')) return
    const s = document.createElement('style'); s.id = 'cart-anim'; s.textContent = CART_CSS
    document.head.appendChild(s)
  }, [])

  useEffect(() => { setIsClient(true) }, [])

  // Zone-based delivery fee estimate (real per-seller pricing, not a flat
  // guess). Plain fetch (not authFetch) — the cart is browsable while
  // logged out, and a 401 here shouldn't force-redirect a guest to /login.
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (items.length === 0 || !token) { setServerDeliveryFee(null); return }
    fetch('/api/delivery/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cartItems: items.map(i => ({ productId: i.productId })) }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data.deliveryFee === 'number') setServerDeliveryFee(data.deliveryFee)
      })
      .catch(err => console.error('Delivery quote error:', err))
  }, [items])

  const fmt = (price: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price)

  const handleCheckout = () => {
    if (items.length === 0) return
    sessionStorage.setItem('checkout_cart', JSON.stringify(items))
    router.push('/checkout')
  }

  if (!isClient) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="w-full max-w-lg space-y-3 px-4">
        <div className="ui-skeleton h-8 rounded-lg" />
        <div className="ui-skeleton h-32 rounded-lg" />
        <div className="ui-skeleton h-32 rounded-lg" />
      </div>
    </div>
  )

  if (items.length === 0) return (
    <div className="min-h-screen bg-surface">
      <PageHeader title="My cart" back="/marketplace" />
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <EmptyFigure
          image="/images/marketing/empty-cart.webp"
          eyebrow="Nothing here yet"
          title="Your cart is"
          accent="empty."
          body="Browse what students around you are selling, and anything you add will wait for you here."
          href="/marketplace"
          cta="Start shopping"
        />
      </div>
    </div>
  )

  const uniqueSellers = new Set(items.map(i => i.sellerId)).size
  // Real per-seller zone pricing once /api/delivery/quote resolves; a rough
  // flat guess until then (checkout re-quotes and payment always charges
  // the authoritative zone-based fee regardless of what's shown here).
  const deliveryFee   = serverDeliveryFee ?? (2000 * Math.max(1, uniqueSellers))
  const subtotal      = getTotalPrice()
  const total         = subtotal + deliveryFee

  return (
    <div className="min-h-screen bg-surface pb-24">
      <PageHeader
        title="My cart"
        back="/marketplace"
        eyebrow={`${items.length} item${items.length !== 1 ? 's' : ''} · ${uniqueSellers} seller${uniqueSellers !== 1 ? 's' : ''}`}
        actions={
          <button
            onClick={clearCart}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted transition-colors duration-300 hover:text-danger"
          >
            Clear all
          </button>
        }
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            <Reveal className="border border-border bg-card">
              <div className="divide-y divide-border">
                {items.map((item) => {
                  const variantEntries = Object.entries(item.selectedVariants || {}).filter(([, v]) => v)
                  return (
                    <div key={item.id} className="cart-item p-4 sm:p-5">
                      <div className="flex gap-3 sm:gap-4">
                        <Link href={`/product/${item.productId}`} className="flex-shrink-0">
                          <div className="h-24 w-20 overflow-hidden bg-surface transition-opacity duration-300 hover:opacity-90 sm:h-28 sm:w-24">
                            <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
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
                                    <span key={key} className="inline-flex items-center gap-1 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-secondary">
                                      <Tag className="h-2.5 w-2.5" strokeWidth={1.75} />
                                      {String(val)}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Note to seller */}
                              {item.note && (
                                <p className="text-[11px] text-ink-secondary bg-surface rounded-lg px-2.5 py-1.5 mt-1.5 italic">
                                  &ldquo;{item.note}&rdquo;
                                </p>
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
                            <p className="ui-figure text-lg text-ink">{fmt(item.price * item.quantity)}</p>
                            <div className="flex items-center border border-border">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                aria-label="Decrease quantity"
                                className="qty-btn flex h-9 w-9 items-center justify-center bg-card text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
                              >
                                <Minus className="h-3 w-3" strokeWidth={2} />
                              </button>
                              <span className="ui-figure w-9 text-center text-sm text-ink">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                disabled={item.quantity >= item.maxQuantity}
                                aria-label="Increase quantity"
                                className="qty-btn flex h-9 w-9 items-center justify-center bg-card text-ink-secondary transition-colors hover:bg-surface hover:text-ink disabled:opacity-30"
                              >
                                <Plus className="h-3 w-3" strokeWidth={2} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Reveal>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <Reveal className="border border-border bg-card p-5 lg:sticky lg:top-28">
              <p className="ui-eyebrow mb-5">Order summary</p>
              <div className="divide-y divide-border">
                <div className="flex items-baseline justify-between py-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary">Subtotal</span>
                  <span className="text-sm font-medium text-ink">{fmt(subtotal)}</span>
                </div>
                <div className="flex items-baseline justify-between py-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary">Delivery fee</span>
                  <span className="text-sm font-medium text-ink">{fmt(deliveryFee)}</span>
                </div>
                <div className="flex items-baseline justify-between pt-3.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink">Total</span>
                  <span className="ui-figure text-2xl text-ink">{fmt(total)}</span>
                </div>
              </div>

              {/* The one action this whole screen exists for — so it gets the
                  magnetic gesture rather than the plain hover wipe. */}
              <Magnetic block className="mt-6">
                <button
                  onClick={handleCheckout}
                  className="checkout-btn ui-btn-sweep flex h-12 w-full items-center justify-center gap-2.5 rounded-lg font-mono text-[11px] uppercase tracking-[0.16em] text-white"
                >
                  <Lock className="h-3.5 w-3.5" strokeWidth={2} /> Secure checkout
                </button>
              </Magnetic>

              <div className="mt-5 flex items-center justify-center gap-5 border-t border-border pt-4">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  <Shield className="h-3.5 w-3.5 text-success" strokeWidth={1.75} />
                  Escrow protected
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                  <Truck className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                  Fast delivery
                </span>
              </div>
            </Reveal>

            <Link href="/marketplace"
              className="flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors duration-300 hover:border-ink/25 hover:text-ink">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
