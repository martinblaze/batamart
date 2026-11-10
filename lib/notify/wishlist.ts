// lib/notify/wishlist.ts
// Saved-item alerts: a real price drop (>= 5%) or "nearly gone" (<= 3 left).
// Types only from jobs.ts so there is no import cycle.

import { prisma } from '@/lib/prisma'
import { notifyUser, type NotifyOptions } from '@/lib/notify/dispatch'
import type { JobContext, JobResult } from '@/lib/notify/jobs'
import { detectDrop, isLowStock } from '@/lib/wishlist/logic'

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`
const PAGE = 500
const MAX_ROWS = 5000
const CONCURRENCY = 6

export async function wishlistPriceDrops(ctx: JobContext): Promise<JobResult> {
  const out = { scanned: 0, drops: 0, lowStock: 0, skipped: 0 }
  let cursor: string | undefined

  while (out.scanned < MAX_ROWS && Date.now() < ctx.deadline) {
    const rows = await prisma.wishlistItem.findMany({
      where: {
        product: {
          isActive: true,
          isDeleted: false,
          quantity: { gt: 0 },
          moderationStatus: { notIn: ['UNDER_REVIEW', 'REMOVED'] as any },
        },
      },
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, userId: true, productId: true, priceWhenSaved: true, lastNotifiedPrice: true,
        product: { select: { name: true, price: true, quantity: true, images: true } },
      },
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1].id
    out.scanned += rows.length

    type Job = { rowId: string; userId: string; price: number; opts: NotifyOptions; drop: boolean }
    const jobs: Job[] = []
    for (const r of rows) {
      const p = r.product
      const drop = detectDrop(r.priceWhenSaved, r.lastNotifiedPrice, p.price)
      const low = isLowStock(p.quantity)
      if (!drop && !low) continue
      const scarcity = low ? ` Only ${p.quantity} left.` : ''
      const image = p.images?.[0]
      if (drop) {
        jobs.push({
          rowId: r.id, userId: r.userId, price: p.price, drop: true,
          opts: {
            category: 'deals',
            type: 'DEAL_ALERT',
            title: `Price drop: ${p.name} is ${drop.percent}% cheaper`,
            message: `Now ${naira(p.price)}, down from ${naira(drop.baseline)}.${scarcity}`,
            url: `/product/${r.productId}`,
            productId: r.productId,
            dedupeKey: `wishlist-drop:${r.productId}:${p.price}`,
            ...(image ? { image } : {}),
          },
        })
      } else {
        jobs.push({
          rowId: r.id, userId: r.userId, price: p.price, drop: false,
          opts: {
            category: 'deals',
            type: 'STOCK_ALERT',
            title: `Only ${p.quantity} left of ${p.name}`,
            message: `It is on your wishlist at ${naira(p.price)}. Grab it before it sells out.`,
            url: `/product/${r.productId}`,
            productId: r.productId,
            dedupeKey: `wishlist-low:${r.productId}:${p.quantity}`,
            ...(image ? { image } : {}),
          },
        })
      }
    }

    // Send with bounded concurrency; remember which drops were delivered or already sent.
    const done = new Map<number, string[]>() // price -> wishlist row ids to mark notified
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      if (Date.now() >= ctx.deadline) break
      const chunk = jobs.slice(i, i + CONCURRENCY)
      const results = await Promise.all(chunk.map(j => notifyUser(j.userId, j.opts as NotifyOptions)))
      results.forEach((res, k) => {
        const j = chunk[k]
        if (res.sent || res.skipped === 'duplicate') {
          if (res.sent) j.drop ? out.drops++ : out.lowStock++
          if (j.drop) done.set(j.price, [...(done.get(j.price) ?? []), j.rowId])
        } else {
          out.skipped++
        }
      })
    }
    for (const [price, ids] of Array.from(done.entries())) {
      await prisma.wishlistItem.updateMany({ where: { id: { in: ids } }, data: { lastNotifiedPrice: price } })
    }

    if (rows.length < PAGE) break
  }
  return out
}
