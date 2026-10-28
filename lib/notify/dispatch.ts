// lib/notify/dispatch.ts
// The single entry point for telling a user something. One call fans out to
// the in-app bell, web push, native-app push (FCM) and email, and applies:
//   - de-duplication (dedupeKey), so a reminder never goes out twice
//   - preferences (reminders / deals / marketing can be switched off; order,
//     money and security messages always go through)
//   - a daily cap and quiet hours for promotional pushes
// It never throws: a failed channel is logged and the others still run.

import { prisma } from '@/lib/prisma'
import { sendPushToUser } from '@/lib/push/sendPushNotification'
import { sendFcmToUser } from '@/lib/notify/fcm'
import { renderEmail, type EmailContent } from '@/lib/notify/email'
import { sendEmail } from '@/lib/email/sendEmail'

export type NotifyCategory = 'transactional' | 'security' | 'reminder' | 'deals' | 'marketing'

type NotificationTypeName =
  | 'ORDER_UPDATE' | 'SECURITY_ALERT' | 'REMINDER' | 'DEAL_ALERT' | 'PROMO' | 'WALLET_ACTIVITY'
  | 'WELCOME' | 'DIGEST' | 'ORDER_PLACED' | 'ORDER_PICKED_UP' | 'ORDER_ON_THE_WAY' | 'ORDER_DELIVERED'
  | 'ORDER_COMPLETED' | 'ORDER_CANCELLED' | 'REFERRAL_REWARD' | 'PAYMENT_RECEIVED' | 'STOCK_ALERT'

export interface NotifyOptions {
  category: NotifyCategory
  title: string
  message: string
  /** Where a tap should land. */
  url?: string
  /** In-app type; defaults from the category. */
  type?: NotificationTypeName
  orderId?: string
  productId?: string
  metadata?: Record<string, unknown>
  /** Same key + same user is only ever delivered once. */
  dedupeKey?: string
  /** Provide to also send an email. */
  email?: EmailContent & { subject?: string }
  push?: boolean
  inApp?: boolean
  /** Skip the promotional daily cap and quiet hours (opt-outs still apply). For admin-triggered sends. */
  bypassLimits?: boolean
}

export interface NotifyResult {
  sent: boolean
  skipped?: 'duplicate' | 'preference' | 'no-user'
  channels: { inApp: boolean; webPush: boolean; appPush: boolean; email: boolean }
}

const DEFAULT_TYPE: Record<NotifyCategory, NotificationTypeName> = {
  transactional: 'ORDER_UPDATE',
  security: 'SECURITY_ALERT',
  reminder: 'REMINDER',
  deals: 'DEAL_ALERT',
  marketing: 'PROMO',
}

const PROMOTIONAL_TYPES = ['DEAL_ALERT', 'PROMO', 'REMINDER', 'DIGEST'] as const
const DAILY_PROMO_CAP = 4

function lagosHour(now = new Date()) {
  return (now.getUTCHours() + 1) % 24
}

const isQuietHours = () => {
  const h = lagosHour()
  return h >= 22 || h < 7
}

export async function notifyUser(userId: string, opts: NotifyOptions): Promise<NotifyResult> {
  const result: NotifyResult = { sent: false, channels: { inApp: false, webPush: false, appPush: false, email: false } }
  try {
    let user: { id: string; email: string | null; notificationPreference?: any } | null
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, notificationPreference: true },
      })
    } catch (error: any) {
      // The preferences table is missing (migration not applied yet): carry on
      // with everyone's defaults instead of failing every message.
      if (error?.code !== 'P2021') throw error
      user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
    }
    if (!user) return { ...result, skipped: 'no-user' }

    const prefs = user.notificationPreference ?? null
    const alwaysOn = opts.category === 'transactional' || opts.category === 'security'

    if (!alwaysOn) {
      const blocked =
        (opts.category === 'reminder' && prefs?.reminders === false) ||
        (opts.category === 'deals' && prefs?.deals === false) ||
        (opts.category === 'marketing' && prefs?.marketing === false)
      if (blocked) return { ...result, skipped: 'preference' }
    }

    if (opts.dedupeKey) {
      try {
        await prisma.notificationLog.create({ data: { userId, key: opts.dedupeKey } })
      } catch (error: any) {
        if (error?.code === 'P2002') return { ...result, skipped: 'duplicate' }
        // No log table yet: send anyway, without the once-only guarantee.
        if (error?.code !== 'P2021') throw error
      }
    }

    // Promotional pushes: capped per day and silent overnight. They still land
    // in the bell so nothing is lost.
    let allowPush = opts.push !== false && (alwaysOn || prefs?.pushEnabled !== false)
    if (allowPush && !alwaysOn && !opts.bypassLimits) {
      if (isQuietHours()) allowPush = false
      else {
        const recent = await prisma.notification.count({
          where: {
            userId,
            type: { in: [...PROMOTIONAL_TYPES] as any },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        })
        if (recent >= DAILY_PROMO_CAP) allowPush = false
      }
    }

    const tasks: Promise<void>[] = []

    if (opts.inApp !== false) {
      tasks.push(
        prisma.notification
          .create({
            data: {
              userId,
              type: (opts.type ?? DEFAULT_TYPE[opts.category]) as any,
              title: opts.title,
              message: opts.message,
              orderId: opts.orderId,
              productId: opts.productId,
              metadata: { ...(opts.metadata ?? {}), ...(opts.url ? { orderUrl: opts.url } : {}) } as any,
            },
          })
          .then(() => { result.channels.inApp = true })
          .catch(err => console.error('[notify] in-app failed:', err)),
      )
    }

    if (allowPush) {
      const data: Record<string, string> = { type: opts.type ?? DEFAULT_TYPE[opts.category] }
      if (opts.orderId) data.orderId = opts.orderId
      if (opts.productId) data.productId = opts.productId
      tasks.push(
        sendPushToUser(userId, { title: opts.title, message: opts.message, url: opts.url, tag: opts.dedupeKey })
          .then(ok => { result.channels.webPush = ok })
          .catch(() => {}),
        sendFcmToUser(userId, { title: opts.title, body: opts.message, url: opts.url, data })
          .then(ok => { result.channels.appPush = ok })
          .catch(() => {}),
      )
    }

    const emailAllowed = opts.email && user.email && (alwaysOn || prefs?.emailEnabled !== false)
    if (emailAllowed && opts.email) {
      const { subject, ...content } = opts.email
      tasks.push(
        sendEmail({
          to: user.email!,
          subject: subject ?? opts.title,
          html: renderEmail({ ...content, showPreferences: !alwaysOn }),
        })
          .then(() => { result.channels.email = true })
          .catch(err => console.error('[notify] email failed:', err)),
      )
    }

    await Promise.all(tasks)
    result.sent = Object.values(result.channels).some(Boolean)
    return result
  } catch (error) {
    console.error('[notify] failed for user', userId, error)
    return result
  }
}

/**
 * Notify many users with bounded concurrency and a time budget, so a cron run
 * on a serverless function stops cleanly instead of being killed mid-send.
 */
export async function notifyMany(
  userIds: string[],
  build: (userId: string) => NotifyOptions | null,
  { concurrency = 15, deadline }: { concurrency?: number; deadline?: number } = {},
): Promise<{ attempted: number; sent: number }> {
  let attempted = 0
  let sent = 0
  for (let i = 0; i < userIds.length; i += concurrency) {
    if (deadline && Date.now() > deadline) break
    const chunk = userIds.slice(i, i + concurrency)
    const results = await Promise.all(
      chunk.map(async id => {
        const opts = build(id)
        if (!opts) return null
        attempted++
        return notifyUser(id, opts)
      }),
    )
    sent += results.filter(r => r?.sent).length
  }
  return { attempted, sent }
}

/** Every admin user, for operational alerts. */
export async function adminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
  return admins.map(a => a.id)
}
