// app/(admin)/admin/products/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trash2, Flag, PackageCheck, ShieldAlert, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import {
  AdminHeader, AdminEmpty, AdminButton, FilterTabs,
} from '@/components/admin/AdminUI'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'

interface Product {
  id: string
  name: string
  price: number
  category: string
  images: string[]
  isActive: boolean
  quantity: number
  isFlagged: boolean
  flagReason?: string | null
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string | null
  _count?: { productReports: number }
  seller: {
    id: string
    name: string
    email?: string
    phone?: string
  }
  createdAt: string
}

export default function ProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [moderationStatus, setModerationStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'all'>('PENDING')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState<{ [key: string]: string }>({})
  const [showReasonInput, setShowReasonInput] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    fetchProducts()
  }, [moderationStatus])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('adminToken')
      const statusParam = moderationStatus === 'all' ? 'all' : moderationStatus
      const response = await fetch(`/api/admin/products?status=${statusParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveProduct = async (productId: string) => {
    try {
      setProcessingId(productId)
      const token = localStorage.getItem('adminToken')
      const response = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          action: 'approve',
        }),
      })

      if (response.ok) {
        alert('Product approved successfully!')
        fetchProducts()
      } else {
        const data = await response.json().catch(() => null)
        alert(data?.error || 'Failed to approve product')
      }
    } catch (error) {
      alert('Failed to approve product')
      console.error('Error:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleRejectProduct = async (productId: string) => {
    const reason = rejectionReason[productId]?.trim()
    if (!reason) {
      alert('Please provide a rejection reason')
      return
    }

    try {
      setProcessingId(productId)
      const token = localStorage.getItem('adminToken')
      const response = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          action: 'reject',
          rejectionReason: reason,
        }),
      })

      if (response.ok) {
        alert('Product rejected successfully!')
        setRejectionReason({ ...rejectionReason, [productId]: '' })
        setShowReasonInput({ ...showReasonInput, [productId]: false })
        fetchProducts()
      } else {
        const data = await response.json().catch(() => null)
        alert(data?.error || 'Failed to reject product')
      }
    } catch (error) {
      alert('Failed to reject product')
      console.error('Error:', error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        alert('Product deleted successfully')
        fetchProducts()
      } else {
        const data = await response.json().catch(() => null)
        alert(data?.error || 'Failed to delete product')
      }
    } catch (error) {
      alert('Failed to delete product')
    }
  }

  const getStatusTone = (status: string): BadgeStatus => {
    if (status === 'PENDING') return 'warning'
    if (status === 'APPROVED') return 'success'
    if (status === 'REJECTED') return 'danger'
    return 'neutral'
  }

  const getStatusIcon = (status: string) => {
    if (status === 'APPROVED') return CheckCircle
    if (status === 'REJECTED') return XCircle
    return PackageCheck
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.seller.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Moderation"
        title="Products"
        description="Every listing awaiting review, plus what has already been approved or rejected."
        actions={
          <div className="flex h-9 w-full min-w-[14rem] items-center gap-2 border border-border bg-card px-3 sm:w-72">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, category, seller…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted focus:outline-none"
            />
          </div>
        }
      />

      <FilterTabs
        value={moderationStatus}
        onChange={(v) => setModerationStatus(v as typeof moderationStatus)}
        options={[
          { value: 'PENDING', label: 'Pending' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
          { value: 'all', label: 'All' },
        ]}
      />

      <div className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center bg-card py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full bg-card">
            <AdminEmpty
              className="border-0"
              icon={PackageCheck}
              title="No products here"
              description="Nothing matches this filter and search."
            />
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => router.push(`/admin/products/${product.id}`)}
              className="group cursor-pointer bg-card transition-colors duration-300 hover:bg-surface"
            >
              <div className="relative aspect-square overflow-hidden bg-surface">
                <img
                  src={product.images[0] || '/placeholder.png'}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
                <div className="absolute right-2.5 top-2.5">
                  <Badge
                    status={getStatusTone(product.moderationStatus)}
                    icon={getStatusIcon(product.moderationStatus)}
                  >
                    {product.moderationStatus}
                  </Badge>
                </div>
              </div>
              <div className="p-4">
                <p className="ui-mono ui-mono-sm text-ink-muted">{product.category}</p>
                <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-ink">
                  {product.name}
                </h3>

                {product.moderationStatus === 'REJECTED' && product.rejectionReason && (
                  <div className="mt-3.5 border border-danger/25 bg-danger/5 p-3">
                    <p className="ui-mono ui-mono-sm text-danger">Rejected because</p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-danger/80">
                      {product.rejectionReason}
                    </p>
                  </div>
                )}

                {product.isFlagged && (
                  <div className="mt-3.5 border border-warning/25 bg-warning/5 p-3">
                    <p className="ui-mono ui-mono-sm flex items-center gap-1.5 text-warning">
                      <ShieldAlert className="h-3 w-3" strokeWidth={2} />
                      Flagged by {product._count?.productReports || 1} user{(product._count?.productReports || 1) === 1 ? '' : 's'}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-warning/80">
                      {product.flagReason || 'No reason provided.'}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex items-baseline justify-between gap-3">
                  <span className="ui-figure text-lg text-ink">
                    ₦{product.price.toLocaleString()}
                  </span>
                  <span className="ui-mono ui-mono-sm text-ink-muted">
                    Stock {product.quantity}
                  </span>
                </div>

                <p className="mt-2.5 truncate text-xs text-ink-secondary">
                  {product.seller.name}
                  {product.seller.email && <span className="text-ink-muted"> · {product.seller.email}</span>}
                </p>

                {product.moderationStatus === 'PENDING' && (
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    <div className="flex gap-2">
                      <AdminButton
                        tone="success"
                        onClick={(e) => { e.stopPropagation(); handleApproveProduct(product.id) }}
                        disabled={processingId === product.id}
                        icon={processingId === product.id ? Loader2 : CheckCircle}
                        className="flex-1"
                      >
                        {processingId === product.id ? 'Approving…' : 'Approve'}
                      </AdminButton>
                      <AdminButton
                        onClick={(e) => { e.stopPropagation(); setShowReasonInput({ ...showReasonInput, [product.id]: !showReasonInput[product.id] }) }}
                        icon={XCircle}
                        className="flex-1"
                      >
                        Reject
                      </AdminButton>
                    </div>

                    {showReasonInput[product.id] && (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={rejectionReason[product.id] || ''}
                          onChange={(e) => setRejectionReason({ ...rejectionReason, [product.id]: e.target.value })}
                          placeholder="Why is this being rejected? The seller sees this."
                          maxLength={500}
                          className="w-full resize-none border border-border bg-card px-3 py-2.5 text-xs leading-relaxed text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger/15"
                          rows={3}
                        />
                        <AdminButton
                          tone="danger"
                          onClick={() => handleRejectProduct(product.id)}
                          disabled={processingId === product.id}
                          className="w-full"
                        >
                          {processingId === product.id ? 'Rejecting…' : 'Confirm rejection'}
                        </AdminButton>
                      </div>
                    )}
                  </div>
                )}

                {product.moderationStatus !== 'PENDING' && (
                  <div className="mt-4 border-t border-border pt-4">
                    <AdminButton
                      onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id) }}
                      icon={Trash2}
                      className="w-full hover:border-danger/40 hover:text-danger"
                    >
                      Delete
                    </AdminButton>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
