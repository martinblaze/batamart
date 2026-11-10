'use client'

// Live strips for the marketplace home. All data is real (see /api/promos/home)
// and every strip renders nothing when its data is empty.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Clock, ShoppingBag, Sparkles, TrendingDown, TrendingUp, Truck, Users } from 'lucide-react'
import { RevealItem } from '@/components/motion/AppMotion'
import { formatMsLeft, minutesAgoLabel } from '@/lib/promos/logic'
import { useHomePromos, type PromoCard } from './useHomePromos'

const naira = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

function useTick(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function StripSkeleton() {
  return <div className="ui-skeleton h-10 w-full border border-border" aria-hidden />
}

/** "Order within 5h 20m for Wednesday delivery" */
function DeliveryBar({ delivery, fetchedAt }: { delivery: { label: string; cutoffAt: string }; fetchedAt: number }) {
  const now = useTick(30_000)
  const msLeft = new Date(delivery.cutoffAt).getTime() - now
  if (!(msLeft > 0)) return null
  void fetchedAt
  return (
    <div className="flex items-center gap-2.5 border border-border bg-card px-3 py-2.5" role="status">
      <Truck className="h-4 w-4 flex-shrink-0 text-primary" strokeWidth={2} />
      <p className="min-w-0 flex-1 text-xs text-ink sm:text-sm">
        Order within <span className="ui-figure font-semibold">{formatMsLeft(msLeft)}</span> for {delivery.label.replace(' delivery', '')} delivery
      </p>
      <Clock className="h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={2} />
    </div>
  )
}

/** Rotating real "just ordered" line. Product and age only, never who bought. */
function JustOrderedTicker({ items }: { items: { productName: string; imageUrl: string | null; minutesAgo: number }[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (items.length < 2) return
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const t = setInterval(() => setI(x => (x + 1) % items.length), 4000)
    return () => clearInterval(t)
  }, [items.length])
  const cur = items[i % items.length]
  if (!cur) return null
  return (
    <div className="flex items-center gap-2.5 border border-border bg-card px-3 py-2" aria-live="polite">
      <ShoppingBag className="h-4 w-4 flex-shrink-0 text-primary" strokeWidth={2} />
      {cur.imageUrl && <img src={cur.imageUrl} alt="" loading="lazy" className="h-7 w-7 flex-shrink-0 object-cover" />}
      <p key={i} className="min-w-0 flex-1 truncate text-xs text-ink animate-[fadeIn_0.4s_ease-out] sm:text-sm">
        <span className="font-medium">{cur.productName}</span>
        <span className="text-ink-muted"> was ordered {minutesAgoLabel(cur.minutesAgo)}</span>
      </p>
    </div>
  )
}

function StatsLine({ orders, shoppers }: { orders: number | null; shoppers: number | null }) {
  if (orders == null && shoppers == null) return null
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
      {orders != null && <span className="inline-flex items-center gap-1.5"><ShoppingBag className="h-3 w-3" strokeWidth={2} />{orders} orders this week</span>}
      {shoppers != null && <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3" strokeWidth={2} />{shoppers} shoppers ordered today</span>}
    </p>
  )
}

function Shelf({ icon, title, items, seeAll }: {
  icon: React.ReactNode; title: string; items: PromoCard[]; seeAll?: string
}) {
  if (!items.length) return null
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="ui-eyebrow min-w-0 flex-1">{icon}{title}</p>
        {seeAll && (
          <Link href={seeAll} className="group flex flex-shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
            See all <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      <div className="ui-rail -mx-1 px-1 pb-1">
        {items.map((p, idx) => (
          <RevealItem key={p.id} index={idx}>
            <Link href={`/product/${p.id}`} className="group block w-32 overflow-hidden border border-border bg-card transition-colors duration-300 hover:border-ink/20 sm:w-40">
              <div className="relative aspect-square overflow-hidden bg-surface">
                {p.image && <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />}
                {p.discountPercent ? (
                  <span className="absolute left-0 top-2 bg-primary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white">-{p.discountPercent}%</span>
                ) : null}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 text-xs leading-snug text-ink">{p.name}</p>
                <p className="ui-figure mt-1.5 text-sm text-ink">
                  {naira(p.price)}
                  {p.originalPrice ? <span className="ml-1.5 text-[11px] text-ink-muted line-through">{naira(p.originalPrice)}</span> : null}
                </p>
              </div>
            </Link>
          </RevealItem>
        ))}
      </div>
    </section>
  )
}

/** Delivery countdown, just-ordered ticker and the stats line. */
export function LiveTopStrips() {
  const { data, loading } = useHomePromos()
  if (loading && !data) return <div className="space-y-2"><StripSkeleton /></div>
  if (!data) return null
  const { delivery, justOrdered, stats } = data.live
  const hasStats = stats.ordersThisWeek != null || stats.activeShoppersToday != null
  if (!delivery && !justOrdered.length && !hasStats) return null
  return (
    <div className="space-y-2 animate-[fadeIn_0.4s_ease-out]">
      {delivery && <DeliveryBar delivery={delivery} fetchedAt={data.fetchedAt} />}
      {justOrdered.length > 0 && <JustOrderedTicker items={justOrdered} />}
      <StatsLine orders={stats.ordersThisWeek} shoppers={stats.activeShoppersToday} />
    </div>
  )
}

/** Trending, price-drop and new-today shelves. */
export function LiveShelves() {
  const { data, loading } = useHomePromos()
  if (loading && !data) {
    return (
      <div className="flex gap-2 overflow-hidden" aria-hidden>
        {[0, 1, 2, 3].map(i => <div key={i} className="ui-skeleton aspect-[4/5] w-32 flex-none border border-border sm:w-40" />)}
      </div>
    )
  }
  if (!data) return null
  const { trending, priceDrops, newToday } = data.live
  return (
    <>
      <Shelf icon={<TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />} title="Trending on campus" items={trending} />
      <Shelf icon={<TrendingDown className="h-3.5 w-3.5" strokeWidth={2} />} title="Below campus price" items={priceDrops} seeAll="/marketplace/deals" />
      <Shelf icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2} />} title="New today" items={newToday} />
    </>
  )
}

