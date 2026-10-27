export const dynamic = 'force-dynamic'
// app/api/push/device-token/route.ts
// The native app registers its FCM token here after login (and whenever
// Firebase rotates it); logout removes it so a shared phone stops receiving
// the previous user's notifications.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const platform = body?.platform === 'ios' ? 'ios' : 'android'
    if (token.length < 20 || token.length > 4096) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    // A token belongs to one user at a time: re-registering moves it.
    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: user.id, platform },
      create: { token, userId: user.id, platform },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('device-token save error:', error)
    return NextResponse.json({ error: 'Failed to save token' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    if (token) await prisma.deviceToken.deleteMany({ where: { token, userId: user.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('device-token delete error:', error)
    return NextResponse.json({ error: 'Failed to remove token' }, { status: 500 })
  }
}
