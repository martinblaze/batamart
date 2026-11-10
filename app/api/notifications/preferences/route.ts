export const dynamic = 'force-dynamic'
// app/api/notifications/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

const DEFAULTS = { pushEnabled: true, emailEnabled: true, reminders: true, deals: true, marketing: true }
const KEYS = Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]
const FREQUENCIES = ['NORMAL', 'FEWER', 'ORDERS_ONLY'] as const

const shape = (prefs: any) => ({
  ...Object.fromEntries(KEYS.map(k => [k, prefs[k]])),
  notifyFrequency: FREQUENCIES.includes(prefs.notifyFrequency) ? prefs.notifyFrequency : 'NORMAL',
  // The Flutter app reads the same value as `frequency`.
  frequency: FREQUENCIES.includes(prefs.notifyFrequency) ? prefs.notifyFrequency : 'NORMAL',
})

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let prefs: any = null
  try {
    prefs = await prisma.notificationPreference.findUnique({ where: { userId: user.id } })
  } catch (error: any) {
    if (error?.code !== 'P2021' && error?.code !== 'P2022') console.error('preferences load error:', error)
    // Table or column missing (migration not applied yet): show defaults, do not fail.
    try {
      prefs = await prisma.notificationPreference.findUnique({
        where: { userId: user.id },
        select: { pushEnabled: true, emailEnabled: true, reminders: true, deals: true, marketing: true },
      })
    } catch {}
  }
  return NextResponse.json({ preferences: prefs ? shape(prefs) : { ...DEFAULTS, notifyFrequency: 'NORMAL', frequency: 'NORMAL' } })
}

export async function PATCH(request: NextRequest) {
  return PUT(request)
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const data: Partial<typeof DEFAULTS> & { notifyFrequency?: string } = {}
    for (const key of KEYS) if (typeof body?.[key] === 'boolean') data[key] = body[key]
    const freq = body?.notifyFrequency !== undefined ? body.notifyFrequency : body?.frequency
    if (freq !== undefined) {
      if (!FREQUENCIES.includes(freq)) {
        return NextResponse.json({ error: `frequency must be one of ${FREQUENCIES.join(', ')}` }, { status: 400 })
      }
      data.notifyFrequency = freq
    }

    let prefs: any
    try {
      prefs = await prisma.notificationPreference.upsert({
        where: { userId: user.id },
        update: data,
        create: { userId: user.id, ...DEFAULTS, ...data },
      })
    } catch (error: any) {
      // notifyFrequency column not migrated yet: save everything else.
      if (error?.code !== 'P2022') throw error
      const { notifyFrequency: _skip, ...rest } = data
      prefs = await prisma.notificationPreference.upsert({
        where: { userId: user.id },
        update: rest,
        create: { userId: user.id, ...DEFAULTS, ...rest },
        select: { pushEnabled: true, emailEnabled: true, reminders: true, deals: true, marketing: true },
      })
    }
    return NextResponse.json({ preferences: shape(prefs) })
  } catch (error) {
    console.error('preferences save error:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
