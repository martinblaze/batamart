// app/(admin)/admin/disputes/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Eye } from 'lucide-react'
import {
  AdminHeader, AdminEmpty, AdminLoading, FilterTabs,
} from '@/components/admin/AdminUI'
import { Badge, type BadgeStatus } from '@/components/ui/Badge'

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

  const getStatusTone = (status: string): BadgeStatus => {
    switch (status) {
      case 'PENDING': return 'warning'
      case 'UNDER_REVIEW': return 'verified'
      case 'RESOLVED_BUYER_FAVOR':
      case 'RESOLVED_SELLER_FAVOR': return 'success'
      default: return 'neutral'
    }
  }

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Moderation"
        title="Disputes"
        description="Cases raised by buyers against a completed order. Review the evidence, then resolve or dismiss."
      />

      <FilterTabs
        value={filterStatus}
        onChange={setFilterStatus}
        options={[
          { value: 'PENDING', label: 'Pending' },
          { value: 'UNDER_REVIEW', label: 'Under review' },
          { value: 'ALL', label: 'All' },
        ]}
      />

      {loading ? (
        <AdminLoading rows={4} />
      ) : disputes.length === 0 ? (
        <AdminEmpty
          icon={AlertTriangle}
          title="No disputes here"
          description="Nothing matches this filter — try 'All' to see resolved and dismissed cases."
        />
      ) : (
        <div className="ui-divide border border-border bg-card">
          {disputes.map((dispute) => (
            <article key={dispute.id} className="p-5 transition-colors duration-300 hover:bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="ui-mono ui-mono-sm text-ink-muted">
                    #{dispute.order.orderNumber}
                  </p>
                  <p className="ui-figure mt-1.5 text-lg text-ink">
                    ₦{dispute.order.totalAmount.toLocaleString()}
                  </p>
                </div>
                <Badge status={getStatusTone(dispute.status)}>
                  {dispute.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              <p className="mt-5 max-w-[70ch] text-sm leading-relaxed text-ink-secondary">
                {dispute.reason}
              </p>

              <div className="mt-5 grid gap-px border border-border bg-border sm:grid-cols-2">
                <div className="bg-card px-3.5 py-2.5">
                  <p className="ui-mono ui-mono-sm text-ink-muted">Buyer</p>
                  <p className="mt-1 truncate text-sm text-ink">{dispute.buyer.name}</p>
                </div>
                <div className="bg-card px-3.5 py-2.5">
                  <p className="ui-mono ui-mono-sm text-ink-muted">Seller</p>
                  <p className="mt-1 truncate text-sm text-ink">{dispute.seller.name}</p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
                <span className="ui-mono ui-mono-sm text-ink-muted">
                  {new Date(dispute.createdAt).toLocaleDateString()}
                </span>
                <Link
                  href={`/admin/disputes/${dispute.id}`}
                  className="ui-mono ui-mono-sm inline-flex h-9 items-center gap-2 bg-ink px-4 text-background transition-colors hover:bg-ink/90"
                >
                  <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                  Review
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}