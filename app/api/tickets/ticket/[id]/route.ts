// GET /api/tickets/ticket/[id]  (auth owner, or ?token=<purchase accessToken> for a guest)
// Full ticket including the QR secret. Polled every few seconds by the ticket page.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { json, fail, hit, clientIp, isEventOver } from '@/lib/tickets/buyer'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    if (!/^[A-Za-z0-9_-]{10,40}$/.test(id)) return json({ error: 'Ticket not found' }, 404)
    // Polling is ~15/min per open tab; this leaves room for a few tabs and retries.
    if (!(await hit(`tickets:ticket:${clientIp(request)}:${id}`, 90, 60_000))) {
      return json({ error: 'Too many requests. Please wait.' }, 429)
    }

    const t = await prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true, code: true, secret: true, secretVersion: true, status: true, checkedInAt: true,
        ownerUserId: true, ownerEmail: true,
        purchase: { select: { accessToken: true, buyerEmail: true, status: true } },
        tier: { select: { name: true, imageUrl: true } },
        event: { select: { id: true, name: true, venue: true, address: true, startsAt: true, endsAt: true, flyerUrl: true, status: true } },
      },
    })
    if (!t || t.purchase.status !== 'PAID') return json({ error: 'Ticket not found' }, 404)

    let allowed = false
    let isOwner = false
    const user = await getUserFromRequest(request)
    if (user && t.ownerUserId === user.id) { allowed = true; isOwner = true }
    if (!allowed) {
      const token = new URL(request.url).searchParams.get('token') ?? ''
      // The link only reaches tickets still held by the purchase's buyer email.
      if (token && token === t.purchase.accessToken && t.ownerEmail === t.purchase.buyerEmail) allowed = true
    }
    if (!allowed) return json({ error: 'Ticket not found' }, 404)

    const e = t.event
    const ticket = {
      id: t.id, code: t.code, secret: t.secret, secretVersion: t.secretVersion,
      status: t.status, checkedInAt: t.checkedInAt?.toISOString() ?? null,
      tierName: t.tier.name, tierImageUrl: t.tier.imageUrl,
      isOwner,
      canTransfer: isOwner && t.status === 'VALID' && e.status !== 'CANCELLED' && !isEventOver(e),
      event: {
        id: e.id, name: e.name, venue: e.venue, address: e.address, status: e.status,
        startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null, flyerUrl: e.flyerUrl,
      },
    }
    // Fields are both flat (spec) and under `ticket` (convenience).
    return json({ ...ticket, ticket, serverTime: Date.now() })
  } catch (err) {
    return fail(err, 'Could not load this ticket')
  }
}
