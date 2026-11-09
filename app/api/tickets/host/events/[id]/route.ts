// app/api/tickets/host/events/[id]/route.ts
// Host: full dashboard for one event (GET) and edits (PATCH, rules in TICKETING.md section 7).
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { adminIds, notifyMany } from '@/lib/notify/dispatch'
import { notifyTicketHolders } from '@/lib/tickets/host-mail'
import { formatEventWhen } from '@/lib/tickets/notify'
import {
  MAX_COMMISSION_PCT, MAX_TICKET_PRICE, MIN_TICKET_PRICE, PENDING_HOLD_MINUTES,
} from '@/lib/tickets/config'
import { fail, requireHost, safeJson, writeAudit, zodMessage, duplicateTierName, MAX_TIERS, noControlChars } from '../../_lib'

const PURCHASE_PAGE = 25

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    const event = await prisma.ticketEvent.findFirst({
      where: { id: params.id, hostId: host.userId },
      select: {
        id: true, name: true, description: true, venue: true, address: true, startsAt: true, endsAt: true,
        flyerUrl: true, status: true, allowResale: true, reviewNote: true, createdAt: true,
        tiers: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    })
    if (!event) return fail('Event not found', 404)

    const eventId = event.id
    const paid = { eventId, status: 'PAID' as const }
    const pcursor = new URL(request.url).searchParams.get('pcursor')
    const holdSince = new Date(Date.now() - PENDING_HOLD_MINUTES * 60_000)

    const [totals, checkedIn, bySeller, eventSellers, checkers, scanGroups, purchases, recentScans, held] = await Promise.all([
      prisma.ticketPurchase.aggregate({
        where: paid,
        _sum: { quantity: true, subtotal: true, platformFee: true, commission: true, hostAmount: true },
      }),
      prisma.ticket.count({ where: { eventId, status: 'CHECKED_IN' } }),
      prisma.ticketPurchase.groupBy({
        by: ['sellerKind', 'resellerId'],
        where: paid,
        _sum: { quantity: true, subtotal: true, commission: true },
      }),
      prisma.eventSeller.findMany({
        where: { eventId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, userId: true, isActive: true, user: { select: { name: true, username: true } } },
      }),
      prisma.eventChecker.findMany({
        where: { eventId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true, createdAt: true },
      }),
      prisma.ticketScan.groupBy({ by: ['checkerId', 'result'], where: { eventId }, _count: { _all: true } }),
      prisma.ticketPurchase.findMany({
        where: paid,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: PURCHASE_PAGE + 1,
        ...(pcursor ? { cursor: { id: pcursor }, skip: 1 } : {}),
        select: {
          id: true, createdAt: true, sellerKind: true, quantity: true, subtotal: true, commission: true, hostAmount: true,
          buyerEmail: true,
          buyer: { select: { username: true } },
          reseller: { select: { username: true, name: true } },
          tier: { select: { name: true } },
        },
      }),
      prisma.ticketScan.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, result: true, holderName: true, tierName: true, createdAt: true, checker: { select: { email: true, name: true } } },
      }),
      prisma.ticketPurchase.groupBy({
        by: ['tierId'],
        where: { eventId, status: 'PENDING', createdAt: { gte: holdSince } },
        _sum: { quantity: true },
      }),
    ])

    // Sellers: every group with sales, plus named unique sellers who have not sold yet.
    const resellerIds = bySeller.map(s => s.resellerId).filter((x): x is string => !!x)
    const resellers = resellerIds.length
      ? await prisma.user.findMany({ where: { id: { in: resellerIds } }, select: { id: true, name: true, username: true } })
      : []
    const userById = new Map(resellers.map(u => [u.id, u]))
    const sellerRowByUser = new Map(eventSellers.map(s => [s.userId, s]))
    const sellers: any[] = bySeller.map(s => {
      const u = s.resellerId ? userById.get(s.resellerId) : null
      const row = s.resellerId ? sellerRowByUser.get(s.resellerId) : undefined
      return {
        rowId: row?.id ?? null,
        kind: s.sellerKind,
        userId: s.resellerId,
        name: s.sellerKind === 'DIRECT' ? 'You (direct)' : u?.name ?? 'Deleted user',
        username: u?.username ?? null,
        ticketsSold: s._sum.quantity ?? 0,
        grossSales: s._sum.subtotal ?? 0,
        commission: s._sum.commission ?? 0,
      }
    })
    const listedIds = new Set(sellers.filter(s => s.kind === 'UNIQUE').map(s => s.userId))
    for (const es of eventSellers) {
      if (listedIds.has(es.userId)) continue
      sellers.push({
        rowId: es.id, kind: 'UNIQUE', userId: es.userId, name: es.user.name, username: es.user.username,
        ticketsSold: 0, grossSales: 0, commission: 0,
      })
    }
    sellers.sort((a, b) => b.ticketsSold - a.ticketsSold)

    const scanStats = new Map<string, { scanCount: number; okCount: number }>()
    for (const g of scanGroups) {
      const cur = scanStats.get(g.checkerId) ?? { scanCount: 0, okCount: 0 }
      cur.scanCount += g._count._all
      if (g.result === 'OK') cur.okCount += g._count._all
      scanStats.set(g.checkerId, cur)
    }

    const heldByTier = new Map(held.map(h => [h.tierId, h._sum.quantity ?? 0]))
    const hasMore = purchases.length > PURCHASE_PAGE
    const page = hasMore ? purchases.slice(0, PURCHASE_PAGE) : purchases

    const ticketsSold = totals._sum.quantity ?? 0
    return NextResponse.json({
      event: {
        id: event.id, name: event.name, description: event.description, venue: event.venue, address: event.address,
        startsAt: event.startsAt, endsAt: event.endsAt, flyerUrl: event.flyerUrl, status: event.status,
        allowResale: event.allowResale, reviewNote: event.reviewNote, hasPaidTickets: ticketsSold > 0,
      },
      tiers: event.tiers.map(t => ({
        id: t.id, name: t.name, description: t.description, imageUrl: t.imageUrl, price: t.price, capacity: t.capacity,
        randomCommissionPct: t.randomCommissionPct, uniqueCommissionPct: t.uniqueCommissionPct,
        saleStartsAt: t.saleStartsAt, saleEndsAt: t.saleEndsAt, isActive: t.isActive,
        sold: t.sold, available: Math.max(0, t.capacity - t.sold - (heldByTier.get(t.id) ?? 0)),
      })),
      totals: {
        ticketsSold,
        grossSales: totals._sum.subtotal ?? 0,
        platformFee: totals._sum.platformFee ?? 0,
        commissionPaid: totals._sum.commission ?? 0,
        hostEarnings: totals._sum.hostAmount ?? 0,
        checkedIn,
      },
      sellers,
      checkers: checkers.map(c => ({
        ...c,
        scanCount: scanStats.get(c.id)?.scanCount ?? 0,
        okCount: scanStats.get(c.id)?.okCount ?? 0,
      })),
      purchases: page.map(p => ({
        id: p.id,
        createdAt: p.createdAt,
        buyerLabel: p.buyer?.username ?? p.buyerEmail,
        via: p.sellerKind === 'DIRECT' ? 'DIRECT' : (p.reseller?.username ?? p.reseller?.name ?? 'seller'),
        kind: p.sellerKind,
        tierName: p.tier.name,
        quantity: p.quantity,
        amount: p.subtotal,
        commission: p.commission,
        hostAmount: p.hostAmount,
      })),
      purchasesNextCursor: hasMore ? page[page.length - 1].id : null,
      scans: recentScans.map(s => ({
        id: s.id, result: s.result, holder: s.holderName, tierName: s.tierName, createdAt: s.createdAt,
        checker: s.checker.name || s.checker.email,
      })),
    })
  } catch (error) {
    console.error('host event dashboard error:', error)
    return fail('Could not load this event', 500)
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
const dateStr = z.string().refine(s => !Number.isNaN(Date.parse(s)), 'Invalid date')
const cloudinaryUrl = z.string().url().max(500).refine(u => /^https:\/\/res\.cloudinary\.com\//.test(u), 'Upload the image through BataMart')
const pct = z.number().int().min(0).max(MAX_COMMISSION_PCT)

const tierPatch = z.object({
  id: z.string().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(40).refine(noControlChars, 'Invalid characters').optional(),
  description: z.string().trim().max(200).nullable().optional(),
  imageUrl: cloudinaryUrl.nullable().optional(),
  price: z.number().int().min(MIN_TICKET_PRICE).max(MAX_TICKET_PRICE).optional(),
  capacity: z.number().int().min(1).max(100_000).optional(),
  randomCommissionPct: pct.optional(),
  uniqueCommissionPct: pct.optional(),
  saleStartsAt: dateStr.nullable().optional(),
  saleEndsAt: dateStr.nullable().optional(),
  isActive: z.boolean().optional(),
}).strict()

const patchSchema = z.object({
  name: z.string().trim().min(3).max(120).refine(noControlChars, 'Invalid characters').optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  venue: z.string().trim().min(2).max(150).refine(noControlChars, 'Invalid characters').optional(),
  address: z.string().trim().max(250).nullable().optional(),
  startsAt: dateStr.optional(),
  endsAt: dateStr.nullable().optional(),
  flyerUrl: cloudinaryUrl.optional(),
  allowResale: z.boolean().optional(),
  tiers: z.array(tierPatch).max(MAX_TIERS).optional(),
  removeTierIds: z.array(z.string().max(64)).max(MAX_TIERS).optional(),
}).strict()

class EditError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message) }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    const parsed = patchSchema.safeParse(await safeJson(request))
    if (!parsed.success) return fail(zodMessage(parsed.error))
    const d = parsed.data

    const event = await prisma.ticketEvent.findFirst({
      where: { id: params.id, hostId: host.userId },
      include: { tiers: true },
    })
    if (!event) return fail('Event not found', 404)
    if (event.status === 'CANCELLED') return fail('A cancelled event cannot be edited.', 409)

    const paidPurchases = await prisma.ticketPurchase.count({ where: { eventId: event.id, status: 'PAID' } })
    const hasPaid = paidPurchases > 0

    // ── Event fields ──
    const data: Record<string, any> = {}
    const oldVals: Record<string, unknown> = {}
    const newVals: Record<string, unknown> = {}
    const setField = (key: string, next: any, prev: any) => {
      const same = next instanceof Date || prev instanceof Date
        ? (next ? new Date(next).getTime() : null) === (prev ? new Date(prev).getTime() : null)
        : next === prev
      if (same) return false
      data[key] = next
      oldVals[key] = prev
      newVals[key] = next
      return true
    }

    let material = false
    if (d.name !== undefined && setField('name', d.name, event.name)) material = true
    if (d.venue !== undefined && setField('venue', d.venue, event.venue)) material = true
    let nextStart = event.startsAt
    if (d.startsAt !== undefined) {
      const s = new Date(d.startsAt)
      if (s.getTime() !== event.startsAt.getTime()) {
        if (s.getTime() <= Date.now()) return fail('The event must start in the future.')
        nextStart = s
        if (setField('startsAt', s, event.startsAt)) material = true
      }
    }
    let nextEnd: Date | null = event.endsAt
    if (d.endsAt !== undefined) {
      nextEnd = d.endsAt ? new Date(d.endsAt) : null
      if (setField('endsAt', nextEnd, event.endsAt)) material = true
    }
    if (nextEnd && nextEnd <= nextStart) return fail('The end time must be after the start time.')
    if (d.description !== undefined) setField('description', d.description || null, event.description)
    if (d.address !== undefined) setField('address', d.address || null, event.address)
    if (d.flyerUrl !== undefined) setField('flyerUrl', d.flyerUrl, event.flyerUrl)
    if (d.allowResale !== undefined) setField('allowResale', d.allowResale, event.allowResale)

    // ── Tier validation (against the event's own tiers only) ──
    const tierById = new Map(event.tiers.map(t => [t.id, t]))
    const removeIds = Array.from(new Set(d.removeTierIds ?? []))
    for (const rid of removeIds) if (!tierById.has(rid)) return fail('One of the ticket types to remove was not found.')

    const patches = d.tiers ?? []
    const existingPatches: { tier: (typeof event.tiers)[number]; p: z.infer<typeof tierPatch> }[] = []
    const newTiers: z.infer<typeof tierPatch>[] = []
    for (const p of patches) {
      if (p.id) {
        const tier = tierById.get(p.id)
        if (!tier) return fail('A ticket type you are editing was not found on this event.')
        if (removeIds.includes(p.id)) return fail(`"${tier.name}" is both edited and removed.`)
        existingPatches.push({ tier, p })
      } else {
        if (!p.name || p.price === undefined || p.capacity === undefined) return fail('A new ticket type needs a name, price and capacity.')
        newTiers.push(p)
      }
    }

    // Final names must stay unique and the event must keep at least one ticket type.
    const finalNames: string[] = []
    for (const t of event.tiers) {
      if (removeIds.includes(t.id)) continue
      const patched = existingPatches.find(x => x.tier.id === t.id)
      finalNames.push(patched?.p.name ?? t.name)
    }
    for (const n of newTiers) finalNames.push(n.name!)
    if (finalNames.length === 0) return fail('An event needs at least one ticket type.')
    if (finalNames.length > MAX_TIERS) return fail(`An event can have at most ${MAX_TIERS} ticket types.`)
    const dup = duplicateTierName(finalNames)
    if (dup) return fail(`Two ticket types are named "${dup}".`)

    for (const { tier, p } of existingPatches) {
      if (p.capacity !== undefined && p.capacity < tier.sold) {
        return fail(`"${tier.name}" already sold ${tier.sold}, so its capacity cannot go below that.`)
      }
      const s = p.saleStartsAt !== undefined ? p.saleStartsAt : tier.saleStartsAt?.toISOString() ?? null
      const e = p.saleEndsAt !== undefined ? p.saleEndsAt : tier.saleEndsAt?.toISOString() ?? null
      if (s && e && new Date(e) <= new Date(s)) return fail(`${p.name ?? tier.name}: sales must close after they open.`)
    }
    for (const n of newTiers) {
      if (n.saleStartsAt && n.saleEndsAt && new Date(n.saleEndsAt) <= new Date(n.saleStartsAt)) {
        return fail(`${n.name}: sales must close after they open.`)
      }
    }

    const holdSince = new Date(Date.now() - PENDING_HOLD_MINUTES * 60_000)
    const tierChanges: unknown[] = []

    let nextStatus = event.status
    const anyChange =
      Object.keys(data).length > 0 || existingPatches.length > 0 || newTiers.length > 0 || removeIds.length > 0
    if (!anyChange) return NextResponse.json({ ok: true, status: event.status, changed: false })

    if (event.status === 'REJECTED') nextStatus = 'PENDING_REVIEW'
    else if (material && !hasPaid && (event.status === 'ACTIVE' || event.status === 'PAUSED')) nextStatus = 'PENDING_REVIEW'
    if (nextStatus !== event.status) data.status = nextStatus

    await prisma.$transaction(async tx => {
      for (const rid of removeIds) {
        const t = tierById.get(rid)!
        const blocking = await tx.ticketPurchase.count({
          where: { tierId: rid, OR: [{ status: 'PAID' }, { status: 'PENDING', createdAt: { gte: holdSince } }] },
        })
        if (t.sold > 0 || blocking > 0) {
          throw new EditError(`"${t.name}" has sales, so it cannot be deleted. Deactivate it instead.`, 409)
        }
        await tx.ticketTier.delete({ where: { id: rid } })
        tierChanges.push({ removed: t.name })
      }

      for (const { tier, p } of existingPatches) {
        const upd: Record<string, any> = {}
        const before: Record<string, unknown> = {}
        const put = (k: string, v: any, prev: any) => {
          if (v === undefined) return
          const same = v instanceof Date ? v.getTime() === (prev ? new Date(prev).getTime() : NaN) : v === prev
          if (same) return
          upd[k] = v
          before[k] = prev instanceof Date ? prev.toISOString() : prev
        }
        put('name', p.name, tier.name)
        put('description', p.description === undefined ? undefined : p.description || null, tier.description)
        put('imageUrl', p.imageUrl, tier.imageUrl)
        put('price', p.price, tier.price)
        put('capacity', p.capacity, tier.capacity)
        put('randomCommissionPct', p.randomCommissionPct, tier.randomCommissionPct)
        put('uniqueCommissionPct', p.uniqueCommissionPct, tier.uniqueCommissionPct)
        put('isActive', p.isActive, tier.isActive)
        if (p.saleStartsAt !== undefined) put('saleStartsAt', p.saleStartsAt ? new Date(p.saleStartsAt) : null, tier.saleStartsAt)
        if (p.saleEndsAt !== undefined) put('saleEndsAt', p.saleEndsAt ? new Date(p.saleEndsAt) : null, tier.saleEndsAt)
        if (Object.keys(upd).length === 0) continue
        // Guard against a sale landing between our check and this write.
        const res = await tx.ticketTier.updateMany({
          where: { id: tier.id, eventId: event.id, ...(upd.capacity !== undefined ? { sold: { lte: upd.capacity } } : {}) },
          data: upd,
        })
        if (res.count !== 1) throw new EditError(`"${tier.name}" just sold more tickets. Reload and try again.`, 409)
        tierChanges.push({ tier: tier.name, from: before, to: upd })
      }

      let order = event.tiers.length
      for (const n of newTiers) {
        await tx.ticketTier.create({
          data: {
            eventId: event.id,
            name: n.name!,
            description: n.description || null,
            imageUrl: n.imageUrl ?? null,
            price: n.price!,
            capacity: n.capacity!,
            randomCommissionPct: n.randomCommissionPct ?? 0,
            uniqueCommissionPct: n.uniqueCommissionPct ?? 0,
            saleStartsAt: n.saleStartsAt ? new Date(n.saleStartsAt) : null,
            saleEndsAt: n.saleEndsAt ? new Date(n.saleEndsAt) : null,
            sortOrder: order++,
          },
        })
        tierChanges.push({ added: n.name, price: n.price, capacity: n.capacity })
      }

      if (Object.keys(data).length) {
        const res = await tx.ticketEvent.updateMany({ where: { id: event.id, hostId: host.userId }, data })
        if (res.count !== 1) throw new EditError('Event not found', 404)
      }

      await writeAudit(tx, host.userId, 'TICKET_EVENT_EDITED', event.id,
        { ...oldVals, status: event.status },
        { ...newVals, status: nextStatus, tiers: tierChanges, hadPaidTickets: hasPaid })
    })

    // After commit: tell holders and admins when a material change goes live over existing sales.
    if (material && hasPaid) {
      const lines: string[] = []
      if (newVals.name) lines.push(`Now called "${newVals.name}".`)
      lines.push(`When: ${formatEventWhen(nextStart)}. Where: ${(newVals.venue as string) ?? event.venue}.`)
      await notifyTicketHolders(event.id, {
        title: `Update: ${(newVals.name as string) ?? event.name}`,
        heading: 'Event details changed',
        message: `The host changed details of the event you hold tickets for. ${lines.join(' ')}`,
        dedupeKey: `ticket-event-edit:${event.id}:${Date.now()}`,
      })
      try {
        const admins = await adminIds()
        await notifyMany(admins, () => ({
          category: 'transactional',
          type: 'ORDER_UPDATE',
          title: 'Live event details changed',
          message: `${host.name} changed "${event.name}" after tickets were sold. Check it is not a bait and switch.`,
          url: '/admin/events',
          dedupeKey: `ticket-event-edit-admin:${event.id}:${Date.now()}`,
          bypassLimits: true,
        }))
      } catch {
        console.error('notify admins (event edit) failed')
      }
    } else if (nextStatus === 'PENDING_REVIEW' && event.status !== 'PENDING_REVIEW') {
      try {
        const admins = await adminIds()
        await notifyMany(admins, () => ({
          category: 'transactional',
          type: 'ORDER_UPDATE',
          title: 'Event waiting for review',
          message: `${host.name} edited "${event.name}" and sent it back for review.`,
          url: '/admin/events',
          dedupeKey: `ticket-event-review:${event.id}:${Date.now()}`,
          bypassLimits: true,
        }))
      } catch {
        console.error('notify admins (resubmit) failed')
      }
    }

    return NextResponse.json({ ok: true, status: nextStatus, changed: true })
  } catch (error: any) {
    if (error instanceof EditError) return fail(error.message, error.status, error.code)
    if (error?.code === 'P2002') return fail('Two ticket types have the same name.', 409)
    console.error('host event edit error:', error)
    return fail('Could not save your changes', 500)
  }
}
