// app/(marketplace)/checkout/page.tsx
// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ UPGRADED: Selected variants are auto-filled into "Note to Seller"
//    The variant summary is prepended automatically; user can still add extra notes.
//
// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ FIX #4: Delivery fee is not hardcoded on the client.
// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ FIX #5: Product prices are re-validated server-side.
// ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ FIX #6: Uses authFetch so a 401 auto-redirects to /login.
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/lib/cart-store'
import { authFetch } from '@/lib/auth-client'
import { formatVariantSelection } from '@/lib/variants'
import {
  ChevronLeft, Lock, Shield, Truck, CheckCircle,
  MapPin, Phone, User, Home, Loader2, AlertCircle,
  MessageSquare, Info, ArrowRight, Package, Tag,
} from 'lucide-react'

export default function CheckoutPage() {
  const router = useRouter()
  const { clearCart } = useCartStore()
  const [cartItems, setCartItems] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Delivery fee and totals come from the server, not hardcoded
  const [serverDeliveryFee, setServerDeliveryFee] = useState<number | null>(null)

  // Per-item EXTRA notes (variant summary is auto-prepended separately)
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({})
  const [deliverySuitabilityConfirmed, setDeliverySuitabilityConfirmed] = useState(false)
  const [paymentsEnabled, setPaymentsEnabled] = useState(true)
  const [paymentsStatusLoaded, setPaymentsStatusLoaded] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }

    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Show error messages from payment callback ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    const searchParams = new URLSearchParams(window.location.search)
    const urlError = searchParams.get('error')
    const productName = searchParams.get('product')

    if (urlError === 'payment_failed') {
      setError('SAFE_TO_RETRY|Payment was not successful. Please try again.')
    } else if (urlError === 'out_of_stock' && productName) {
      setError(`NOT_CHARGED|Sorry, "${decodeURIComponent(productName)}" went out of stock just before your payment was confirmed. You have NOT been charged ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â please try a different item.`)
    } else if (urlError === 'verification_failed' || urlError === 'order_creation_failed') {
      setError('CHECK_ORDERS|Your payment may have gone through but something went wrong on our end. DO NOT pay again ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â check your Orders page first to see if the order was created. If it was not there within 5 minutes, contact support.')
    } else if (urlError === 'invalid_metadata' || urlError === 'user_not_found') {
      setError('CHECK_ORDERS|There was a problem processing your payment. Check your Orders page first before trying again. If no order appears within 5 minutes, contact support.')
    } else if (urlError === 'product_not_found' || urlError === 'product_inactive') {
      const name = productName ? `"${decodeURIComponent(productName)}"` : 'one of the products'
      setError(`NOT_CHARGED|${name} is no longer available. You have NOT been charged.`)
    } else if (urlError === 'no_reference') {
      setError('SAFE_TO_RETRY|Payment session expired. Please try again.')
    }

    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Load cart items ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    const cartData = sessionStorage.getItem('checkout_cart')
    if (cartData) {
      setCartItems(JSON.parse(cartData))
    } else {
      const productData = sessionStorage.getItem('checkout_product')
      if (productData) {
        const product = JSON.parse(productData)
        setCartItems([{
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          image: product.images[0],
          sellerId: product.sellerId,
          sellerName: product.seller.name,
          deliveryEstimate: product.deliveryEstimate,
          selectedVariants: product.selectedVariants || {},
        }])
      } else {
        router.push('/marketplace')
        return
      }
    }

    fetchUserProfile()
    fetchPaymentSettings()
  }, [])

  const fetchUserProfile = async () => {
    try {
      const response = await authFetch('/api/auth/me')
      const data = await response.json()
      if (response.ok) setUser(data.user)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchPaymentSettings = async () => {
    try {
      const response = await fetch('/api/payment-availability')
      const data = await response.json()
      if (response.ok) {
        setPaymentsEnabled(data.enabled !== false)
      }
    } catch (error) {
      console.error('Error fetching payment settings:', error)
    } finally {
      setPaymentsStatusLoaded(true)
    }
  }


  // Build note = auto variant summary + user's extra note
  const buildOrderNote = (item: any): string => {
    const variantNote = formatVariantSelection(item.selectedVariants || {})
    const extra = orderNotes[item.productId]?.trim() || ''
    const parts = []
    if (!item.variantId && variantNote) parts.push(`[Order: ${variantNote}]`)
    if (extra) parts.push(extra)
    return parts.join(' ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ')
  }

  const handlePayment = async () => {
    if (!paymentsStatusLoaded) {
      setError('Payment status is still loading. Please wait a moment and try again.')
      return
    }
    if (!paymentsEnabled) {
      setError('Payments are currently disabled by the admin. Please try again later.')
      return
    }
    if (!deliverySuitabilityConfirmed) {
      setError('Please confirm rider-delivery suitability before payment.')
      return
    }
    if (!user?.hostelName) {
      router.push('/profile/setup')
      return
    }

    setLoading(true)
    setError('')

    try {
      const cartItemsWithNotes = cartItems.map(item => ({
        // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ FIX #5: We send productId and quantity only.
        // The server MUST re-fetch the price from the DB.
        productId: item.productId,
        variantId: item.variantId || null,
        variantData: item.selectedVariants || null,
        quantity: item.quantity,
        orderNote: buildOrderNote(item),
        buyerDeliveryAcknowledged: deliverySuitabilityConfirmed,
      }))

      // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ FIX #4: We do NOT send deliveryFee from the client.
      const response = await authFetch('/api/payments/initialize', {
        method: 'POST',
        body: JSON.stringify({ cartItems: cartItemsWithNotes }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Payment initialisation failed. Please try again.')
        return
      }

      if (data.deliveryFee !== undefined) {
        setServerDeliveryFee(data.deliveryFee)
      }

      if (data.authorization_url) {
        sessionStorage.removeItem('checkout_product')
        sessionStorage.removeItem('checkout_cart')
        clearCart()
        window.location.href = data.authorization_url
        return
      }

      // Dev mode path
      if (data.devMode || data.orderId) {
        sessionStorage.removeItem('checkout_product')
        sessionStorage.removeItem('checkout_cart')
        clearCart()
        router.push(`/orders?payment=success&order=${data.orderNumber || data.orderId}`)
        return
      }

      setError('Unexpected response from payment server. Please try again.')

    } catch (err) {
      console.error('Payment error:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

  if (cartItems.length === 0 || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-BATAMART-primary border-t-transparent" />
    </div>
  )

  // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ FIX: Delivery fee is ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¦800 per unique seller (server remains source of truth). ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
  const uniqueSellers = Math.max(1, new Set(cartItems.map(item => item.sellerId)).size)
  const fallbackDeliveryFee = uniqueSellers * 800
  const deliveryFee   = serverDeliveryFee ?? fallbackDeliveryFee
  const subtotal      = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalAmount   = subtotal + deliveryFee
  const hasNotes = cartItems.some(item => {
    const variantNote = formatVariantSelection(item.selectedVariants || {})
    const extra = orderNotes[item.productId]?.trim() || ''
    return variantNote || extra
  })

  return (
    <div className="min-h-screen bg-[#f7f8fa] pb-20">

      {/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Sticky header ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/cart')}
            className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-BATAMART-primary transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Cart
          </button>
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Lock className="w-4 h-4 text-emerald-500" />
            Secure Checkout
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-7">Checkout</h1>

        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">

          {/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ LEFT: Main sections ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */}
          <div className="lg:col-span-3 space-y-5">

            {/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Delivery address ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-BATAMART-primary/10 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-BATAMART-primary" />
                  </div>
                  <h2 className="font-black text-gray-900">Delivery Address</h2>
                </div>
                <Link href="/profile/setup" className="text-xs font-bold text-BATAMART-primary hover:text-BATAMART-dark transition-colors flex items-center gap-1">
                  Edit <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="p-5 grid sm:grid-cols-2 gap-4">
                {[
                  { icon: <User className="w-4 h-4 text-gray-400" />, label: 'Name', value: user.name },
                  { icon: <Phone className="w-4 h-4 text-gray-400" />, label: 'Phone', value: user.phone },
                  { icon: <Home className="w-4 h-4 text-gray-400" />, label: 'Location', value: `${user.hostelName}${user.roomNumber ? `, Room ${user.roomNumber}` : ''}` },
                  { icon: <MapPin className="w-4 h-4 text-gray-400" />, label: 'Landmark', value: user.landmark || 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â' },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 bg-gray-50 rounded-xl p-3.5">
                    <div className="mt-0.5 flex-shrink-0">{icon}</div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                      <p className="font-bold text-gray-900 text-sm mt-0.5 truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Order items + notes ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                  <Package className="w-4 h-4 text-violet-600" />
                </div>
                <h2 className="font-black text-gray-900">Your Items</h2>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="divide-y divide-gray-50">
                {cartItems.map((item, index) => {
                  const variantEntries = Object.entries(item.selectedVariants || {}).filter(([, v]) => v)
                  const variantSummary = variantEntries.map(([, v]) => String(v)).join(' ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ')

                  return (
                    <div key={index} className="p-5">
                      <div className="flex gap-4 mb-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-gray-900 text-sm sm:text-base line-clamp-2">{item.name}</h3>
                          <p className="text-xs text-gray-400 mt-0.5">by <span className="font-semibold text-gray-600">{item.sellerName}</span></p>
                          {item.deliveryEstimate && <p className="text-[11px] text-orange-600 font-semibold mt-1">Estimated delivery: {item.deliveryEstimate}</p>}

                          {/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ NEW: Variant chips ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */}
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

                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-BATAMART-primary font-black text-base">{formatPrice(item.price * item.quantity)}</span>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-semibold">
                              Qty: {item.quantity}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Order note ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â LOCKED: do not remove. Auto-fills variant selection. ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */}
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                        <div className="flex items-start gap-2.5 mb-3">
                          <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-amber-900">Note to Seller</p>
                            {variantSummary ? (
                              <p className="text-xs text-amber-700 mt-0.5">
                                ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ Your selection (<strong>{variantSummary}</strong>) is auto-sent to seller. Add extra info below if needed.
                              </p>
                            ) : (
                              <p className="text-xs text-amber-700 mt-0.5">
                                Let the seller know your preferences ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â size, colour, variation, or any special request.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Auto-filled variant preview */}
                        {variantSummary && (
                          <div className="bg-white/70 rounded-lg px-3 py-2 mb-2 border border-amber-100">
                            <p className="text-xs text-gray-500 font-semibold">Auto-filled: <span className="text-indigo-600">[Order: {variantSummary}]</span></p>
                          </div>
                        )}

                        <textarea
                          value={orderNotes[item.productId] || ''}
                          onChange={e => setOrderNotes(prev => ({ ...prev, [item.productId]: e.target.value }))}
                          placeholder={variantSummary ? 'Add extra instructions (optional)...' : `e.g. "Size M, black colour" or "Size 42 shoe, wider fit preferred."`}
                          rows={3}
                          maxLength={300}
                          className="w-full text-sm bg-white border border-amber-200 rounded-xl px-3.5 py-3 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 resize-none placeholder:text-gray-400 text-gray-800 font-medium"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Seller will be notified immediately
                          </p>
                          <p className="text-[11px] text-amber-500 font-semibold">
                            {(orderNotes[item.productId] || '').length}/300
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Escrow info ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-black text-gray-900">Secure Escrow Payment</h3>
              </div>
              <div className="space-y-2.5">
                {[
                  'Your payment is held securely in escrow until delivery',
                  'Seller gets paid only after you confirm delivery',
                  'Rider picks up and delivers within hours on campus',
                  'Rate both seller and rider after your order arrives',
                ].map(text => (
                  <div key={text} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600 font-medium">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Error banner ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â context-aware messaging */}
            {error && (() => {
              const [type, msg] = error.includes('|') ? error.split('|') : ['GENERIC', error]
              const isCheckOrders = type === 'CHECK_ORDERS'
              const isNotCharged  = type === 'NOT_CHARGED'

              return (
                <div className={`rounded-xl border px-4 py-4 ${
                  isCheckOrders
                    ? 'bg-amber-50 border-amber-300'
                    : isNotCharged
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">
                      {isCheckOrders ? 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â' : isNotCharged ? 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¹ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â' : 'ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€¦Ã¢â‚¬â„¢'}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-bold mb-1 ${
                        isCheckOrders ? 'text-amber-800' : isNotCharged ? 'text-blue-800' : 'text-red-800'
                      }`}>
                        {isCheckOrders ? 'Before You Try Again ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Check Your Orders' : isNotCharged ? 'You Were Not Charged' : 'Payment Error'}
                      </p>
                      <p className={`text-sm leading-relaxed ${
                        isCheckOrders ? 'text-amber-700' : isNotCharged ? 'text-blue-700' : 'text-red-700'
                      }`}>
                        {msg}
                      </p>
                      {isCheckOrders && (
                        <a
                          href="/orders"
                          className="inline-block mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg transition-colors"
                        >
                          Check My Orders ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ RIGHT: Summary + CTA ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-20">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Order Summary</p>

              <div className="space-y-3 pb-4 border-b border-gray-50">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal ({cartItems.reduce((a, i) => a + i.quantity, 0)} units)</span>
                  <span className="font-bold text-gray-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Delivery Fee
                  </span>
                  {/* Shows server fee or seller-based fallback placeholder */}
                  <span className="font-bold text-gray-900">
                    {serverDeliveryFee !== null ? formatPrice(serverDeliveryFee) : formatPrice(fallbackDeliveryFee)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between mt-4 mb-5">
                <span className="font-black text-gray-900">Total</span>
                <span className="font-black text-BATAMART-primary text-xl">{formatPrice(totalAmount)}</span>
              </div>

              {hasNotes && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5 mb-4">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-amber-800">Order notes will be sent to seller(s)</p>
                </div>
              )}
              <label className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3 mb-4">
                <input
                  type="checkbox"
                  checked={deliverySuitabilityConfirmed}
                  onChange={(e) => setDeliverySuitabilityConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-BATAMART-primary focus:ring-BATAMART-primary"
                />
                <span className="text-xs text-red-600 font-semibold leading-relaxed">
                  I confirm these products can be delivered by riders. If a rider declines an oversized item, product payment is refunded to wallet but delivery fee is not refunded.
                </span>
              </label>

              <button
                onClick={handlePayment}
                disabled={loading || !paymentsStatusLoaded || !paymentsEnabled || !deliverySuitabilityConfirmed}
                className="w-full flex items-center justify-center gap-2.5 bg-BATAMART-primary hover:bg-BATAMART-dark disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-black text-base shadow-lg shadow-BATAMART-primary/25 hover:shadow-xl transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                                ) : !paymentsStatusLoaded ? (
                  <>Checking payment status...</>
                ) : !paymentsEnabled ? (
                  <>Payments Temporarily Disabled</>
                ) : (
                  <><Lock className="w-4 h-4" /> Pay Securely - {formatPrice(totalAmount)}</>
                )}
              </button>

              <p className="text-[11px] text-center text-gray-400 mt-3 leading-relaxed">
                                {!paymentsStatusLoaded
                  ? 'Checking payment status. Please wait a moment.'
                  : !paymentsEnabled
                  ? 'Payments are currently disabled by the admin. Please try again later.'
                  : "By paying, you agree to BATAMART's Terms of Service. Payment secured by Paystack."}
              </p>

              <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-center gap-4">
                {[
                  { icon: <Lock className="w-3.5 h-3.5 text-gray-400" />, label: 'SSL Secured' },
                  { icon: <Shield className="w-3.5 h-3.5 text-gray-400" />, label: 'Escrow Protected' },
                  { icon: <CheckCircle className="w-3.5 h-3.5 text-gray-400" />, label: 'Verified' },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1">
                    {icon}
                    <span className="text-[10px] text-gray-400 font-semibold">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
