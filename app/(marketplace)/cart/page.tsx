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
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }

  .cart-item { transition: background 0.15s ease; }
  .cart-item:hover { background: #fafafa; }

  .qty-btn {
    transition: background 0.12s ease, transform 0.12s cubic-bezier(0.34,1.4,0.64,1);
  }
  .qty-btn:hover:not(:disabled) { background: white; transform: scale(1.1); }

  .checkout-btn {
    background: linear-gradient(135deg, #6366f1, #4c1d95);
    transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.2s ease;
    box-shadow: 0 8px 24px rgba(99,102,241,0.35);
  }
  .checkout-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 40px rgba(99,102,241,0.45);
  }

  .header-gradient {
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
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
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <div className="animate-pulse space-y-3 w-full max-w-lg px-4">
        <div className="h-8 bg-gray-200 rounded-xl" />
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="h-32 bg-gray-200 rounded-2xl" />
      </div>
    </div>
  )

  if (items.length === 0) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center px-4">
      <div className="fade-up text-center bg-white rounded-3xl p-12 sm:p-16 shadow-sm border border-gray-100 max-w-md w-full">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
          <ShoppingCart className="w-11 h-11 text-white" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Your cart is empty</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">Browse products and add items you love!</p>
        <button
          onClick={() => router.push('/marketplace')}
          className="checkout-btn inline-flex items-center gap-2.5 text-white px-8 py-4 rounded-2xl font-black text-base"
        >
          <Sparkles className="w-5 h-5" /> Start Shopping
        </button>
      </div>
    </div>
  )

  const uniqueSellers = new Set(items.map(i => i.sellerId)).size
  const deliveryFee   = 800 * Math.max(1, uniqueSellers)
  const subtotal      = getTotalPrice()
  const total         = subtotal + deliveryFee

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-24">
      {/* Header */}
      <header className="header-gradient sticky top-0 z-40 shadow-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.push('/marketplace')}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-white">
              My Cart <span className="text-white/50 font-semibold text-sm">({items.length} item{items.length !== 1 ? 's' : ''})</span>
            </h1>
            <p className="text-white/50 text-xs">{uniqueSellers} seller{uniqueSellers !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={clearCart}
            className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold px-3 py-2 rounded-xl transition-colors border border-red-400/20">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="fade-up bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {items.map((item) => {
                  const variantEntries = Object.entries(item.selectedVariants || {}).filter(([, v]) => v)
                  return (
                    <div key={item.id} className="cart-item p-4 sm:p-5">
                      <div className="flex gap-3 sm:gap-4">
                        <Link href={`/product/${item.productId}`} className="flex-shrink-0">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-gray-100 hover:border-indigo-300 transition-colors shadow-sm">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        </Link>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link href={`/product/${item.productId}`}
                                className="font-black text-gray-900 hover:text-indigo-600 transition-colors text-sm sm:text-base line-clamp-2">
                                {item.name}
                              </Link>
                              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                                <BadgeCheck className="w-3 h-3 text-blue-500" />
                                <Link href={`/seller/${item.sellerId}`} className="text-indigo-600 font-bold hover:underline">{item.sellerName}</Link>
                              </p>
                              {item.deliveryEstimate && (
                                <p className="text-[11px] text-orange-600 font-semibold mt-1">Delivery: {item.deliveryEstimate}</p>
                              )}

                              {/* ── Variant Chips ── */}
                              {variantEntries.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {variantEntries.map(([key, val]) => (
                                    <span key={key} className="inline-flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2.5 py-0.5 rounded-full">
                                      <Tag className="w-2.5 h-2.5" />
                                      {String(val)}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Change Variants link */}
                              <Link href={`/product/${item.productId}`}
                                className="text-[10px] text-gray-400 hover:text-indigo-500 font-semibold mt-1 inline-block transition-colors">
                                {variantEntries.length > 0 ? '✏️ Change options' : '+ Select options'}
                              </Link>
                            </div>
                            <button onClick={() => removeItem(item.productId)}
                              className="w-7 h-7 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-400 transition-colors flex-shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-3">
                            <p className="font-black text-indigo-600 text-base">{fmt(item.price * item.quantity)}</p>
                            <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                className="qty-btn w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 font-black hover:text-red-500 transition-all"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-black text-gray-900 w-6 text-center text-sm">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                disabled={item.quantity >= item.maxQuantity}
                                className="qty-btn w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 font-black hover:text-emerald-500 transition-all disabled:opacity-40"
                              >
                                <Plus className="w-3 h-3" />
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
            <div className="fade-up bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-black text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-bold">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery fee</span>
                  <span className="font-bold">{fmt(deliveryFee)}</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between">
                  <span className="font-black text-gray-900">Total</span>
                  <span className="font-black text-indigo-600 text-lg">{fmt(total)}</span>
                </div>
              </div>

              <button onClick={handleCheckout}
                className="checkout-btn w-full mt-5 py-4 rounded-2xl text-white font-black flex items-center justify-center gap-2.5">
                <Lock className="w-4 h-4" /> Secure Checkout
              </button>

              <div className="flex items-center justify-center gap-4 mt-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Escrow Protected</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Truck className="w-3.5 h-3.5 text-blue-500" />
                  <span>Fast Delivery</span>
                </div>
              </div>
            </div>

            <Link href="/marketplace"
              className="fade-up flex items-center justify-center gap-2 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-bold text-gray-600 hover:text-indigo-600 hover:border-indigo-200 transition-all">
              <Sparkles className="w-4 h-4" /> Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
