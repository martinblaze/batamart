'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Loader2, MapPin, Package, Phone, Tag, Check, Clock } from 'lucide-react'
import { authFetch } from '@/lib/auth-client'

type Toast = (message: string, type?: 'success' | 'error' | 'info') => void

interface PickupOrder {
  id: string
  orderNumber: string
  status: string
  username: string | null
  note: string | null
  earn: number
  deliveryDate: string
  canTakeNow: boolean
  vendor: { name: string; phone: string | null; hostel: string | null; room: string | null; landmark: string | null }
  items: { name: string; quantity: number; image: string | null }[]
}
interface PickupGroup { area: string; orders: PickupOrder[]; claimable: number }

interface DeliveryOrder {
  id: string
  orderNumber: string
  username: string | null
  buyerName: string | null
  phone: string
  hostel: string
  room: string
  landmark: string
  note: string | null
  earn: number
  items: string[]
}
interface DeliveryGroup { area: string; orders: DeliveryOrder[] }
interface Bag { bag: string; day: string; earn: number; count: number; orderIds: string[]; areas: string[] }

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`

function AreaCard({
  title,
  subtitle,
  right,
  defaultOpen,
  children,
}: {
  title: string
  subtitle: string
  right?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className="border border-border bg-card">
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <MapPin className="h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          <p className="ui-mono ui-mono-sm mt-0.5 text-ink-muted">{subtitle}</p>
        </div>
        {right}
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={1.75} />
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="ui-eyebrow mb-3 mt-1">{children}</h3>
}

export default function RiderJobs({
  showToast,
  blocked,
  onActiveOrderIds,
}: {
  showToast: Toast
  blocked: boolean
  onActiveOrderIds: (ids: string[]) => void
}) {
  const [tab, setTab] = useState<'pickups' | 'deliveries'>('pickups')
  const [available, setAvailable] = useState<PickupGroup[]>([])
  const [minePickups, setMinePickups] = useState<PickupGroup[]>([])
  const [bags, setBags] = useState<Bag[]>([])
  const [mineDeliveries, setMineDeliveries] = useState<DeliveryGroup[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([authFetch('/api/riders/pickups'), authFetch('/api/riders/deliveries')])
      const pj = await p.json()
      const dj = await d.json()
      if (p.ok) {
        setAvailable(pj.available || [])
        setMinePickups(pj.mine || [])
      }
      if (d.ok) {
        setBags(dj.bags || [])
        setMineDeliveries(dj.mine || [])
      }
    } catch {
      /* keep the last good data */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])

  const activeIds = useMemo(
    () => [
      ...minePickups.flatMap(g => g.orders.map(o => o.id)),
      ...mineDeliveries.flatMap(g => g.orders.map(o => o.id)),
    ],
    [minePickups, mineDeliveries],
  )
  useEffect(() => {
    onActiveOrderIds(activeIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIds.join(',')])

  const post = async (key: string, url: string, body: unknown, okMessage: (j: any) => string) => {
    if (busy[key]) return
    setBusy(b => ({ ...b, [key]: true }))
    try {
      const res = await authFetch(url, { method: 'POST', body: JSON.stringify(body) })
      const json = await res.json()
      if (res.ok) showToast(okMessage(json), 'success')
      else showToast(json.error || 'Something went wrong.', res.status === 409 ? 'info' : 'error')
      await load()
    } catch {
      showToast('Network error. Please check your connection.', 'error')
    } finally {
      setBusy(b => ({ ...b, [key]: false }))
    }
  }

  const claim = (group: PickupGroup) => {
    const ids = group.orders.filter(o => o.canTakeNow && ['PENDING', 'PROCESSING'].includes(o.status)).map(o => o.id)
    return post(`claim-${group.area}`, '/api/riders/claim-pickups', { orderIds: ids }, j =>
      `${j.claimed} pickup${j.claimed > 1 ? 's' : ''} added to your list.`,
    )
  }

  const notReady = (o: PickupOrder) =>
    post(`nr-${o.id}`, '/api/riders/pickups/not-ready', { orderId: o.id }, () => 'Moved to the next delivery day.')

  const takeBag = (b: Bag) =>
    post(`bag-${b.bag}-${b.day}`, '/api/riders/take-bag', { orderIds: b.orderIds }, j => `${j.taken} parcel${j.taken > 1 ? 's' : ''} on your list. Safe trip!`)

  const pickupCount = minePickups.reduce((n, g) => n + g.orders.length, 0)
  const deliveryCount = mineDeliveries.reduce((n, g) => n + g.orders.length, 0)

  const tabBtn = (id: 'pickups' | 'deliveries', label: string, count: number) => (
    <button
      onClick={() => setTab(id)}
      className={`ui-mono ui-mono-sm flex h-11 flex-1 items-center justify-center gap-2 ${
        tab === id ? 'bg-ink text-background' : 'bg-card text-ink-secondary'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`px-1.5 text-[10px] ${tab === id ? 'bg-background/20' : 'bg-surface'}`}>{count}</span>
      )}
    </button>
  )

  if (!loaded) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-ink-muted" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex gap-px border border-border bg-border">
        {tabBtn('pickups', 'Pickups', pickupCount)}
        {tabBtn('deliveries', 'Deliveries', deliveryCount)}
      </div>

      {tab === 'pickups' && (
        <div className="space-y-6">
          {minePickups.length > 0 && (
            <div>
              <SectionLabel>To collect now</SectionLabel>
              <div className="space-y-3">
                {minePickups.map(group => (
                  <AreaCard
                    key={group.area}
                    defaultOpen
                    title={group.area}
                    subtitle={`${group.orders.length} parcel${group.orders.length > 1 ? 's' : ''} · ${new Set(group.orders.map(o => o.vendor.name)).size} vendor${new Set(group.orders.map(o => o.vendor.name)).size > 1 ? 's' : ''}`}
                  >
                    <ul className="divide-y divide-border">
                      {group.orders.map(o => (
                        <li key={o.id} className="space-y-3 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink">{o.vendor.name}</p>
                              {o.vendor.phone && (
                                <a href={`tel:${o.vendor.phone}`} className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-primary">
                                  <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
                                  {o.vendor.phone}
                                </a>
                              )}
                              {(o.vendor.hostel || o.vendor.landmark) && (
                                <p className="mt-0.5 text-xs text-ink-secondary">
                                  {[o.vendor.hostel, o.vendor.room ? `Room ${o.vendor.room}` : null, o.vendor.landmark].filter(Boolean).join(', ')}
                                </p>
                              )}
                            </div>
                            <span className="ui-mono ui-mono-sm whitespace-nowrap text-ink-muted">{fmtDay(o.deliveryDate)}</span>
                          </div>

                          <ul className="space-y-1">
                            {o.items.map((i, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-sm text-ink">
                                <Package className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                                {i.name} <span className="text-ink-muted">x{i.quantity}</span>
                              </li>
                            ))}
                          </ul>
                          {o.note && <p className="text-xs text-ink-secondary">Note: {o.note}</p>}

                          <div className="flex items-start gap-2 border border-border bg-surface px-3 py-2.5">
                            <Tag className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                            <p className="text-xs text-ink-secondary">
                              Check the parcel is wrapped and labelled <span className="font-medium text-ink">@{o.username}</span> with code{' '}
                              <span className="font-medium text-ink">#{o.orderNumber}</span>.
                            </p>
                          </div>

                          {o.status === 'PICKED_UP' ? (
                            <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                              <Check className="h-3.5 w-3.5" strokeWidth={2} /> Vendor confirmed the handover. Take it to the hub.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              <p className="flex items-center gap-1.5 text-xs text-warning">
                                <Clock className="h-3.5 w-3.5" strokeWidth={1.75} /> Ask the vendor to tap “Mark picked up”.
                              </p>
                              <button
                                onClick={() => notReady(o)}
                                disabled={busy[`nr-${o.id}`]}
                                className="ui-mono ui-mono-sm h-9 w-full border border-border bg-card px-3 text-ink-secondary hover:border-ink/25 hover:text-ink disabled:opacity-50"
                              >
                                {busy[`nr-${o.id}`] ? 'Updating…' : 'Not ready, roll to next delivery day'}
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </AreaCard>
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Available pickups</SectionLabel>
            {blocked && (
              <p className="mb-3 border border-warning/25 bg-warning/5 px-3 py-2 text-xs text-warning">
                Finish your return pickup first. New pickups are locked until then.
              </p>
            )}
            {available.length === 0 ? (
              <div className="border border-dashed border-border bg-card p-10 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-border" strokeWidth={1.5} />
                <p className="text-sm font-medium text-ink-muted">No pickups right now</p>
                <p className="mt-1 text-xs text-ink-muted">Check back soon</p>
              </div>
            ) : (
              <div className="space-y-3">
                {available.map(group => {
                  const vendors = new Set(group.orders.map(o => o.vendor.name)).size
                  const earn = group.orders.reduce((n, o) => n + o.earn, 0)
                  const nextDay = group.orders[0]?.deliveryDate
                  return (
                    <AreaCard
                      key={group.area}
                      title={group.area}
                      subtitle={`${group.orders.length} parcel${group.orders.length > 1 ? 's' : ''} · ${vendors} vendor${vendors > 1 ? 's' : ''} · ${naira(earn)}`}
                      right={
                        group.claimable === 0 && nextDay ? (
                          <span className="ui-mono ui-mono-sm whitespace-nowrap text-ink-muted">{fmtDay(nextDay)}</span>
                        ) : undefined
                      }
                    >
                      <ul className="divide-y divide-border">
                        {group.orders.map(o => (
                          <li key={o.id} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-ink">{o.vendor.name}</p>
                                <p className="mt-0.5 text-xs text-ink-secondary">
                                  {o.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                                </p>
                              </div>
                              <span className={`ui-mono ui-mono-sm whitespace-nowrap ${o.canTakeNow ? 'text-success' : 'text-ink-muted'}`}>
                                {o.canTakeNow ? 'Ready to take' : fmtDay(o.deliveryDate)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t border-border p-4">
                        <button
                          onClick={() => claim(group)}
                          disabled={blocked || group.claimable === 0 || busy[`claim-${group.area}`]}
                          className="h-11 w-full bg-ink px-4 text-sm font-medium text-background hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy[`claim-${group.area}`] ? (
                            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                          ) : group.claimable === 0 ? (
                            'Not open yet'
                          ) : (
                            `Take ${group.claimable} pickup${group.claimable > 1 ? 's' : ''}`
                          )}
                        </button>
                      </div>
                    </AreaCard>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'deliveries' && (
        <div className="space-y-6">
          {mineDeliveries.length > 0 && (
            <div>
              <SectionLabel>Out for delivery</SectionLabel>
              <div className="space-y-3">
                {mineDeliveries.map(group => (
                  <AreaCard
                    key={group.area}
                    defaultOpen
                    title={group.area}
                    subtitle={`${group.orders.length} parcel${group.orders.length > 1 ? 's' : ''}`}
                  >
                    <ul className="divide-y divide-border">
                      {group.orders.map(o => (
                        <li key={o.id} className="space-y-2 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink">
                                @{o.username} <span className="text-ink-muted">#{o.orderNumber}</span>
                              </p>
                              {o.buyerName && <p className="text-xs text-ink-secondary">{o.buyerName}</p>}
                            </div>
                            <span className="ui-mono ui-mono-sm whitespace-nowrap text-ink-muted">{naira(o.earn)}</span>
                          </div>
                          <p className="flex items-start gap-1.5 text-sm text-ink">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                            {[o.hostel, o.room ? `Room ${o.room}` : null, o.landmark].filter(Boolean).join(', ')}
                          </p>
                          <a href={`tel:${o.phone}`} className="inline-flex items-center gap-1.5 text-sm text-primary">
                            <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
                            {o.phone}
                          </a>
                          <p className="text-xs text-ink-secondary">{o.items.join(', ')}</p>
                          {o.note && <p className="text-xs text-ink-secondary">Note: {o.note}</p>}
                          <p className="flex items-center gap-1.5 text-xs text-warning">
                            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} /> After handing over, ask the buyer to tap “Mark delivered”.
                          </p>
                        </li>
                      ))}
                    </ul>
                  </AreaCard>
                ))}
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Packed bags at the hub</SectionLabel>
            {bags.length === 0 ? (
              <div className="border border-dashed border-border bg-card p-10 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-border" strokeWidth={1.5} />
                <p className="text-sm font-medium text-ink-muted">No packed bags yet</p>
                <p className="mt-1 text-xs text-ink-muted">Bags show here once the sorting room has packed them.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bags.map(b => (
                  <div key={`${b.bag}-${b.day}`} className="flex items-center gap-3 border border-border bg-card p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{b.bag}</p>
                      <p className="ui-mono ui-mono-sm mt-0.5 text-ink-muted">
                        {b.count} parcel{b.count > 1 ? 's' : ''} · {naira(b.earn)}
                      </p>
                    </div>
                    <button
                      onClick={() => takeBag(b)}
                      disabled={busy[`bag-${b.bag}-${b.day}`]}
                      className="ui-mono ui-mono-sm h-10 bg-ink px-4 text-background hover:bg-ink/90 disabled:opacity-50"
                    >
                      {busy[`bag-${b.bag}-${b.day}`] ? 'Taking…' : 'Take bag'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
