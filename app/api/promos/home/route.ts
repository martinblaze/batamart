export const dynamic = 'force-dynamic'
// app/api/promos/home/route.ts
// One call that powers the home page's live strips and the rotating promo sheet
// (web and the Flutter app). Auth is optional: guests get the public sections,
// signed-in users also get personalised slides. Every figure comes from the
// database; every sub-query is fail-soft so a slow or broken section just comes
// back empty instead of turning the whole response into a 500.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { checkRateLimit, getIpKey } from '@/lib/security/rate-limit'
import { formatDeliveryDate, getScheduledDeliveryDate } from '@/lib/delivery/schedule'
import {
  anonymiseOrders, hideLowStat, selectPopups,
  MIN_ACTIVE_SHOPPERS, MIN_ORDERS_THIS_WEEK,
  type Popup,
} from '@/lib/promos/logic'

const HOUR = 3600_000
const DAY = 24 * HOUR

const PRODUCT_SELECT = {
  id: true, name: true, price: true, images: true, category: true,
  marketPrice: true, discountPercent: true, isDeal: true, createdAt: true,
  seller: { select: { name: true } },
} as const

const PUBLIC_PRODUCT = { isActive: true, isDeleted: false, quantity: { gt: 0 }, moderationStatus: 'APPROVED' } as const

type Row = {
  id: string; name: string; price: number; images: string[]; category: string
  marketPrice: number | null; discountPercent: number | null; isDeal: boolean
  createdAt: Date; seller?: { name: string | null } | null
}

/** Percent off computed from the live prices (the stored discountPercent can be stale). Null under 5%. */
function realPct(price: number, original: number | null): number | null {
  if (!original || original <= price || price <= 0) return null
  const pct = Math.round((1 - price / original) * 100)
  return pct >= 5 ? pct : null
}

function card(p: Row) {
  const original = p.marketPrice && p.marketPrice > p.price ? p.marketPrice : null
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    originalPrice: original,
    discountPercent: original ? realPct(p.price, original) : null,
    image: p.images?.[0] ?? '',
    category: p.category,
    sellerName: p.seller?.name ?? null,
  }
}

async function safe<T>(label: string, fallback: T, fn: () => Promise<T>): Promise<T> {
  try { return await fn() } catch (e) { console.warn(`[promos/home] ${label} failed:`, (e as Error)?.message); return fallback }
}

function naira(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)
}

export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization, Cookie' }
  // Public and fairly heavy: cap each address (per server instance).
  const rl = checkRateLimit(`promos-home:${getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))}`, 40, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { ...headers, 'Retry-After': String(rl.retryAfterSecs) } })
  }
  const now = new Date()
  const nowMs = now.getTime()

  const empty = {
    popups: [] as Popup[],
    live: {
      delivery: null as any, trending: [] as any[], newToday: [] as any[], priceDrops: [] as any[],
      justOrdered: [] as any[], stats: { ordersThisWeek: null, activeShoppersToday: null } as { ordersThisWeek: number | null; activeShoppersToday: number | null },
    },
  }

  try {
    const user = await safe('auth', null, () => getUserFromRequest(request))
    const universityId = user?.universityId ?? null
    const scope = { ...PUBLIC_PRODUCT, ...(universityId ? { universityId } : {}) }
    const hintCats = (request.nextUrl.searchParams.get('categories') || '')
      .split(',').map(s => s.trim()).filter(Boolean).slice(0, 8)

    // ── Delivery countdown: orders placed before the delivery day begins (Lagos
    // midnight) ride that day; from then on they roll to the next one.
    const nextDelivery = getScheduledDeliveryDate(now)
    const delivery = {
      label: `${formatDeliveryDate(nextDelivery).split(',')[0]} delivery`,
      nextDeliveryDate: nextDelivery.toISOString(),
      cutoffAt: nextDelivery.toISOString(),
      msLeft: Math.max(0, nextDelivery.getTime() - nowMs),
    }

    const since24 = new Date(nowMs - DAY)
    const since48 = new Date(nowMs - 2 * DAY)
    const since7d = new Date(nowMs - 7 * DAY)
    const notCancelled = { order: { status: { not: 'CANCELLED' as const } } }

    const [
      trending, newToday, discounted, justRows, ordersWeek, shoppers,
      orderCount, userRow, cart, forYou, wishlist, events,
    ] = await Promise.all([
      // Trending: most bought in 24h (widened to 7d if the day was quiet).
      safe('trending', [] as Row[], async () => {
        const rank = async (from: Date) => prisma.orderItem.groupBy({
          by: ['productId'], where: { createdAt: { gte: from }, ...notCancelled },
          _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 24,
        })
        let g = await rank(since24)
        if (g.length < 4) g = await rank(since7d)
        if (!g.length) return []
        const rows = await prisma.product.findMany({ where: { id: { in: g.map(x => x.productId) }, ...scope }, select: PRODUCT_SELECT })
        const order = new Map(g.map((x, i) => [x.productId, i]))
        return rows.sort((a, b) => (order.get(a.id)! - order.get(b.id)!)).slice(0, 12) as Row[]
      }),
      safe('newToday', [] as Row[], () => prisma.product.findMany({
        where: { ...scope, createdAt: { gte: since24 } }, select: PRODUCT_SELECT, orderBy: { createdAt: 'desc' }, take: 12,
      }) as Promise<Row[]>),
      // Real discounts vs the last confirmed campus sale price.
      safe('discounted', [] as Row[], () => prisma.product.findMany({
        where: { ...scope, isDeal: true, marketPrice: { not: null }, discountPercent: { gte: 5 } },
        select: PRODUCT_SELECT, orderBy: [{ discountPercent: 'desc' }, { createdAt: 'desc' }], take: 24,
      }).then(rows => rows.filter(r => realPct(r.price, r.marketPrice) !== null)) as Promise<Row[]>),
      safe('justOrdered', [] as any[], () => prisma.orderItem.findMany({
        where: { createdAt: { gte: since48 }, ...notCancelled, product: scope },
        select: { productId: true, createdAt: true, product: { select: { name: true, images: true } } },
        orderBy: { createdAt: 'desc' }, take: 40,
      })),
      safe('ordersWeek', 0, () => prisma.order.count({ where: { createdAt: { gte: since7d }, status: { not: 'CANCELLED' } } })),
      safe('shoppers', 0, async () => (await prisma.order.findMany({
        where: { createdAt: { gte: since24 }, status: { not: 'CANCELLED' } }, select: { buyerId: true }, distinct: ['buyerId'], take: 500,
      })).length),
      user ? safe('orderCount', -1, () => prisma.order.count({ where: { buyerId: user.id, status: { not: 'CANCELLED' } } })) : Promise.resolve(-1),
      user ? safe('userRow', null as any, () => prisma.user.findUnique({ where: { id: user.id }, select: { referralCode: true } })) : Promise.resolve(null as any),
      user ? safe('cart', null as any, () => prisma.cartItem.findMany({
        where: { cart: { userId: user.id }, product: scope },
        select: { quantity: true, addedAt: true, product: { select: PRODUCT_SELECT } },
        orderBy: { addedAt: 'desc' }, take: 5,
      })) : Promise.resolve(null as any),
      safe('forYou', null as Row | null, async () => {
        let cats = hintCats
        let bought: string[] = []
        if (user) {
          const past = await prisma.orderItem.findMany({
            where: { order: { buyerId: user.id } }, select: { productId: true, product: { select: { category: true } } },
            orderBy: { createdAt: 'desc' }, take: 20,
          })
          bought = past.map(p => p.productId)
          cats = Array.from(new Set([...past.map(p => p.product.category), ...hintCats])).slice(0, 6)
        }
        if (!cats.length) return null
        return (await prisma.product.findFirst({
          where: { ...scope, category: { in: cats }, id: { notIn: bought }, ...(user ? { sellerId: { not: user.id } } : {}) },
          select: PRODUCT_SELECT, orderBy: [{ hotScore: 'desc' }, { viewCount: 'desc' }],
        })) as Row | null
      }),
      user ? safe('wishlist', null as any, () => lookupWishlistDrop(user.id)) : Promise.resolve(null as any),
      safe('events', [] as any[], () => prisma.ticketEvent.findMany({
        where: { status: 'ACTIVE', startsAt: { gte: now } },
        select: { id: true, name: true, venue: true, startsAt: true, flyerUrl: true },
        orderBy: { startsAt: 'asc' }, take: 3,
      })),
    ])

    // ── Live section ──
    const justOrdered = anonymiseOrders(
      justRows.map((r: any) => ({ productId: r.productId, productName: r.product?.name ?? '', imageUrl: r.product?.images?.[0] ?? null, at: r.createdAt })),
      nowMs,
    )
    const priceDrops = discounted.slice(0, 12)
    const live = {
      delivery,
      trending: trending.map(card),
      newToday: newToday.map(card),
      priceDrops: priceDrops.map(card),
      justOrdered,
      stats: {
        ordersThisWeek: hideLowStat(ordersWeek, MIN_ORDERS_THIS_WEEK),
        activeShoppersToday: hideLowStat(shoppers, MIN_ACTIVE_SHOPPERS),
      },
    }

    // ── Popups ──
    const c: Popup[] = []
    if (user && orderCount === 0) {
      c.push({
        id: 'first-order', kind: 'FIRST_ORDER', title: 'Your first order, protected',
        body: `Deliveries run every Wednesday and Saturday. Your money is held in escrow and only released to the seller once you confirm your order arrived. Next up: ${delivery.label.replace(' delivery', '')}.`,
        imageUrl: null, ctaLabel: 'Start shopping', ctaUrl: '/marketplace', badge: 'New here',
      })
    }
    // Prefer a deal that has a picture: the sheet is a visual slide.
    const best = discounted.find(p => p.images?.[0]) ?? discounted[0]
    const bestPct = best ? realPct(best.price, best.marketPrice) : null
    if (best && bestPct) {
      c.push({
        id: `hot-${best.id}`, kind: 'HOT_DEAL', title: `${bestPct}% off ${best.name}`,
        body: `Now ${naira(best.price)}, down from ${naira(best.marketPrice!)} (last campus price).`,
        imageUrl: best.images?.[0] ?? null, ctaLabel: 'See this deal', ctaUrl: `/product/${best.id}`, badge: `${bestPct}% OFF`,
      })
    }
    if (forYou) {
      c.push({
        id: `foryou-${forYou.id}`, kind: 'FOR_YOU', title: forYou.name,
        body: `Picked for you from ${forYou.category}. ${naira(forYou.price)}.`,
        imageUrl: forYou.images?.[0] ?? null, ctaLabel: 'View', ctaUrl: `/product/${forYou.id}`, badge: 'For you',
      })
    }
    if (cart && cart.length) {
      const first = cart[0].product
      const n = cart.length
      c.push({
        id: 'cart', kind: 'CART', title: n === 1 ? `${first.name} is waiting` : `${n} items are waiting in your cart`,
        body: n === 1 ? `${naira(first.price)}. Check out before the next delivery cutoff.` : `${first.name} and ${n - 1} more. Check out before the next delivery cutoff.`,
        imageUrl: first.images?.[0] ?? null, ctaLabel: 'Go to cart', ctaUrl: '/cart', badge: null,
      })
    }
    if (wishlist) {
      c.push({
        id: `wish-${wishlist.id}`, kind: 'WISHLIST_DROP', title: wishlist.title, body: wishlist.body,
        imageUrl: wishlist.image, ctaLabel: 'View', ctaUrl: `/product/${wishlist.id}`, badge: wishlist.badge,
      })
    }
    if (user && userRow?.referralCode) {
      c.push({
        id: 'referral', kind: 'REFERRAL', title: 'Invite a friend, earn together',
        body: `Share your code ${userRow.referralCode} and earn a reward when your friend places an order.`,
        imageUrl: null, ctaLabel: 'Get my link', ctaUrl: '/referrals', badge: null,
      })
    }
    if (events.length) {
      const e = events[0]
      c.push({
        id: `event-${e.id}`, kind: 'EVENTS', title: e.name,
        body: `${new Date(e.startsAt).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' })} at ${e.venue}. Tickets on BataMart.`,
        imageUrl: e.flyerUrl ?? null, ctaLabel: 'Get tickets', ctaUrl: `/events/${e.id}`, badge: 'Event',
      })
    }
    if (newToday.length >= 3) {
      c.push({
        id: 'new-arrivals', kind: 'NEW_ARRIVALS', title: `${newToday.length}${newToday.length >= 12 ? '+' : ''} new listings today`,
        body: `Fresh on campus, starting with ${newToday[0].name}.`,
        imageUrl: newToday[0].images?.[0] ?? null, ctaLabel: 'Browse new', ctaUrl: '/marketplace', badge: 'New',
      })
    }

    return NextResponse.json({ popups: selectPopups(c), live }, { headers })
  } catch (error) {
    console.error('promos/home error:', error)
    return NextResponse.json(empty, { headers })
  }
}

/**
 * The best saved item whose price is now lower. Fail-soft: if the wishlist table
 * is missing (migration not applied yet) the caller's safe() wrapper returns null.
 */
async function lookupWishlistDrop(userId: string) {
  const rows: any[] = await prisma.wishlistItem.findMany({
    where: { userId }, take: 30, orderBy: { createdAt: 'desc' },
    include: { product: { select: { ...PRODUCT_SELECT, isActive: true, isDeleted: true, quantity: true } } },
  })
  let best: { id: string; title: string; body: string; image: string | null; badge: string; score: number } | null = null
  for (const r of rows) {
    const p = r.product as (Row & { isActive: boolean; isDeleted: boolean; quantity: number }) | undefined
    if (!p || !p.isActive || p.isDeleted || p.quantity <= 0) continue
    const saved = [r.lastNotifiedPrice, r.priceWhenSaved].find(v => typeof v === 'number' && v > 0)
    let score = 0, body = '', badge = ''
    if (saved && saved > p.price) {
      const pct = Math.round(((saved - p.price) / saved) * 100)
      if (pct < 3) continue
      score = pct; badge = `${pct}% OFF`; body = `Dropped from ${naira(saved)} to ${naira(p.price)} since you saved it.`
    } else if (!saved && p.marketPrice && p.marketPrice > p.price && (p.discountPercent ?? 0) >= 5) {
      score = p.discountPercent!; badge = `${p.discountPercent}% OFF`; body = `Now ${naira(p.price)}, below the last campus price of ${naira(p.marketPrice)}.`
    } else continue
    if (!best || score > best.score) best = { id: p.id, title: `${p.name} is cheaper`, body, image: p.images?.[0] ?? null, badge, score }
  }
  return best
}
