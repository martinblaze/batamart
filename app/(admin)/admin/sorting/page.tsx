'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PackageCheck, Search } from 'lucide-react'
import { AdminHeader, AdminPanel, AdminEmpty, AdminLoading, AdminButton } from '@/components/admin/AdminUI'
import { Badge } from '@/components/ui/Badge'

interface HubOrder {
  id: string
  orderNumber: string
  status: 'RIDER_ASSIGNED' | 'PICKED_UP' | 'AT_HUB' | 'PACKED'
  username: string | null
  vendor: string
  rider: string | null
  area: string
  bagLabel: string | null
  items: string[]
  deliveryDate: string
  dayKey: string
}

const STATUS_LABEL: Record<HubOrder['status'], string> = {
  RIDER_ASSIGNED: 'With rider, not handed over',
  PICKED_UP: 'On its way to hub',
  AT_HUB: 'Sorting',
  PACKED: 'Packed',
}

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })

function OrderRow({
  o,
  checked,
  onToggle,
  action,
}: {
  o: HubOrder
  checked?: boolean
  onToggle?: () => void
  action?: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      {onToggle && <input type="checkbox" className="mt-1 h-4 w-4" checked={!!checked} onChange={onToggle} />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          {o.username ? `@${o.username}` : 'No username'} <span className="text-ink-muted">#{o.orderNumber}</span>
        </p>
        <p className="mt-0.5 text-xs text-ink-secondary">{o.items.join(', ')}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          From {o.vendor} · to {o.area} · {fmtDay(o.deliveryDate)}
          {o.rider ? ` · rider ${o.rider}` : ''}
        </p>
      </div>
      {action ?? (
        <Badge status={o.status === 'PACKED' ? 'success' : o.status === 'AT_HUB' ? 'verified' : 'warning'}>
          {STATUS_LABEL[o.status]}
        </Badge>
      )}
    </li>
  )
}

export default function AdminSortingPage() {
  const [orders, setOrders] = useState<HubOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [day, setDay] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bagName, setBagName] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (username = '') => {
    const token = localStorage.getItem('adminToken')
    try {
      const res = await fetch(`/api/admin/hub${username ? `?username=${encodeURIComponent(username)}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load'); return }
      setOrders(json.orders)
      setError('')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search, load])

  useEffect(() => {
    const t = setInterval(() => load(search.trim()), 30000)
    return () => clearInterval(t)
  }, [search, load])

  const days = useMemo(() => {
    const map = new Map<string, string>()
    orders.forEach(o => map.set(o.dayKey, o.deliveryDate))
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [orders])

  const visible = orders.filter(o => day === 'all' || o.dayKey === day)
  const incoming = visible.filter(o => o.status === 'RIDER_ASSIGNED' || o.status === 'PICKED_UP')
  const sorting = visible.filter(o => o.status === 'AT_HUB')
  const packed = visible.filter(o => o.status === 'PACKED')

  const bags = useMemo(() => {
    const map = new Map<string, HubOrder[]>()
    packed.forEach(o => {
      const key = `${o.bagLabel || o.area} · ${fmtDay(o.deliveryDate)}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(o)
    })
    return Array.from(map.entries())
  }, [packed])

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const run = async (action: 'receive' | 'pack' | 'unpack', ids: string[], bag?: string) => {
    if (ids.length === 0) return
    setBusy(true)
    const token = localStorage.getItem('adminToken')
    try {
      const res = await fetch('/api/admin/hub/action', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, orderIds: ids, bagLabel: bag }),
      })
      const json = await res.json()
      if (!res.ok) window.alert(json.error || 'Could not update')
      setSelected(new Set())
      await load(search.trim())
    } finally {
      setBusy(false)
    }
  }

  const selectedSorting = sorting.filter(o => selected.has(o.id))
  const dayTabs: [string, string][] = [['all', 'All days'], ...days.map(([k, iso]) => [k, fmtDay(iso)] as [string, string])]

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Operations"
        title="Sorting room"
        description="Check parcels in as the riders bring them, then pack them into bags by area for the delivery riders."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search a username"
            className="h-10 w-full border border-border bg-card pl-9 pr-3 text-sm text-ink outline-none focus:border-ink/40"
          />
        </div>
        <div className="flex flex-wrap gap-px border border-border bg-border">
          {dayTabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setDay(k)}
              className={`ui-mono ui-mono-sm h-10 px-3 ${day === k ? 'bg-ink text-background' : 'bg-card text-ink-secondary'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <AdminLoading rows={4} />
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : visible.length === 0 ? (
        <AdminEmpty icon={PackageCheck} title="Nothing in the sorting room" description="Parcels appear here once a rider claims them." />
      ) : (
        <>
          <AdminPanel title={`Coming in (${incoming.length})`}>
            {incoming.length === 0 ? (
              <p className="text-sm text-ink-muted">No parcels on the way.</p>
            ) : (
              <>
                <ul>
                  {incoming.map(o => (
                    <OrderRow
                      key={o.id}
                      o={o}
                      action={
                        <AdminButton tone="ink" disabled={busy} onClick={() => run('receive', [o.id])}>
                          Mark sorting
                        </AdminButton>
                      }
                    />
                  ))}
                </ul>
                <div className="mt-4 border-t border-border pt-4">
                  <AdminButton tone="default" disabled={busy} onClick={() => run('receive', incoming.map(o => o.id))}>
                    Mark all as sorting
                  </AdminButton>
                </div>
              </>
            )}
          </AdminPanel>

          <AdminPanel title={`Sorting (${sorting.length})`}>
            {sorting.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing waiting to be packed.</p>
            ) : (
              <>
                <ul>
                  {sorting.map(o => (
                    <OrderRow key={o.id} o={o} checked={selected.has(o.id)} onToggle={() => toggle(o.id)} />
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  <input
                    value={bagName}
                    onChange={e => setBagName(e.target.value)}
                    placeholder="Bag name, e.g. Aroma bag (blank uses the buyer area)"
                    className="h-10 min-w-[240px] flex-1 border border-border bg-card px-3 text-sm text-ink outline-none focus:border-ink/40"
                  />
                  <AdminButton
                    tone="ink"
                    disabled={busy || selectedSorting.length === 0}
                    onClick={() => run('pack', selectedSorting.map(o => o.id), bagName)}
                  >
                    Pack {selectedSorting.length || ''} into bag
                  </AdminButton>
                  <AdminButton tone="default" disabled={busy} onClick={() => setSelected(new Set(sorting.map(o => o.id)))}>
                    Select all
                  </AdminButton>
                </div>
              </>
            )}
          </AdminPanel>

          <AdminPanel title={`Packed bags (${bags.length})`}>
            {bags.length === 0 ? (
              <p className="text-sm text-ink-muted">No bags yet.</p>
            ) : (
              <div className="space-y-6">
                {bags.map(([name, list]) => (
                  <div key={name}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="ui-mono ui-mono-sm text-ink">
                        {name} · {list.length} parcel{list.length > 1 ? 's' : ''}
                      </p>
                      <AdminButton tone="default" disabled={busy} onClick={() => run('unpack', list.map(o => o.id))}>
                        Unpack bag
                      </AdminButton>
                    </div>
                    <ul className="mt-1">
                      {list.map(o => (
                        <OrderRow key={o.id} o={o} />
                      ))}
                    </ul>
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
