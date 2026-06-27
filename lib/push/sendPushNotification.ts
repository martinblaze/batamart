// lib/push/sendPushNotification.ts
import webpush, { PushSubscription as WebPushSubscription } from 'web-push'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/sendEmail'
import {
  orderPlacedEmail,
  newOrderEmail,
  riderAssignedEmail,
  orderOnTheWayEmail,
  orderDeliveredEmail,
  paymentReceivedEmail,
  withdrawalProcessedEmail,
  disputeOpenedEmail,
  disputeResolvedEmail,
  newReviewEmail,
} from '@/lib/email/emailTemplates'

let vapidConfigured = false

function normalizeVapidEmail(email: string): string {
  const normalized = email.trim().replace(/^mailto:/i, '')
  return normalized.startsWith('http') ? normalized : `mailto:${normalized}`
}

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/^"(.*)"$/s, '$1')
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim().replace(/^"(.*)"$/s, '$1')
  const vapidEmail = process.env.VAPID_EMAIL?.trim().replace(/^"(.*)"$/s, '$1')

  if (!publicKey || !privateKey || !vapidEmail) {
    console.warn('[Push] VAPID env vars are missing. Push notifications are disabled.')
    return false
  }

  try {
    webpush.setVapidDetails(normalizeVapidEmail(vapidEmail), publicKey, privateKey)
    vapidConfigured = true
    return true
  } catch (error) {
    console.error('[Push] Failed to initialize VAPID config:', error)
    return false
  }
}

interface PushPayload {
  title: string
  message: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

// ─── Send push to all subscriptions for a user ───────────────────────────────
// ✅ Now EXPORTED so lib/notification.ts can call it directly for custom pushes.
// Returns true if at least one push succeeded.
// Stale/expired subscriptions (410/404) are auto-deleted.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<boolean> {
  try {
    if (!ensureVapidConfigured()) return false

    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } })
    if (subscriptions.length === 0) return false

    // ✅ De-duplicate subscriptions by endpoint before sending
    // This prevents the same device receiving the notification multiple times
    const uniqueSubs = Array.from(
      new Map(subscriptions.map((s) => [s.endpoint, s])).values()
    )

    const results = await Promise.allSettled(
      uniqueSubs.map(async (sub) => {
        const pushSub: WebPushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }
        try {
          await webpush.sendNotification(
            pushSub,
            JSON.stringify({
              title: payload.title,
              body: payload.message,
              url: payload.url || '/',
              tag: payload.tag,
              requireInteraction: payload.requireInteraction ?? false,
              icon: '/icon-192x192.png',
              badge: '/badge-72x72.png',
            })
          )
        } catch (error: any) {
          // 410 Gone / 404 Not Found = subscription is dead, remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`[Push] Removing stale subscription for user ${userId}`)
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
          } else {
            console.error(
              `[Push] Failed to send to ${sub.endpoint.slice(0, 40)}:`,
              error.statusCode,
              error.body
            )
          }
          throw error
        }
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    if (succeeded > 0) {
      console.log(`[Push] ✅ ${succeeded}/${results.length} push(es) delivered to user ${userId}`)
    }
    return succeeded > 0
  } catch {
    return false
  }
}

// ─── Get user email ───────────────────────────────────────────────────────────
async function getUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  return user?.email ?? null
}

// ─── Core notify function ─────────────────────────────────────────────────────
// STRATEGY: Always try push first.
// If push fails (no subscription or all pushes fail) → send email as fallback.
async function notify(
  userId: string,
  push: PushPayload,
  emailFn: () => Promise<{ subject: string; html: string }>
) {
  try {
    const pushed = await sendPushToUser(userId, push)

    if (!pushed) {
      const email = await getUserEmail(userId)
      if (email) {
        const { subject, html } = await emailFn()
        await sendEmail({ to: email, subject, html })
        console.log(`[Notify] 📧 Email fallback sent to ${email} for "${push.title}"`)
      } else {
        console.warn(`[Notify] ⚠️ No push & no email found for user ${userId}`)
      }
    }
  } catch (error) {
    console.error(`[Notify] ❌ Failed to notify user ${userId}:`, error)
  }
}

// ─── Public notification functions ───────────────────────────────────────────

export async function notifyOrderPlaced(buyerId: string, orderNumber: string) {
  await notify(
    buyerId,
    {
      title: '🛒 Order Placed!',
      message: `Your order #${orderNumber} was placed successfully. The seller has been notified.`,
      url: `/orders`,
      tag: 'order-placed',
    },
    async () => orderPlacedEmail(orderNumber)
  )
}

export async function notifyNewOrder(sellerId: string, orderNumber: string) {
  await notify(
    sellerId,
    {
      title: '🎉 New Order!',
      message: `You have a new order #${orderNumber}. Check your dashboard to confirm it now.`,
      url: `/my-shop`,
      tag: 'new-order',
      requireInteraction: true,
    },
    async () => newOrderEmail(orderNumber)
  )
}

export async function notifyRiderAssigned(buyerId: string, orderNumber: string) {
  await notify(
    buyerId,
    {
      title: '🚴 Rider Assigned',
      message: `A rider has been assigned to your order #${orderNumber}. They will pick it up soon.`,
      url: `/orders`,
      tag: 'rider-assigned',
    },
    async () => riderAssignedEmail(orderNumber)
  )
}

export async function notifyOrderOnTheWay(buyerId: string, orderNumber: string) {
  await notify(
    buyerId,
    {
      title: '🛵 Order On The Way!',
      message: `Your order #${orderNumber} has been picked up and is heading to you now!`,
      url: `/orders`,
      tag: 'order-on-the-way',
      requireInteraction: true,
    },
    async () => orderOnTheWayEmail(orderNumber)
  )
}

export async function notifyOrderDelivered(buyerId: string, orderNumber: string) {
  await notify(
    buyerId,
    {
      title: '✅ Order Delivered!',
      message: `Your order #${orderNumber} has been delivered. Please confirm receipt to release payment.`,
      url: `/orders`,
      tag: 'order-delivered',
      requireInteraction: true,
    },
    async () => orderDeliveredEmail(orderNumber)
  )
}

export async function notifyPaymentReceived(sellerId: string, amount: string) {
  await notify(
    sellerId,
    {
      title: '💰 Payment Received!',
      message: `You received a payment of ${amount}. It has been added to your wallet.`,
      url: `/wallet`,
      tag: 'payment-received',
      requireInteraction: true,
    },
    async () => paymentReceivedEmail(amount)
  )
}

export async function notifyWithdrawalProcessed(userId: string, amount: string) {
  await notify(
    userId,
    {
      title: '💸 Withdrawal Processed',
      message: `Your withdrawal of ${amount} has been processed successfully.`,
      url: `/wallet`,
      tag: 'withdrawal-processed',
    },
    async () => withdrawalProcessedEmail(amount)
  )
}

export async function notifyDisputeOpened(userId: string, orderNumber: string) {
  await notify(
    userId,
    {
      title: '⚠️ Dispute Opened',
      message: `A dispute was opened for order #${orderNumber}. Please respond as soon as possible.`,
      url: `/disputes`,
      tag: 'dispute-opened',
      requireInteraction: true,
    },
    async () => disputeOpenedEmail(orderNumber)
  )
}

export async function notifyDisputeResolved(userId: string, orderNumber: string) {
  await notify(
    userId,
    {
      title: '✅ Dispute Resolved',
      message: `The dispute for order #${orderNumber} has been resolved. Check the outcome.`,
      url: `/disputes`,
      tag: 'dispute-resolved',
    },
    async () => disputeResolvedEmail(orderNumber)
  )
}

export async function notifyNewReview(sellerId: string, productName: string) {
  await notify(
    sellerId,
    {
      title: '⭐ New Review',
      message: `"${productName}" just received a new review. Check it out!`,
      url: `/my-shop`,
      tag: 'new-review',
    },
    async () => newReviewEmail(productName)
  )
}

// ─── Notify all available riders of a new order ──────────────────────────────
export async function notifyAvailableRiders(orderNumber: string): Promise<void> {
  try {
    const availableRiders = await prisma.user.findMany({
      where: {
        role: 'RIDER',
        isAvailable: true,
        isDeleted: false,
        isSuspended: false,
        riderDeliveries: {
          none: {
            status: { in: ['RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'] },
            isDisputed: false,
          },
        },
        pushSubscriptions: { some: {} },
      },
      select: { id: true },
    })

    if (availableRiders.length === 0) {
      console.log(`[Push] No available riders with push subscriptions for order #${orderNumber}`)
      return
    }

    const payload: PushPayload = {
      title: '🛵 New Order Available!',
      message: `Order #${orderNumber} is ready for pickup. Open the app to accept it now.`,
      url: '/rider-dashboard',
      tag: 'new-order-available',
      requireInteraction: true,
    }

    console.log(
      `[Push] Notifying ${availableRiders.length} available rider(s) of order #${orderNumber}`
    )

    const results = await Promise.allSettled(
      availableRiders.map((rider) => sendPushToUser(rider.id, payload))
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value === true).length
    console.log(
      `[Push] Rider notifications: ${succeeded}/${results.length} delivered for order #${orderNumber}`
    )
  } catch (error) {
    console.error(`[Push] notifyAvailableRiders failed for order #${orderNumber}:`, error)
  }
}
