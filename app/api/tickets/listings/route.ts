// app/api/tickets/listings/route.ts
// POST: a seller puts an event's tickets in their shop (creates or reactivates a
// TicketListing). The price is never an input: buyers always pay the tier price.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { checkRateLimitDistributed, getIpKey } from '@/lib/security/rate-limit'
import { salesCloseAt } from '@/lib/tickets/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
    const rate = await checkRateLimitDistributed(`tickets:listing:${user.id}:${ip}`, 30, 15 * 60 * 1000, {
      requireDistributedInProduction: true,
    })
    if (!rate.allowed) return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 })

    let body: any
    try { body = await request.json() } catch { body = null }
    const eventId = typeof body?.eventId === 'string' ? body.eventId.trim() : ''
    if (!eventId || eventId.length > 64) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
    }

    // Account standing: suspended or deleted users cannot list.
    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isSuspended: true, isDeleted: true },
    })
    if (!account || account.isDeleted) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (account.isSuspended) {
      return NextResponse.json({ error: 'Your account is suspended.', code: 'SUSPENDED' }, { status: 403 })
    }
    if (account.role !== 'SELLER') {
      return NextResponse.json(
        { error: 'Become a seller to sell tickets.', code: 'NOT_SELLER' },
        { status: 403 },
      )
    }

    const event = await prisma.ticketEvent.findUnique({
      where: { id: eventId },
      select: { id: true, hostId: true, status: true, allowResale: true, startsAt: true, endsAt: true },
    })
    if (!event || event.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This event is not on sale.', code: 'EVENT_NOT_ON_SALE' }, { status: 400 })
    }
    if (!event.allowResale) {
      return NextResponse.json({ error: 'The host does not allow resale for this event.', code: 'NO_RESALE' }, { status: 400 })
    }
    if (event.hostId === user.id) {
      return NextResponse.json({ error: 'You cannot resell your own event.', code: 'OWN_EVENT' }, { status: 400 })
    }
    if (Date.now() > salesCloseAt(event.startsAt, event.endsAt)) {
      return NextResponse.json({ error: 'This event has already taken place.', code: 'EVENT_OVER' }, { status: 400 })
    }

    // Upsert on the unique (eventId, sellerId): reactivates a deactivated listing.
    const listing = await prisma.ticketListing.upsert({
      where: { eventId_sellerId: { eventId: event.id, sellerId: user.id } },
      create: { eventId: event.id, sellerId: user.id, isActive: true },
      update: { isActive: true },
      select: { id: true, eventId: true, isActive: true },
    })

    return NextResponse.json({
      listing,
      resaleLink: `/events/${event.id}?ref=${user.id}`,
    })
  } catch (error) {
    console.error('Create ticket listing error:', error)
    return NextResponse.json({ error: 'Could not list these tickets. Please try again.' }, { status: 500 })
  }
}
