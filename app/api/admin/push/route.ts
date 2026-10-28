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

    // The email can say more than the push. Anything left blank falls back to
    // the push title and message.
    const emailSubject = String(body.emailSubject || '').trim() || title
    const emailHeading = String(body.emailHeading || '').trim() || title
    const emailBody = String(body.emailBody || '').trim() || message
    const emailButton = String(body.emailButton || '').trim() || 'Open BataMart'
    const emailParagraphs = emailBody.split(/\n\s*\n/).map(p => p.trim().replace(/\n/g, ' ')).filter(Boolean)

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
    }

    // A broadcast relies on the sent-log table so nobody gets it twice. Without
    // the migration, stop with a clear message instead of reporting "0 sent".
    try {
      await prisma.notificationLog.findFirst({ select: { id: true } })
    } catch (error: any) {
      if (error?.code === 'P2021') {
        return NextResponse.json(
          { error: 'The notifications database update has not been applied yet. Run "npx prisma migrate deploy" (migration 20260731090000_notifications_engine), then send again. Nothing was sent.' },
          { status: 503 },
        )
      }
      throw error
    }

    let userIds: string[]
    const firstNames = new Map<string, string>()
    if (target === 'user') {
      if (!email) {
        return NextResponse.json({ error: 'User email is required for target=user' }, { status: 400 })
      }
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      userIds = [user.id]
      firstNames.set(user.id, (user.name || '').trim().split(/\s+/)[0] || '')
    } else {
      const users = await prisma.user.findMany({
        where: { isSuspended: false, role: { in: ['BUYER', 'SELLER', 'RIDER'] } },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      })
      userIds = users.map(u => u.id)
      users.forEach(u => firstNames.set(u.id, (u.name || '').trim().split(/\s+/)[0] || ''))
    }

    const deadline = Date.now() + 50_000
    const totals = { failed: 0, attempted: 0, reached: 0, webPush: 0, appPush: 0, email: 0, inApp: 0, alreadyReceived: 0, optedOut: 0 }
    let processed = 0

    // Skip people who already got this broadcast in one query. Letting the
    // dedupe insert reject them one by one costs ~0.35s each and used up the
    // time budget before the last users on a re-send were reached.
    let queue = userIds
    try {
      const done = await prisma.notificationLog.findMany({
        where: { key: `broadcast:${broadcastId}`, userId: { in: userIds } },
        select: { userId: true },
      })
      if (done.length > 0) {
        const received = new Set(done.map(d => d.userId))
        queue = userIds.filter(id => !received.has(id))
        totals.alreadyReceived = received.size
      }
    } catch {
      // table missing or lookup failed: fall back to the per-user dedupe
    }

    for (let i = 0; i < queue.length; i += 15) {
      if (Date.now() > deadline) break
      const chunk = queue.slice(i, i + 15)
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
              ? {
                  email: {
                    subject: emailSubject,
                    preheader: message,
                    greeting: firstNames.get(id) ? `Hi ${firstNames.get(id)},` : 'Hello,',
                    heading: emailHeading,
                    lines: emailParagraphs,
                    ctaLabel: emailButton,
                    ctaUrl: url,
                    signoff: 'The BataMart team',
                  },
                }
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
          else totals.failed++
          if (r.channels.webPush) totals.webPush++
          if (r.channels.appPush) totals.appPush++
          if (r.channels.email) totals.email++
          if (r.channels.inApp) totals.inApp++
        }
      }
    }

    const remaining = queue.length - processed
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
          : `Sent to ${totals.reached} of ${userIds.length} users: ${parts.join(', ')}.${totals.optedOut ? ` ${totals.optedOut} opted out of offers.` : ''}${remaining > 0 ? ` Stopped early with ${remaining} still to go. Send again to continue.` : ''}${totals.failed > 0 ? ` ${totals.failed} could not be sent (a provider limit or a missing address). Send again later to retry just those.` : ''}`,
    })
  } catch (error) {
    console.error('[ADMIN PUSH] Error sending push notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
