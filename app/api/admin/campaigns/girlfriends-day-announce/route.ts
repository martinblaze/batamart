import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { createBulkNotifications } from '@/lib/notification'
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

const DEFAULT_TITLE = "Girlfriend's Day is live 💕"
const DEFAULT_MESSAGE = 'Got something she’d love? List it and tag it "Girlfriend’s Day" so gift shoppers can find it. Selling a package? Describe everything inside the box. Tap for a quick walkthrough.'
const TOUR_URL = '/marketplace?tour=girlfriends-day-sell'

// One-off broadcast: notifies every active seller (in-app + push) about the
// Girlfriend's Day tagging feature, deep-linking into a guided on-screen tour
// (components/tutorial/GirlfriendsDaySellTour.tsx) that shows them exactly
// where the Sell entry point lives for their device/mode.
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminFromToken(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const title = String(body.title || DEFAULT_TITLE).trim()
    const message = String(body.message || DEFAULT_MESSAGE).trim()

    const sellers = await prisma.user.findMany({
      where: {
        role: 'SELLER',
        isSellerMode: true,
        isSuspended: false,
      },
      select: { id: true },
    })

    const userIds = sellers.map((s) => s.id)
    if (userIds.length === 0) {
      return NextResponse.json({ success: false, notified: 0, pushDelivered: 0, message: 'No active sellers found.' })
    }

    await createBulkNotifications(userIds, {
      type: 'CAMPAIGN_ANNOUNCEMENT',
      title,
      message,
      metadata: { tourUrl: TOUR_URL, campaign: 'GIRLFRIENDS_DAY' },
    })

    const pushResults = await Promise.allSettled(
      userIds.map((userId) =>
        sendPushToUser(userId, {
          title,
          message,
          url: TOUR_URL,
          tag: 'girlfriends-day-announce',
          requireInteraction: false,
        })
      )
    )
    const pushDelivered = pushResults.filter((r) => r.status === 'fulfilled' && r.value === true).length

    return NextResponse.json({
      success: true,
      notified: userIds.length,
      pushDelivered,
      message: `Notified ${userIds.length} seller(s), delivered push to ${pushDelivered}.`,
    })
  } catch (error) {
    console.error('[GIRLFRIENDS_DAY_ANNOUNCE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
