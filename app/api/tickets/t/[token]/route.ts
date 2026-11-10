// GET /api/tickets/t/[token]
// Guest view of a purchase's tickets. The token is a bearer credential from the
// receipt email, so it is rate limited by IP and never logged.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { json, fail, hit, clientIp, maskEmail, isEventOver } from '@/lib/tickets/buyer'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = params.token
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return json({ error: 'Link not found' }, 404)
    if (!(await hit(`tickets:t:${clientIp(request)}`, 90, 60_000))) {
      return json({ error: 'Too many requests. Please wait.' }, 429)
    }

    const purchase = await prisma.ticketPurchase.findUnique({
      where: { accessToken: token },
      select: {
        id: true, status: true, buyerEmail: true,
        event: { select: { id: true, name: true, venue: true, address: true, startsAt: true, endsAt: true, flyerUrl: true, status: true } },
        tickets: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, code: true, status: true, secret: true, secretVersion: true, checkedInAt: true,
            ownerEmail: true, ownerUserId: true, tier: { select: { name: true, imageUrl: true } },
          },
        },
      },
    })
    if (!purchase || purchase.status !== 'PAID') return json({ error: 'Link not found' }, 404)

    if (purchase.tickets.length === 0 && isEventOver(purchase.event)) {
      return json({
        error: 'This event has ended and the tickets were removed.',
        code: 'EVENT_ENDED',
        event: { id: purchase.event.id, name: purchase.event.name, venue: purchase.event.venue, startsAt: purchase.event.startsAt.toISOString() },
      }, 410)
    }

    // Only tickets still held by the purchase's buyer email: a ticket sent to a
    // friend must not stay reachable through the old link.
    const tickets = purchase.tickets
      .filter(t => t.ownerEmail === purchase.buyerEmail)
      .map(t => ({
        id: t.id, code: t.code, tierName: t.tier.name, tierImageUrl: t.tier.imageUrl,
        status: t.status, secret: t.secret, secretVersion: t.secretVersion,
        checkedInAt: t.checkedInAt?.toISOString() ?? null,
      }))

    const e = purchase.event
    return json({
      event: {
        id: e.id, name: e.name, venue: e.venue, address: e.address, status: e.status,
        startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null, flyerUrl: e.flyerUrl,
      },
      buyerEmail: maskEmail(purchase.buyerEmail),
      tickets,
      serverTime: Date.now(),
    })
  } catch (err) {
    return fail(err, 'Could not load your tickets')
  }
}
