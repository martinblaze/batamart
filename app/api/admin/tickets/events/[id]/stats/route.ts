export const dynamic = 'force-dynamic'
// GET /api/admin/tickets/events/[id]/stats  (read-only)
// Sales, check-ins, scan outcomes and purchases flagged `overbooked`. Never returns ticket secrets.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminIdFromRequest } from '../../../_auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!adminIdFromRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const event = await prisma.ticketEvent.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, status: true, startsAt: true, endsAt: true },
    })
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const paid = { eventId: event.id, status: 'PAID' as const }
    const [money, ticketGroups, tiers, scanGroups, overbooked, checkerCount] = await Promise.all([
      prisma.ticketPurchase.aggregate({
        where: paid,
        _count: { _all: true },
        _sum: { subtotal: true, platformFee: true, commission: true, hostAmount: true, quantity: true },
      }),
      prisma.ticket.groupBy({ by: ['status'], where: { eventId: event.id }, _count: { _all: true } }),
      prisma.ticketTier.findMany({
        where: { eventId: event.id },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, price: true, capacity: true, sold: true },
      }),
      prisma.ticketScan.groupBy({ by: ['result'], where: { eventId: event.id }, _count: { _all: true } }),
      prisma.ticketPurchase.findMany({
        where: { eventId: event.id, overbooked: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true, reference: true, buyerEmail: true, quantity: true, subtotal: true,
          status: true, paidAt: true, createdAt: true,
          tier: { select: { name: true, capacity: true, sold: true } },
          buyer: { select: { id: true, name: true, username: true } },
        },
      }),
      prisma.eventChecker.count({ where: { eventId: event.id, isActive: true } }),
    ])

    const byStatus = (s: string) => ticketGroups.find(g => g.status === s)?._count._all ?? 0
    const scans: Record<string, number> = {}
    for (const g of scanGroups) scans[g.result] = g._count._all

    return NextResponse.json({
      event,
      sales: {
        purchases: money._count._all,
        ticketsSold: money._sum.quantity ?? 0,
        grossSales: money._sum.subtotal ?? 0,
        platformFee: money._sum.platformFee ?? 0,
        commissionPaid: money._sum.commission ?? 0,
        hostEarnings: money._sum.hostAmount ?? 0,
      },
      // Ticket rows are deleted after the event: the scan log (kept) still says how many got in.
      tickets: {
        valid: byStatus('VALID'),
        checkedIn: Math.max(byStatus('CHECKED_IN'), scans.OK ?? 0),
        void: byStatus('VOID'),
        purged: ticketGroups.length === 0 && (money._sum.quantity ?? 0) > 0,
      },
      scans,
      activeCheckers: checkerCount,
      tiers,
      overbooked,
    })
  } catch (error) {
    console.error('Admin ticket event stats error:', error)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
