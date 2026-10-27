// app/api/cron/notify-morning/route.ts
// Scheduled notification bundle (see vercel.json). Vercel Cron calls this with
// `Authorization: Bearer $CRON_SECRET`; the x-cron-secret header is accepted
// too so it can be triggered by hand or from another scheduler.
import { NextRequest, NextResponse } from 'next/server'
import { runMorning } from '@/lib/notify/jobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || (bearer !== secret && req.headers.get('x-cron-secret') !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const started = Date.now()
  const results = await runMorning({ deadline: started + 50_000 })
  return NextResponse.json({ ok: true, ms: Date.now() - started, results })
}
