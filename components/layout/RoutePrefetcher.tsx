'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const ROUTES_TO_PREFETCH = [
  '/marketplace',
  '/search',
  '/orders',
  '/cart',
  '/sell',
  '/wallet',
  '/referrals',
  '/myprofile',
  '/dispute/select-order',
  '/most-bought',
]

export function RoutePrefetcher() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (cancelled) return
      ROUTES_TO_PREFETCH.forEach(route => {
        try { router.prefetch(route) } catch {}
      })
    }

    const id = (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(run, { timeout: 1200 })
      : window.setTimeout(run, 350)

    return () => {
      cancelled = true
      if ((window as any).cancelIdleCallback && typeof id === 'number') {
        ;(window as any).cancelIdleCallback(id)
      } else {
        clearTimeout(id)
      }
    }
  }, [router])

  return null
}
