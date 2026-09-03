'use client'

import { useEffect, useMemo, useState } from 'react'
import { PackageX, ShieldAlert, UserX, ExternalLink } from 'lucide-react'
import {
  AdminHeader, AdminPanel, AdminEmpty, AdminLoading, AdminButton,
} from '@/components/admin/AdminUI'
import { Badge } from '@/components/ui/Badge'

export default function AdminOversizedPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const token = localStorage.getItem('adminToken')
    const res = await fetch('/api/admin/oversized', { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const usersById = useMemo(
    () => Object.fromEntries((data?.users || []).map((u: any) => [u.id, u.name])),
    [data]
  )
  const productsById = useMemo(
    () => Object.fromEntries((data?.products || []).map((p: any) => [p.id, p])),
    [data]
  )

  const moderate = async (productId: string, action: 'APPROVE' | 'REMOVE') => {
    const token = localStorage.getItem('adminToken')
    await fetch('/api/admin/oversized', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, action }),
    })
    fetchData()
  }

  const declines = data?.declines || []
  const strikes = data?.strikes || []
  const suspended = data?.suspendedSellers || []

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Moderation"
        title="Oversized listings"
        description="Items riders refused to carry. Approve the listing if the rider was wrong, or remove it if the seller misrepresented the size."
      />

      {loading ? (
        <AdminLoading rows={3} />
      ) : (
        <>
          {/* ── Decline evidence ────────────────────────────────────────── */}
          <AdminPanel title="Decline evidence" padded={false}>
            {declines.length === 0 ? (
              <AdminEmpty
                className="border-0"
                icon={PackageX}
                title="No pending declines"
                description="When a rider refuses an item as oversized, their evidence lands here for review."
              />
            ) : (
              <div className="ui-divide">
                {declines.map((d: any) => (
                  <div key={d.id} className="p-5">
                    <p className="text-sm font-medium text-ink">
                      {productsById[d.productId]?.name || d.productId}
                    </p>

                    <div className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-2">
                      <div className="bg-card px-3.5 py-2.5">
                        <p className="ui-mono ui-mono-sm text-ink-muted">Seller</p>
                        <p className="mt-1 truncate text-sm text-ink">
                          {usersById[d.sellerId] || d.sellerId}
                        </p>
                      </div>
                      <div className="bg-card px-3.5 py-2.5">
                        <p className="ui-mono ui-mono-sm text-ink-muted">Rider</p>
                        <p className="mt-1 truncate text-sm text-ink">
                          {usersById[d.riderId] || d.riderId}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="ui-mono ui-mono-sm text-ink-muted">Reason given</p>
                      <p className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-ink-secondary">
                        {d.reason}
                      </p>
                    </div>

                    {d.proofImageUrl && (
                      <a
                        className="ui-mono ui-mono-sm mt-4 inline-flex items-center gap-1.5 text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline"
                        href={d.proofImageUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                        View proof photo
                      </a>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                      <AdminButton tone="success" onClick={() => moderate(d.productId, 'APPROVE')}>
                        Approve listing
                      </AdminButton>
                      <AdminButton tone="danger" onClick={() => moderate(d.productId, 'REMOVE')}>
                        Remove listing
                      </AdminButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>

          {/* ── Strike history ──────────────────────────────────────────── */}
          <AdminPanel title="Seller strike history" padded={false}>
            {strikes.length === 0 ? (
              <AdminEmpty
                className="border-0"
                icon={ShieldAlert}
                title="No strikes recorded"
                description="Sellers accumulate a strike each time a listing is removed for misrepresentation."
              />
            ) : (
              <div className="ui-divide">
                {strikes.map((s: any) => (
                  <div key={s.id} className="ui-row">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        {usersById[s.sellerId] || s.sellerId}
                      </p>
                      <p className="mt-1 text-xs text-ink-secondary">{s.reason}</p>
                    </div>
                    <Badge status={s.strikeCount >= 3 ? 'danger' : 'warning'}>
                      Strike {s.strikeCount}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>

          {/* ── Suspended sellers ───────────────────────────────────────── */}
          <AdminPanel title="Suspended sellers" padded={false}>
            {suspended.length === 0 ? (
              <AdminEmpty
                className="border-0"
                icon={UserX}
                title="Nobody suspended"
                description="Sellers suspended for repeated oversized violations appear here."
              />
            ) : (
              <div className="ui-divide">
                {suspended.map((u: any) => (
                  <div key={u.id} className="ui-row">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{u.name}</p>
                      <p className="mt-1 text-xs text-ink-secondary">
                        {u.suspensionReason || 'Suspended'}
                      </p>
                    </div>
                    <Badge status={u.suspendedUntil ? 'warning' : 'danger'}>
                      {u.suspendedUntil
                        ? `Until ${new Date(u.suspendedUntil).toLocaleDateString()}`
                        : 'Permanent'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </AdminPanel>
        </>
      )}
    </div>
  )
}
