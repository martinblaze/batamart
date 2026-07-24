'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const POLL_INTERVAL_MS = 30_000 // check every 30 seconds

/**
 * useSuspensionGuard
 *
 * Polls /api/auth/me every 30 seconds for any logged-in user.
 * If the server returns 403 with { suspended: true }, the admin has
 * suspended this account while the user was active. We immediately:
 *   1. Clear all auth data from localStorage
 *   2. Dispatch 'auth-change' so any listening components update
 *   3. Redirect to /login?suspended=1
 *
 * We do NOT put reason or until in the URL — that info is fetched
 * server-side by the login page from /api/auth/suspension-info,
 * so it cannot be spoofed by manipulating query params.
 */
export function useSuspensionGuard() {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem('token')
      if (!token) return

      try {
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })

        if (response.status === 403) {
          const data = await response.json()

          if (data.suspended) {
            // Riders have their own login page — send them back there, not
            // the buyer/seller /login.
            const wasRider = localStorage.getItem('userRole') === 'RIDER'

            // Clear auth — but keep token briefly so suspension-info
            // endpoint can still identify the user (it clears on next load)
            localStorage.removeItem('userName')
            localStorage.removeItem('userRole')
            localStorage.removeItem('userId')
            // Remove token last
            localStorage.removeItem('token')

            window.dispatchEvent(new Event('auth-change'))

            // Only pass the signal — reason/until fetched server-side
            router.replace(wasRider ? '/rider/login?suspended=1' : '/login?suspended=1')
          }
        }
      } catch {
        // Network error — silently skip, retry on next interval
      }
    }

    check()
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [router])
}