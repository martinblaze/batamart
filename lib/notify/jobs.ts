// lib/notify/jobs.ts
// The scheduled half of notifications: reminders, deals, retention, summaries.
// Each job is idempotent (dedupeKey) and bounded (caps + a shared deadline),
// so a cron run can be retried or overlap without double-sending or timing out.
// Run from /api/cron/notify-morning and /api/cron/notify-evening.

import { prisma } from '@/lib/prisma'
import { notifyUser, notifyMany, adminIds, type NotifyOptions } from '@/lib/notify/dispatch'
import { releaseMaturedSellerEscrowForUser } from '@/lib/escrow'
import { getEffectiveDeliveryDate, getLagosToday, lagosDayKey, parseReadyDays } from '@/lib/delivery/schedule'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`

const lagosNow = () => new Date(Date.now() + HOUR)
const lagosWeekday = () => lagosNow().getUTCDay() // 0 = Sunday
const isoWeek = () => {
  const d = lagosNow()
  const start = Date.UTC(d.getUTCFullYear(), 0, 1)
  return `${d.getUTCFullYear()}-w${Math.floor((d.getTime() - start) / (7 * DAY))}`
}
const yearMonth = () => lagosNow().toISOString().slice(0, 7)

const LIVE_PRODUCT = {
  isActive: true,
  isDeleted: false,
  quantity: { gt: 0 },
  moderationStatus: { notIn: ['UNDER_REVIEW', 'REMOVED'] as any },
}

export interface JobContext {
  deadline: number
}
export type JobResult = Record<string, number | string>

const left = (ctx: JobContext) => ctx.deadline - Date.now()

/** Everyone reachable by a device push (web or app). */
async function pushReachableUserIds(): Promise<string[]> {
  const [web, app] = await Promise.all([
    prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'], take: 5000 }),
    prisma.deviceToken.findMany({ select: { userId: true }, distinct: ['userId'], take: 5000 }),
  ])
  return Array.from(new Set([...web.map(w => w.userId), ...app.map(a => a.userId)]))
}

// ── Delivery day reminders ──────────────────────────────────────────────────

export async function deliveryReminders(mode: 'today' | 'tomorrow', ctx: JobContext): Promise<JobResult> {
  const target = lagosDayKey(new Date(getLagosToday().getTime() + (mode === 'tomorrow' ? DAY : 0)))
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PENDING', 'PROCESSING', 'RIDER_ASSIGNED', 'PICKED_UP', 'AT_HUB', 'PACKED', 'ON_THE_WAY'] },
      isDisputed: false,
      createdAt: { gte: new Date(Date.now() - 45 * DAY) },
    },
    select: {
      id: true, orderNumber: true, createdAt: true, deferredUntil: true, status: true,
      buyerId: true, sellerId: true,
      buyer: { select: { universityId: true } },
      product: { select: { deliveryEstimate: true } },
      items: { select: { product: { select: { deliveryEstimate: true } } } },
    },
  })

  const due = orders.filter(o => {
    const est = o.items.length ? o.items.map(i => i.product.deliveryEstimate) : [o.product.deliveryEstimate]
    const ready = Math.max(0, ...est.map(parseReadyDays))
    return lagosDayKey(getEffectiveDeliveryDate(o, ready)) === target
  })
  if (due.length === 0) return { due: 0 }

  const word = mode === 'today' ? 'today' : 'tomorrow'
  const byBuyer = new Map<string, typeof due>()
  const bySeller = new Map<string, typeof due>()
  const riderDemand = new Map<string, number>() // universityId -> open pickups
  for (const o of due) {
    byBuyer.set(o.buyerId, [...(byBuyer.get(o.buyerId) ?? []), o])
    if (['PENDING', 'PROCESSING', 'RIDER_ASSIGNED'].includes(o.status)) {
      bySeller.set(o.sellerId, [...(bySeller.get(o.sellerId) ?? []), o])
      if (o.status !== 'RIDER_ASSIGNED' && o.buyer.universityId) {
        riderDemand.set(o.buyer.universityId, (riderDemand.get(o.buyer.universityId) ?? 0) + 1)
      }
    }
  }

  const buyers = await notifyMany(Array.from(byBuyer.keys()), id => {
    const list = byBuyer.get(id)!
    return {
      category: 'reminder',
      title: list.length > 1 ? `${list.length} orders arrive ${word}` : `Your order arrives ${word}`,
      message: list.length > 1
        ? `You have ${list.length} orders on the delivery run ${word}. Keep your phone close.`
        : `Order #${list[0].orderNumber} is on the delivery run ${word}. Keep your phone close.`,
      url: list.length > 1 ? '/orders' : `/orders/${list[0].id}`,
      dedupeKey: `deliv-${mode}:${id}:${target}`,
    }
  }, { deadline: ctx.deadline })

  const sellers = await notifyMany(Array.from(bySeller.keys()), id => {
    const list = bySeller.get(id)!
    return {
      category: 'reminder',
      title: `${list.length} parcel${list.length > 1 ? 's' : ''} go out ${word}`,
      message: `Have ${list.length > 1 ? 'them' : 'it'} wrapped and labelled with the buyer's username. Tap Mark picked up when the rider collects.`,
      url: '/orders/sales',
      dedupeKey: `pickup-${mode}:${id}:${target}`,
    }
  }, { deadline: ctx.deadline })

  let riders = 0
  for (const [universityId, count] of Array.from(riderDemand.entries())) {
    const riderRows = await prisma.user.findMany({
      where: { role: 'RIDER', universityId, isSuspended: false },
      select: { id: true },
    })
    const r = await notifyMany(riderRows.map(x => x.id), id => ({
      category: 'reminder',
      title: mode === 'today' ? `${count} pickup${count > 1 ? 's' : ''} open today` : `${count} pickup${count > 1 ? 's' : ''} open tomorrow`,
      message: 'Open the Pickups tab, take an area and head out. Earn your delivery fee on every order.',
      url: '/rider-dashboard',
      dedupeKey: `rider-open-${mode}:${id}:${target}`,
    }), { deadline: ctx.deadline })
    riders += r.sent
  }

  return { due: due.length, buyers: buyers.sent, sellers: sellers.sent, riders }
}

// ── Order follow-ups ────────────────────────────────────────────────────────

export async function sellerAcceptReminders(ctx: JobContext): Promise<JobResult> {
  const orders = await prisma.order.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 2 * HOUR), gt: new Date(Date.now() - 3 * DAY) } },
    select: { id: true, orderNumber: true, sellerId: true },
    take: 300,
  })
  let sent = 0
  for (const o of orders) {
    if (left(ctx) < 0) break
    const res = await notifyUser(o.sellerId, {
      category: 'transactional',
      title: 'A buyer is waiting on you',
      message: `Order #${o.orderNumber} has not been accepted yet. Accept it so a rider can be lined up.`,
      url: '/orders/sales',
      orderId: o.id,
      dedupeKey: `accept-reminder:${o.id}`,
    })
    if (res.sent) sent++
  }
  return { sellerAcceptReminders: sent }
}

export async function deliveryConfirmReminders(ctx: JobContext): Promise<JobResult> {
  const orders = await prisma.order.findMany({
    where: { status: 'ON_THE_WAY', updatedAt: { lt: new Date(Date.now() - 6 * HOUR), gt: new Date(Date.now() - 4 * DAY) } },
    select: { id: true, orderNumber: true, buyerId: true },
    take: 300,
  })
  let sent = 0
  for (const o of orders) {
    if (left(ctx) < 0) break
    const res = await notifyUser(o.buyerId, {
      category: 'reminder',
      title: 'Did your order arrive?',
      message: `Order #${o.orderNumber} was out for delivery. If you have it, tap Mark delivered so the rider is paid.`,
      url: `/orders/${o.id}`,
      orderId: o.id,
      dedupeKey: `confirm-reminder:${o.id}`,
    })
    if (res.sent) sent++
  }
  return { deliveryConfirmReminders: sent }
}

export async function reviewRequests(ctx: JobContext): Promise<JobResult> {
  const orders = await prisma.order.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { lte: new Date(Date.now() - 20 * HOUR), gte: new Date(Date.now() - 72 * HOUR) },
      reviews: { none: {} },
      productReviews: { none: {} },
    },
    select: { id: true, orderNumber: true, buyerId: true, product: { select: { name: true } } },
    take: 300,
  })
  let sent = 0
  for (const o of orders) {
    if (left(ctx) < 0) break
    const res = await notifyUser(o.buyerId, {
      category: 'reminder',
      title: `How was ${o.product.name}?`,
      message: 'Your review helps other students buy with confidence. It takes ten seconds.',
      url: `/orders/${o.id}`,
      orderId: o.id,
      dedupeKey: `review-request:${o.id}`,
    })
    if (res.sent) sent++
  }
  return { reviewRequests: sent }
}

// Releases matured seller escrow on schedule (until now it only happened when
// the seller opened their wallet) and tells them the money landed.
export async function escrowReleases(ctx: JobContext): Promise<JobResult> {
  const rows = await prisma.order.findMany({
    where: {
      status: { in: ['DELIVERED', 'COMPLETED'] },
      isDisputed: false,
      dispute: null,
      deliveredAt: { not: null, lte: new Date(Date.now() - 48 * HOUR), gte: new Date(Date.now() - 14 * DAY) },
    },
    select: { sellerId: true },
    distinct: ['sellerId'],
    take: 150,
  })
  let released = 0
  let amount = 0
  for (const { sellerId } of rows) {
    if (left(ctx) < 0) break
    const r = await releaseMaturedSellerEscrowForUser(sellerId).catch(() => ({ releasedCount: 0, releasedAmount: 0 }))
    if (r.releasedCount > 0) {
      released++
      amount += r.releasedAmount
      await notifyUser(sellerId, {
        category: 'transactional',
        type: 'PAYMENT_RECEIVED',
        title: `${naira(r.releasedAmount)} released to your wallet`,
        message: `${r.releasedCount} order${r.releasedCount > 1 ? 's' : ''} cleared the 48-hour window. It is ready to withdraw.`,
        url: '/wallet',
        email: {
          subject: `${naira(r.releasedAmount)} is ready to withdraw`,
          eyebrow: 'Wallet',
          heading: 'Your money is released',
          lines: [`${r.releasedCount} order${r.releasedCount > 1 ? 's' : ''} cleared the dispute window.`],
          rows: [{ label: 'Released', value: naira(r.releasedAmount) }],
          ctaLabel: 'Open wallet',
          ctaUrl: '/wallet',
        },
      })
    }
  }
  return { sellersReleased: released, amount }
}

export async function lowStockAlerts(ctx: JobContext): Promise<JobResult> {
  const products = await prisma.product.findMany({
    where: { ...LIVE_PRODUCT, quantity: { gt: 0, lte: 2 } },
    select: { id: true, name: true, quantity: true, sellerId: true },
    take: 200,
  })
  let sent = 0
  for (const p of products) {
    if (left(ctx) < 0) break
    const res = await notifyUser(p.sellerId, {
      category: 'reminder',
      type: 'STOCK_ALERT',
      title: `Only ${p.quantity} left of ${p.name}`,
      message: 'Restock to keep selling. Sold-out items drop out of search.',
      url: '/my-shop',
      productId: p.id,
      dedupeKey: `lowstock:${p.id}:${p.quantity}`,
    })
    if (res.sent) sent++
  }
  return { lowStockAlerts: sent }
}

// ── Deals: the main reason to open the app ─────────────────────────────────

export async function dealAlerts(ctx: JobContext): Promise<JobResult> {
  const featured = await prisma.notificationLog.findMany({
    where: { userId: 'system', key: { startsWith: 'featured:' }, createdAt: { gte: new Date(Date.now() - 3 * DAY) } },
    select: { key: true },
  })
  const skip = new Set(featured.map(f => f.key.replace('featured:', '')))

  const [deals, hot] = await Promise.all([
    prisma.product.findMany({
      where: { ...LIVE_PRODUCT, isDeal: true, discountPercent: { gte: 5 } },
      orderBy: { discountPercent: 'desc' },
      take: 20,
      select: { id: true, name: true, price: true, marketPrice: true, discountPercent: true, quantity: true, categoryKey: true, universityId: true },
    }),
    prisma.product.findMany({
      where: { ...LIVE_PRODUCT, isHot: true },
      orderBy: { hotScore: 'desc' },
      take: 20,
      select: { id: true, name: true, price: true, marketPrice: true, discountPercent: true, quantity: true, categoryKey: true, universityId: true },
    }),
  ])

  const flash = deals.find(p => !skip.has(p.id))
  const trending = hot.find(p => !skip.has(p.id) && p.id !== flash?.id)
  const reachable = await pushReachableUserIds()
  const out: JobResult = { reachable: reachable.length }

  const send = async (product: (typeof deals)[number], kind: 'flash' | 'hot') => {
    const universityUsers = await prisma.user.findMany({
      where: {
        id: { in: reachable },
        isSuspended: false,
        ...(product.universityId ? { universityId: product.universityId } : {}),
      },
      select: { id: true },
    })
    const eligible = universityUsers.map(u => u.id)

    // People who have bought this kind of thing before hear first.
    const affinity = product.categoryKey
      ? await prisma.order.findMany({
          where: { buyerId: { in: eligible }, items: { some: { product: { categoryKey: product.categoryKey } } } },
          select: { buyerId: true },
          distinct: ['buyerId'],
          take: 600,
        })
      : []
    const first = new Set(affinity.map(a => a.buyerId))
    const ordered = [...eligible.filter(id => first.has(id)), ...eligible.filter(id => !first.has(id))].slice(0, 800)

    const scarcity = product.quantity <= 5 ? ` Only ${product.quantity} left.` : ''
    const base: NotifyOptions = kind === 'flash'
      ? {
          category: 'deals',
          type: 'DEAL_ALERT',
          title: `Flash deal: ${product.discountPercent}% off ${product.name}`,
          message: `Now ${naira(product.price)}${product.marketPrice ? `, campus price was ${naira(product.marketPrice)}` : ''}.${scarcity}`,
          url: `/product/${product.id}`,
          productId: product.id,
        }
      : {
          category: 'deals',
          type: 'DEAL_ALERT',
          title: `Hot on campus: ${product.name}`,
          message: `${naira(product.price)}. Students are looking at this right now.${scarcity}`,
          url: `/product/${product.id}`,
          productId: product.id,
        }

    const r = await notifyMany(ordered, id => ({ ...base, dedupeKey: `deal:${product.id}:${id}` }), { deadline: ctx.deadline })
    await prisma.notificationLog.create({ data: { userId: 'system', key: `featured:${product.id}` } }).catch(() => {})
    return r.sent
  }

  if (flash) out.flashSent = await send(flash, 'flash')
  if (trending && left(ctx) > 0) out.hotSent = await send(trending, 'hot')
  return out
}

// A seller you have bought from listed something new.
export async function newArrivalsFromSellers(ctx: JobContext): Promise<JobResult> {
  const products = await prisma.product.findMany({
    where: { ...LIVE_PRODUCT, createdAt: { gte: new Date(Date.now() - 26 * HOUR) } },
    select: { id: true, name: true, price: true, sellerId: true, seller: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })
  let sent = 0
  for (const p of products) {
    if (left(ctx) < 0) break
    const buyers = await prisma.order.findMany({
      where: { sellerId: p.sellerId, status: { in: ['COMPLETED', 'DELIVERED'] } },
      select: { buyerId: true },
      distinct: ['buyerId'],
      take: 100,
    })
    const r = await notifyMany(buyers.map(b => b.buyerId), id => ({
      category: 'deals',
      title: `New from ${p.seller.name}`,
      message: `${p.name} just dropped at ${naira(p.price)}.`,
      url: `/product/${p.id}`,
      productId: p.id,
      dedupeKey: `newlist:${p.id}:${id}`,
    }), { deadline: ctx.deadline })
    sent += r.sent
  }
  return { newArrivalAlerts: sent }
}

// Looked at the same item twice and did not buy: a nudge, with the price if
// it has become a deal since.
export async function viewedNotBought(ctx: JobContext): Promise<JobResult> {
  const views = await prisma.userSessionEvent.groupBy({
    by: ['userId', 'productId'],
    where: { eventType: 'view', userId: { not: null }, productId: { not: null }, createdAt: { gte: new Date(Date.now() - 3 * DAY) } },
    _count: { _all: true },
    having: { productId: { _count: { gte: 2 } } },
    orderBy: { _count: { productId: 'desc' } },
    take: 300,
  })
  if (views.length === 0) return { retargeted: 0 }

  const productIds = Array.from(new Set(views.map(v => v.productId!)))
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, ...LIVE_PRODUCT },
    select: { id: true, name: true, price: true, quantity: true, isDeal: true, discountPercent: true },
  })
  const byId = new Map(products.map(p => [p.id, p]))
  const bought = await prisma.orderItem.findMany({
    where: { productId: { in: productIds }, order: { buyerId: { in: Array.from(new Set(views.map(v => v.userId!))) } } },
    select: { productId: true, order: { select: { buyerId: true } } },
  })
  const boughtSet = new Set(bought.map(b => `${b.order.buyerId}:${b.productId}`))

  let sent = 0
  for (const v of views) {
    if (left(ctx) < 0) break
    const p = byId.get(v.productId!)
    if (!p || boughtSet.has(`${v.userId}:${p.id}`)) continue
    const res = await notifyUser(v.userId!, {
      category: 'deals',
      type: 'DEAL_ALERT',
      title: p.isDeal && p.discountPercent ? `${p.name} is ${p.discountPercent}% below campus price` : `Still thinking about ${p.name}?`,
      message: `${naira(p.price)}.${p.quantity <= 3 ? ` Only ${p.quantity} left.` : ' It is still available.'}`,
      url: `/product/${p.id}`,
      productId: p.id,
      dedupeKey: `retarget:${p.id}:${v.userId}`,
    })
    if (res.sent) sent++
  }
  return { retargeted: sent }
}

// ── Retention ───────────────────────────────────────────────────────────────

export async function winBack(ctx: JobContext): Promise<JobResult> {
  const since = new Date(Date.now() - 14 * DAY)
  const reachable = await pushReachableUserIds()
  if (reachable.length === 0) return { winBack: 0 }

  const [sessions, buyers, sellers] = await Promise.all([
    prisma.userSessionEvent.findMany({ where: { userId: { in: reachable }, createdAt: { gte: since } }, select: { userId: true }, distinct: ['userId'] }),
    prisma.order.findMany({ where: { buyerId: { in: reachable }, createdAt: { gte: since } }, select: { buyerId: true }, distinct: ['buyerId'] }),
    prisma.order.findMany({ where: { sellerId: { in: reachable }, createdAt: { gte: since } }, select: { sellerId: true }, distinct: ['sellerId'] }),
  ])
  const active = new Set<string>([...sessions.map(s => s.userId!), ...buyers.map(b => b.buyerId), ...sellers.map(s => s.sellerId)])
  const inactive = reachable.filter(id => !active.has(id)).slice(0, 400)
  const dealCount = await prisma.product.count({ where: { ...LIVE_PRODUCT, isDeal: true } })

  const week = isoWeek()
  const r = await notifyMany(inactive, id => ({
    category: 'marketing',
    type: 'PROMO',
    title: 'We saved some deals for you',
    message: dealCount > 0 ? `${dealCount} deals are live on campus right now. Come and see what you missed.` : 'New listings dropped on campus. Come and see what you missed.',
    url: '/marketplace',
    dedupeKey: `winback:${week}:${id}`,
  }), { deadline: ctx.deadline })
  return { inactiveFound: inactive.length, winBackSent: r.sent }
}

export async function walletBalanceReminders(ctx: JobContext): Promise<JobResult> {
  const users = await prisma.user.findMany({
    where: { availableBalance: { gte: 500 }, isSuspended: false, role: { in: ['BUYER', 'SELLER'] } },
    select: { id: true, availableBalance: true },
    orderBy: { availableBalance: 'desc' },
    take: 400,
  })
  const week = isoWeek()
  const byId = new Map(users.map(u => [u.id, Number(u.availableBalance)]))
  const r = await notifyMany(users.map(u => u.id), id => ({
    category: 'marketing',
    type: 'WALLET_ACTIVITY',
    title: `You have ${naira(byId.get(id)!)} in your wallet`,
    message: 'Spend it on a deal at checkout, or withdraw it any time.',
    url: '/wallet',
    dedupeKey: `wallet-balance:${week}:${id}`,
  }), { deadline: ctx.deadline })
  return { walletReminders: r.sent }
}

export async function referralNudges(ctx: JobContext): Promise<JobResult> {
  const reachable = await pushReachableUserIds()
  const users = await prisma.user.findMany({
    where: { id: { in: reachable }, role: { in: ['BUYER', 'SELLER'] }, isSuspended: false },
    select: { id: true },
    take: 400,
  })
  const month = yearMonth()
  const r = await notifyMany(users.map(u => u.id), id => ({
    category: 'marketing',
    type: 'PROMO',
    title: 'Invite friends, earn on every order',
    message: 'You earn ₦120 for each order your friends get delivered. Share your code from the Referrals page.',
    url: '/referrals',
    dedupeKey: `ref-nudge:${month}:${id}`,
  }), { deadline: ctx.deadline })
  return { referralNudges: r.sent }
}

export async function sellerWeeklySummary(ctx: JobContext): Promise<JobResult> {
  const since = new Date(Date.now() - 7 * DAY)
  const sellers = await prisma.user.findMany({
    where: { role: 'SELLER', isSuspended: false },
    select: { id: true, name: true, pendingBalance: true, availableBalance: true },
    take: 300,
  })
  const orders = await prisma.order.groupBy({
    by: ['sellerId'],
    where: { sellerId: { in: sellers.map(s => s.id) }, createdAt: { gte: since }, status: { not: 'CANCELLED' } },
    _count: { _all: true },
    _sum: { productPrice: true },
  })
  const stats = new Map(orders.map(o => [o.sellerId, { count: o._count._all, revenue: o._sum.productPrice ?? 0 }]))
  const week = isoWeek()

  const r = await notifyMany(sellers.map(s => s.id), id => {
    const s = sellers.find(x => x.id === id)!
    const st = stats.get(id)
    return st
      ? {
          category: 'marketing',
          type: 'DIGEST',
          title: `Your week: ${st.count} order${st.count > 1 ? 's' : ''}, ${naira(st.revenue)}`,
          message: `${naira(Number(s.pendingBalance))} is still in escrow and ${naira(Number(s.availableBalance))} is ready to withdraw.`,
          url: '/wallet',
          dedupeKey: `seller-week:${week}:${id}`,
          email: {
            subject: `Your BataMart week: ${st.count} order${st.count > 1 ? 's' : ''}`,
            eyebrow: 'Weekly summary',
            heading: 'Here is how your shop did',
            lines: ['Keep your listings stocked and your parcels labelled to keep the momentum.'],
            rows: [
              { label: 'Orders this week', value: String(st.count) },
              { label: 'Sales', value: naira(st.revenue) },
              { label: 'In escrow', value: naira(Number(s.pendingBalance)) },
              { label: 'Ready to withdraw', value: naira(Number(s.availableBalance)) },
            ],
            ctaLabel: 'Open wallet',
            ctaUrl: '/wallet',
          },
        }
      : {
          category: 'marketing',
          type: 'DIGEST',
          title: 'No orders yet this week',
          message: 'Share your shop link and add sharp photos. Listings with clear photos sell faster.',
          url: '/my-shop',
          dedupeKey: `seller-week:${week}:${id}`,
        }
  }, { deadline: ctx.deadline })
  return { sellerSummaries: r.sent }
}

export async function sellerInactivityNudges(ctx: JobContext): Promise<JobResult> {
  const cutoff = new Date(Date.now() - 14 * DAY)
  const sellers = await prisma.user.findMany({
    where: { role: 'SELLER', isSuspended: false, products: { none: { createdAt: { gte: cutoff } } } },
    select: { id: true },
    take: 200,
  })
  const month = yearMonth()
  const r = await notifyMany(sellers.map(s => s.id), id => ({
    category: 'marketing',
    type: 'PROMO',
    title: 'List something new this week',
    message: 'Fresh listings are shown first. It takes a minute to post.',
    url: '/sell',
    dedupeKey: `seller-inactive:${month}:${id}`,
  }), { deadline: ctx.deadline })
  return { sellerNudges: r.sent }
}

// ── Weekly digest email ─────────────────────────────────────────────────────

export async function weeklyDigest(ctx: JobContext): Promise<JobResult> {
  const [deals, fresh] = await Promise.all([
    prisma.product.findMany({
      where: { ...LIVE_PRODUCT, isDeal: true },
      orderBy: { discountPercent: 'desc' },
      take: 5,
      select: { name: true, price: true, discountPercent: true },
    }),
    prisma.product.findMany({
      where: { ...LIVE_PRODUCT, createdAt: { gte: new Date(Date.now() - 7 * DAY) } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { name: true, price: true },
    }),
  ])
  if (deals.length === 0 && fresh.length === 0) return { digest: 0 }

  const users = await prisma.user.findMany({
    where: { isSuspended: false, role: { in: ['BUYER', 'SELLER'] }, email: { not: null } },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
  const week = isoWeek()
  const rows = [
    ...deals.map(d => ({ label: `${d.name}${d.discountPercent ? ` (-${d.discountPercent}%)` : ''}`, value: naira(d.price) })),
    ...fresh.map(f => ({ label: `New: ${f.name}`, value: naira(f.price) })),
  ]
  const r = await notifyMany(users.map(u => u.id), id => ({
    category: 'marketing',
    type: 'DIGEST',
    title: 'Your weekly campus digest',
    message: `${deals.length} top deals and ${fresh.length} new listings this week.`,
    url: '/marketplace',
    dedupeKey: `digest:${week}:${id}`,
    email: {
      subject: 'This week on BataMart: deals and new listings',
      eyebrow: 'Weekly digest',
      heading: 'What is moving on campus',
      lines: ['The best deals and freshest listings from students around Awka.'],
      rows,
      ctaLabel: 'See all deals',
      ctaUrl: '/marketplace',
    },
  }), { concurrency: 8, deadline: ctx.deadline })
  return { digestSent: r.sent }
}

// ── Operations ──────────────────────────────────────────────────────────────

export async function adminDailySummary(ctx: JobContext): Promise<JobResult> {
  const since = new Date(Date.now() - DAY)
  const [placed, cancelled, completed, openDisputes, pendingWithdrawals, stuck] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { status: 'CANCELLED', updatedAt: { gte: since } } }),
    prisma.order.count({ where: { status: 'COMPLETED', completedAt: { gte: since } } }),
    prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
    prisma.withdrawalRequest.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
    prisma.order.count({ where: { status: { in: ['PICKED_UP', 'AT_HUB'] }, updatedAt: { lt: new Date(Date.now() - DAY) } } }),
  ])
  const day = lagosDayKey(new Date())
  const ids = await adminIds()
  const r = await notifyMany(ids, id => ({
    category: 'transactional',
    title: `Yesterday: ${placed} orders, ${completed} completed`,
    message: `${cancelled} cancelled, ${openDisputes} open disputes, ${pendingWithdrawals} withdrawals pending${stuck ? `, ${stuck} parcels stuck at the hub` : ''}.`,
    url: '/admin',
    dedupeKey: `admin-summary:${day}:${id}`,
    email: {
      subject: `BataMart daily summary, ${day}`,
      eyebrow: 'Daily summary',
      heading: 'Last 24 hours',
      lines: [stuck ? `${stuck} parcel${stuck > 1 ? 's have' : ' has'} been in transit or at the hub for more than a day.` : 'Nothing is stuck at the hub.'],
      rows: [
        { label: 'Orders placed', value: String(placed) },
        { label: 'Orders completed', value: String(completed) },
        { label: 'Orders cancelled', value: String(cancelled) },
        { label: 'Open disputes', value: String(openDisputes) },
        { label: 'Withdrawals pending', value: String(pendingWithdrawals) },
        { label: 'Stuck at hub', value: String(stuck) },
      ],
      ctaLabel: 'Open admin',
      ctaUrl: '/admin',
    },
  }), { deadline: ctx.deadline })
  return { adminSummaries: r.sent }
}

export async function stuckOrderAlerts(ctx: JobContext): Promise<JobResult> {
  const stuck = await prisma.order.findMany({
    where: { status: { in: ['PICKED_UP', 'AT_HUB'] }, updatedAt: { lt: new Date(Date.now() - 30 * HOUR) } },
    select: { id: true, orderNumber: true },
    take: 20,
  })
  if (stuck.length === 0) return { stuck: 0 }
  const ids = await adminIds()
  const day = lagosDayKey(new Date())
  const r = await notifyMany(ids, id => ({
    category: 'transactional',
    title: `${stuck.length} parcel${stuck.length > 1 ? 's' : ''} stuck`,
    message: `Orders ${stuck.slice(0, 3).map(s => `#${s.orderNumber}`).join(', ')}${stuck.length > 3 ? ' and more' : ''} have not moved in over a day.`,
    url: '/admin/sorting',
    dedupeKey: `stuck:${day}:${id}`,
  }), { deadline: ctx.deadline })
  return { stuck: stuck.length, alerted: r.sent }
}

// ── The two daily bundles ───────────────────────────────────────────────────

async function runAll(tasks: [string, () => Promise<JobResult>][], ctx: JobContext) {
  const results: Record<string, JobResult | { error: string }> = {}
  for (const [name, task] of tasks) {
    if (left(ctx) < 2000) {
      results[name] = { error: 'skipped: out of time' }
      continue
    }
    try {
      results[name] = await task()
    } catch (error: any) {
      console.error(`[notify-job] ${name} failed:`, error)
      results[name] = { error: String(error?.message ?? error) }
    }
  }
  return results
}

/** 07:00 Lagos. */
export function runMorning(ctx: JobContext) {
  const sunday = lagosWeekday() === 0
  return runAll(
    [
      ['deliveryToday', () => deliveryReminders('today', ctx)],
      ['escrowReleases', () => escrowReleases(ctx)],
      ['sellerAcceptReminders', () => sellerAcceptReminders(ctx)],
      ['deliveryConfirmReminders', () => deliveryConfirmReminders(ctx)],
      ['reviewRequests', () => reviewRequests(ctx)],
      ['dealAlerts', () => dealAlerts(ctx)],
      ['viewedNotBought', () => viewedNotBought(ctx)],
      ['lowStockAlerts', () => lowStockAlerts(ctx)],
      ['adminDailySummary', () => adminDailySummary(ctx)],
      ...(lagosWeekday() === 1 ? ([['winBack', () => winBack(ctx)]] as [string, () => Promise<JobResult>][]) : []),
      ...(sunday ? ([['walletBalanceReminders', () => walletBalanceReminders(ctx)]] as [string, () => Promise<JobResult>][]) : []),
    ],
    ctx,
  )
}

/** 18:00 Lagos. */
export function runEvening(ctx: JobContext) {
  const day = lagosWeekday()
  return runAll(
    [
      ['deliveryTomorrow', () => deliveryReminders('tomorrow', ctx)],
      ['dealAlerts', () => dealAlerts(ctx)],
      ['newArrivalsFromSellers', () => newArrivalsFromSellers(ctx)],
      ['stuckOrderAlerts', () => stuckOrderAlerts(ctx)],
      ...(day === 0
        ? ([
            ['weeklyDigest', () => weeklyDigest(ctx)],
            ['sellerWeeklySummary', () => sellerWeeklySummary(ctx)],
          ] as [string, () => Promise<JobResult>][])
        : []),
      ...(day === 4 ? ([['referralNudges', () => referralNudges(ctx)]] as [string, () => Promise<JobResult>][]) : []),
      ...(day === 3 ? ([['sellerInactivityNudges', () => sellerInactivityNudges(ctx)]] as [string, () => Promise<JobResult>][]) : []),
    ],
    ctx,
  )
}
