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
import { AdminPanel, AdminEmpty, AdminButton } from '@/components/admin/AdminUI'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'

const STATUS_TONES: Record<string, BadgeStatus> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    )
  }

  if (!product) {
    return (
      <AdminEmpty
        icon={Package}
        title="Product not found"
        description="This listing may have been deleted by its seller or removed in moderation."
        action={
          <AdminButton tone="ink" onClick={() => router.push('/admin/products')}>
            Back to products
          </AdminButton>
        }
      />
    )
  }

  const { category, subcategory } = getCategoryDisplayInfo(product.categoryKey, product.subcategoryKey, product.category, product.subcategory)
  const images: string[] = product.images?.length ? product.images : ['/placeholder.png']
  const campaignActive = isValidCampaignKey(product.campaignTag)

  return (
    <div className="space-y-6 pb-16">
      <button
        onClick={() => router.push('/admin/products')}
        className="group ui-mono ui-mono-sm inline-flex items-center gap-2 text-ink-secondary transition-colors hover:text-ink"
      >
        <ArrowLeft
          className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
          strokeWidth={2}
        />
        Back to products
      </button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left: images + details ── */}
        <div className="space-y-6">
          <div className="border border-border bg-card">
            <div className="aspect-square bg-surface">
              <img src={images[activeImage]} alt={product.name} className="h-full w-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden border transition-colors ${activeImage === i ? 'border-ink' : 'border-border'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ui-panel space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={STATUS_TONES[product.moderationStatus] ?? 'neutral'}>
                {product.moderationStatus}
              </Badge>
              {product.isFlagged && (
                <Badge status="warning" icon={ShieldAlert}>Flagged</Badge>
              )}
              {campaignActive && (
                <Badge status="campaign" icon={Heart}>
                  {CAMPAIGNS[product.campaignTag as keyof typeof CAMPAIGNS].label}
                </Badge>
              )}
              {product.conditionType && (
                <Badge status="neutral">{product.conditionType}</Badge>
              )}
            </div>

            <div>
              <p className="ui-mono ui-mono-sm text-ink-muted">
                {category}{subcategory ? ` · ${subcategory}` : ''}
              </p>
              <h1 className="mt-2 text-[clamp(1.25rem,2.6vw,1.6rem)] leading-tight text-ink">
                {product.name}
              </h1>
            </div>

            <div className="flex flex-wrap items-baseline gap-4">
              <span className="ui-figure text-2xl text-ink">{fmt(product.price)}</span>
              {product.basePrice && product.basePrice !== product.price && (
                <span className="text-sm text-ink-muted line-through">{fmt(product.basePrice)}</span>
              )}
              <span className="ui-mono ui-mono-sm text-ink-muted">Stock {product.quantity}</span>
            </div>

            {product.moderationStatus === 'REJECTED' && product.rejectionReason && (
              <div className="border border-danger/25 bg-danger/5 p-3.5">
                <p className="ui-mono ui-mono-sm text-danger">Rejected because</p>
                <p className="mt-1.5 text-xs leading-relaxed text-danger/80">{product.rejectionReason}</p>
              </div>
            )}

            {product.isFlagged && (
              <div className="border border-warning/25 bg-warning/5 p-3.5">
                <p className="ui-mono ui-mono-sm text-warning">Flagged because</p>
                <p className="mt-1.5 text-xs leading-relaxed text-warning/80">
                  {product.flagReason || 'No reason provided.'}
                </p>
              </div>
            )}

            <div>
              <p className="ui-eyebrow mb-3">Description</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">
                {product.description || 'No description provided.'}
              </p>
            </div>

            {product.attributeValues?.length > 0 && (
              <div>
                <p className="ui-eyebrow mb-3">Specifications</p>
                <div className="flex flex-wrap gap-1.5">
                  {product.attributeValues.map((attr: any) => (
                    <span key={attr.id} className="inline-flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1 text-xs text-ink-secondary">
                      <Tag className="h-3 w-3 text-ink-muted" strokeWidth={1.75} />
                      {attr.label}: <span className="font-medium text-ink">{Array.isArray(attr.value) ? attr.value.join(', ') : String(attr.value)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
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
            <AdminPanel title={`Variants · ${product.variants.length}`} padded={false}>
              <div className="ui-divide">
                {product.variants.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(v.combination || {}).map(([key, value]) => (
                        <span key={key} className="border border-border bg-surface px-2 py-0.5 text-[11px] text-ink-secondary">
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3 text-xs">
                      <span className="ui-figure text-[13px] text-ink">{fmt(v.price)}</span>
                      <span className="ui-mono ui-mono-sm text-ink-muted">Stock {v.stock}</span>
                    </div>
                  </div>
                ))}
              </div>
            </AdminPanel>
          )}

          {product.productReports?.length > 0 && (
            <AdminPanel title={`Reports · ${product.productReports.length}`} padded={false}>
              <div className="ui-divide">
                {product.productReports.map((r: any) => (
                  <div key={r.id} className="p-4">
                    <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-secondary">
                      <Flag className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" strokeWidth={1.75} />
                      {r.reason || 'No reason provided.'}
                    </p>
                    <p className="ui-mono ui-mono-sm mt-2 pl-5 text-ink-muted">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </AdminPanel>
          )}
        </div>

        {/* ── Right: seller + actions ── */}
        <div className="space-y-6">
          <div className="ui-panel space-y-3.5">
            <p className="ui-eyebrow mb-5">Seller</p>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center bg-ink">
                <span className="font-display font-bold text-white">{(product.seller?.name || 'S')[0]}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{product.seller?.name}</p>
                {product.seller?.trustLevel && (
                  <span className="ui-mono ui-mono-sm mt-1 inline-flex items-center gap-1 text-ink-secondary">
                    <BadgeCheck className="h-3 w-3" strokeWidth={2} /> {product.seller.trustLevel}
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
              <div className="border border-danger/25 bg-danger/5 px-3 py-2">
                <p className="text-xs font-medium text-danger">This seller is currently suspended.</p>
              </div>
            )}
            {product._count && (
              <div className="flex items-center gap-2 text-xs text-ink-secondary pt-2 border-t border-border">
                <Package className="w-3.5 h-3.5 text-ink-muted" /> {product._count.orders} order{product._count.orders === 1 ? '' : 's'} for this product
              </div>
            )}
          </div>

          {product.moderationStatus === 'PENDING' ? (
            <div className="ui-panel space-y-2.5">
              <p className="ui-eyebrow mb-5">Moderation</p>
              <AdminButton
                tone="success"
                onClick={() => moderate('approve')}
                disabled={actionLoading}
                icon={actionLoading ? Loader2 : CheckCircle}
                className="h-11 w-full"
              >
                Approve product
              </AdminButton>
              <AdminButton
                onClick={() => setShowReasonInput((v) => !v)}
                icon={XCircle}
                className="h-11 w-full hover:border-danger/40 hover:text-danger"
              >
                Reject product
              </AdminButton>
              {showReasonInput && (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Why is this being rejected? The seller sees this."
                    maxLength={500}
                    rows={3}
                    className="w-full resize-none border border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/15"
                  />
                  <AdminButton
                    tone="danger"
                    onClick={() => moderate('reject')}
                    disabled={actionLoading}
                    className="h-11 w-full"
                  >
                    {actionLoading ? 'Rejecting…' : 'Confirm rejection'}
                  </AdminButton>
                </div>
              )}
            </div>
          ) : (
            <div className="ui-panel">
              <p className="ui-eyebrow mb-5">Danger zone</p>
              <AdminButton
                onClick={handleDelete}
                icon={Trash2}
                className="h-11 w-full hover:border-danger/40 hover:text-danger"
              >
                Delete product
              </AdminButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
