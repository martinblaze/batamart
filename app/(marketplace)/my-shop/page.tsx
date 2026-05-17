'use client'
// app/(marketplace)/my-shop/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingBag, Package, TrendingUp, Award, Eye,
  CheckCircle, XCircle, Plus, Trash2, BarChart3,
  Grid, List, Search, ArrowRight, X, AlertTriangle,
  Sparkles, Zap, RefreshCw, Star, Loader2, ChevronRight,
  BadgeCheck, Timer,
} from 'lucide-react'
import { authFetch } from '@/lib/auth-client'
import { decodeProductData } from '@/lib/variants'

const SHOP_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.93); }
    to   { opacity: 1; transform: scale(1); }
  }
  .scale-in { animation: scaleIn 0.3s cubic-bezier(0.34,1.4,0.64,1) forwards; }

  .product-row {
    transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s cubic-bezier(0.34,1.4,0.64,1);
  }
  .product-row:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    border-color: #e0e7ff;
    transform: translateY(-1px);
  }

  .product-img-wrap { overflow: hidden; }
  .product-img { transition: transform 0.5s cubic-bezier(0.22,1,0.36,1); }
  .product-row:hover .product-img { transform: scale(1.06); }

  .stat-card {
    transition: transform 0.25s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.25s ease;
  }
  .stat-card:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(0,0,0,0.1); }

  .action-btn {
    transition: transform 0.15s cubic-bezier(0.34,1.4,0.64,1), background 0.15s ease;
  }
  .action-btn:hover { transform: scale(1.04); }
  .action-btn:active { transform: scale(0.96); }

  .filter-chip {
    transition: all 0.15s cubic-bezier(0.34,1.4,0.64,1);
  }
  .filter-chip:hover { transform: scale(1.03); }

  .header-gradient {
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
  }

  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .shimmer {
    background: linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%);
    background-size: 1200px 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`

interface Product {
  id: string; name: string; price: number; quantity: number
  images: string[]; category: string; subcategory?: string
  description: string; isActive: boolean
  deliveryEstimate?: string
  viewCount: number; createdAt: string
  _count: { orders: number }
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className={`scale-in flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-2xl max-w-sm w-full pointer-events-auto border ${
        type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
      }`}>
        {type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />}
        <p className="text-sm font-bold flex-1">{message}</p>
        <button onClick={onClose} className="flex-shrink-0 opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: {
  title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
      <div className="scale-in bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="font-black text-gray-900 text-lg">{title}</h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-sm transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-red-500/25">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const fmt = (price: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price)

export default function MyShopPage() {
  const router = useRouter()
  const [products, setProducts]           = useState<Product[]>([])
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState<'all' | 'active' | 'outofstock'>('all')
  const [restockingId, setRestockingId]   = useState<string | null>(null)
  const [restockAmount, setRestockAmount] = useState<number>(1)
  const [userRole, setUserRole]           = useState('')
  const [isSellerMode, setIsSellerMode]   = useState(true)
  const [viewMode, setViewMode]           = useState<'grid' | 'list'>('list')
  const [searchTerm, setSearchTerm]       = useState('')
  const [toast, setToast]                 = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null)

  useEffect(() => {
    if (document.getElementById('shop-anim')) return
    const s = document.createElement('style'); s.id = 'shop-anim'; s.textContent = SHOP_CSS
    document.head.appendChild(s)
  }, [])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const showConfirm = (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
    setConfirmDialog({ title, message, confirmLabel, onConfirm })
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    const loadUserData = async () => {
      try {
        const response = await authFetch('/api/auth/me')
        const data = await response.json()
        if (response.ok && data.user) { setUserRole(data.user.role || 'BUYER'); setIsSellerMode(data.user.isSellerMode ?? true) }
      } catch {}
    }
    loadUserData(); fetchMyProducts()
  }, [])

  const fetchMyProducts = async () => {
    setLoading(true)
    try {
      const response = await authFetch('/api/products/my-products')
      const data = await response.json()
      if (response.ok) setProducts(data.products || [])
      else showToast(data.error || 'Failed to fetch products', 'error')
    } catch { showToast('Network error loading products', 'error') }
    finally { setLoading(false) }
  }

  const handleRestock = async (productId: string) => {
    if (restockAmount < 1) { showToast('Enter a valid quantity', 'error'); return }
    try {
      const response = await authFetch(`/api/products/${productId}/restock`, { method: 'POST', body: JSON.stringify({ quantity: restockAmount }) })
      const data = await response.json()
      if (response.ok) { showToast(`Restocked ${restockAmount} item${restockAmount !== 1 ? 's' : ''} ✓`); setRestockingId(null); setRestockAmount(1); fetchMyProducts() }
      else showToast(data.error || 'Failed to restock', 'error')
    } catch { showToast('Network error', 'error') }
  }

  const handleDelete = (productId: string, productName: string) => {
    showConfirm('Delete product', `Delete "${productName}"? This cannot be undone.`, 'Delete', async () => {
      setConfirmDialog(null)
      try {
        const response = await authFetch(`/api/products/${productId}`, { method: 'DELETE' })
        if (response.ok) { showToast('Product deleted'); fetchMyProducts() }
        else { const data = await response.json(); showToast(data.error || 'Failed to delete', 'error') }
      } catch { showToast('Network error', 'error') }
    })
  }

  const toggleActive = async (productId: string, currentStatus: boolean) => {
    try {
      const response = await authFetch(`/api/products/${productId}`, { method: 'PUT', body: JSON.stringify({ isActive: !currentStatus }) })
      if (response.ok) { showToast(`Product ${!currentStatus ? 'activated ✓' : 'paused'}`); fetchMyProducts() }
      else { const data = await response.json(); showToast(data.error || 'Failed to update', 'error') }
    } catch { showToast('Network error', 'error') }
  }

  const toggleSellerMode = async () => {
    const newMode = !isSellerMode
    setIsSellerMode(newMode)
    if (userRole === 'SELLER' || userRole === 'ADMIN') {
      try {
        const res = await authFetch('/api/auth/toggle-seller-mode', { method: 'POST', body: JSON.stringify({ isSellerMode: newMode }) })
        if (!res.ok) { setIsSellerMode(!newMode); showToast('Failed to update mode.', 'error') }
      } catch { setIsSellerMode(!newMode); showToast('Network error.', 'error') }
    }
  }

  const filteredProducts = products.filter(p => {
    let matchesFilter = true
    if (filter === 'active') matchesFilter = p.quantity > 0 && p.isActive
    if (filter === 'outofstock') matchesFilter = p.quantity === 0
    const matchesSearch = !searchTerm || (() => {
      const q = searchTerm.toLowerCase()
      const { variants, tags } = decodeProductData(p.description || '')
      const variantValues = Object.values(variants).flat() as string[]
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory?.toLowerCase() || '').includes(q) ||
        tags.some((t: string) => t.toLowerCase().includes(q)) ||
        variantValues.some((v: string) => v.toLowerCase().includes(q))
      )
    })()
    return matchesFilter && matchesSearch
  })

  const totalOrders      = products.reduce((s, p) => s + (p._count?.orders || 0), 0)
  const activeCount      = products.filter(p => p.quantity > 0 && p.isActive).length
  const outOfStockCount  = products.filter(p => p.quantity === 0).length

  if (loading) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
        <p className="text-gray-500 font-semibold">Loading your shop…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-28">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title} message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel} onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* ── Header ── */}
      <header className="header-gradient sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-white">
                {isSellerMode ? '🛍️ My Shop' : '📦 My Purchases'}
              </h1>
              <p className="text-white/50 text-xs mt-0.5">
                {isSellerMode ? `${products.length} products · ${totalOrders} total orders` : 'Your purchase history'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(userRole === 'SELLER' || userRole === 'ADMIN') && (
                <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/15">
                  <button
                    onClick={() => !isSellerMode && toggleSellerMode()}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${isSellerMode ? 'bg-white text-indigo-700 shadow-md' : 'text-white/60 hover:text-white/80'}`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Seller
                  </button>
                  <button
                    onClick={() => isSellerMode && toggleSellerMode()}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${!isSellerMode ? 'bg-white text-blue-700 shadow-md' : 'text-white/60 hover:text-white/80'}`}
                  >
                    <Package className="w-3.5 h-3.5" /> Buyer
                  </button>
                </div>
              )}
              {isSellerMode && (
                <Link href="/sell"
                  className="flex items-center gap-1.5 text-white px-4 py-2.5 rounded-xl font-black text-sm shadow-lg transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                  <Plus className="w-4 h-4" /> Add Product
                </Link>
              )}
              <button onClick={fetchMyProducts}
                className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                <RefreshCw className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {isSellerMode ? (
          <>
            {/* ── Stats row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: <ShoppingBag className="w-5 h-5 text-indigo-600" />, bg: 'bg-indigo-50', value: products.length, label: 'Listed', sub: 'Total products', color: 'text-indigo-600', gradient: false },
                { icon: <CheckCircle className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50', value: activeCount, label: 'Active', sub: 'Live & in stock', color: 'text-emerald-600', gradient: false },
                { icon: <XCircle className="w-5 h-5 text-red-500" />, bg: 'bg-red-50', value: outOfStockCount, label: 'Out of Stock', sub: 'Needs restocking', color: 'text-red-500', gradient: false },
                { icon: <TrendingUp className="w-5 h-5 text-white" />, bg: 'bg-white/20', value: totalOrders, label: 'Total Orders', sub: 'All time sales', color: 'text-white', gradient: true },
              ].map(({ icon, bg, value, label, sub, color, gradient }) => (
                <div key={label} className={`stat-card rounded-2xl border shadow-sm p-4 sm:p-5 ${gradient ? 'border-transparent text-white' : 'bg-white border-gray-100'}`}
                  style={gradient ? { background: 'linear-gradient(135deg, #6366f1, #4c1d95)' } : {}}>
                  <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
                  <p className={`text-2xl sm:text-3xl font-black ${color}`}>{value}</p>
                  <p className={`text-sm font-bold mt-0.5 ${gradient ? 'text-white/90' : 'text-gray-700'}`}>{label}</p>
                  <p className={`text-xs mt-0.5 ${gradient ? 'text-white/60' : 'text-gray-400'}`}>{sub}</p>
                </div>
              ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text" value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search your products…"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl border-2 border-transparent focus:border-indigo-300 focus:bg-white focus:outline-none text-sm font-medium transition-all"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { key: 'all', label: `All (${products.length})`, active: 'bg-indigo-600' },
                    { key: 'active', label: `Active (${activeCount})`, active: 'bg-emerald-500' },
                    { key: 'outofstock', label: `Out of Stock (${outOfStockCount})`, active: 'bg-red-500' },
                  ].map(({ key, label, active }) => (
                    <button key={key} onClick={() => setFilter(key as any)}
                      className={`filter-chip px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all ${
                        filter === key ? `${active} text-white shadow-md` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl ml-auto flex-shrink-0">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Grid className="w-4 h-4" />
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Products ── */}
            {filteredProducts.length === 0 ? (
              <div className="fade-up flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mb-5 ring-1 ring-gray-100">
                  <Package className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-black text-gray-800 mb-1">No products found</h3>
                <p className="text-sm text-gray-400 mb-6 text-center max-w-xs">
                  {searchTerm ? 'Try different keywords.' : 'List your first product to start selling!'}
                </p>
                <Link href="/sell"
                  className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                  <Sparkles className="w-4 h-4" /> List First Product
                </Link>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((product, i) => (
                  <div key={product.id} className="product-row fade-up bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group"
                    style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="product-img-wrap relative aspect-square bg-gray-100">
                      <img src={product.images[0] || '/placeholder.png'} alt={product.name} className="product-img w-full h-full object-cover" />
                      <div className="absolute top-2.5 right-2.5">
                        {product.quantity === 0
                          ? <span className="px-2 py-1 bg-red-500 text-white text-[10px] font-black rounded-lg shadow-md">OUT OF STOCK</span>
                          : <span className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-lg shadow-md">{product.quantity} LEFT</span>
                        }
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                        {product.subcategory ? `${product.category} · ${product.subcategory}` : product.category}
                      </p>
                      <h3 className="font-black text-gray-900 text-base line-clamp-1 mb-0.5">{product.name}</h3>
                      {product.deliveryEstimate && <p className="text-[11px] font-semibold text-orange-600 mb-1">Delivery: {product.deliveryEstimate}</p>}
                      {/* ── Variant chips ── */}
                      {(() => {
                        const { variants } = decodeProductData(product.description || '')
                        const chips = Object.values(variants).flat().slice(0, 4) as string[]
                        return chips.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {chips.map(v => (
                              <span key={v} className="text-[9px] bg-indigo-50 text-indigo-500 font-bold px-2 py-0.5 rounded-full">{v}</span>
                            ))}
                          </div>
                        ) : null
                      })()}
                      <p className="font-black text-lg text-indigo-600 mb-3">{fmt(product.price)}</p>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-gray-400 font-semibold">Views</p>
                          <p className="text-sm font-black text-gray-900 flex items-center justify-center gap-1"><Eye className="w-3 h-3" />{product.viewCount}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-gray-400 font-semibold">Orders</p>
                          <p className="text-sm font-black text-gray-900 flex items-center justify-center gap-1"><ShoppingBag className="w-3 h-3" />{product._count?.orders || 0}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => router.push(`/product/${product.id}`)}
                          className="action-btn flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button onClick={() => toggleActive(product.id, product.isActive)}
                          className={`action-btn px-3 py-2.5 rounded-xl font-bold text-xs ${product.isActive ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                          {product.isActive ? 'Pause' : 'Live'}
                        </button>
                        <button onClick={() => handleDelete(product.id, product.name)}
                          className="action-btn px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List view */
              <div className="space-y-3">
                {filteredProducts.map((product, i) => (
                  <div key={product.id} className="product-row fade-up bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group flex"
                    style={{ animationDelay: `${i * 35}ms` }}>
                    <div className="product-img-wrap w-28 sm:w-36 flex-shrink-0 relative bg-gray-100" style={{ minHeight: '120px' }}>
                      <img src={product.images[0] || '/placeholder.png'} alt={product.name} className="product-img w-full h-full object-cover absolute inset-0" />
                      <div className="absolute top-2 left-2">
                        {product.quantity === 0
                          ? <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-md shadow">OUT</span>
                          : product.quantity < 5
                            ? <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-md shadow">LOW</span>
                            : null
                        }
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                              {product.subcategory ? `${product.category} · ${product.subcategory}` : product.category}
                            </p>
                            <h3 className="font-black text-gray-900 text-base leading-tight mt-0.5 line-clamp-1">{product.name}</h3>
                            {product.deliveryEstimate && <p className="text-[11px] font-semibold text-orange-600 mt-1">Delivery: {product.deliveryEstimate}</p>}
                            {/* ── Variant chips ── */}
                            {(() => {
                              const { variants } = decodeProductData(product.description || '')
                              const chips = Object.values(variants).flat().slice(0, 3) as string[]
                              return chips.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {chips.map(v => (
                                    <span key={v} className="text-[9px] bg-indigo-50 text-indigo-500 font-bold px-2 py-0.5 rounded-full">{v}</span>
                                  ))}
                                </div>
                              ) : null
                            })()}
                          </div>
                          <p className="font-black text-lg text-indigo-600 whitespace-nowrap flex-shrink-0">{fmt(product.price)}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {product.quantity === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-red-50 text-red-700 rounded-full ring-1 ring-red-200">
                              <XCircle className="w-3 h-3" /> Out of Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full ring-1 ring-emerald-200">
                              <CheckCircle className="w-3 h-3" /> {product.quantity} in stock
                            </span>
                          )}
                          {!product.isActive && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded-full ring-1 ring-gray-200">Inactive</span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-blue-50 text-blue-700 rounded-full ring-1 ring-blue-200">
                            <Eye className="w-3 h-3" /> {product.viewCount} views
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-violet-50 text-violet-700 rounded-full ring-1 ring-violet-200">
                            <ShoppingBag className="w-3 h-3" /> {product._count?.orders || 0} orders
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(product.quantity === 0 || product.quantity < 5) && (
                          restockingId === product.id ? (
                            <div className="flex items-center gap-2">
                              <input type="number" min="1" value={restockAmount}
                                onChange={e => setRestockAmount(parseInt(e.target.value) || 1)}
                                className="w-20 px-3 py-2 border-2 border-indigo-200 rounded-xl focus:outline-none focus:border-indigo-400 text-sm font-bold bg-white"
                              />
                              <button onClick={() => handleRestock(product.id)}
                                className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setRestockingId(null); setRestockAmount(1) }}
                                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-sm transition-all">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setRestockingId(product.id)}
                              className="action-btn flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-500/20">
                              <Package className="w-3.5 h-3.5" /> Restock
                            </button>
                          )
                        )}
                        <button onClick={() => toggleActive(product.id, product.isActive)}
                          className={`action-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black text-xs transition-all ${product.isActive ? 'bg-amber-50 hover:bg-amber-100 text-amber-800' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'}`}>
                          {product.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <Link href={`/product/${product.id}`}
                          className="action-btn flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl font-black text-xs transition-all">
                          <Eye className="w-3.5 h-3.5" /> View Live
                        </Link>
                        <button onClick={() => handleDelete(product.id, product.name)}
                          className="action-btn flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-black text-xs transition-all">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Buyer mode ── */
          <div className="space-y-4">
            <div className="fade-up bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10 text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                <ShoppingBag className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-1">You're in Buyer Mode</h2>
              <p className="text-gray-400 text-sm mb-7 max-w-sm mx-auto">Switch to Seller Mode to manage your listings and start earning.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/marketplace"
                  className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                  <ShoppingBag className="w-4 h-4" /> Browse Marketplace
                </Link>
                <Link href="/orders"
                  className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-3 rounded-2xl font-black text-sm transition-all">
                  <Package className="w-4 h-4" /> View My Orders
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
   </div>
  )
}
