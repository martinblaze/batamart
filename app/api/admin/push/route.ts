import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push/sendPushNotification'

export const dynamic = 'force-dynamic'

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

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
    }

    const allSubscriptions = await prisma.pushSubscription.findMany({ select: { userId: true } })
    const totalSubscribers = Array.from(new Set(allSubscriptions.map((sub) => sub.userId))).length

    let userIds: string[] = []
    let targetedEmail: string | null = null
    let userSubscriptionCount: number | null = null

    if (target === 'user') {
      if (!email) {
        return NextResponse.json({ error: 'User email is required for target=user' }, { status: 400 })
      }

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      targetedEmail = user.email
      userSubscriptionCount = await prisma.pushSubscription.count({ where: { userId: user.id } })

      if (userSubscriptionCount === 0) {
        return NextResponse.json({
          success: false,
          attempted: 0,
          delivered: 0,
          target,
          targetedEmail,
          userSubscriptionCount,
          totalSubscribers,
          message: `User ${email} exists but has no active push subscription.`,
        })
      }

      userIds = [user.id]
    } else {
      userIds = Array.from(new Set(allSubscriptions.map((sub) => sub.userId)))

      if (userIds.length === 0) {
        return NextResponse.json({
          success: false,
          attempted: 0,
          delivered: 0,
          target,
          totalSubscribers: 0,
          message: 'No subscribed users found.',
        })
      }
    }

    const results = await Promise.allSettled(
      userIds.map(async (userId) => {
        return await sendPushToUser(userId, {
          title,
          message,
          url,
          tag: 'admin-push-test',
          requireInteraction: false,
        })
      })
    )

    const delivered = results.filter(
      (result) => result.status === 'fulfilled' && result.value === true
    ).length

    return NextResponse.json({
      success: delivered > 0,
      attempted: userIds.length,
      delivered,
      target,
      targetedEmail,
      userSubscriptionCount: userSubscriptionCount ?? undefined,
      totalSubscribers,
      message: delivered > 0
        ? `Sent push to ${delivered} user(s).`
        : target === 'user'
          ? `User ${email} has ${userSubscriptionCount ?? 0} subscription(s), but none delivered.`
          : 'No push notifications were delivered. Check subscription state.',
    })
  } catch (error) {
    console.error('[ADMIN PUSH] Error sending push notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
