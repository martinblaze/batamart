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
    if (status !== 'all' && !(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50') || 50))
    const where = status === 'all' ? {} : { status: status as (typeof STATUSES)[number] }

    const [events, grouped, total] = await Promise.all([
      prisma.ticketEvent.findMany({
        where,
        orderBy: { createdAt: status === 'PENDING_REVIEW' ? 'asc' : 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, description: true, venue: true, address: true,
          startsAt: true, endsAt: true, flyerUrl: true, status: true, allowResale: true,
          reviewNote: true, reviewedAt: true, createdAt: true,
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
    ])

    const counts: Record<string, number> = { PENDING_REVIEW: 0, ACTIVE: 0, REJECTED: 0, PAUSED: 0, CANCELLED: 0 }
    for (const g of grouped) counts[g.status] = g._count._all

    return NextResponse.json({ events, counts, total, page, limit })
  } catch (error) {
    console.error('Admin ticket events list error:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
