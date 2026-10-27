export const dynamic = 'force-dynamic'
// app/api/notifications/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

const DEFAULTS = { pushEnabled: true, emailEnabled: true, reminders: true, deals: true, marketing: true }
const KEYS = Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ preferences: prefs ? Object.fromEntries(KEYS.map(k => [k, prefs[k]])) : DEFAULTS })
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const data: Partial<typeof DEFAULTS> = {}
    for (const key of KEYS) if (typeof body?.[key] === 'boolean') data[key] = body[key]

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: data,
      create: { userId: user.id, ...DEFAULTS, ...data },
    })
    return NextResponse.json({ preferences: Object.fromEntries(KEYS.map(k => [k, prefs[k]])) })
  } catch (error) {
    console.error('preferences save error:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
