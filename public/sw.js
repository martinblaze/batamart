// public/sw.js
// ─────────────────────────────────────────────────────────────────────────────
// BataMart Service Worker
// Handles: Push Notifications, Notification Clicks, Offline Cache
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'batamart-v3'

// Pages to cache for offline use
const OFFLINE_URLS = [
  '/',
  '/marketplace',
  '/offline',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

// ─── Install: cache key pages ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn('[SW] Cache addAll partial failure (some URLs may not exist yet):', err)
      })
    })
  )
  self.skipWaiting()
})

// ─── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch: network-first for pages, cache-first for hashed static assets ─────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) return

  const accept = event.request.headers.get('accept') || ''
  const isStaticAsset = url.pathname.startsWith('/_next/static/')
  const isNavigation =
    event.request.mode === 'navigate' ||
    accept.includes('text/html') ||
    accept.includes('text/x-component')

  if (isStaticAsset) {
    // Next.js content-hashes these filenames, so the same URL always means
    // the same bytes — safe (and fast) to cache-first forever.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached
        const response = await fetch(event.request)
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(event.request, response.clone())
        }
        return response
      })
    )
    return
  }

  if (isNavigation) {
    // Pages/RSC payloads live at stable URLs whose CONTENT changes on every
    // deploy — cache-first here meant a page loaded once was frozen forever
    // (e.g. the Girlfriend's Day page showing "no gifts" from before any
    // were approved, never re-checking even after real data existed).
    // Network-first fixes that; the cache is now purely an offline fallback.
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const cache = await caches.open(CACHE_NAME)
            cache.put(event.request, response.clone())
          }
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          const cached = await cache.match(event.request)
          return cached || cache.match('/')
        })
    )
  }
})

// ─── Push: receive and show notification ─────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_RUNTIME_CACHE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) =>
        cache.keys().then((requests) =>
          Promise.all(
            requests
              .filter((request) => {
                const url = new URL(request.url)
                return !url.pathname.startsWith('/_next/static/')
              })
              .map((request) => cache.delete(request))
          )
        )
      )
    )
  }
})

self.addEventListener('push', (event) => {
  console.log('[SW] Push received')

  let data = {
    title: 'BataMart',
    body: 'You have a new notification',
    url: '/',
    tag: 'batamart-default',
    requireInteraction: false,
  }

  // Parse payload sent from server
  if (event.data) {
    try {
      const parsed = event.data.json()
      data = {
        title: parsed.title || data.title,
        body: parsed.body || parsed.message || data.body,
        url: parsed.url || data.url,
        tag: parsed.tag || data.tag,
        requireInteraction: parsed.requireInteraction ?? data.requireInteraction,
      }
    } catch (err) {
      console.warn('[SW] Failed to parse push payload:', err)
      // Use text fallback
      try {
        data.body = event.data.text()
      } catch {}
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag,
    requireInteraction: data.requireInteraction,
    renotify: true, // Always show even if same tag
    data: { url: data.url },
    actions: data.requireInteraction
      ? [
          { action: 'open', title: 'Open App' },
          { action: 'dismiss', title: 'Dismiss' },
        ]
      : [],
    vibrate: data.requireInteraction ? [200, 100, 200, 100, 200] : [200],
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // Open pages (the bell, the notifications list) refresh themselves
      // instead of waiting for their next poll.
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => clients.forEach((client) => client.postMessage({ type: 'PUSH_RECEIVED' }))),
    ])
  )
})

// ─── Notification Click: open or focus the app ────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action)
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/'
  const fullUrl = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus()
            client.navigate(fullUrl)
            return
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(fullUrl)
        }
      })
  )
})

// ─── Notification Close: track dismissed notifications ────────────────────────
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification dismissed by user:', event.notification.tag)
})

// ─── Push Subscription Change: re-subscribe automatically ────────────────────
// This fires when browser auto-refreshes the push subscription
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed — re-subscribing...')

  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
      })
      .then(async (newSubscription) => {
        // Send new subscription to server
        const token = await getTokenFromDB()
        if (!token) return

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newSubscription),
        })
        console.log('[SW] Re-subscribed and saved new subscription to server')
      })
      .catch((err) => {
        console.error('[SW] pushsubscriptionchange re-subscribe failed:', err)
      })
  )
})

// ─── Helper: get auth token from open clients ─────────────────────────────────
async function getTokenFromDB() {
  try {
    const clientList = await clients.matchAll({ includeUncontrolled: true })
    // Ask first available client for the token
    for (const client of clientList) {
      const response = await new Promise((resolve) => {
        const channel = new MessageChannel()
        channel.port1.onmessage = (e) => resolve(e.data)
        client.postMessage({ type: 'GET_TOKEN' }, [channel.port2])
        setTimeout(() => resolve(null), 1000)
      })
      if (response) return response
    }
  } catch {}
  return null
}
