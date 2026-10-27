// lib/notify/fcm.ts
// Native-app push through Firebase Cloud Messaging. Needs the env var
// FIREBASE_SERVICE_ACCOUNT: the service-account JSON, either raw or base64.
// Without it every call is a quiet no-op, so the rest of the app keeps working.

import { prisma } from '@/lib/prisma'

let messagingPromise: Promise<any | null> | null = null

async function getMessaging() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
      if (!raw) {
        console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT is not set. App push is disabled.')
        return null
      }
      try {
        const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
        const credentials = JSON.parse(json)
        const mod: any = await import('firebase-admin')
        const admin: any = mod.default ?? mod
        const app = admin.apps.length
          ? admin.app()
          : admin.initializeApp({ credential: admin.credential.cert(credentials) })
        return admin.messaging(app)
      } catch (error) {
        console.error('[FCM] Could not initialise Firebase Admin:', error)
        return null
      }
    })()
  }
  return messagingPromise
}

export interface FcmPayload {
  title: string
  body: string
  url?: string
  /** Extra string data the app uses to deep-link (type, orderId, productId...). */
  data?: Record<string, string>
}

/** Sends to every device the user has. Resolves true if at least one was accepted. */
export async function sendFcmToUser(userId: string, payload: FcmPayload): Promise<boolean> {
  try {
    const messaging = await getMessaging()
    if (!messaging) return false

    const devices = await prisma.deviceToken.findMany({ where: { userId }, select: { token: true } })
    if (devices.length === 0) return false

    const response = await messaging.sendEachForMulticast({
      tokens: devices.map(d => d.token),
      notification: { title: payload.title, body: payload.body },
      data: { url: payload.url ?? '/', ...(payload.data ?? {}) },
      android: { priority: 'high', notification: { channelId: 'batamart_default' } },
      apns: { payload: { aps: { sound: 'default' } } },
    })

    // Drop tokens Firebase says are dead (app uninstalled, token rotated).
    const dead: string[] = []
    response.responses.forEach((r: any, i: number) => {
      const code = r.error?.code as string | undefined
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        dead.push(devices[i].token)
      }
    })
    if (dead.length) await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } }).catch(() => {})

    return response.successCount > 0
  } catch (error) {
    console.error('[FCM] send failed:', error)
    return false
  }
}
