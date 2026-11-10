export const dynamic = 'force-dynamic'
// GET /api/admin/tickets/events?status=PENDING_REVIEW|ACTIVE|PAUSED|REJECTED|CANCELLED|all
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminIdFromRequest } from '../_auth'

const STATUSES = ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'PAUSED', 'CANCELLED'] as const

export async function GET(req: NextRequest) {
  if (!adminIdFromRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'PENDING_REVIEW'
    if (status !== 'all' && status !== 'PENDING_CHANGES' && !(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50') || 50))
    // PENDING_CHANGES: live events whose host asked to change the flyer/description (oldest request first).
    const where = status === 'all'
      ? {}
      : status === 'PENDING_CHANGES'
        ? { pendingChangeAt: { not: null } }
        : { status: status as (typeof STATUSES)[number] }

    const [events, grouped, total, pendingChanges] = await Promise.all([
      prisma.ticketEvent.findMany({
        where,
        orderBy: status === 'PENDING_CHANGES' ? { pendingChangeAt: 'asc' } : { createdAt: status === 'PENDING_REVIEW' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, description: true, venue: true, address: true,
          startsAt: true, endsAt: true, flyerUrl: true, status: true, allowResale: true,
          reviewNote: true, reviewedAt: true, createdAt: true,
          pendingFlyerUrl: true, pendingDescription: true, pendingChangeAt: true,
          host: { select: { id: true, name: true, username: true, email: true } },
          tiers: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true, name: true, price: true, capacity: true, sold: true, isActive: true,
              randomCommissionPct: true, uniqueCommissionPct: true,
            },
          },
        },
      }),
      prisma.ticketEvent.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ticketEvent.count({ where }),
      prisma.ticketEvent.count({ where: { pendingChangeAt: { not: null } } }),
    ])

    const counts: Record<string, number> = { PENDING_REVIEW: 0, ACTIVE: 0, REJECTED: 0, PAUSED: 0, CANCELLED: 0 }
    for (const g of grouped) counts[g.status] = g._count._all
    counts.PENDING_CHANGES = pendingChanges

    return NextResponse.json({ events: events.map(e => ({ ...e, hasPendingChange: !!e.pendingChangeAt })), counts, total, page, limit })
  } catch (error) {
    console.error('Admin ticket events list error:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
