'use client'
// app/(marketplace)/my-shop/page.tsx

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ShoppingBag, Package, TrendingUp, Award, Eye,
  CheckCircle, XCircle, Plus, Trash2, BarChart3,
  Grid, List, Search, ArrowRight, X, AlertTriangle,
  Crown, Zap, RefreshCw, Star, Loader2, ChevronRight,
  BadgeCheck, Timer,
} from 'lucide-react'
import { authFetch } from '@/lib/auth-client'
import { decodeProductData, getCategoryDisplayInfo } from '@/lib/variants'

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
    border-color: var(--color-primary);
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
    /* Ink, not accent. A full-bleed blue slab at the top of four different
       screens was the loudest thing in the product and made every one of
       them read as a different app. */
    background: var(--ui-slab);
  }

  .shimmer {
    background: var(--color-surface);
    animation: pulse-shimmer 1.5s ease-in-out infinite;
  }
  @keyframes pulse-shimmer {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`

interface Product {
  id: string; name: string; price: number; quantity: number
  images: string[]; category: string; subcategory?: string
  description: string; isActive: boolean; moderationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string | null
  deliveryEstimate?: string
  viewCount: number; createdAt: string
  _count: { orders: number }
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className={`scale-in flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-soft max-w-sm w-full pointer-events-auto border ${
        type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'
      }`}>
        {type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 text-success" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0 text-danger" />}
        <p className="text-sm font-semibold flex-1">{message}</p>
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
      <div className="scale-in bg-card rounded-3xl shadow-soft p-6 max-w-sm w-full">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 bg-danger/10 rounded-2xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div>
            <h3 className="font-semibold text-ink text-lg">{title}</h3>
            <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-3 bg-surface hover:bg-border text-ink-secondary rounded-2xl font-semibold text-sm transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 px-4 py-3 bg-danger hover:brightness-95 text-white rounded-2xl font-semibold text-sm transition-all">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const fmt = (price: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(price)

const getModerationStatusBadge = (status?: string, rejectionReason?: string | null) => {
  if (!status || status === 'APPROVED') return null
  
  const config = {
    PENDING: { bg: 'bg-warning/10', text: 'text-warning', label: 'Under Review', icon: <Timer className="w-3 h-3" /> },
    REJECTED: { bg: 'bg-danger/10', text: 'text-danger', label: 'Rejected', icon: <XCircle className="w-3 h-3" /> },
  }[status] || { bg: 'bg-surface', text: 'text-ink-secondary', label: status, icon: null }
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold ${config.bg} ${config.text} ring-1 ring-current ring-opacity-20`}>
      {config.icon}
      {config.label}
      {status === 'REJECTED' && rejectionReason && (
        <span className="ml-0.5 text-[8px] opacity-70 truncate max-w-xs" title={rejectionReason}>({rejectionReason})</span>
      )}
    </div>
  )
}

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
    if (!token) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return }
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
      if (response.ok) { showToast(`Restocked ${restockAmount} item${restockAmount !== 1 ? 's' : ''}`); setRestockingId(null); setRestockAmount(1); fetchMyProducts() }
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
      if (response.ok) { showToast(`Product ${!currentStatus ? 'activated' : 'paused'}`); fetchMyProducts() }
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
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <p className="text-ink-secondary font-semibold">Loading your shop…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface pb-28">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title} message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel} onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* ── Header ── */}
      <header className="header-gradient sticky top-0 z-40 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="ui-eyebrow mb-2 max-w-[14rem] !text-white/45">
                {isSellerMode ? 'Seller' : 'Buyer'}
              </p>
              <h1 className="text-[clamp(1.35rem,3vw,2rem)] text-white">
                {isSellerMode ? 'My shop' : 'My purchases'}
              </h1>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/45">
                {isSellerMode ? `${products.length} products · ${totalOrders} total orders` : 'Your purchase history'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(userRole === 'SELLER' || userRole === 'ADMIN') && (
                <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/15">
                  <button
                    onClick={() => !isSellerMode && toggleSellerMode()}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${isSellerMode ? 'bg-card text-primary shadow-soft' : 'text-white/60 hover:text-white/80'}`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> Seller
                  </button>
                  <button
                    onClick={() => isSellerMode && toggleSellerMode()}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${!isSellerMode ? 'bg-card text-primary shadow-soft' : 'text-white/60 hover:text-white/80'}`}
                  >
                    <Package className="w-3.5 h-3.5" /> Buyer
                  </button>
                </div>
              )}
              {isSellerMode && (
                <Link href="/sell"
                  className="flex items-center gap-1.5 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-soft transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'var(--color-primary)' }}>
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
                { icon: <ShoppingBag className="w-5 h-5 text-primary" />, bg: 'bg-primary/10', value: products.length, label: 'Listed', sub: 'Total products', color: 'text-primary', gradient: false },
                { icon: <CheckCircle className="w-5 h-5 text-success" />, bg: 'bg-success/10', value: activeCount, label: 'Active', sub: 'Live & in stock', color: 'text-success', gradient: false },
                { icon: <XCircle className="w-5 h-5 text-danger" />, bg: 'bg-danger/10', value: outOfStockCount, label: 'Out of Stock', sub: 'Needs restocking', color: 'text-danger', gradient: false },
                { icon: <TrendingUp className="w-5 h-5 text-white" />, bg: 'bg-white/20', value: totalOrders, label: 'Total Orders', sub: 'All time sales', color: 'text-white', gradient: true },
              ].map(({ icon, bg, value, label, sub, color, gradient }) => (
                <div key={label} className={`stat-card rounded-2xl border shadow-soft p-4 sm:p-5 ${gradient ? 'border-transparent text-white' : 'bg-card border-border'}`}
                  style={gradient ? { background: 'var(--color-primary)' } : {}}>
                  <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
                  <p className={`text-2xl sm:text-3xl font-semibold ${color}`}>{value}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${gradient ? 'text-white/90' : 'text-ink-secondary'}`}>{label}</p>
                  <p className={`text-xs mt-0.5 ${gradient ? 'text-white/60' : 'text-ink-muted'}`}>{sub}</p>
                </div>
              ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="bg-card rounded-2xl border border-border shadow-soft p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
                  <input
                    type="text" value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search your products…"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-xl border-2 border-transparent focus:border-primary focus:bg-card focus:outline-none text-sm font-medium transition-all"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { key: 'all', label: `All (${products.length})`, active: 'bg-primary' },
                    { key: 'active', label: `Active (${activeCount})`, active: 'bg-success/100' },
                    { key: 'outofstock', label: `Out of Stock (${outOfStockCount})`, active: 'bg-danger/100' },
                  ].map(({ key, label, active }) => (
                    <button key={key} onClick={() => setFilter(key as any)}
                      className={`filter-chip px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        filter === key ? `${active} text-white shadow-soft` : 'bg-surface text-ink-secondary hover:bg-border'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-surface p-1 rounded-xl ml-auto flex-shrink-0">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-card text-primary shadow-soft' : 'text-ink-secondary hover:text-ink-secondary'}`}>
                    <Grid className="w-4 h-4" />
                  </button>
                  <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-card text-primary shadow-soft' : 'text-ink-secondary hover:text-ink-secondary'}`}>
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Products ── */}
            {filteredProducts.length === 0 ? (
              <div className="fade-up flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-border">
                <div className="w-20 h-20 rounded-3xl bg-surface flex items-center justify-center mb-5 ring-1 ring-border">
                  <Package className="w-10 h-10 text-ink-muted" />
                </div>
                <h3 className="text-xl font-semibold text-ink mb-1">No products found</h3>
                <p className="text-sm text-ink-muted mb-6 text-center max-w-xs">
                  {searchTerm ? 'Try different keywords.' : 'List your first product to start selling!'}
                </p>
                <Link href="/sell"
                  className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-soft transition-all hover:scale-105"
                  style={{ background: 'var(--color-primary)' }}>
                  <Crown className="w-4 h-4" /> List First Product
                </Link>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((product, i) => (
                  <div key={product.id} className="product-row fade-up bg-card rounded-2xl border border-border shadow-soft overflow-hidden group"
                    style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="product-img-wrap relative aspect-square bg-surface">
                      <img src={product.images[0] || '/placeholder.png'} alt={product.name} className="product-img w-full h-full object-cover" />
                      <div className="absolute top-2.5 right-2.5">
                        {product.quantity === 0
                          ? <span className="px-2 py-1 bg-danger/100 text-white text-[10px] font-semibold rounded-lg shadow-soft">OUT OF STOCK</span>
                          : <span className="px-2 py-1 bg-success/100 text-white text-[10px] font-semibold rounded-lg shadow-soft">{product.quantity} LEFT</span>
                        }
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider mb-1">
                        {(() => {
                          const display = getCategoryDisplayInfo(product.categoryKey, product.subcategoryKey, product.category, product.subcategory)
                          return display.subcategory ? `${display.category} · ${display.subcategory}` : display.category
                        })()}
                      </p>
                      <h3 className="font-semibold text-ink text-base line-clamp-1 mb-0.5">{product.name}</h3>
                      {getModerationStatusBadge(product.moderationStatus, product.rejectionReason) && (
                        <div className="mb-2">
                          {getModerationStatusBadge(product.moderationStatus, product.rejectionReason)}
                        </div>
                      )}
                      {product.deliveryEstimate && <p className="text-[11px] font-semibold text-ink-secondary mb-1">Delivery: {product.deliveryEstimate}</p>}
                      {/* ── Variant chips ── */}
                      {(() => {
                        const { variants } = decodeProductData(product.description || '')
                        const chips = Object.values(variants).flat().slice(0, 4) as string[]
                        return chips.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {chips.map(v => (
                              <span key={v} className="text-[9px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{v}</span>
                            ))}
                          </div>
                        ) : null
                      })()}
                      <p className="font-semibold text-lg text-primary mb-3">{fmt(product.price)}</p>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        <div className="bg-surface rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-ink-muted font-semibold">Views</p>
                          <p className="text-sm font-semibold text-ink flex items-center justify-center gap-1"><Eye className="w-3 h-3" />{product.viewCount}</p>
                        </div>
                        <div className="bg-surface rounded-xl p-2.5 text-center">
                          <p className="text-[10px] text-ink-muted font-semibold">Orders</p>
                          <p className="text-sm font-semibold text-ink flex items-center justify-center gap-1"><ShoppingBag className="w-3 h-3" />{product._count?.orders || 0}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => router.push(`/product/${product.id}`)}
                          className="action-btn flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-primary/10 hover:bg-primary/10 text-primary rounded-xl font-semibold text-xs">
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button onClick={() => toggleActive(product.id, product.isActive)}
                          className={`action-btn px-3 py-2.5 rounded-xl font-semibold text-xs ${product.isActive ? 'bg-warning/10 text-warning hover:bg-warning/10' : 'bg-success/10 text-success hover:bg-success/10'}`}>
                          {product.isActive ? 'Pause' : 'Live'}
                        </button>
                        <button onClick={() => handleDelete(product.id, product.name)}
                          className="action-btn px-3 py-2.5 bg-danger/10 hover:bg-danger/10 text-danger rounded-xl transition-all">
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
                  <div key={product.id} className="product-row fade-up bg-card rounded-2xl border border-border shadow-soft overflow-hidden group flex"
                    style={{ animationDelay: `${i * 35}ms` }}>
                    <div className="product-img-wrap w-28 sm:w-36 flex-shrink-0 relative bg-surface" style={{ minHeight: '120px' }}>
                      <img src={product.images[0] || '/placeholder.png'} alt={product.name} className="product-img w-full h-full object-cover absolute inset-0" />
                      <div className="absolute top-2 left-2">
                        {product.quantity === 0
                          ? <span className="px-1.5 py-0.5 bg-danger/100 text-white text-[9px] font-semibold rounded-md shadow">OUT</span>
                          : product.quantity < 5
                            ? <span className="px-1.5 py-0.5 bg-warning/100 text-white text-[9px] font-semibold rounded-md shadow">LOW</span>
                            : null
                        }
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                              {(() => {
                                const display = getCategoryDisplayInfo(product.categoryKey, product.subcategoryKey, product.category, product.subcategory)
                                return display.subcategory ? `${display.category} · ${display.subcategory}` : display.category
                              })()}
                            </p>
                            <h3 className="font-semibold text-ink text-base leading-tight mt-0.5 line-clamp-1">{product.name}</h3>
                            {getModerationStatusBadge(product.moderationStatus, product.rejectionReason) && (
                              <div className="mt-1.5 mb-1">
                                {getModerationStatusBadge(product.moderationStatus, product.rejectionReason)}
                              </div>
                            )}
                            {product.deliveryEstimate && <p className="text-[11px] font-semibold text-ink-secondary mt-1">Delivery: {product.deliveryEstimate}</p>}
                            {/* ── Variant chips ── */}
                            {(() => {
                              const { variants } = decodeProductData(product.description || '')
                              const chips = Object.values(variants).flat().slice(0, 3) as string[]
                              return chips.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {chips.map(v => (
                                    <span key={v} className="text-[9px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{v}</span>
                                  ))}
                                </div>
                              ) : null
                            })()}
                          </div>
                          <p className="font-semibold text-lg text-primary whitespace-nowrap flex-shrink-0">{fmt(product.price)}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {product.quantity === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 bg-danger/10 text-danger rounded-full ring-1 ring-danger/30">
                              <XCircle className="w-3 h-3" /> Out of Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 bg-success/10 text-success rounded-full ring-1 ring-success/30">
                              <CheckCircle className="w-3 h-3" /> {product.quantity} in stock
                            </span>
                          )}
                          {!product.isActive && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 bg-surface text-ink-secondary rounded-full ring-1 ring-border">Inactive</span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full ring-1 ring-primary/20">
                            <Eye className="w-3 h-3" /> {product.viewCount} views
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 bg-primary/10 text-primary rounded-full">
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
                                className="w-20 px-3 py-2 border-2 border-primary/20 rounded-xl focus:outline-none focus:border-primary text-sm font-semibold bg-card"
                              />
                              <button onClick={() => handleRestock(product.id)}
                                className="px-3 py-2 bg-success/100 hover:bg-success text-white rounded-xl font-semibold text-sm transition-all">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setRestockingId(null); setRestockAmount(1) }}
                                className="px-3 py-2 bg-border hover:brightness-95 text-ink-secondary rounded-xl font-semibold text-sm transition-all">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setRestockingId(product.id)}
                              className="action-btn flex items-center gap-1.5 px-3.5 py-2 bg-success hover:brightness-95 text-white rounded-xl font-semibold text-xs">
                              <Package className="w-3.5 h-3.5" /> Restock
                            </button>
                          )
                        )}
                        <button onClick={() => toggleActive(product.id, product.isActive)}
                          className={`action-btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-xs transition-all ${product.isActive ? 'bg-warning/10 hover:bg-warning/10 text-warning' : 'bg-success/10 hover:bg-success/10 text-success'}`}>
                          {product.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <Link href={`/product/${product.id}`}
                          className="action-btn flex items-center gap-1.5 px-3.5 py-2 bg-primary/10 hover:bg-primary/10 text-primary rounded-xl font-semibold text-xs transition-all">
                          <Eye className="w-3.5 h-3.5" /> View Live
                        </Link>
                        <button onClick={() => handleDelete(product.id, product.name)}
                          className="action-btn flex items-center gap-1.5 px-3.5 py-2 bg-danger/10 hover:bg-danger/10 text-danger rounded-xl font-semibold text-xs transition-all">
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
            <div className="fade-up bg-card rounded-2xl border border-border shadow-soft p-8 sm:p-10 text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-soft"
                style={{ background: 'var(--color-primary)' }}>
                <ShoppingBag className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-ink mb-1">You're in Buyer Mode</h2>
              <p className="text-ink-muted text-sm mb-7 max-w-sm mx-auto">Switch to Seller Mode to manage your listings and start earning.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/marketplace"
                  className="inline-flex items-center gap-2 text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-soft transition-all hover:scale-105"
                  style={{ background: 'var(--color-primary)' }}>
                  <ShoppingBag className="w-4 h-4" /> Browse Marketplace
                </Link>
                <Link href="/orders"
                  className="inline-flex items-center gap-2 bg-surface hover:bg-border text-ink px-6 py-3 rounded-2xl font-semibold text-sm transition-all">
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
