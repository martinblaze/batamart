// GET /api/tickets/checker/me -> { checker, event, stats: { checkedIn, total, myScans } }
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCheckerFromRequest } from '@/lib/tickets/checker-session'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getCheckerFromRequest(request)
    if (!ctx) return NextResponse.json({ error: 'Please sign in again.', code: 'UNAUTHENTICATED' }, { status: 401 })
    const eventId = ctx.checker.eventId

    const [checkedIn, total, myScans] = await Promise.all([
      prisma.ticket.count({ where: { eventId, status: 'CHECKED_IN' } }),
      prisma.ticket.count({ where: { eventId, status: { in: ['VALID', 'CHECKED_IN'] } } }),
      prisma.ticketScan.count({ where: { eventId, checkerId: ctx.checker.id, result: 'OK' } }),
    ])

    return NextResponse.json({
      checker: { email: ctx.checker.email, name: ctx.checker.name },
      event: { id: ctx.event.id, name: ctx.event.name, venue: ctx.event.venue, startsAt: ctx.event.startsAt, status: ctx.event.status },
      stats: { checkedIn, total, myScans },
    })
  } catch (e) {
    console.error('[checker/me]', e instanceof Error ? e.message : 'error')
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
