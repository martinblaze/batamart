import { NextRequest, NextResponse } from 'next/server'
import { backfillHotStatusesForActiveUniversities } from '@/lib/hot-status-backfill'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await backfillHotStatusesForActiveUniversities()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Hot status cron error:', error)
    return NextResponse.json({ error: 'Failed to backfill hot statuses' }, { status: 500 })
  }
}
