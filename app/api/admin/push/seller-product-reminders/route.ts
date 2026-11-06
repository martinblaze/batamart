import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify/dispatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAdmin(request: NextRequest) {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return false

  try {
    const decoded = jwt.verify(header.substring(7), process.env.JWT_SECRET!)
    return typeof decoded !== 'string' && decoded.role === 'ADMIN'
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const runId = typeof body.runId === 'string' ? body.runId.trim() : ''
  if (!/^[\w-]{1,80}$/.test(runId)) {
    return NextResponse.json({ error: 'A valid run ID is required' }, { status: 400 })
  }

  try {
    await prisma.notificationLog.findFirst({ select: { id: true } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return NextResponse.json(
        { error: 'The notifications database update is required before sending this campaign.' },
        { status: 503 },
      )
    }
    console.error('[SELLER_PRODUCT_REMINDERS] Could not verify notification log:', error)
    return NextResponse.json({ error: 'Could not verify notification setup' }, { status: 500 })
  }

  try {
    const sellers = await prisma.user.findMany({
      where: {
        role: 'SELLER',
        isSuspended: false,
        isDeleted: false,
        products: { some: { isDeleted: false } },
      },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    })

    const totals = {
      attempted: 0,
      reached: 0,
      webPush: 0,
      appPush: 0,
      email: 0,
      inApp: 0,
      alreadyReceived: 0,
      optedOut: 0,
      failed: 0,
    }
    const deadline = Date.now() + 50_000
    let processed = 0

    for (let i = 0; i < sellers.length; i += 10) {
      if (Date.now() > deadline) break
      const batch = sellers.slice(i, i + 10)
      const results = await Promise.all(batch.map(async seller => {
        const firstName = seller.name.trim().split(/\s+/)[0] || 'seller'
        const notifications = [
          {
            key: 'listing-refresh',
            title: `Happy new month, ${firstName}! Refresh your listings`,
            message: `Please make a small update to most of your products, such as refreshing a photo, title, description or price. Keeping listings current can help buyers notice them.`,
            subject: 'Happy new month! Refresh your BataMart listings',
            heading: 'Give your listings a refresh',
            lines: [
              `Happy new month, ${firstName}. Make a small update to most of your products, such as refreshing a photo, title, description or price.`,
              'Current, complete listings can help buyers understand what you are selling. Open your shop to review and update your products.',
            ],
            dedupeKey: `seller-product-refresh-broadcast:${runId}:${seller.id}`,
          },
          {
            key: 'stock-check',
            title: `Happy new month, ${firstName}! Check your stock`,
            message: `Please confirm your products are still available in your physical market. Update quantities, and pause or remove anything out of stock so buyers do not order unavailable items.`,
            subject: 'Happy new month! Confirm your product stock',
            heading: 'Check what is in stock',
            lines: [
              `Happy new month, ${firstName}. Please confirm your listed products are still available in your physical market.`,
              'Update quantities, and pause or remove anything that is out of stock so buyers do not order unavailable items.',
            ],
            dedupeKey: `seller-stock-check-broadcast:${runId}:${seller.id}`,
          },
        ]

        return Promise.all(notifications.map(notification => notifyUser(seller.id, {
          category: 'reminder',
          title: notification.title,
          message: notification.message,
          url: '/my-shop',
          dedupeKey: notification.dedupeKey,
          bypassLimits: true,
          email: {
            subject: notification.subject,
            preheader: notification.message,
            greeting: `Hi ${firstName},`,
            heading: notification.heading,
            lines: notification.lines,
            ctaLabel: 'Manage my products',
            ctaUrl: '/my-shop',
            signoff: 'The BataMart team',
          },
        })))
      }))

      processed += batch.length
      for (const sellerResults of results) {
        for (const result of sellerResults) {
          if (result.skipped === 'duplicate') totals.alreadyReceived++
          else if (result.skipped === 'preference') totals.optedOut++
          else {
            totals.attempted++
            if (result.sent) totals.reached++
            else totals.failed++
            if (result.channels.webPush) totals.webPush++
            if (result.channels.appPush) totals.appPush++
            if (result.channels.email) totals.email++
            if (result.channels.inApp) totals.inApp++
          }
        }
      }
    }

    const remaining = sellers.length - processed
    return NextResponse.json({
      success: totals.reached > 0,
      audience: sellers.length,
      ...totals,
      remaining,
      runId,
      message: `Sent ${totals.reached} of ${sellers.length * 2} seller reminders: ${totals.inApp} in-app, ${totals.webPush} browser push, ${totals.appPush} app push and ${totals.email} email deliveries.${totals.optedOut ? ` ${totals.optedOut} reminders were skipped due to notification preferences.` : ''}${remaining ? ` Stopped early with ${remaining} seller(s) remaining; continue the send to finish.` : ''}${totals.failed ? ` ${totals.failed} reminder(s) could not be delivered.` : ''}`,
    })
  } catch (error) {
    console.error('[SELLER_PRODUCT_REMINDERS] Send failed:', error)
    return NextResponse.json({ error: 'Could not send seller reminders' }, { status: 500 })
  }
}
