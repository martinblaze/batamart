// app/(admin)/admin/products/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Search, Trash2, Flag, PackageCheck, ShieldAlert, CheckCircle, XCircle, Loader2 } from 'lucide-react'

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
      case 'APPROVED':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'REJECTED':
        return 'bg-red-500/10 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="w-4 h-4" />
      case 'REJECTED':
        return <XCircle className="w-4 h-4" />
      default:
        return <PackageCheck className="w-4 h-4" />
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.seller.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex rounded-xl border border-gray-700 bg-gray-800 p-1 w-full sm:w-auto overflow-x-auto">
          {(['PENDING', 'APPROVED', 'REJECTED', 'all'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setModerationStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
                moderationStatus === status ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              {status === 'all' ? 'All Products' : status}
            </button>
          ))}
        </div>

        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            No {moderationStatus !== 'all' ? moderationStatus.toLowerCase() : ''} products found
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden hover:shadow-xl transition-all">
              <div className="relative aspect-square bg-gray-700">
                <img
                  src={product.images[0] || '/placeholder.png'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                <div className={`absolute top-2 right-2 px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${getStatusColor(product.moderationStatus)}`}>
                  {getStatusIcon(product.moderationStatus)}
                  {product.moderationStatus}
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-white font-bold mb-1 line-clamp-2">{product.name}</h3>
                <p className="text-gray-400 text-sm mb-2">{product.category}</p>

                {product.moderationStatus === 'REJECTED' && product.rejectionReason && (
                  <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-xs font-bold text-red-300 mb-1">Rejection Reason:</p>
                    <p className="text-xs text-red-100/80 line-clamp-2">{product.rejectionReason}</p>
                  </div>
                )}

                {product.isFlagged && (
                  <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Flagged by {product._count?.productReports || 1} user{(product._count?.productReports || 1) === 1 ? '' : 's'}
                    </p>
                    <p className="text-xs text-amber-100/80 line-clamp-2">
                      {product.flagReason || 'No reason provided.'}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-red-400">
                    ₦{product.price.toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-400">Stock: {product.quantity}</span>
                </div>

                <p className="text-xs text-gray-400 mb-3">
                  <strong>Seller:</strong> {product.seller.name}
                  {product.seller.email && <> ({product.seller.email})</>}
                </p>

                {product.moderationStatus === 'PENDING' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveProduct(product.id)}
                        disabled={processingId === product.id}
                        className="flex-1 px-3 py-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {processingId === product.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Approving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowReasonInput({ ...showReasonInput, [product.id]: !showReasonInput[product.id] })}
                        className="flex-1 px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>

                    {showReasonInput[product.id] && (
                      <div className="space-y-2">
                        <textarea
                          value={rejectionReason[product.id] || ''}
                          onChange={(e) => setRejectionReason({ ...rejectionReason, [product.id]: e.target.value })}
                          placeholder="Enter rejection reason..."
                          maxLength={500}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                          rows={3}
                        />
                        <button
                          onClick={() => handleRejectProduct(product.id)}
                          disabled={processingId === product.id}
                          className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {processingId === product.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Rejecting...
                            </>
                          ) : (
                            'Confirm Rejection'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {product.moderationStatus !== 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="flex-1 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors text-sm font-semibold"
                    >
                      <Trash2 className="w-4 h-4 inline mr-1" />
                      Delete
                    </button>
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
