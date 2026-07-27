// app/(admin)/admin/products/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle, XCircle, Loader2, ShieldAlert, Trash2,
  Star, BadgeCheck, MapPin, Phone, Mail, Package, Ruler, Weight,
  Truck, Tag, Heart, Flag,
} from 'lucide-react'
import { getCategoryDisplayInfo } from '@/lib/variants'
import { CAMPAIGNS, isValidCampaignKey } from '@/lib/campaigns'

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-warning/10 text-warning border-warning/30',
  APPROVED: 'bg-success/10 text-success border-success/30',
  REJECTED: 'bg-danger/10 text-danger border-danger/30',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)
}

export default function AdminProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [actionLoading, setActionLoading] = useState(false)
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => { fetchProduct() }, [productId])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setProduct(data.product)
      }
    } catch (error) {
      console.error('Failed to fetch product:', error)
    } finally {
      setLoading(false)
    }
  }

  const moderate = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectionReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }
    try {
      setActionLoading(true)
      const token = localStorage.getItem('adminToken')
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          action,
          ...(action === 'reject' ? { rejectionReason: rejectionReason.trim() } : {}),
        }),
      })
      if (res.ok) {
        alert(action === 'approve' ? 'Product approved successfully!' : 'Product rejected successfully!')
        fetchProduct()
        setShowReasonInput(false)
        setRejectionReason('')
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.error || `Failed to ${action} product`)
      }
    } catch (error) {
      alert(`Failed to ${action} product`)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        alert('Product deleted successfully')
        router.push('/admin/products')
      } else {
        const data = await res.json().catch(() => null)
        alert(data?.error || 'Failed to delete product')
      }
    } catch {
      alert('Failed to delete product')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="py-24 text-center text-ink-secondary">
        <p className="mb-4">Product not found.</p>
        <button onClick={() => router.push('/admin/products')} className="text-primary font-semibold hover:underline">
          Back to products
        </button>
      </div>
    )
  }

  const { category, subcategory } = getCategoryDisplayInfo(product.categoryKey, product.subcategoryKey, product.category, product.subcategory)
  const images: string[] = product.images?.length ? product.images : ['/placeholder.png']
  const campaignActive = isValidCampaignKey(product.campaignTag)

  return (
    <div className="space-y-6 pb-16">
      <button
        onClick={() => router.push('/admin/products')}
        className="flex items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left: images + details ── */}
        <div className="space-y-6">
          <div className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="aspect-square bg-surface">
              <img src={images[activeImage]} alt={product.name} className="w-full h-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 ${activeImage === i ? 'border-primary' : 'border-transparent'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-border rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[product.moderationStatus] || ''}`}>
                {product.moderationStatus}
              </span>
              {product.isFlagged && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border bg-warning/10 text-warning border-warning/30">
                  <ShieldAlert className="w-3.5 h-3.5" /> Flagged
                </span>
              )}
              {campaignActive && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border bg-rose-500/10 text-rose-600 border-rose-200">
                  <Heart className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} /> {CAMPAIGNS[product.campaignTag as keyof typeof CAMPAIGNS].label}
                </span>
              )}
              {product.conditionType && (
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold border bg-surface text-ink-secondary border-border">
                  {product.conditionType}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-xl font-semibold text-ink">{product.name}</h1>
              <p className="text-sm text-ink-secondary mt-1">
                {category}{subcategory ? ` · ${subcategory}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-2xl font-semibold text-ink">{fmt(product.price)}</span>
              {product.basePrice && product.basePrice !== product.price && (
                <span className="text-sm text-ink-muted line-through">{fmt(product.basePrice)}</span>
              )}
              <span className="text-sm text-ink-secondary">Stock: {product.quantity}</span>
            </div>

            {product.moderationStatus === 'REJECTED' && product.rejectionReason && (
              <div className="rounded-xl border border-danger/30 bg-danger/10 p-3">
                <p className="text-xs font-semibold text-danger mb-1">Rejection Reason</p>
                <p className="text-xs text-danger/80">{product.rejectionReason}</p>
              </div>
            )}

            {product.isFlagged && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
                <p className="text-xs font-semibold text-warning mb-1">Flag Reason</p>
                <p className="text-xs text-warning/80">{product.flagReason || 'No reason provided.'}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm text-ink-secondary whitespace-pre-wrap">{product.description || 'No description provided.'}</p>
            </div>

            {product.attributeValues?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Specifications</p>
                <div className="flex flex-wrap gap-2">
                  {product.attributeValues.map((attr: any) => (
                    <span key={attr.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface text-xs font-medium text-ink-secondary">
                      <Tag className="w-3 h-3 text-ink-muted" />
                      {attr.label}: <span className="font-semibold text-ink">{Array.isArray(attr.value) ? attr.value.join(', ') : String(attr.value)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-ink-secondary">
                <Truck className="w-4 h-4 text-ink-muted" /> {product.deliveryEstimate || 'Not set'}
              </div>
              {product.estimatedWeightKg && (
                <div className="flex items-center gap-2 text-xs text-ink-secondary">
                  <Weight className="w-4 h-4 text-ink-muted" /> {product.estimatedWeightKg}kg
                </div>
              )}
              {product.dimensionsCm && (
                <div className="flex items-center gap-2 text-xs text-ink-secondary">
                  <Ruler className="w-4 h-4 text-ink-muted" />
                  {product.dimensionsCm.length}×{product.dimensionsCm.width}×{product.dimensionsCm.height}cm
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-ink-secondary">
                <MapPin className="w-4 h-4 text-ink-muted" /> {product.landmark || product.hostelName || 'Not set'}
              </div>
            </div>
          </div>

          {product.variants?.length > 0 && (
            <div className="bg-white border border-border rounded-2xl p-6">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
                Variants ({product.variants.length})
              </p>
              <div className="space-y-2">
                {product.variants.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(v.combination || {}).map(([key, value]) => (
                        <span key={key} className="px-2 py-0.5 rounded-full bg-surface text-[11px] font-medium text-ink-secondary">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs font-semibold text-ink">
                      <span>{fmt(v.price)}</span>
                      <span className="text-ink-secondary">Stock: {v.stock}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.productReports?.length > 0 && (
            <div className="bg-white border border-border rounded-2xl p-6">
              <p className="flex items-center gap-2 text-xs font-semibold text-warning uppercase tracking-wider mb-3">
                <Flag className="w-3.5 h-3.5" /> Reports ({product.productReports.length})
              </p>
              <div className="space-y-2">
                {product.productReports.map((r: any) => (
                  <div key={r.id} className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-ink-secondary">
                    <p>{r.reason || 'No reason provided.'}</p>
                    <p className="text-ink-muted mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: seller + actions ── */}
        <div className="space-y-6">
          <div className="bg-white border border-border rounded-2xl p-6 space-y-3">
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Seller</p>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">{(product.seller?.name || 'S')[0]}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{product.seller?.name}</p>
                {product.seller?.trustLevel && (
                  <span className="inline-flex items-center gap-1 text-xs text-primary font-semibold">
                    <BadgeCheck className="w-3 h-3" /> {product.seller.trustLevel}
                  </span>
                )}
              </div>
            </div>
            {product.seller?.avgRating > 0 && (
              <div className="flex items-center gap-1 text-sm text-ink-secondary">
                <Star className="w-3.5 h-3.5 text-warning fill-warning" /> {product.seller.avgRating.toFixed(1)} · {product.seller.completedOrders || 0} completed orders
              </div>
            )}
            {product.seller?.email && (
              <div className="flex items-center gap-2 text-xs text-ink-secondary">
                <Mail className="w-3.5 h-3.5 text-ink-muted" /> {product.seller.email}
              </div>
            )}
            {product.seller?.phone && (
              <div className="flex items-center gap-2 text-xs text-ink-secondary">
                <Phone className="w-3.5 h-3.5 text-ink-muted" /> {product.seller.phone}
              </div>
            )}
            {(product.seller?.hostelName || product.seller?.roomNumber) && (
              <div className="flex items-center gap-2 text-xs text-ink-secondary">
                <MapPin className="w-3.5 h-3.5 text-ink-muted" />
                {product.seller.hostelName}{product.seller.roomNumber ? `, Room ${product.seller.roomNumber}` : ''}
              </div>
            )}
            {product.seller?.isSuspended && (
              <p className="text-xs font-semibold text-danger">⚠ This seller is currently suspended</p>
            )}
            {product._count && (
              <div className="flex items-center gap-2 text-xs text-ink-secondary pt-2 border-t border-border">
                <Package className="w-3.5 h-3.5 text-ink-muted" /> {product._count.orders} order{product._count.orders === 1 ? '' : 's'} for this product
              </div>
            )}
          </div>

          {product.moderationStatus === 'PENDING' ? (
            <div className="bg-white border border-border rounded-2xl p-6 space-y-3">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Moderation</p>
              <button
                onClick={() => moderate('approve')}
                disabled={actionLoading}
                className="w-full px-4 py-3 bg-success/10 text-success hover:bg-success/20 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve Product
              </button>
              <button
                onClick={() => setShowReasonInput((v) => !v)}
                className="w-full px-4 py-3 bg-danger/10 text-danger hover:bg-danger/20 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Reject Product
              </button>
              {showReasonInput && (
                <div className="space-y-2">
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter rejection reason..."
                    maxLength={500}
                    rows={3}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-danger/40 resize-none"
                  />
                  <button
                    onClick={() => moderate('reject')}
                    disabled={actionLoading}
                    className="w-full px-4 py-2.5 bg-danger hover:brightness-95 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-border rounded-2xl p-6">
              <button
                onClick={handleDelete}
                className="w-full px-4 py-3 bg-danger/10 text-danger hover:bg-danger/20 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete Product
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
