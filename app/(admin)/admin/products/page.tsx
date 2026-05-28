// app/(admin)/admin/products/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Search, Trash2, Flag, PackageCheck, ShieldAlert } from 'lucide-react'

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
  _count?: { productReports: number }
  seller: {
    id: string
    name: string
  }
  createdAt: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'all' | 'flagged'>('all')

  useEffect(() => {
    fetchProducts()
  }, [viewMode])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/products${viewMode === 'flagged' ? '?flagged=true' : ''}`, {
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
      }
    } catch (error) {
      alert('Failed to delete product')
    }
  }

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/admin/products/${productId}/toggle`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (response.ok) {
        alert(`Product ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
        fetchProducts()
      }
    } catch (error) {
      alert('Failed to update product')
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
        <div className="flex rounded-xl border border-gray-700 bg-gray-800 p-1 w-full sm:w-auto">
          <button
            onClick={() => setViewMode('all')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex-1 sm:flex-none ${
              viewMode === 'all' ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            All
          </button>
          <button
            onClick={() => setViewMode('flagged')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex-1 sm:flex-none ${
              viewMode === 'flagged' ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Flag className="w-4 h-4" />
            Flagged
          </button>
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
            {viewMode === 'flagged' ? 'No flagged products found' : 'No products found'}
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
                {!product.isActive && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="px-4 py-2 bg-red-500 text-white rounded-full text-sm font-bold">
                      Inactive
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-white font-bold mb-1 line-clamp-2">{product.name}</h3>
                <p className="text-gray-400 text-sm mb-2">{product.category}</p>
                {product.isFlagged && (
                  <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Flagged by {product._count?.productReports || 1} user{(product._count?.productReports || 1) === 1 ? '' : 's'}
                    </p>
                    <p className="text-xs text-amber-100/80 line-clamp-3">
                      {product.flagReason || 'No reason provided.'}
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xl font-bold text-red-400">
                    ₦{product.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-400">Stock: {product.quantity}</span>
                </div>
                <p className="text-sm text-gray-400 mb-4">By: {product.seller.name}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(product.id, product.isActive)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      product.isActive
                        ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    }`}
                  >
                    {product.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(product.id)}
                    className="px-3 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                    aria-label={`Delete ${product.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
