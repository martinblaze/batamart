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
import { pushImageUrl } from '@/lib/notify/image'
import { unsubscribeHeaders, buildUnsubscribeUrl } from '@/lib/notify/unsubscribe'
import { activityTier, dailyCapFor, nonCampaignLimit, normalizeFrequency, MAX_DAILY } from '@/lib/notify/campaigns/logic'
import { getLagosToday, lagosDayKey } from '@/lib/delivery/schedule'

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
  /** Picture shown large on the push (and the app notification). Resized and https-only. */
  image?: string
  /**
   * Sent by the daily campaign engine. Campaign sends use the unified daily cap
   * first, and when the push is blocked (cap or quiet hours) nothing is created
   * at all, so the next slot can try again with something else.
   */
  campaign?: boolean
  /** Precomputed daily cap for this person (campaign engine batches this). */
  dailyCap?: number
}

export interface NotifyResult {
  sent: boolean
  skipped?: 'duplicate' | 'preference' | 'no-user' | 'cap' | 'quiet' | 'frequency'
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

/** Most recent sign of life: a session event or an order. Null if neither exists. */
async function lastActivityOf(userId: string): Promise<Date | null> {
  const [ev, ord, u] = await Promise.all([
    prisma.userSessionEvent.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }).catch(() => null),
    prisma.order.findFirst({ where: { buyerId: userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }).catch(() => null),
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }).catch(() => null),
  ])
  const times = [ev?.createdAt, ord?.createdAt, u?.createdAt].filter(Boolean) as Date[]
  return times.length ? new Date(Math.max(...times.map(t => t.getTime()))) : null
}

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
    let user: { id: string; email: string | null; isSuspended?: boolean; isDeleted?: boolean; notificationPreference?: any } | null
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, isSuspended: true, isDeleted: true, notificationPreference: true },
      })
    } catch (error: any) {
      // The preferences table is missing (migration not applied yet): carry on
      // with everyone's defaults instead of failing every message.
      if (error?.code !== 'P2021' && error?.code !== 'P2022') throw error
      user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, isSuspended: true, isDeleted: true } })
    }
    if (!user) return { ...result, skipped: 'no-user' }

    const prefs = user.notificationPreference ?? null
    const alwaysOn = opts.category === 'transactional' || opts.category === 'security'
    // Never send promotions to suspended or deleted accounts.
    if (!alwaysOn && (user.isSuspended || user.isDeleted)) return { ...result, skipped: 'preference' }

    if (!alwaysOn) {
      const blocked =
        (opts.category === 'reminder' && prefs?.reminders === false) ||
        (opts.category === 'deals' && prefs?.deals === false) ||
        (opts.category === 'marketing' && prefs?.marketing === false)
      if (blocked) return { ...result, skipped: 'preference' }
    }

    const promotional = !alwaysOn && (opts.campaign || opts.category === 'deals' || opts.category === 'marketing')
    const frequency = normalizeFrequency(prefs?.notifyFrequency)
    if (promotional && frequency === 'ORDERS_ONLY' && !opts.bypassLimits) return { ...result, skipped: 'frequency' }

    // Promotional pushes: ONE daily cap shared by every job, scaled by how
    // recently the person was active and by their "How often" choice. Campaign
    // slots get the whole cap; older jobs only what the slots leave free.
    // Quiet hours (22:00 to 07:00 Lagos) silence them overnight.
    let allowPush = opts.push !== false && (alwaysOn || prefs?.pushEnabled !== false)
    let pushBlocked: 'cap' | 'quiet' | null = null
    if (allowPush && !alwaysOn && !opts.bypassLimits) {
      if (isQuietHours()) pushBlocked = 'quiet'
      else {
        let limit = MAX_DAILY
        if (promotional) {
          let cap = opts.dailyCap
          if (cap === undefined) {
            const last = await lastActivityOf(userId)
            cap = dailyCapFor(activityTier(last), frequency)
          }
          limit = opts.campaign ? cap : nonCampaignLimit(cap)
        }
        const recent = await prisma.notification.count({
          where: {
            userId,
            type: { in: [...PROMOTIONAL_TYPES] as any },
            createdAt: { gte: getLagosToday() },
          },
        })
        if (recent >= limit) pushBlocked = 'cap'
      }
      if (pushBlocked) allowPush = false
    }
    const wantsEmail = !!(opts.email && user.email && (alwaysOn || prefs?.emailEnabled !== false))
    // A promotion that hit the daily cap leaves NO trace (no bell entry either): bell entries of
    // promotional type count toward the cap, so silent ones from older jobs would starve the campaign slots.
    const dropInApp = !!pushBlocked && (opts.campaign || (promotional && pushBlocked === 'cap'))
    if (dropInApp && !wantsEmail) return { ...result, skipped: pushBlocked! }

    if (opts.dedupeKey) {
      try {
        await prisma.notificationLog.create({ data: { userId, key: opts.dedupeKey } })
      } catch (error: any) {
        if (error?.code === 'P2002') return { ...result, skipped: 'duplicate' }
        // No log table yet: send anyway, without the once-only guarantee.
        if (error?.code !== 'P2021') throw error
      }
    }

    const tasks: Promise<void>[] = []

    if (opts.inApp !== false && !dropInApp) {
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
      const image = pushImageUrl(opts.image)
      const data: Record<string, string> = { type: opts.type ?? DEFAULT_TYPE[opts.category] }
      if (opts.orderId) data.orderId = opts.orderId
      if (opts.productId) data.productId = opts.productId
      tasks.push(
        sendPushToUser(userId, { title: opts.title, message: opts.message, url: opts.url, tag: opts.dedupeKey, image })
          .then(ok => { result.channels.webPush = ok })
          .catch(() => {}),
        sendFcmToUser(userId, { title: opts.title, body: opts.message, url: opts.url, image, data })
          .then(ok => { result.channels.appPush = ok })
          .catch(() => {}),
      )
    }

    // At most ONE marketing email per person per day, whichever job sends it.
    let emailDayKey: string | null = null
    let sendMail = wantsEmail && !!opts.email
    if (sendMail && !alwaysOn && !opts.bypassLimits) {
      emailDayKey = `cemail:${lagosDayKey(new Date())}`
      try {
        await prisma.notificationLog.create({ data: { userId, key: emailDayKey } })
      } catch (error: any) {
        if (error?.code === 'P2002') sendMail = false
        else emailDayKey = null
      }
    }
    if (sendMail && opts.email) {
      const { subject, ...content } = opts.email
      tasks.push(
        sendEmail({
          to: user.email!,
          subject: subject ?? opts.title,
          html: renderEmail({
            ...content,
            showPreferences: !alwaysOn,
            unsubscribeUrl: alwaysOn ? undefined : buildUnsubscribeUrl(userId) ?? undefined,
          }),
          headers: alwaysOn ? undefined : unsubscribeHeaders(userId),
        })
          .then(async ok => {
            result.channels.email = ok === true
            if (!ok && emailDayKey) await prisma.notificationLog.deleteMany({ where: { userId, key: emailDayKey } }).catch(() => {})
          })
          .catch(err => console.error('[notify] email failed:', err)),
      )
    }

    await Promise.all(tasks)
    result.sent = Object.values(result.channels).some(Boolean)
    // Nothing got through (for example an email provider's daily limit): free the
    // once-only slot so sending again can reach this person.
    if (!result.sent && opts.dedupeKey) {
      await prisma.notificationLog.deleteMany({ where: { userId, key: opts.dedupeKey } }).catch(() => {})
    }
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
