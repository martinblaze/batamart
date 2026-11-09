// GET /api/tickets/events/[id]?ref=<resellerUserId>
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { availableForTier } from '@/lib/tickets/purchase'
import { json, fail, hit, clientIp, isEventOver } from '@/lib/tickets/buyer'
import { salesCloseAt } from '@/lib/tickets/config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await hit(`tickets:event:${clientIp(request)}`, 120, 60_000))) {
      return json({ error: 'Too many requests. Please wait.' }, 429)
    }
    const ev = await prisma.ticketEvent.findUnique({
      where: { id: params.id },
      select: {
        id: true, name: true, description: true, venue: true, address: true, startsAt: true, endsAt: true,
        flyerUrl: true, status: true, allowResale: true, hostId: true,
        host: { select: { name: true, username: true } },
        tiers: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
          select: { id: true, name: true, description: true, imageUrl: true, price: true, saleStartsAt: true, saleEndsAt: true },
        },
      },
    })
    // Only live events are public. Paused/cancelled ones look like they do not exist.
    if (!ev || ev.status !== 'ACTIVE') return json({ error: 'Event not found' }, 404)

    const now = Date.now()
    const closedByTime = now > salesCloseAt(ev.startsAt, ev.endsAt)
    const tiers = await Promise.all(ev.tiers.map(async t => {
      const available = await availableForTier(t.id)
      let saleOpen = true
      let saleMessage: string | null = null
      if (closedByTime) { saleOpen = false; saleMessage = 'This event has taken place.' }
      else if (t.saleStartsAt && now < t.saleStartsAt.getTime()) {
        saleOpen = false
        saleMessage = `On sale from ${t.saleStartsAt.toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })}`
      } else if (t.saleEndsAt && now > t.saleEndsAt.getTime()) { saleOpen = false; saleMessage = 'Sales have closed.' }
      else if (available === 0) { saleOpen = false; saleMessage = 'Sold out' }
      return {
        id: t.id, name: t.name, description: t.description, imageUrl: t.imageUrl,
        price: t.price, available, saleOpen, saleMessage,
      }
    }))

    let reseller: { id: string; name: string; username: string | null } | null = null
    const ref = (new URL(request.url).searchParams.get('ref') ?? '').trim().slice(0, 40)
    if (ref && ev.allowResale && ref !== ev.hostId) {
      const listing = await prisma.ticketListing.findUnique({
        where: { eventId_sellerId: { eventId: ev.id, sellerId: ref } },
        select: { isActive: true, seller: { select: { id: true, name: true, username: true, isSuspended: true, isDeleted: true } } },
      })
      if (listing?.isActive && !listing.seller.isSuspended && !listing.seller.isDeleted) {
        reseller = { id: listing.seller.id, name: listing.seller.name, username: listing.seller.username }
      }
    }

    return json({
      event: {
        id: ev.id, name: ev.name, description: ev.description, venue: ev.venue, address: ev.address,
        startsAt: ev.startsAt.toISOString(), endsAt: ev.endsAt?.toISOString() ?? null,
        flyerUrl: ev.flyerUrl, hostId: ev.hostId, hostName: ev.host.name, hostUsername: ev.host.username,
        allowResale: ev.allowResale, isOver: isEventOver(ev),
      },
      tiers,
      reseller,
    })
  } catch (err) {
    return fail(err, 'Could not load this event')
  }
}
