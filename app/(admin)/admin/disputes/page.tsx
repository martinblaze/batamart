// app/(admin)/admin/disputes/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Clock, CheckCircle, Eye } from 'lucide-react'

interface Dispute {
  id: string
  status: string
  reason: string
  createdAt: string
  buyer: { id: string; name: string }
  seller: { id: string; name: string }
  order: { id: string; orderNumber: string; totalAmount: number }
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('PENDING')

  useEffect(() => {
    fetchDisputes()
  }, [filterStatus])

  const fetchDisputes = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const url = filterStatus === 'ALL' 
        ? '/api/admin/disputes'
        : `/api/admin/disputes?status=${filterStatus}`
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setDisputes(data.disputes)
      }
    } catch (error) {
      console.error('Failed to fetch disputes:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-warning/10 text-warning'
      case 'UNDER_REVIEW': return 'bg-primary/10 text-primary'
      case 'RESOLVED_BUYER_FAVOR': return 'bg-success/10 text-success'
      case 'RESOLVED_SELLER_FAVOR': return 'bg-success/10 text-success'
      case 'DISMISSED': return 'bg-surface text-ink-secondary'
      default: return 'bg-surface text-ink-secondary'
    }
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {['PENDING', 'UNDER_REVIEW', 'ALL'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-6 py-3 rounded-xl font-semibold whitespace-nowrap transition-all ${
              filterStatus === status
                ? 'bg-danger text-white'
                : 'bg-white text-ink-secondary hover:text-ink border border-border'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Disputes List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
          </div>
        ) : disputes.length === 0 ? (
          <div className="text-center py-12 bg-white border border-border rounded-2xl">
            <AlertTriangle className="w-16 h-16 text-ink-muted mx-auto mb-4" />
            <p className="text-ink-secondary">No disputes found</p>
          </div>
        ) : (
          disputes.map((dispute) => (
            <div key={dispute.id} className="bg-white border border-border rounded-2xl p-6 hover:shadow-soft transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-warning/10 rounded-xl">
                    <AlertTriangle className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <h3 className="text-ink font-semibold">Order #{dispute.order.orderNumber}</h3>
                    <p className="text-sm text-ink-secondary">
                      Amount: ₦{dispute.order.totalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(dispute.status)}`}>
                  {dispute.status.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-ink-secondary">Buyer:</p>
                  <p className="text-ink font-medium">{dispute.buyer.name}</p>
                </div>
                <div>
                  <p className="text-ink-secondary">Seller:</p>
                  <p className="text-ink font-medium">{dispute.seller.name}</p>
                </div>
              </div>

              <p className="text-ink-secondary mb-4">{dispute.reason}</p>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <span className="text-sm text-ink-muted">
                  {new Date(dispute.createdAt).toLocaleDateString()}
                </span>
                <Link
                  href={`/admin/disputes/${dispute.id}`}
                  className="px-4 py-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/10 transition-colors font-semibold text-sm flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Review
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}