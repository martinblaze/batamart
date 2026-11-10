// app/api/cron/notify-slot/route.ts
// POST /api/cron/notify-slot?slot=1..6
// One of the six daily campaign slots (see lib/notify/campaigns). Vercel only
// offers daily crons, so the owner's VPS calls this at the Lagos times (see
// infra/notify-scheduler). Authorised by the SLOT_CRON_SECRET env var, sent in
// the x-slot-secret header. Idempotent per slot per day: people already handled
// are skipped, and once a slot has finished for everyone it answers
// { alreadyDone: true }. If it ran out of time it answers { done: false } and
// the scheduler simply calls it again to continue.
import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { runSlot } from '@/lib/notify/campaigns/engine'
import { parseSlot } from '@/lib/notify/campaigns/logic'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const digest = (v: string) => createHash('sha256').update(v).digest()

export async function POST(req: NextRequest) {
  const secret = process.env.SLOT_CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'SLOT_CRON_SECRET is not configured' }, { status: 503 })
  const given = req.headers.get('x-slot-secret') ?? ''
  if (!timingSafeEqual(digest(given), digest(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const slot = parseSlot(new URL(req.url).searchParams.get('slot'))
  if (!slot) return NextResponse.json({ error: 'slot must be 1 to 6' }, { status: 400 })

  const started = Date.now()
  try {
    const result = await runSlot(slot, { deadline: started + 50_000 })
    return NextResponse.json({ ok: true, ms: Date.now() - started, ...result })
  } catch (error: any) {
    console.error('[notify-slot] failed:', error)
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 })
  }
}
