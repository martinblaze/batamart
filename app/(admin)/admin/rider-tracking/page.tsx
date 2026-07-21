'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, Crosshair, Loader2, MapPin, Navigation, Phone, Route, Search } from 'lucide-react'

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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Rider GPS Records</h1>
          <p className="text-sm text-ink-secondary mt-0.5">Track rider movement per delivered/completed order.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2 min-w-[260px]">
            <Search className="w-4 h-4 text-ink-muted" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search order, rider, product..."
              className="bg-transparent text-sm text-ink outline-none flex-1"
            />
          </div>
          <button
            onClick={() => { setPage(1); setSearch(searchInput.trim()) }}
            className="px-4 py-2 rounded-xl bg-danger hover:brightness-95 text-white text-sm font-semibold"
          >
            Filter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm text-ink-secondary font-semibold">Delivered Orders with Tracking Data</p>
          </div>
          {loading ? (
            <div className="p-8 flex items-center justify-center text-ink-secondary">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading records...
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-ink-secondary">No tracking records found.</div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row: any) => {
                const active = selectedOrderId === row.id
                return (
                  <button
                    key={row.id}
                    onClick={() => setSelectedOrderId(row.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-surface/40 transition-colors ${
                      active ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={row.product?.images?.[0] || '/placeholder.png'}
                        alt={row.product?.name || 'Product'}
                        className="w-12 h-12 rounded-lg object-cover bg-surface"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{row.product?.name || 'Product'}</p>
                        <p className="text-xs text-ink-secondary mt-0.5">
                          #{row.orderNumber} • Rider: {row.rider?.name || 'N/A'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-ink-secondary">
                          <span className="inline-flex items-center gap-1">
                            <Crosshair className="w-3.5 h-3.5 text-primary" />
                            {row.trackingSummary?.totalPings || 0} pings
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Route className="w-3.5 h-3.5 text-primary" />
                            {row.trackingSummary?.checkpointCount || 0} checkpoints
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-warning" />
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

          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-ink-secondary">
              Page {page} of {totalPages} • {total} total orders
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs bg-surface text-ink-secondary disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-xs bg-surface text-ink-secondary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white border border-border rounded-2xl p-4">
          {!selectedOrderId ? (
            <div className="h-full flex items-center justify-center text-ink-secondary text-sm">
              Select an order to view full GPS trail.
            </div>
          ) : detailLoading ? (
            <div className="h-full flex items-center justify-center text-ink-secondary text-sm">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading order trail...
            </div>
          ) : !detail ? (
            <div className="h-full flex items-center justify-center text-ink-secondary text-sm">
              Failed to load this order trail.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-ink-secondary">Order</p>
                <p className="text-ink font-semibold">#{detail.order?.orderNumber}</p>
                <p className="text-xs text-ink-secondary mt-0.5">{detail.order?.product?.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface/60 rounded-xl p-3">
                  <p className="text-[11px] text-ink-secondary">Rider</p>
                  <p className="text-sm text-ink font-semibold">{detail.order?.rider?.name || 'N/A'}</p>
                  <p className="text-xs text-ink-secondary inline-flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" /> {detail.order?.rider?.phone || 'N/A'}
                  </p>
                </div>
                <div className="bg-surface/60 rounded-xl p-3">
                  <p className="text-[11px] text-ink-secondary">GPS Pings</p>
                  <p className="text-sm text-primary font-semibold">{detail.tracking?.totalPings || 0}</p>
                  <p className="text-xs text-ink-secondary mt-0.5">{fmtDate(detail.tracking?.latestPoint?.at)}</p>
                </div>
              </div>

              {mapEmbed ? (
                <div className="rounded-xl overflow-hidden border border-border">
                  <iframe title="Admin rider GPS map" src={mapEmbed} className="w-full h-52" loading="lazy" />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-surface p-3 text-sm text-ink-secondary">
                  No GPS coordinates saved for this order.
                </div>
              )}

              <div>
                <p className="text-xs text-ink-secondary uppercase tracking-wide font-semibold mb-2 inline-flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-primary" />
                  Checkpoints
                </p>
                <div className="space-y-2 max-h-52 overflow-auto pr-1">
                  {(detail.tracking?.checkpoints || []).map((checkpoint: any) => (
                    <div key={checkpoint.id} className="bg-surface/60 rounded-lg px-3 py-2">
                      <p className="text-sm text-ink">{checkpointLabel(checkpoint)}</p>
                      <p className="text-xs text-ink-secondary mt-0.5">{fmtDate(checkpoint.at)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-ink-secondary uppercase tracking-wide font-semibold mb-2 inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  GPS Trail (latest first)
                </p>
                <div className="space-y-2 max-h-56 overflow-auto pr-1">
                  {[...(detail.tracking?.points || [])].reverse().slice(0, 30).map((point: any) => (
                    <div key={point.id} className="bg-surface/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-primary font-semibold">
                        {point.lat?.toFixed(6)}, {point.lng?.toFixed(6)}
                      </p>
                      <p className="text-xs text-ink-secondary mt-0.5">{fmtDate(point.at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
