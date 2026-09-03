// hooks/usePushSubscription.tsx
'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useNotificationNudge } from '@/hooks/useNotificationNudge'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

function isIosBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

export function isIosBrowserTab(): boolean {
  return isIosBrowser() && !isStandaloneMode()
}

export function isIosPwa(): boolean {
  return isIosBrowser() && isStandaloneMode()
}

export function usePushSubscription() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) return

    if (isIosBrowserTab()) return

    setIsSupported(true)
    setPermission(Notification.permission)
    checkSubscription()
  }, [])

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) return

    if (isIosBrowserTab()) return

    autoResubscribeIfNeeded()
  }, [])

  const checkSubscription = async () => {
    try {
      const registration = await getServiceWorkerRegistration()
      if (!registration) return
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error('[Push] Check subscription error:', error)
    }
  }

  const autoResubscribeIfNeeded = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/^"(.*)"$/s, '$1')
      if (!vapidKey) return

      const registration = await getServiceWorkerRegistration()
      if (!registration) return

      const existing = await registration.pushManager.getSubscription()

      if (existing) {
        const lastSync = parseInt(localStorage.getItem('batamart_push_synced') || '0')
        const twentyFourHours = 24 * 60 * 60 * 1000
        if (Date.now() - lastSync < twentyFourHours) {
          setIsSubscribed(true)
          return
        }
        await saveSubscriptionToServer(existing, token)
        localStorage.setItem('batamart_push_synced', String(Date.now()))
        setIsSubscribed(true)
        return
      }

      console.log('[Push] No subscription found — re-subscribing silently...')
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await saveSubscriptionToServer(newSubscription, token)
      localStorage.setItem('batamart_push_synced', String(Date.now()))
      setIsSubscribed(true)
      console.log('[Push] ✅ Auto re-subscribed successfully')
    } catch (error) {
      console.error('[Push] Auto re-subscribe failed:', error)
    }
  }

  const getServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Service worker ready timeout')), 10000)
        ),
      ])
      return registration as ServiceWorkerRegistration
    } catch (error) {
      console.error('[Push] Service worker registration failed:', error)
      return null
    }
  }

  const saveSubscriptionToServer = async (subscription: PushSubscription, token: string) => {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(subscription),
    })
    if (!response.ok) {
      throw new Error(`Server rejected subscription: ${await response.text()}`)
    }
  }

  const subscribe = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser')
      return false
    }

const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/^"(.*)"$/s, '$1')
    if (!vapidKey) {
      console.error('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
      toast.error('Notifications are not configured yet. Please try again later.')
      return false
    }

    setIsLoading(true)

    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result === 'denied') {
        toast.error('Notification permission denied. Enable it in your device settings.')
        return false
      }

      if (result !== 'granted') return false

      const registration = await getServiceWorkerRegistration()
      if (!registration) {
        toast.error('Service worker not ready. Please refresh and try again.')
        return false
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const token = localStorage.getItem('token')
      if (!token) {
        toast.error('Please log in to enable notifications')
        return false
      }

      await saveSubscriptionToServer(subscription, token)
      localStorage.setItem('batamart_push_synced', String(Date.now()))
      setIsSubscribed(true)
      toast.success('Notifications enabled!')
      return true
    } catch (error) {
      console.error('[Push] Subscribe error:', error)
      toast.error('Failed to enable notifications. Please try again.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const unsubscribe = async (): Promise<boolean> => {
    try {
      setIsLoading(true)
      const registration = await getServiceWorkerRegistration()
      if (!registration) return false

      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        setIsSubscribed(false)
        return true
      }

      await subscription.unsubscribe()

      const token = localStorage.getItem('token')
      if (token) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
      }

      localStorage.removeItem('batamart_push_synced')
      setIsSubscribed(false)
      toast.success('Notifications disabled')
      return true
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return {
    permission,
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  }
}

export function NotificationPrompt() {
  const { shouldShowPassive, snooze, markGranted } = useNotificationNudge()
  const { isLoading, subscribe } = usePushSubscription()
  const [visible, setVisible] = useState(false)
  const [animOut, setAnimOut] = useState(false)

  useEffect(() => {
    if (!shouldShowPassive) return
    const t = setTimeout(() => setVisible(true), 3000)
    return () => clearTimeout(t)
  }, [shouldShowPassive])

  const dismiss = (andSnooze = true) => {
    setAnimOut(true)
    setTimeout(() => {
      setVisible(false)
      setAnimOut(false)
      if (andSnooze) snooze()
    }, 280)
  }

  const handleEnable = async () => {
    const granted = await subscribe()
    if (granted) {
      markGranted()
      dismiss(false)
    }
  }

  if (!visible) return null

  return (
    <>
      <style>{`
        @keyframes npBackdropIn  { from{opacity:0} to{opacity:1} }
        @keyframes npBackdropOut { from{opacity:1} to{opacity:0} }
        @keyframes npSheetIn     { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes npSheetOut    { from{transform:translateY(0)} to{transform:translateY(100%)} }
        @keyframes npBellRing {
          0%,100%{transform:rotate(0)}
          15%{transform:rotate(14deg)}
          30%{transform:rotate(-10deg)}
          45%{transform:rotate(8deg)}
          60%{transform:rotate(-5deg)}
          75%{transform:rotate(3deg)}
        }
        .np-backdrop {
          animation: ${animOut ? 'npBackdropOut' : 'npBackdropIn'} 0.28s ease forwards;
        }
        .np-sheet {
          animation: ${animOut ? 'npSheetOut' : 'npSheetIn'} 0.32s cubic-bezier(0.32,0.72,0,1) forwards;
        }
        .np-bell { animation: npBellRing 1.6s ease 0.5s both; }
      `}</style>

      <div
        className="np-backdrop fixed inset-0 z-[9998] bg-black/30"
        onClick={() => dismiss(true)}
      />

      <div
        className="np-sheet fixed left-0 right-0 bottom-0 z-[9999] bg-card rounded-t-3xl overflow-hidden"
        style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.18)' }}
      >
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#1a3f8f,#3b9ef5)' }} />

        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        <div className="px-5 pt-2 pb-6" style={{ paddingBottom: 'calc(24px + max(env(safe-area-inset-bottom), 16px))' }}>
          <div className="flex items-start gap-3 mb-4">
            <div className="np-bell flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border bg-surface">
              <svg className="h-5 w-5 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[17px] leading-snug text-ink" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', fontWeight: 600 }}>
                Stay in the loop
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">
                Get notified about your orders, deliveries and messages — even when the app is closed.
              </p>
            </div>

            <button
              onClick={() => dismiss(true)}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors -mt-0.5 -mr-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2">
            {['Order updates', 'Delivery alerts', 'New messages'].map((text, i) => (
              <span key={text} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden className="h-2.5 w-px bg-border" />}
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">{text}</span>
              </span>
            ))}
          </div>

          <button
            onClick={handleEnable}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink font-mono text-[11px] uppercase tracking-[0.16em] text-background transition-colors duration-300 hover:bg-primary disabled:opacity-60 active:scale-[0.99]"
            style={{ minHeight: '52px' }}
          >
            {isLoading
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Enabling…</>
              : 'Enable Notifications'
            }
          </button>

          <button
            onClick={() => dismiss(true)}
            className="mt-2.5 w-full rounded-lg border border-border font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors duration-300 hover:border-ink/25 hover:text-ink active:scale-[0.99]"
            style={{ minHeight: '44px' }}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </>
  )
}