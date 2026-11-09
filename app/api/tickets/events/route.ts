// GET /api/tickets/events?search=&sellerId=&page=
// Public list of events on sale (ACTIVE, not over).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { json, fail, hit, clientIp, DEFAULT_EVENT_LENGTH_HOURS } from '@/lib/tickets/buyer'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  try {
    if (!(await hit(`tickets:events:${clientIp(request)}`, 120, 60_000))) {
      return json({ error: 'Too many requests. Please wait.' }, 429)
    }
    const sp = new URL(request.url).searchParams
    const search = (sp.get('search') ?? '').trim().slice(0, 80)
    const sellerId = (sp.get('sellerId') ?? '').trim().slice(0, 40)
    const page = Math.min(200, Math.max(1, Math.floor(Number(sp.get('page')) || 1)))

    const now = new Date()
    const where: Prisma.TicketEventWhereInput = {
      status: 'ACTIVE',
      OR: [
        { endsAt: { gte: now } },
        { endsAt: null, startsAt: { gte: new Date(now.getTime() - DEFAULT_EVENT_LENGTH_HOURS * 3_600_000) } },
      ],
      ...(search
        ? { AND: [{ OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { venue: { contains: search, mode: 'insensitive' } },
          ] }] }
        : {}),
      ...(sellerId ? { listings: { some: { sellerId, isActive: true } }, allowResale: true } : {}),
    }

    const rows = await prisma.ticketEvent.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, name: true, venue: true, startsAt: true, flyerUrl: true,
        host: { select: { name: true } },
        tiers: { where: { isActive: true }, select: { price: true, capacity: true, sold: true } },
      },
    })

    const events = rows.map(e => ({
      id: e.id,
      name: e.name,
      venue: e.venue,
      startsAt: e.startsAt.toISOString(),
      flyerUrl: e.flyerUrl,
      fromPrice: e.tiers.length ? Math.min(...e.tiers.map(t => t.price)) : null,
      soldOut: e.tiers.length > 0 && e.tiers.every(t => t.sold >= t.capacity),
      hostName: e.host.name,
    }))
    return json({ events, page, hasMore: rows.length === PAGE_SIZE })
  } catch (err) {
    return fail(err, 'Could not load events')
  }
}
