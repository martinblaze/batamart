// app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

const NOTIFICATION_CACHE_TTL_MS = 20 * 1000
const notificationCache = new Map<string, {
  timestamp: number
  payload: { notifications: unknown[]; unreadCount: number }
}>()

function cacheKey(userId: string, unreadOnly: boolean, limit: number) {
  return `${userId}:${unreadOnly ? 'unread' : 'all'}:${limit}`
}

function clearUserNotificationCache(userId: string) {
  for (const key of notificationCache.keys()) {
    if (key.startsWith(`${userId}:`)) notificationCache.delete(key)
  }
}

// GET - Fetch user's notifications
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const key = cacheKey(user.id, unreadOnly, limit)
    const cached = notificationCache.get(key)
    if (cached && Date.now() - cached.timestamp < NOTIFICATION_CACHE_TTL_MS) {
      return NextResponse.json(cached.payload)
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: user.id,
          ...(unreadOnly && { isRead: false })
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      }),
      prisma.notification.count({
        where: {
          userId: user.id,
          isRead: false
        }
      })
    ])

    const payload = {
      notifications,
      unreadCount
    }
    notificationCache.set(key, { timestamp: Date.now(), payload })

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Fetch notifications error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// PATCH - Mark notification(s) as read
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { notificationIds, markAllAsRead } = await request.json()

    if (markAllAsRead) {
      // Mark all user's notifications as read
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })
      clearUserNotificationCache(user.id)

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read'
      })
    }

    if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: user.id // Security: only update user's own notifications
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      })
      clearUserNotificationCache(user.id)

      return NextResponse.json({
        success: true,
        message: 'Notifications marked as read'
      })
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Update notifications error:', error)
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    )
  }
}

// DELETE - Delete notification(s)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get('id')
    const deleteAll = searchParams.get('deleteAll') === 'true'

    if (deleteAll) {
      await prisma.notification.deleteMany({
        where: { userId: user.id }
      })
      clearUserNotificationCache(user.id)

      return NextResponse.json({
        success: true,
        message: 'All notifications deleted'
      })
    }

    if (notificationId) {
      await prisma.notification.delete({
        where: {
          id: notificationId,
          userId: user.id // Security check
        }
      })
      clearUserNotificationCache(user.id)

      return NextResponse.json({
        success: true,
        message: 'Notification deleted'
      })
    }

    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Delete notification error:', error)
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}
