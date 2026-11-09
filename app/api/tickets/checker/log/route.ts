// GET /api/tickets/checker/log -> recent scans for this checker's event (scope from the session only)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCheckerFromRequest } from '@/lib/tickets/checker-session'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getCheckerFromRequest(request)
    if (!ctx) return NextResponse.json({ error: 'Please sign in again.', code: 'UNAUTHENTICATED' }, { status: 401 })

    const rows = await prisma.ticketScan.findMany({
      where: { eventId: ctx.checker.eventId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true, result: true, holderName: true, tierName: true, createdAt: true, checkerId: true,
        ticket: { select: { code: true } },
      },
    })
    return NextResponse.json({
      scans: rows.map((r) => ({
        id: r.id,
        result: r.result,
        holderName: r.holderName,
        tierName: r.tierName,
        code: r.ticket?.code ?? null,
        createdAt: r.createdAt,
        mine: r.checkerId === ctx.checker.id,
      })),
    })
  } catch (e) {
    console.error('[checker/log]', e instanceof Error ? e.message : 'error')
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
