export const dynamic = 'force-dynamic'
// GET /api/admin/notifications/campaign-stats?days=7
// Per day and slot: sent, skipped (cap / quiet hours / opt-out / frequency /
// no product to show) and marketing emails sent against the daily budget.
// Read from NotificationLog keys the campaign engine writes; no extra table.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminIdFromRequest } from '../../tickets/_auth'
import { emailDailyBudget } from '@/lib/notify/campaigns/engine'
import { SLOT_TIMES } from '@/lib/notify/campaigns/logic'

export async function GET(req: NextRequest) {
  if (!adminIdFromRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const days = Math.min(30, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') ?? '7') || 7))
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [done, budgetRows, finished] = await Promise.all([
      prisma.notificationLog.groupBy({
        by: ['key'],
        where: { key: { startsWith: 'cdone:' }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.notificationLog.findMany({ where: { userId: 'system', key: { startsWith: 'email-budget:' }, createdAt: { gte: since } }, select: { key: true } }),
      prisma.notificationLog.findMany({ where: { userId: 'system', key: { startsWith: 'crun:' }, createdAt: { gte: since } }, select: { key: true } }),
    ])

    type Slot = { slot: number; time: string; sent: number; skippedCap: number; skippedQuiet: number; skippedPreference: number; noProduct: number; finished: boolean }
    const perDay = new Map<string, { day: string; slots: Map<number, Slot>; emailsSent: number }>()
    const dayOf = (day: string) => {
      let d = perDay.get(day)
      if (!d) { d = { day, slots: new Map(), emailsSent: 0 }; perDay.set(day, d) }
      return d
    }
    const slotOf = (day: string, slot: number): Slot => {
      const d = dayOf(day)
      let s = d.slots.get(slot)
      if (!s) {
        s = { slot, time: SLOT_TIMES[slot as 1] ?? '', sent: 0, skippedCap: 0, skippedQuiet: 0, skippedPreference: 0, noProduct: 0, finished: false }
        d.slots.set(slot, s)
      }
      return s
    }

    for (const row of done) {
      const [, day, slotStr, outcome] = row.key.split(':')
      const s = slotOf(day, Number(slotStr))
      const n = row._count._all
      if (outcome === 'sent') s.sent += n
      else if (outcome === 'cap') s.skippedCap += n
      else if (outcome === 'quiet') s.skippedQuiet += n
      else if (outcome === 'pref' || outcome === 'frequency') s.skippedPreference += n
      else if (outcome === 'nocand') s.noProduct += n
    }
    for (const f of finished) {
      const [, day, slotStr] = f.key.split(':')
      slotOf(day, Number(slotStr)).finished = true
    }
    for (const b of budgetRows) dayOf(b.key.split(':')[1]).emailsSent++

    const budget = emailDailyBudget()
    const result = Array.from(perDay.values())
      .sort((a, b) => (a.day < b.day ? 1 : -1))
      .map(d => ({
        day: d.day,
        pushSent: Array.from(d.slots.values()).reduce((n, s) => n + s.sent, 0),
        emails: { sent: d.emailsSent, budget },
        slots: Array.from(d.slots.values()).sort((a, b) => a.slot - b.slot),
      }))

    return NextResponse.json({ days: result, emailDailyBudget: budget })
  } catch (error) {
    console.error('campaign-stats error:', error)
    return NextResponse.json({ error: 'Failed to load campaign stats' }, { status: 500 })
  }
}
