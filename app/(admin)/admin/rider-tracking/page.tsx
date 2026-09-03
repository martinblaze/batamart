'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, Crosshair, Loader2, MapPin, Navigation, Phone, Route, Search } from 'lucide-react'
import {
  AdminHeader, AdminPanel, AdminEmpty, AdminButton,
} from '@/components/admin/AdminUI'

function fmtDate(date?: string | null) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleString()
}

function checkpointLabel(checkpoint: any) {
  if (checkpoint?.status === 'RIDER_ASSIGNED') return 'Rider accepted order'
  if (checkpoint?.status === 'PICKED_UP') return 'Item picked up'
  if (checkpoint?.status === 'ON_THE_WAY') return 'Rider on the way'
  if (checkpoint?.status === 'DELIVERED') return 'Marked delivered'
  if (checkpoint?.action === 'RIDER_TRACKING_STARTED') return 'Live tracking started'
  return checkpoint?.status?.replace(/_/g, ' ') || checkpoint?.action || 'Update'
}

export default function AdminRiderTrackingPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total])

  const fetchRows = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      if (search) qs.set('search', search)

      const res = await fetch(`/api/admin/rider-tracking?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setRows(data.rows || [])
        setTotal(data.total || 0)
      } else {
        setRows([])
      }
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const fetchDetail = async (orderId: string) => {
    setDetailLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(`/api/admin/rider-tracking?orderId=${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setDetail(data)
      } else {
        setDetail(null)
      }
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search])

  useEffect(() => {
    if (!selectedOrderId) {
      setDetail(null)
      return
    }
    fetchDetail(selectedOrderId)
  }, [selectedOrderId])

  const latestPoint = detail?.tracking?.latestPoint || null
  const mapEmbed = latestPoint
    ? `https://www.google.com/maps?q=${latestPoint.lat},${latestPoint.lng}&z=16&output=embed`
    : null

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Logistics"
        title="Rider GPS records"
        description="Movement captured per delivered or completed order — pings, checkpoints, and the full trail."
        actions={
          <>
            <div className="flex h-9 w-full min-w-[15rem] items-center gap-2 border border-border bg-card px-3 sm:w-72">
              <Search className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { setPage(1); setSearch(searchInput.trim()) }
                }}
                placeholder="Search order, rider, product…"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted focus:outline-none"
              />
            </div>
            <AdminButton
              tone="ink"
              onClick={() => { setPage(1); setSearch(searchInput.trim()) }}
            >
              Filter
            </AdminButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* ── Order list ────────────────────────────────────────────────── */}
        <div className="xl:col-span-3">
          <AdminPanel title="Orders with tracking data" padded={false}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-ink-secondary">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading records…
              </div>
            ) : rows.length === 0 ? (
              <AdminEmpty
                className="border-0"
                icon={Crosshair}
                title="No tracking records"
                description="Nothing matches this search. Delivered orders appear here once a rider has logged GPS data."
              />
            ) : (
              <div className="ui-divide">
                {rows.map((row: any) => {
                  const active = selectedOrderId === row.id
                  return (
                    <button
                      key={row.id}
                      onClick={() => setSelectedOrderId(row.id)}
                      aria-pressed={active}
                      className={`relative w-full px-4 py-3.5 text-left transition-colors duration-300 hover:bg-surface ${
                        active
                          ? 'bg-surface before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-ink'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <img
                          src={row.product?.images?.[0] || '/placeholder.png'}
                          alt=""
                          className="h-12 w-12 flex-shrink-0 bg-surface object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {row.product?.name || 'Product'}
                          </p>
                          <p className="ui-mono ui-mono-sm mt-1.5 text-ink-muted">
                            #{row.orderNumber} · {row.rider?.name || 'No rider'}
                          </p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-secondary">
                            <span className="inline-flex items-center gap-1.5">
                              <Crosshair className="h-3 w-3 text-ink-muted" strokeWidth={1.75} />
                              {row.trackingSummary?.totalPings || 0} pings
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Route className="h-3 w-3 text-ink-muted" strokeWidth={1.75} />
                              {row.trackingSummary?.checkpointCount || 0} checkpoints
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-ink-muted" strokeWidth={1.75} />
                              {fmtDate(row.deliveredAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
              <p className="ui-mono ui-mono-sm text-ink-muted">
                Page {page} / {totalPages} · {total} orders
              </p>
              <div className="flex items-center gap-2">
                <AdminButton
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </AdminButton>
                <AdminButton
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </AdminButton>
              </div>
            </div>
          </AdminPanel>
        </div>

        {/* ── Trail detail ──────────────────────────────────────────────── */}
        <div className="xl:col-span-2">
          <AdminPanel title="Trail" className="xl:sticky xl:top-6">
            {!selectedOrderId ? (
              <p className="py-10 text-center text-sm text-ink-secondary">
                Select an order to view its full GPS trail.
              </p>
            ) : detailLoading ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-ink-secondary">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading trail…
              </p>
            ) : !detail ? (
              <p className="py-10 text-center text-sm text-ink-secondary">
                Failed to load this order trail.
              </p>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="ui-mono ui-mono-sm text-ink-muted">Order</p>
                  <p className="ui-figure mt-1.5 text-lg text-ink">
                    #{detail.order?.orderNumber}
                  </p>
                  <p className="mt-1 text-xs text-ink-secondary">{detail.order?.product?.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-px border border-border bg-border">
                  <div className="bg-card px-3.5 py-3">
                    <p className="ui-mono ui-mono-sm text-ink-muted">Rider</p>
                    <p className="mt-1.5 truncate text-sm text-ink">
                      {detail.order?.rider?.name || 'N/A'}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-secondary">
                      <Phone className="h-3 w-3" strokeWidth={1.75} />
                      {detail.order?.rider?.phone || 'N/A'}
                    </p>
                  </div>
                  <div className="bg-card px-3.5 py-3">
                    <p className="ui-mono ui-mono-sm text-ink-muted">GPS pings</p>
                    <p className="ui-figure mt-1.5 text-lg text-ink">
                      {detail.tracking?.totalPings || 0}
                    </p>
                    <p className="mt-1 text-xs text-ink-secondary">
                      {fmtDate(detail.tracking?.latestPoint?.at)}
                    </p>
                  </div>
                </div>

                {mapEmbed ? (
                  <div className="overflow-hidden border border-border">
                    <iframe
                      title="Admin rider GPS map"
                      src={mapEmbed}
                      className="h-52 w-full"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <p className="border border-dashed border-border bg-surface px-3.5 py-3 text-sm text-ink-secondary">
                    No GPS coordinates saved for this order.
                  </p>
                )}

                <div>
                  <p className="ui-eyebrow mb-3">
                    <Navigation className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Checkpoints
                  </p>
                  <div className="ui-divide max-h-52 overflow-auto border border-border">
                    {(detail.tracking?.checkpoints || []).map((checkpoint: any) => (
                      <div key={checkpoint.id} className="bg-card px-3.5 py-2.5">
                        <p className="text-sm text-ink">{checkpointLabel(checkpoint)}</p>
                        <p className="ui-mono ui-mono-sm mt-1 text-ink-muted">
                          {fmtDate(checkpoint.at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="ui-eyebrow mb-3">
                    <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                    GPS trail
                  </p>
                  <div className="ui-divide max-h-56 overflow-auto border border-border">
                    {[...(detail.tracking?.points || [])].reverse().slice(0, 30).map((point: any) => (
                      <div key={point.id} className="bg-card px-3.5 py-2.5">
                        <p className="ui-figure text-xs text-ink">
                          {point.lat?.toFixed(6)}, {point.lng?.toFixed(6)}
                        </p>
                        <p className="ui-mono ui-mono-sm mt-1 text-ink-muted">{fmtDate(point.at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </AdminPanel>
        </div>
      </div>
    </div>
  )
}
