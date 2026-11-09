// app/api/tickets/listings/mine/route.ts
// GET: my resale listings with what I earn per tier, plus events whose host named
// me a unique seller (so I can see my commission before I start selling).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tierSelect = {
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' as const }, { price: 'asc' as const }],
      select: { name: true, price: true, randomCommissionPct: true, uniqueCommissionPct: true },
    }

    const [listings, uniqueRows, paid] = await Promise.all([
      prisma.ticketListing.findMany({
        where: { sellerId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, eventId: true, isActive: true,
          event: { select: { name: true, startsAt: true, status: true, hostId: true, tiers: tierSelect } },
        },
      }),
      prisma.eventSeller.findMany({
        where: { userId: user.id, isActive: true },
        select: { eventId: true },
      }),
      // Only PAID purchases count towards earnings.
      prisma.ticketPurchase.groupBy({
        by: ['eventId'],
        where: { resellerId: user.id, status: 'PAID' },
        _sum: { quantity: true, commission: true },
      }),
    ])

    const uniqueIds = new Set(uniqueRows.map((r) => r.eventId))
    const stats = new Map(paid.map((p) => [p.eventId, p._sum]))

    const out = listings.map((l) => {
      const kind = uniqueIds.has(l.eventId) ? 'UNIQUE' : 'RANDOM'
      const s = stats.get(l.eventId)
      return {
        id: l.id,
        eventId: l.eventId,
        eventName: l.event.name,
        startsAt: l.event.startsAt,
        eventStatus: l.event.status,
        isActive: l.isActive,
        kind,
        ticketsSold: s?.quantity ?? 0,
        commissionEarned: s?.commission ?? 0,
        tiers: l.event.tiers.map((t) => ({
          name: t.name,
          price: t.price,
          commissionPct: kind === 'UNIQUE' ? t.uniqueCommissionPct : t.randomCommissionPct,
        })),
      }
    })

    // Unique-seller invitations I have not turned into a listing yet.
    const listedIds = new Set(listings.map((l) => l.eventId))
    const pendingIds = Array.from(uniqueIds).filter((id) => !listedIds.has(id))
    const invitedEvents = pendingIds.length
      ? await prisma.ticketEvent.findMany({
          where: { id: { in: pendingIds }, status: 'ACTIVE', allowResale: true, startsAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
          orderBy: { startsAt: 'asc' },
          select: { id: true, name: true, startsAt: true, tiers: tierSelect },
        })
      : []
    const invitations = invitedEvents.map((e) => ({
      eventId: e.id,
      eventName: e.name,
      startsAt: e.startsAt,
      kind: 'UNIQUE' as const,
      tiers: e.tiers.map((t) => ({ name: t.name, price: t.price, commissionPct: t.uniqueCommissionPct })),
    }))

    const totals = {
      ticketsSold: out.reduce((n, l) => n + l.ticketsSold, 0),
      commissionEarned: out.reduce((n, l) => n + l.commissionEarned, 0),
    }

    return NextResponse.json({ listings: out, invitations, totals, userId: user.id })
  } catch (error) {
    console.error('Fetch my ticket listings error:', error)
    return NextResponse.json({ error: 'Could not load your listings.' }, { status: 500 })
  }
}
