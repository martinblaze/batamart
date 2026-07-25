'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, Check, X, MapPin, Truck } from 'lucide-react'

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

  if (loading) return <div className="text-ink-secondary">Loading delivery zones...</div>

  const activeZones = zones.filter(z => z.isActive)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" /> Delivery Zones & Routes
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Rider gets 70% of the delivery fee, referrer gets ₦{REFERRAL_FLAT_BONUS} flat (if the buyer was referred),
            Batamart keeps the remaining 30%. Same-zone deliveries are a flat ₦{SAME_ZONE_FEE}.
          </p>
        </div>

        {universities.length > 1 && (
          <select
            value={universityId}
            onChange={e => handleUniversityChange(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {universities.map(u => <option key={u.id} value={u.id}>{u.shortName}</option>)}
          </select>
        )}
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl px-4 py-3 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Zones list */}
      <div className="bg-white border border-border rounded-2xl p-5">
        <h2 className="text-ink font-semibold mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> Zones ({zones.length})
        </h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {zones.map(zone => (
            <div
              key={zone.id}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm border ${
                zone.isActive ? 'bg-surface border-border' : 'bg-danger/5 border-danger/20 opacity-60'
              }`}
            >
              {editingZoneId === zone.id ? (
                <>
                  <input
                    value={editingZoneName}
                    onChange={e => setEditingZoneName(e.target.value)}
                    className="border border-border rounded px-2 py-1 text-xs w-28"
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
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${zone.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {zone.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                  <button onClick={() => deleteZone(zone)}>
                    <Trash2 className="w-3.5 h-3.5 text-ink-muted hover:text-danger" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={newZoneName}
            onChange={e => setNewZoneName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addZone()}
            placeholder="New zone name (e.g. Aroma)"
            className="border border-border rounded-lg px-3 py-2 text-sm flex-1 max-w-xs"
          />
          <button
            onClick={addZone}
            disabled={!newZoneName.trim()}
            className="flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Zone
          </button>
        </div>
      </div>

      {/* Route price matrix */}
      <div className="bg-white border border-border rounded-2xl p-5 overflow-x-auto">
        <h2 className="text-ink font-semibold mb-3">Route Prices</h2>
        {activeZones.length < 2 ? (
          <p className="text-sm text-ink-muted">Add at least 2 active zones to start pricing routes.</p>
        ) : (
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left p-2 text-ink-muted font-semibold sticky left-0 bg-white">Zone</th>
                {activeZones.map(z => (
                  <th key={z.id} className="p-2 text-ink-muted font-semibold text-center min-w-[110px]">{z.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeZones.map((rowZone, rowIdx) => (
                <tr key={rowZone.id}>
                  <td className="p-2 font-semibold text-ink sticky left-0 bg-white border-t border-border">{rowZone.name}</td>
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
                              className="border border-border rounded px-1.5 py-1 text-xs w-20"
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
                            <div className="font-semibold text-ink group-hover:text-primary">₦{route.price.toLocaleString()}</div>
                            <div className="text-[10px] text-ink-muted">
                              R:₦{splitFee(route.price).rider} · P:₦{splitFee(route.price).platform}
                            </div>
                            {!route.isActive && <div className="text-[10px] text-danger">inactive</div>}
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditCell(rowZone.id, colZone.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            + Set price
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
      </div>

      {/* Flat route list, useful for deleting / spotting inactive routes */}
      <div className="bg-white border border-border rounded-2xl p-5">
        <h2 className="text-ink font-semibold mb-3">All Routes ({routes.length})</h2>
        <div className="space-y-2">
          {routes.map(r => {
            const split = splitFee(r.price)
            return (
              <div key={r.id} className="flex items-center justify-between bg-surface rounded-xl px-3.5 py-2.5 text-sm">
                <div>
                  <span className="font-semibold text-ink">{r.zoneA.name} ↔ {r.zoneB.name}</span>
                  <span className="text-ink-muted ml-2">₦{r.price.toLocaleString()}</span>
                  <span className="text-ink-muted ml-2 text-xs">
                    (Rider ₦{split.rider} · Batamart ₦{split.platform} gross, ₦{split.platform - split.referrer} net if buyer was referred)
                  </span>
                  {!r.isActive && <span className="ml-2 text-[10px] font-semibold text-danger bg-danger/10 px-1.5 py-0.5 rounded">INACTIVE</span>}
                </div>
                <button onClick={() => deleteRoute(r.id)}>
                  <Trash2 className="w-4 h-4 text-ink-muted hover:text-danger" />
                </button>
              </div>
            )
          })}
          {routes.length === 0 && <p className="text-sm text-ink-muted">No routes yet.</p>}
        </div>
      </div>
    </div>
  )
}
