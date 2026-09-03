'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, Check, X, MapPin, Truck } from 'lucide-react'
import {
  AdminHeader, AdminPanel, AdminEmpty, AdminButton,
} from '@/components/admin/AdminUI'
import { Badge } from '@/components/ui/Badge'

type University = { id: string; name: string; shortName: string }
type Zone = { id: string; universityId: string; name: string; isActive: boolean }
type Route = {
  id: string
  zoneAId: string
  zoneBId: string
  price: number
  isActive: boolean
  zoneA: { id: string; name: string }
  zoneB: { id: string; name: string }
}

const SAME_ZONE_FEE = 1000
const RIDER_SHARE_PERCENT = 0.7
const PLATFORM_SHARE_PERCENT = 0.3
const REFERRAL_FLAT_BONUS = 120

function splitFee(fee: number) {
  return {
    rider: Math.round(fee * RIDER_SHARE_PERCENT),
    platform: Math.round(fee * PLATFORM_SHARE_PERCENT),
    referrer: REFERRAL_FLAT_BONUS,
  }
}

function authHeaders() {
  const token = localStorage.getItem('adminToken')
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export default function AdminDeliveryZonesPage() {
  const [universities, setUniversities] = useState<University[]>([])
  const [universityId, setUniversityId] = useState<string>('')
  const [zones, setZones] = useState<Zone[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newZoneName, setNewZoneName] = useState('')
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  const [editingZoneName, setEditingZoneName] = useState('')
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState('')

  const fetchZones = async (uniId?: string) => {
    const res = await fetch(`/api/admin/delivery-zones${uniId ? `?universityId=${uniId}` : ''}`, {
      headers: authHeaders(),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to load zones'); return }
    setUniversities(data.universities || [])
    setUniversityId(data.universityId || '')
    setZones(data.zones || [])
    return data.universityId as string | undefined
  }

  const fetchRoutes = async (uniId: string) => {
    if (!uniId) { setRoutes([]); return }
    const res = await fetch(`/api/admin/delivery-routes?universityId=${uniId}`, { headers: authHeaders() })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to load routes'); return }
    setRoutes(data.routes || [])
  }

  const loadAll = async (uniId?: string) => {
    setLoading(true)
    setError('')
    const resolvedUniId = await fetchZones(uniId)
    if (resolvedUniId) await fetchRoutes(resolvedUniId)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const routeByPair = useMemo(() => {
    const map = new Map<string, Route>()
    for (const r of routes) {
      map.set(`${r.zoneAId}|${r.zoneBId}`, r)
      map.set(`${r.zoneBId}|${r.zoneAId}`, r)
    }
    return map
  }, [routes])

  const handleUniversityChange = (id: string) => {
    setUniversityId(id)
    loadAll(id)
  }

  const addZone = async () => {
    if (!newZoneName.trim() || !universityId) return
    const res = await fetch('/api/admin/delivery-zones', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ universityId, name: newZoneName.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to create zone'); return }
    setNewZoneName('')
    loadAll(universityId)
  }

  const saveZoneName = async (zoneId: string) => {
    if (!editingZoneName.trim()) { setEditingZoneId(null); return }
    await fetch(`/api/admin/delivery-zones/${zoneId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ name: editingZoneName.trim() }),
    })
    setEditingZoneId(null)
    loadAll(universityId)
  }

  const toggleZoneActive = async (zone: Zone) => {
    await fetch(`/api/admin/delivery-zones/${zone.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ isActive: !zone.isActive }),
    })
    loadAll(universityId)
  }

  const deleteZone = async (zone: Zone) => {
    if (!confirm(`Delete "${zone.name}"? This also deletes every route connected to it.`)) return
    await fetch(`/api/admin/delivery-zones/${zone.id}`, { method: 'DELETE', headers: authHeaders() })
    loadAll(universityId)
  }

  const startEditCell = (zoneAId: string, zoneBId: string, currentPrice?: number) => {
    setEditingCellKey(`${zoneAId}|${zoneBId}`)
    setEditingPrice(currentPrice ? String(currentPrice) : '')
  }

  const saveCell = async (zoneAId: string, zoneBId: string) => {
    const price = Number(editingPrice)
    if (!Number.isFinite(price) || price <= 0) { setEditingCellKey(null); return }

    const existing = routeByPair.get(`${zoneAId}|${zoneBId}`)
    if (existing) {
      await fetch(`/api/admin/delivery-routes/${existing.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ price }),
      })
    } else {
      const res = await fetch('/api/admin/delivery-routes', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ zoneAId, zoneBId, price }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Failed to save route')
    }
    setEditingCellKey(null)
    fetchRoutes(universityId)
  }

  const deleteRoute = async (routeId: string) => {
    if (!confirm('Delete this route?')) return
    await fetch(`/api/admin/delivery-routes/${routeId}`, { method: 'DELETE', headers: authHeaders() })
    fetchRoutes(universityId)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    )
  }

  const activeZones = zones.filter(z => z.isActive)

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Logistics"
        title="Zones & routes"
        description={
          <>
            Riders take 70% of the delivery fee. A referrer takes a flat ₦{REFERRAL_FLAT_BONUS} when
            the buyer was referred, and BataMart keeps the rest. Same-zone deliveries are a flat
            ₦{SAME_ZONE_FEE}.
          </>
        }
        actions={
          universities.length > 1 ? (
            <select
              value={universityId}
              onChange={e => handleUniversityChange(e.target.value)}
              aria-label="University"
              className="h-9 cursor-pointer border border-border bg-card px-3 text-[13px] text-ink transition-colors hover:border-ink/25 focus:border-ink/40 focus:outline-none"
            >
              {universities.map(u => <option key={u.id} value={u.id}>{u.shortName}</option>)}
            </select>
          ) : undefined
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 border border-danger/25 bg-danger/5 px-4 py-3.5 text-sm text-danger">
          {error}
          <button onClick={() => setError('')} aria-label="Dismiss">
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {/* Zones list */}
      <AdminPanel
        title={`Zones · ${zones.length}`}
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {zones.map(zone => (
            <div
              key={zone.id}
              className={`flex items-center gap-2.5 border px-3 py-2 text-sm ${
                zone.isActive ? 'border-border bg-surface' : 'border-danger/20 bg-danger/5 opacity-70'
              }`}
            >
              {editingZoneId === zone.id ? (
                <>
                  <input
                    value={editingZoneName}
                    onChange={e => setEditingZoneName(e.target.value)}
                    className="w-28 border border-border bg-card px-2 py-1 text-xs text-ink focus:border-ink/40 focus:outline-none"
                    autoFocus
                  />
                  <button onClick={() => saveZoneName(zone.id)}><Check className="w-3.5 h-3.5 text-success" /></button>
                  <button onClick={() => setEditingZoneId(null)}><X className="w-3.5 h-3.5 text-ink-muted" /></button>
                </>
              ) : (
                <>
                  <span className="font-medium text-ink">{zone.name}</span>
                  <button onClick={() => { setEditingZoneId(zone.id); setEditingZoneName(zone.name) }}>
                    <Pencil className="w-3.5 h-3.5 text-ink-muted hover:text-primary" />
                  </button>
                  <button onClick={() => toggleZoneActive(zone)} title={zone.isActive ? 'Deactivate' : 'Activate'}>
                    <Badge status={zone.isActive ? 'success' : 'danger'}>
                      {zone.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                  <button onClick={() => deleteZone(zone)}>
                    <Trash2 className="w-3.5 h-3.5 text-ink-muted hover:text-danger" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-border pt-5">
          <input
            value={newZoneName}
            onChange={e => setNewZoneName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addZone()}
            placeholder="New zone name (e.g. Aroma)"
            className="h-9 max-w-xs flex-1 border border-border bg-card px-3 text-sm text-ink placeholder:text-ink-muted focus:border-ink/40 focus:outline-none"
          />
          <AdminButton tone="ink" onClick={addZone} disabled={!newZoneName.trim()} icon={Plus}>
            Add zone
          </AdminButton>
        </div>
      </AdminPanel>

      {/* Route price matrix */}
      <AdminPanel title="Route prices" className="overflow-x-auto">
        {activeZones.length < 2 ? (
          <p className="text-sm text-ink-secondary">
            Add at least two active zones before you can price routes between them.
          </p>
        ) : (
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="ui-mono ui-mono-sm sticky left-0 bg-card p-2 text-left font-medium text-ink-muted">Zone</th>
                {activeZones.map(z => (
                  <th key={z.id} className="ui-mono ui-mono-sm min-w-[110px] p-2 text-center font-medium text-ink-muted">{z.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeZones.map((rowZone, rowIdx) => (
                <tr key={rowZone.id}>
                  <td className="sticky left-0 border-t border-border bg-card p-2 text-sm font-medium text-ink">{rowZone.name}</td>
                  {activeZones.map((colZone, colIdx) => {
                    if (rowZone.id === colZone.id) {
                      return (
                        <td key={colZone.id} className="p-2 text-center border-t border-border text-ink-muted text-xs bg-surface">
                          ₦{SAME_ZONE_FEE}
                          <div className="text-[10px]">(same zone)</div>
                        </td>
                      )
                    }
                    if (colIdx < rowIdx) {
                      // Lower triangle mirrors the upper triangle — routes are bidirectional.
                      return <td key={colZone.id} className="p-2 text-center border-t border-border text-ink-muted text-xs">—</td>
                    }
                    const route = routeByPair.get(`${rowZone.id}|${colZone.id}`)
                    const cellKey = `${rowZone.id}|${colZone.id}`
                    const isEditing = editingCellKey === cellKey

                    return (
                      <td key={colZone.id} className="p-2 text-center border-t border-border">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              value={editingPrice}
                              onChange={e => setEditingPrice(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveCell(rowZone.id, colZone.id)}
                              className="w-20 border border-border bg-card px-1.5 py-1 text-xs text-ink focus:border-ink/40 focus:outline-none"
                              autoFocus
                            />
                            <button onClick={() => saveCell(rowZone.id, colZone.id)}><Check className="w-3.5 h-3.5 text-success" /></button>
                            <button onClick={() => setEditingCellKey(null)}><X className="w-3.5 h-3.5 text-ink-muted" /></button>
                          </div>
                        ) : route ? (
                          <button
                            onClick={() => startEditCell(rowZone.id, colZone.id, route.price)}
                            className="group w-full"
                            title="Click to edit"
                          >
                            <div className="ui-figure text-sm text-ink transition-colors group-hover:text-primary">₦{route.price.toLocaleString()}</div>
                            <div className="text-[10px] text-ink-muted">
                              R:₦{splitFee(route.price).rider} · P:₦{splitFee(route.price).platform}
                            </div>
                            {!route.isActive && <div className="text-[10px] text-danger">inactive</div>}
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditCell(rowZone.id, colZone.id)}
                            className="ui-mono ui-mono-sm text-ink-muted transition-colors hover:text-ink"
                          >
                            + Set
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminPanel>

      {/* Flat route list, useful for deleting / spotting inactive routes */}
      <AdminPanel title={`All routes · ${routes.length}`} padded={false}>
        {routes.length === 0 ? (
          <AdminEmpty
            className="border-0"
            icon={MapPin}
            title="No routes yet"
            description="Price a pair of zones in the matrix above and it appears here."
          />
        ) : (
          <div className="ui-divide">
            {routes.map(r => {
              const split = splitFee(r.price)
              return (
                <div key={r.id} className="ui-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm font-medium text-ink">
                        {r.zoneA.name} ↔ {r.zoneB.name}
                      </span>
                      <span className="ui-figure text-sm text-ink">
                        ₦{r.price.toLocaleString()}
                      </span>
                      {!r.isActive && <Badge status="danger">Inactive</Badge>}
                    </div>
                    <p className="mt-1.5 text-xs text-ink-muted">
                      Rider ₦{split.rider} · BataMart ₦{split.platform} gross, ₦{split.platform - split.referrer} net when the buyer was referred
                    </p>
                  </div>
                  <button
                    onClick={() => deleteRoute(r.id)}
                    aria-label="Delete route"
                    className="flex-shrink-0 text-ink-muted transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </AdminPanel>
    </div>
  )
}
