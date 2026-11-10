// lib/notify/campaigns/engine.ts
// The "always active" daily campaign: six slots a day (Lagos time) that pick,
// per person, the best product to show them. Everything personalised is loaded
// in batches per chunk of people (never a query per person per product), is
// bounded by a deadline and is fault-isolated per person.
//
// Bookkeeping lives in NotificationLog (no new table):
//   cslot:<day>:<slot>             per user, the once-a-day guard for the slot
//   cdone:<day>:<slot>:<outcome>   per user, what happened (stats + resume)
//   promo:<productId>:<day>:<slot> per user, product pushed (14-day no-repeat)
//   pcat:<category>:<day>:<slot>   per user, category pushed (rotation)
//   cemail:<day>                   per user, the one marketing email of the day
//   fo-email:<1|3|7>               per user, first-order series stage sent
//   email-budget:<day>:<n>         system, one per marketing email (daily budget)
//   crun:<day>:<slot>              system, the slot finished for everyone

import { prisma } from '@/lib/prisma'
import { notifyUser, type NotifyOptions } from '@/lib/notify/dispatch'
import { pushImageUrl } from '@/lib/notify/image'
import type { EmailContent, EmailProduct } from '@/lib/notify/email'
import { getLagosToday, lagosDayKey, parseReadyDays } from '@/lib/delivery/schedule'
import {
  activityTier, buildAffinity, chooseCategory, cutoffMessage, dailyCapFor, emailSubject, firstOrderStage,
  hash32, normalizeFrequency, pickCandidate, realPercentOff, SLOT_TIMES,
  type Candidate, type Frequency, type SlotNo, type Tier,
} from '@/lib/notify/campaigns/logic'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
const PROMO_TYPES = ['DEAL_ALERT', 'PROMO', 'REMINDER', 'DIGEST'] as const

export const EMAIL_SLOT: SlotNo = 2

export type Outcome = 'sent' | 'cap' | 'quiet' | 'pref' | 'frequency' | 'nocand' | 'error' | 'duplicate'

export interface SlotRunResult {
  slot: SlotNo
  day: string
  alreadyDone?: boolean
  done: boolean
  considered: number
  outcomes: Record<string, number>
  emails: number
  emailBudget: { used: number; budget: number }
}

// ── Email budget ────────────────────────────────────────────────────────────

export function emailDailyBudget(): number {
  const n = Number(process.env.EMAIL_DAILY_BUDGET)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 150
}

/** Takes one unit of today's email budget. Returns the row key, or null if the budget is spent. */
export async function claimEmailBudget(day: string): Promise<string | null> {
  const budget = emailDailyBudget()
  const used = await prisma.notificationLog.count({ where: { userId: 'system', key: { startsWith: `email-budget:${day}:` } } })
  if (used >= budget) return null
  // Only keys 1..budget exist, so the unique key is the real limit: two sends racing for the same
  // number cannot both win, and a loser moves on to the next free number (wrapping to holes left by
  // released claims) but never past the budget.
  for (let i = 0; i < Math.min(budget, 24); i++) {
    const n = ((used + i) % budget) + 1
    const key = `email-budget:${day}:${n}`
    try {
      await prisma.notificationLog.create({ data: { userId: 'system', key } })
      return key
    } catch (error: any) {
      if (error?.code !== 'P2002') return null
    }
  }
  return null
}

const releaseEmailBudget = (key: string) => prisma.notificationLog.deleteMany({ where: { userId: 'system', key } }).catch(() => {})

// ── Product pool ────────────────────────────────────────────────────────────

const LIVE = {
  isActive: true,
  isDeleted: false,
  isFlagged: false,
  quantity: { gt: 0 },
  moderationStatus: 'APPROVED' as any,
  NOT: { images: { isEmpty: true } },
}
const PRODUCT_SELECT = {
  id: true, name: true, price: true, images: true, category: true, categoryKey: true, quantity: true,
  marketPrice: true, discountPercent: true, isDeal: true, isHot: true, hotScore: true, createdAt: true,
  universityId: true, viewCount: true, deliveryEstimate: true,
} as const

type Row = Awaited<ReturnType<typeof loadRows>>[number]
const loadRows = (where: any, orderBy: any, take: number) =>
  prisma.product.findMany({ where: { ...LIVE, ...where }, orderBy, take, select: PRODUCT_SELECT })

interface PoolItem extends Candidate {
  universityId: string | null
  readyDays: number
  isNew: boolean
}

function toCandidate(r: Row, maxViews: number): PoolItem {
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    categoryKey: r.categoryKey ?? r.category ?? null,
    quantity: r.quantity,
    image: pushImageUrl(r.images?.[0]),
    marketPrice: r.marketPrice,
    discountPercent: r.discountPercent,
    isDeal: r.isDeal,
    isHot: r.isHot,
    hotScore: r.hotScore,
    createdAt: r.createdAt,
    popularity: maxViews > 0 ? Math.min(1, (r.viewCount ?? 0) / maxViews) : 0,
    universityId: r.universityId,
    readyDays: parseReadyDays(r.deliveryEstimate),
    isNew: Date.now() - r.createdAt.getTime() < 3 * DAY,
  }
}

async function loadPool(): Promise<PoolItem[]> {
  const [deals, hot, fresh, popular] = await Promise.all([
    loadRows({ isDeal: true, discountPercent: { gte: 5 } }, { discountPercent: 'desc' }, 150),
    loadRows({ isHot: true }, { hotScore: 'desc' }, 150),
    loadRows({ createdAt: { gte: new Date(Date.now() - 4 * DAY) } }, { createdAt: 'desc' }, 200),
    loadRows({}, [{ viewCount: 'desc' }, { avgRating: 'desc' }], 300),
  ])
  const byId = new Map<string, Row>()
  for (const r of [...deals, ...hot, ...fresh, ...popular]) if (!byId.has(r.id)) byId.set(r.id, r)
  const rows = Array.from(byId.values())
  const maxViews = Math.max(0, ...rows.map(r => r.viewCount ?? 0))
  return rows.map(r => toCandidate(r, maxViews)).filter(c => c.image)
}

// ── Per-chunk batched context ───────────────────────────────────────────────

interface UserCtx {
  id: string
  email: string | null
  createdAt: Date
  universityId: string | null
  prefs: { emailEnabled: boolean; pushEnabled: boolean } | null
  frequency: Frequency
  tier: Tier
  cap: number
  todayCount: number
  hasOrder: boolean
  boughtIds: Set<string>
  sent14: Set<string>
  sentTodayCats: string[]
  affinity: Map<string, number>
  views: { productId: string; count: number; last: Date }[]
  cart: PoolItem[]
  cartAgeOk: boolean
  emailedToday: boolean
  foStagesSent: Set<string>
}

const chunked = <T,>(list: T[], n: number) => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n))
  return out
}

async function loadUsers(ids: string[]) {
  try {
    return await prisma.user.findMany({
      where: { id: { in: ids }, isSuspended: false, isDeleted: false },
      select: { id: true, email: true, createdAt: true, universityId: true, notificationPreference: true },
    })
  } catch (error: any) {
    if (error?.code !== 'P2021' && error?.code !== 'P2022') throw error
    const rows = await prisma.user.findMany({
      where: { id: { in: ids }, isSuspended: false, isDeleted: false },
      select: { id: true, email: true, createdAt: true, universityId: true },
    })
    return rows.map(r => ({ ...r, notificationPreference: null as any }))
  }
}

async function buildContexts(ids: string[], day: string, slot: SlotNo, poolById: Map<string, PoolItem>): Promise<UserCtx[]> {
  const now = Date.now()
  const lagosMidnight = getLagosToday()
  const [users, sessions, orderAct, todayRows, logs, viewRows, cartRows, itemRows, searchRows] = await Promise.all([
    loadUsers(ids),
    prisma.userSessionEvent.groupBy({ by: ['userId'], where: { userId: { in: ids }, createdAt: { gte: new Date(now - 60 * DAY) } }, _max: { createdAt: true } }),
    prisma.order.groupBy({ by: ['buyerId'], where: { buyerId: { in: ids }, status: { not: 'CANCELLED' } }, _max: { createdAt: true } }),
    prisma.notification.groupBy({ by: ['userId'], where: { userId: { in: ids }, type: { in: [...PROMO_TYPES] as any }, createdAt: { gte: lagosMidnight } }, _count: { _all: true } }),
    prisma.notificationLog.findMany({
      where: {
        userId: { in: ids },
        createdAt: { gte: new Date(now - 14 * DAY) },
        OR: [{ key: { startsWith: 'promo:' } }, { key: { startsWith: 'pcat:' } }, { key: { startsWith: 'cemail:' } }, { key: { startsWith: 'fo-email:' } }],
      },
      select: { userId: true, key: true },
    }),
    prisma.userSessionEvent.groupBy({
      by: ['userId', 'productId'],
      where: { userId: { in: ids }, eventType: 'view', productId: { not: null }, createdAt: { gte: new Date(now - 14 * DAY) } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.cartItem.findMany({
      where: { cart: { userId: { in: ids } }, product: { is: { ...LIVE } } },
      select: { productId: true, addedAt: true, cart: { select: { userId: true } } },
    }),
    prisma.orderItem.findMany({
      where: { order: { buyerId: { in: ids }, status: { not: 'CANCELLED' } } },
      select: { productId: true, order: { select: { buyerId: true } }, product: { select: { categoryKey: true, category: true } } },
    }),
    prisma.searchLog.findMany({
      where: { userId: { in: ids }, category: { not: null }, createdAt: { gte: new Date(now - 30 * DAY) } },
      select: { userId: true, category: true },
      take: 5000,
    }),
  ])

  // Products people looked at or carted that are not already in the pool.
  const extraIds = Array.from(new Set([...viewRows.map(v => v.productId!), ...cartRows.map(c => c.productId)])).filter(id => !poolById.has(id))
  const extraRows = extraIds.length ? await prisma.product.findMany({ where: { id: { in: extraIds }, ...LIVE }, select: PRODUCT_SELECT }) : []
  const extra = new Map(extraRows.map(r => [r.id, toCandidate(r, 0)]))
  const info = (id: string) => poolById.get(id) ?? extra.get(id)
  // Categories of viewed products that were not live any more still tell us interest.
  const deadIds = extraIds.filter(id => !extra.has(id))
  const deadCats = deadIds.length
    ? new Map((await prisma.product.findMany({ where: { id: { in: deadIds } }, select: { id: true, categoryKey: true, category: true } })).map(p => [p.id, p.categoryKey ?? p.category]))
    : new Map<string, string | null>()
  const catOf = (id: string) => info(id)?.categoryKey ?? deadCats.get(id) ?? null

  const lastSession = new Map(sessions.map(s => [s.userId!, s._max.createdAt]))
  const lastOrder = new Map(orderAct.map(o => [o.buyerId, o._max.createdAt]))
  const todayCount = new Map(todayRows.map(r => [r.userId, r._count._all]))

  const by = <T,>(list: T[], key: (t: T) => string | null | undefined) => {
    const m = new Map<string, T[]>()
    for (const t of list) {
      const k = key(t)
      if (k) m.set(k, [...(m.get(k) ?? []), t])
    }
    return m
  }
  const logsBy = by(logs, l => l.userId)
  const viewsBy = by(viewRows, v => v.userId)
  const cartBy = by(cartRows, c => c.cart.userId)
  const itemsBy = by(itemRows, i => i.order.buyerId)
  const searchBy = by(searchRows, s => s.userId)

  return users.map(u => {
    const lastTimes = [lastSession.get(u.id), lastOrder.get(u.id), u.createdAt].filter(Boolean) as Date[]
    const last = new Date(Math.max(...lastTimes.map(t => t.getTime())))
    const tier = activityTier(last)
    const frequency = normalizeFrequency((u.notificationPreference as any)?.notifyFrequency)
    const ulogs = logsBy.get(u.id) ?? []
    const myItems = itemsBy.get(u.id) ?? []
    const myViews = viewsBy.get(u.id) ?? []
    const myCart = cartBy.get(u.id) ?? []
    const cartItems = myCart.map(c => info(c.productId)).filter(Boolean) as PoolItem[]
    return {
      id: u.id,
      email: u.email,
      createdAt: u.createdAt,
      universityId: u.universityId,
      prefs: u.notificationPreference ? { emailEnabled: (u.notificationPreference as any).emailEnabled !== false, pushEnabled: (u.notificationPreference as any).pushEnabled !== false } : null,
      frequency,
      tier,
      cap: dailyCapFor(tier, frequency),
      todayCount: todayCount.get(u.id) ?? 0,
      hasOrder: myItems.length > 0 || lastOrder.has(u.id),
      boughtIds: new Set(myItems.map(i => i.productId)),
      sent14: new Set(ulogs.filter(l => l.key.startsWith('promo:')).map(l => l.key.split(':')[1])),
      sentTodayCats: ulogs.filter(l => l.key.startsWith('pcat:') && l.key.split(':')[2] === day).map(l => l.key.split(':')[1]),
      affinity: buildAffinity({
        views: myViews.flatMap(v => Array(Math.min(v._count._all, 5)).fill(catOf(v.productId!))),
        cart: myCart.map(c => catOf(c.productId)).filter(Boolean) as string[],
        orders: myItems.map(i => i.product.categoryKey ?? i.product.category),
        searches: (searchBy.get(u.id) ?? []).map(s => s.category as string),
      }),
      views: myViews
        .map(v => ({ productId: v.productId!, count: v._count._all, last: v._max.createdAt ?? new Date(0) }))
        .sort((a, b) => b.count - a.count || b.last.getTime() - a.last.getTime()),
      cart: cartItems,
      cartAgeOk: myCart.some(c => now - c.addedAt.getTime() > HOUR),
      emailedToday: ulogs.some(l => l.key === `cemail:${day}`),
      foStagesSent: new Set(ulogs.filter(l => l.key.startsWith('fo-email:')).map(l => l.key)),
      _info: info,
    } as UserCtx & { _info: (id: string) => PoolItem | undefined }
  })
}

// ── Message builders ────────────────────────────────────────────────────────

interface Built {
  opts: NotifyOptions
  product?: PoolItem
  /** Extra ids to treat as shown (cart items). */
  category?: string | null
}

const scarcity = (p: Candidate) => (p.quantity <= 5 ? ` Only ${p.quantity} left.` : '')

function emailCard(p: Candidate): EmailProduct {
  const pct = realPercentOff(p)
  return { image: p.image, name: p.name, price: naira(p.price), badge: pct ? `${pct}% off` : undefined, url: `/product/${p.id}` }
}

function build(slot: SlotNo, u: UserCtx & { _info?: (id: string) => PoolItem | undefined }, pool: PoolItem[], day: string, now: Date): Built | null {
  const mine = pool.filter(p => !p.universityId || !u.universityId || p.universityId === u.universityId)
  const exclude = new Set(Array.from(u.sent14).concat(Array.from(u.boughtIds)))
  const seed = `${u.id}:${day}:${slot}`
  const cats = Array.from(new Set(mine.map(p => p.categoryKey).filter(Boolean) as string[]))
  const { category } = chooseCategory({ affinity: u.affinity, available: cats, seed, sentTodayCats: u.sentTodayCats })
  const base = { campaign: true as const, dedupeKey: `cslot:${day}:${slot}`, metadata: { campaignSlot: slot } }
  const show = (p: PoolItem, extra: Partial<NotifyOptions>): Built => ({
    product: p,
    category: p.categoryKey,
    opts: { ...base, type: 'DEAL_ALERT', category: 'deals', url: `/product/${p.id}`, productId: p.id, image: p.image, ...extra } as NotifyOptions,
  })
  const forYou = () => pickCandidate(mine, { category, excludeIds: exclude, seed })

  if (slot === 1) {
    const p = forYou()
    if (!p) return null
    const pct = realPercentOff(p)
    return show(p, {
      title: `Picked for you: ${p.name}`,
      message: `${naira(p.price)}${pct ? `, ${pct}% below campus price` : ''}.${scarcity(p)}`,
    })
  }

  if (slot === 2) {
    const deal = pickCandidate(mine, { category, excludeIds: exclude, seed, require: x => realPercentOff(x) !== null, score: x => (x.categoryKey && u.affinity.has(x.categoryKey) ? 2 : 0) })
    const p = deal ?? forYou()
    if (!p) return null
    const pct = realPercentOff(p)
    return show(p, pct
      ? { title: `${pct}% off ${p.name}`, message: `Now ${naira(p.price)}, campus price was ${naira(p.marketPrice!)}.${scarcity(p)}` }
      : { title: `Hot on campus: ${p.name}`, message: `${naira(p.price)}. Students are looking at this.${scarcity(p)}` })
  }

  if (slot === 3) {
    const seen = u.views
      .map(v => ({ v, p: (u as any)._info?.(v.productId) as PoolItem | undefined }))
      .filter(x => x.p && !exclude.has(x.p.id) && x.p.image)
    if (seen.length) {
      const p = seen[0].p!
      const pct = realPercentOff(p)
      return show(p, {
        title: pct ? `${p.name} is ${pct}% below campus price` : `Still thinking about ${p.name}?`,
        message: `${naira(p.price)}.${p.quantity <= 3 ? ` Only ${p.quantity} left.` : ' It is still available.'}`,
      })
    }
    const p = pickCandidate(mine, { category, excludeIds: exclude, seed, require: x => realPercentOff(x) !== null || !!x.isHot })
    if (!p) return null
    const pct = realPercentOff(p)
    return show(p, { title: pct ? `${pct}% off ${p.name}` : `Popular right now: ${p.name}`, message: `${naira(p.price)}.${scarcity(p)}` })
  }

  if (slot === 4) {
    const fresh = pickCandidate(mine, { category, excludeIds: exclude, seed, require: x => x.isNew, score: x => (x.categoryKey === category ? 2 : 0) })
    if (fresh && (fresh.categoryKey === category || !mine.some(x => x.isHot && x.categoryKey === category))) {
      return show(fresh, { title: `New on campus: ${fresh.name}`, message: `Just listed at ${naira(fresh.price)}.${scarcity(fresh)}` })
    }
    const hot = pickCandidate(mine, { category, excludeIds: exclude, seed, require: x => !!x.isHot })
    const p = hot ?? fresh ?? forYou()
    if (!p) return null
    return show(p, p.isHot
      ? { title: `Trending on campus: ${p.name}`, message: `${naira(p.price)}. Students are looking at this right now.${scarcity(p)}` }
      : { title: `Have you seen ${p.name}?`, message: `${naira(p.price)}.${scarcity(p)}` })
  }

  if (slot === 5) {
    const cart = u.cart.filter(c => !exclude.has(c.id) && c.image)
    if (cart.length && u.cartAgeOk) {
      const p = cart[0]
      const more = u.cart.length - 1
      return {
        product: p,
        category: p.categoryKey,
        opts: {
          ...base, type: 'REMINDER', category: 'reminder', url: '/cart', productId: p.id, image: p.image,
          title: more > 0 ? `${p.name} and ${more} more in your cart` : `${p.name} is waiting in your cart`,
          message: `${naira(p.price)}.${scarcity(p) || ' Order today and pay safely, your money is held until delivery.'}`,
        },
      }
    }
    const p = forYou()
    if (!u.hasOrder) {
      return {
        product: p ?? undefined,
        category: p?.categoryKey,
        opts: {
          ...base, type: 'PROMO', category: 'marketing', url: p ? `/product/${p.id}` : '/marketplace',
          productId: p?.id, image: p?.image,
          title: 'You have not placed an order yet',
          message: `Delivery runs every Wednesday and Saturday, and your payment is held safely until you confirm it arrived.${p ? ` Start with ${p.name} at ${naira(p.price)}.` : ''}`,
        },
      }
    }
    if (!p) return null
    return show(p, { title: `You might like ${p.name}`, message: `${naira(p.price)}.${scarcity(p)}` })
  }

  // Slot 6: order tonight for the next delivery day.
  const cut = cutoffMessage(now)
  const inCart = u.cart.find(c => !exclude.has(c.id) && c.image && c.readyDays === 0)
  const p = inCart ?? pickCandidate(mine, { category, excludeIds: exclude, seed, require: x => x.readyDays === 0 })
  return {
    product: p ?? undefined,
    category: p?.categoryKey,
    opts: {
      ...base, type: 'DEAL_ALERT', category: 'deals', url: inCart ? '/cart' : p ? `/product/${p.id}` : '/marketplace',
      productId: p?.id, image: p?.image,
      title: cut.title,
      message: p ? `${p.name}, ${naira(p.price)}. ${cut.message}` : cut.message,
    },
  }
}

/** Slot 2 only: the one marketing email of the day, with 1 to 4 product cards. */
function buildEmail(u: UserCtx, main: PoolItem | undefined, pool: PoolItem[], day: string): { content: EmailContent & { subject: string }; stageKey?: string } | null {
  if (!main) return null
  const mine = pool.filter(p => !p.universityId || !u.universityId || p.universityId === u.universityId)
  const exclude = new Set(Array.from(u.sent14).concat(Array.from(u.boughtIds), [main.id]))
  const cards: PoolItem[] = [main]
  const wanted = 2 + (hash32(u.id + day) % 3) // 2 to 4 cards
  const usedCats = new Set<string | null>([main.categoryKey])
  for (let i = 0; cards.length < wanted && i < 12; i++) {
    const preferCat = Array.from(u.affinity.keys())[i % Math.max(1, u.affinity.size)] ?? null
    const c = pickCandidate(mine, {
      category: preferCat, excludeIds: exclude, seed: `${u.id}:${day}:e${i}`,
      require: x => !usedCats.has(x.categoryKey) || i > 6,
    })
    if (!c) break
    exclude.add(c.id)
    usedCats.add(c.categoryKey)
    cards.push(c)
  }
  const pct = realPercentOff(main)
  const stage = !u.hasOrder ? firstOrderStage(u.createdAt) : null
  const stageKey = stage ? `fo-email:${stage}` : undefined
  if (stageKey && u.foStagesSent.has(stageKey)) return null
  const products = cards.map(emailCard)

  if (stage) {
    const copy = {
      1: { subject: 'Your first order on BataMart', heading: 'Ready for your first order?', line: 'Browse what students near you are selling. Delivery runs every Wednesday and Saturday.' },
      3: { subject: 'How buying on BataMart keeps you safe', heading: 'Your money is protected', line: 'When you order, your payment is held in escrow and only released to the seller after you confirm delivery.' },
      7: { subject: 'Still looking? Here is what is moving', heading: 'Make your first order this week', line: 'Order before midnight on Tuesday or Friday to make the next delivery day.' },
    }[stage]
    return {
      stageKey,
      content: {
        subject: copy.subject, preheader: copy.line, eyebrow: 'Welcome', heading: copy.heading,
        lines: [copy.line, 'A few picks to start with:'], products, ctaLabel: 'Shop now', ctaUrl: '/marketplace',
      },
    }
  }
  return {
    content: {
      subject: emailSubject(hash32(u.id + day), main.name, pct),
      preheader: `${main.name} at ${naira(main.price)} and other finds from campus.`,
      eyebrow: 'Picked for you',
      heading: pct ? `${pct}% off ${main.name}` : 'Fresh finds on campus',
      lines: ['Here are products chosen from what students near you are browsing and buying.'],
      products, ctaLabel: 'See more on BataMart', ctaUrl: '/marketplace',
    },
  }
}

// ── The run ─────────────────────────────────────────────────────────────────

async function reachableIds(slot: SlotNo): Promise<string[]> {
  const [web, app] = await Promise.all([
    prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'], take: 8000 }),
    prisma.deviceToken.findMany({ select: { userId: true }, distinct: ['userId'], take: 8000 }),
  ])
  const ids = new Set([...web.map(w => w.userId), ...app.map(a => a.userId)])
  if (slot === EMAIL_SLOT) {
    // Email-only people too (recently active first); the daily budget limits how many get mail.
    const recent = await prisma.user.findMany({
      where: { isSuspended: false, isDeleted: false, email: { not: null }, role: { in: ['BUYER', 'SELLER'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
      take: 3000,
    })
    for (const r of recent) ids.add(r.id)
  }
  return Array.from(ids)
}

export async function runSlot(slot: SlotNo, { deadline, now = new Date() }: { deadline: number; now?: Date }): Promise<SlotRunResult> {
  const day = lagosDayKey(now)
  const budget = emailDailyBudget()
  const result: SlotRunResult = { slot, day, done: false, considered: 0, outcomes: {}, emails: 0, emailBudget: { used: 0, budget } }
  const runKey = `crun:${day}:${slot}`
  const finished = await prisma.notificationLog.findFirst({ where: { userId: 'system', key: runKey }, select: { id: true } })
  if (finished) return { ...result, alreadyDone: true, done: true }

  const pool = await loadPool()
  const poolById = new Map(pool.map(p => [p.id, p]))
  const all = await reachableIds(slot)

  // Skip people already handled for this slot today (resume after a timeout).
  const handled = new Set<string>()
  for (const part of chunked(all, 1000)) {
    const rows = await prisma.notificationLog.findMany({ where: { userId: { in: part }, key: { startsWith: `cdone:${day}:${slot}:` } }, select: { userId: true } })
    rows.forEach(r => handled.add(r.userId))
  }
  const todo = all.filter(id => !handled.has(id))

  // Most recently active first, so a tight email budget goes to people who read it.
  const activity = new Map<string, number>()
  for (const part of chunked(todo, 1000)) {
    const [s, o] = await Promise.all([
      prisma.userSessionEvent.groupBy({ by: ['userId'], where: { userId: { in: part }, createdAt: { gte: new Date(now.getTime() - 60 * DAY) } }, _max: { createdAt: true } }),
      prisma.order.groupBy({ by: ['buyerId'], where: { buyerId: { in: part } }, _max: { createdAt: true } }),
    ])
    s.forEach(x => x.userId && x._max.createdAt && activity.set(x.userId, Math.max(activity.get(x.userId) ?? 0, x._max.createdAt.getTime())))
    o.forEach(x => x._max.createdAt && activity.set(x.buyerId, Math.max(activity.get(x.buyerId) ?? 0, x._max.createdAt.getTime())))
  }
  todo.sort((a, b) => (activity.get(b) ?? 0) - (activity.get(a) ?? 0))

  const count = (o: string) => { result.outcomes[o] = (result.outcomes[o] ?? 0) + 1 }
  let complete = true

  for (const part of chunked(todo, 200)) {
    if (Date.now() > deadline - 4000) { complete = false; break }
    const ctxs = await buildContexts(part, day, slot, poolById)
    const outcomes: { userId: string; outcome: Outcome }[] = []
    const seen = new Set(ctxs.map(c => c.id))
    // Suspended / missing users: record so they are not reloaded.
    for (const id of part) if (!seen.has(id)) outcomes.push({ userId: id, outcome: 'pref' })

    for (const group of chunked(ctxs, 15)) {
      if (Date.now() > deadline) { complete = false; break }
      await Promise.all(group.map(async u => {
        let outcome: Outcome = 'error'
        try {
          outcome = await handleUser(slot, u as any, pool, day, now, result)
        } catch (error) {
          console.error('[campaign] user failed', u.id, error)
        }
        outcomes.push({ userId: u.id, outcome })
      }))
    }

    // Transient results (cap) are final for the day; 'error' is retried on resume.
    const final = outcomes.filter(o => o.outcome !== 'error')
    outcomes.forEach(o => count(o.outcome))
    result.considered += outcomes.length
    if (final.length) {
      await prisma.notificationLog.createMany({
        data: final.map(o => ({ userId: o.userId, key: `cdone:${day}:${slot}:${o.outcome}` })),
        skipDuplicates: true,
      }).catch(() => {})
    }
    if (Date.now() > deadline) { complete = false; break }
  }

  result.emailBudget.used = await prisma.notificationLog.count({ where: { userId: 'system', key: { startsWith: `email-budget:${day}:` } } })
  if (complete) {
    await prisma.notificationLog.create({ data: { userId: 'system', key: runKey } }).catch(() => {})
    result.done = true
  }
  return result
}

async function handleUser(slot: SlotNo, u: UserCtx & { _info?: any }, pool: PoolItem[], day: string, now: Date, result: SlotRunResult): Promise<Outcome> {
  if (u.frequency === 'ORDERS_ONLY') return 'frequency'
  if (u.todayCount >= u.cap) return 'cap'

  const built = build(slot, u, pool, day, now)
  if (!built) return 'nocand'
  const opts: NotifyOptions = { ...built.opts, dailyCap: u.cap }

  // Slot 2 carries the day's one marketing email, within the daily budget.
  let budgetKey: string | null = null
  let stageKey: string | undefined
  if (slot === EMAIL_SLOT && u.email && u.prefs?.emailEnabled !== false && !u.emailedToday) {
    const mail = buildEmail(u, built.product, pool, day)
    if (mail) {
      budgetKey = await claimEmailBudget(day)
      if (budgetKey) {
        opts.email = mail.content
        stageKey = mail.stageKey
      }
    }
  }

  const res = await notifyUser(u.id, opts)

  if (budgetKey) {
    if (res.channels.email) {
      result.emails++
      if (stageKey) await prisma.notificationLog.create({ data: { userId: u.id, key: stageKey } }).catch(() => {})
    } else {
      await releaseEmailBudget(budgetKey)
    }
  }

  if (res.sent) {
    const rows: { userId: string; key: string }[] = []
    if (built.product) rows.push({ userId: u.id, key: `promo:${built.product.id}:${day}:${slot}` })
    if (built.category) rows.push({ userId: u.id, key: `pcat:${built.category}:${day}:${slot}` })
    if (rows.length) await prisma.notificationLog.createMany({ data: rows, skipDuplicates: true }).catch(() => {})
    return 'sent'
  }
  if (res.skipped === 'cap' || res.skipped === 'quiet' || res.skipped === 'frequency' || res.skipped === 'preference' || res.skipped === 'duplicate') {
    return res.skipped === 'preference' ? 'pref' : (res.skipped as Outcome)
  }
  // Nothing reached a device (no push token and no email): not an error.
  return 'nocand'
}

export { SLOT_TIMES }
