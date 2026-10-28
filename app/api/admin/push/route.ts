import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify/dispatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function getAdminFromToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  try {
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    if (decoded.role !== 'ADMIN') return null
    return decoded
  } catch {
    return null
  }
}

/**
 * Admin broadcast. One send reaches every channel a person has:
 *   - web push and app push (whichever devices they registered)
 *   - the in-app bell
 *   - email, when "also email" is on
 * It respects the "tips and offers" opt-out, but skips the promotional daily
 * cap and quiet hours, because an admin chose to send it now.
 *
 * Large audiences are processed until a time budget runs out. Every message
 * carries the broadcastId as its dedupe key, so sending again with the same
 * id only reaches the people who were not reached yet.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromToken(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    const target = body.target === 'all' ? 'all' : 'user'
    const email = String(body.email || '').trim()
    const url = body.url ? String(body.url).trim() : '/'
    // Which channels to use: browser/app push (with the bell), email, or both.
    const channel: 'push' | 'email' | 'both' = ['push', 'email', 'both'].includes(body.channel) ? body.channel : 'both'
    const sendPush = channel !== 'email'
    const alsoEmail = channel !== 'push'
    const broadcastId = String(body.broadcastId || '').trim() || `${Date.now()}`

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
    }

    let userIds: string[]
    if (target === 'user') {
      if (!email) {
        return NextResponse.json({ error: 'User email is required for target=user' }, { status: 400 })
      }
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      userIds = [user.id]
    } else {
      const users = await prisma.user.findMany({
        where: { isSuspended: false, role: { in: ['BUYER', 'SELLER', 'RIDER'] } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })
      userIds = users.map(u => u.id)
    }

    const deadline = Date.now() + 50_000
    const totals = { attempted: 0, reached: 0, webPush: 0, appPush: 0, email: 0, inApp: 0, alreadyReceived: 0, optedOut: 0 }
    let processed = 0

    for (let i = 0; i < userIds.length; i += 15) {
      if (Date.now() > deadline) break
      const chunk = userIds.slice(i, i + 15)
      const results = await Promise.all(
        chunk.map(id =>
          notifyUser(id, {
            category: 'marketing',
            type: 'PROMO',
            title,
            message,
            url,
            bypassLimits: true,
            push: sendPush,
            inApp: sendPush,
            dedupeKey: `broadcast:${broadcastId}`,
            ...(alsoEmail
              ? { email: { subject: title, heading: title, lines: [message], ctaLabel: 'Open BataMart', ctaUrl: url } }
              : {}),
          }),
        ),
      )
      processed += chunk.length
      for (const r of results) {
        if (r.skipped === 'duplicate') totals.alreadyReceived++
        else if (r.skipped === 'preference') totals.optedOut++
        else {
          totals.attempted++
          if (r.sent) totals.reached++
          if (r.channels.webPush) totals.webPush++
          if (r.channels.appPush) totals.appPush++
          if (r.channels.email) totals.email++
          if (r.channels.inApp) totals.inApp++
        }
      }
    }

    const remaining = userIds.length - processed
    const parts = [
      sendPush ? `${totals.webPush} browser push` : null,
      sendPush ? `${totals.appPush} app push` : null,
      alsoEmail ? `${totals.email} email` : null,
      sendPush ? `${totals.inApp} in the bell` : null,
    ].filter(Boolean)

    return NextResponse.json({
      success: totals.reached > 0,
      target,
      audience: userIds.length,
      ...totals,
      remaining,
      broadcastId,
      channel,
      message:
        totals.reached === 0 && totals.alreadyReceived > 0 && remaining === 0
          ? 'Everyone in this audience already received this broadcast.'
          : `Sent to ${totals.reached} of ${userIds.length} users: ${parts.join(', ')}.${totals.optedOut ? ` ${totals.optedOut} opted out of offers.` : ''}${remaining > 0 ? ` Stopped early with ${remaining} still to go. Send again to continue.` : ''}`,
    })
  } catch (error) {
    console.error('[ADMIN PUSH] Error sending push notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
