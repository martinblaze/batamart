// app/api/tickets/host/events/[id]/audit/route.ts
// Host: one merged timeline of purchases, transfers, door scans and status/setting changes.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fail, requireHost } from '../../../_lib'

const PAGE = 30

interface Item {
  at: Date
  type: 'PURCHASE' | 'TRANSFER' | 'SCAN' | 'CHANGE'
  text: string
}

const ACTION_TEXT: Record<string, string> = {
  TICKET_EVENT_CREATED: 'Event submitted for review',
  TICKET_EVENT_EDITED: 'Event details edited',
  TICKET_EVENT_CANCELLED: 'Event cancelled by you',
  TICKET_CHECKER_ADDED: 'Checker added',
  TICKET_CHECKER_LINK_RESENT: 'Checker link resent',
  TICKET_CHECKER_DEACTIVATED: 'Checker deactivated',
  TICKET_SELLER_ADDED: 'Unique seller added',
  TICKET_SELLER_REMOVED: 'Unique seller removed',
  TICKET_EVENT_APPROVED: 'Approved by BataMart',
  TICKET_EVENT_REJECTED: 'Rejected by BataMart',
  TICKET_EVENT_PAUSED: 'Paused by BataMart',
  TICKET_EVENT_RESUMED: 'Resumed by BataMart',
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    const event = await prisma.ticketEvent.findFirst({ where: { id: params.id, hostId: host.userId }, select: { id: true } })
    if (!event) return fail('Event not found', 404)

    const raw = new URL(request.url).searchParams.get('cursor')
    const before = raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw) : new Date(Date.now() + 60_000)
    const lt = { lt: before }

    const [purchases, transfers, scans, changes] = await Promise.all([
      prisma.ticketPurchase.findMany({
        where: { eventId: event.id, status: 'PAID', createdAt: lt },
        orderBy: { createdAt: 'desc' },
        take: PAGE,
        select: {
          createdAt: true, quantity: true, subtotal: true, sellerKind: true, buyerEmail: true,
          buyer: { select: { username: true } }, reseller: { select: { username: true } }, tier: { select: { name: true } },
        },
      }),
      prisma.ticketTransfer.findMany({
        where: { ticket: { eventId: event.id }, createdAt: lt },
        orderBy: { createdAt: 'desc' },
        take: PAGE,
        select: { createdAt: true, fromUserId: true, fromEmail: true, toUserId: true, ticket: { select: { code: true } } },
      }),
      prisma.ticketScan.findMany({
        where: { eventId: event.id, createdAt: lt },
        orderBy: { createdAt: 'desc' },
        take: PAGE,
        select: { createdAt: true, result: true, holderName: true, tierName: true, checker: { select: { email: true, name: true } } },
      }),
      prisma.auditLog.findMany({
        where: { entityType: 'TicketEvent', entityId: event.id, createdAt: lt },
        orderBy: { createdAt: 'desc' },
        take: PAGE,
        select: { createdAt: true, action: true },
      }),
    ])

    const userIds = Array.from(new Set(transfers.flatMap(t => [t.fromUserId, t.toUserId]).filter((x): x is string => !!x)))
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } })
      : []
    const uname = new Map(users.map(u => [u.id, u.username ? `@${u.username}` : 'a user']))

    const items: Item[] = [
      ...purchases.map<Item>(p => ({
        at: p.createdAt,
        type: 'PURCHASE',
        text: `${p.buyer?.username ? '@' + p.buyer.username : p.buyerEmail} bought ${p.quantity} x ${p.tier.name} for N${p.subtotal.toLocaleString('en-NG')} ${
          p.sellerKind === 'DIRECT' ? 'directly from you' : `via ${p.reseller?.username ? '@' + p.reseller.username : 'a seller'} (${p.sellerKind.toLowerCase()})`
        }`,
      })),
      ...transfers.map<Item>(t => ({
        at: t.createdAt,
        type: 'TRANSFER',
        text: `Ticket ${t.ticket.code} sent from ${t.fromUserId ? uname.get(t.fromUserId) ?? 'a user' : t.fromEmail} to ${uname.get(t.toUserId) ?? 'a user'}`,
      })),
      ...scans.map<Item>(s => ({
        at: s.createdAt,
        type: 'SCAN',
        text: `${s.checker.name || s.checker.email} scanned ${s.holderName ?? 'a ticket'}${s.tierName ? ` (${s.tierName})` : ''}: ${s.result.replace(/_/g, ' ').toLowerCase()}`,
      })),
      ...changes.map<Item>(c => ({ at: c.createdAt, type: 'CHANGE', text: ACTION_TEXT[c.action] ?? c.action.replace(/_/g, ' ').toLowerCase() })),
    ]
    items.sort((a, b) => b.at.getTime() - a.at.getTime())
    const page = items.slice(0, PAGE)
    // If any source returned a full page there may be more behind the oldest item shown.
    const maybeMore = items.length > PAGE || [purchases, transfers, scans, changes].some(a => a.length === PAGE)

    return NextResponse.json({
      items: page.map(i => ({ at: i.at, type: i.type, text: i.text })),
      nextCursor: maybeMore && page.length ? page[page.length - 1].at.toISOString() : null,
    })
  } catch (error) {
    console.error('host event audit error:', error)
    return fail('Could not load the timeline', 500)
  }
}
