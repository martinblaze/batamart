'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const CACHE_PREFIX = 'batamart:session-fetch:'
const SCROLL_PREFIX = 'batamart:scroll:'

function isReloadNavigation() {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type === 'reload'
}

function clearSessionFetchCache() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key)
    }
  } catch {}
}

function simpleHash(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

function headersToObject(headers: Headers) {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (['content-type', 'cache-control', 'etag', 'last-modified'].includes(lower)) out[key] = value
  })
  return out
}

function shouldCacheRequest(input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (method !== 'GET') return false
  if (init?.cache === 'no-store' || init?.cache === 'reload' || init?.cache === 'no-cache') return false

  let url: URL
  try {
    url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
  } catch {
    return false
  }

  if (url.origin !== window.location.origin) return false
  if (!url.pathname.startsWith('/api/')) return false
  if (url.pathname.includes('/live-location')) return false
  if (url.pathname.includes('/payments/')) return false
  if (url.pathname.includes('/upload')) return false
  return true
}

function authPart(init?: RequestInit) {
  try {
    const headers = new Headers(init?.headers || {})
    return headers.get('authorization') || ''
  } catch {
    return ''
  }
}

function installFetchCache() {
  if (typeof window === 'undefined') return () => {}
  const w = window as typeof window & {
    __batamartFetchCacheInstalled?: boolean
    __batamartOriginalFetch?: typeof fetch
  }
  if (w.__batamartFetchCacheInstalled) return () => {}

  const originalFetch = window.fetch.bind(window)
  w.__batamartOriginalFetch = originalFetch
  w.__batamartFetchCacheInstalled = true

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!shouldCacheRequest(input, init)) return originalFetch(input, init)

    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin)
    const key = `${CACHE_PREFIX}${simpleHash(`${url.href}|${authPart(init)}`)}`

    try {
      const cached = sessionStorage.getItem(key)
      if (cached) {
        const record = JSON.parse(cached) as {
          body: string
          status: number
          statusText: string
          headers: Record<string, string>
        }
        return new Response(record.body, {
          status: record.status,
          statusText: record.statusText,
          headers: record.headers,
        })
      }
    } catch {}

    const response = await originalFetch(input, init)
    if (response.ok) {
      try {
        const clone = response.clone()
        const body = await clone.text()
        sessionStorage.setItem(key, JSON.stringify({
          body,
          status: response.status,
          statusText: response.statusText,
          headers: headersToObject(response.headers),
        }))
      } catch {}
    }
    return response
  }

  return () => {
    if (w.__batamartOriginalFetch) window.fetch = w.__batamartOriginalFetch
    w.__batamartFetchCacheInstalled = false
  }
}

export function AppNavigationCache() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname || '/'}?${searchParams.toString()}`

  useEffect(() => {
    if (isReloadNavigation()) clearSessionFetchCache()
    const cleanup = installFetchCache()

    const clearHandler = () => clearSessionFetchCache()
    window.addEventListener('batamart:clear-session-cache', clearHandler)
    return () => {
      window.removeEventListener('batamart:clear-session-cache', clearHandler)
      cleanup()
    }
  }, [])

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const key = `${SCROLL_PREFIX}${routeKey}`
    const container = document.getElementById('ios-scroll-area') || window

    window.requestAnimationFrame(() => {
      try {
        const saved = Number(sessionStorage.getItem(key) || 0)
        if (!Number.isFinite(saved) || saved <= 0) return
        if (container === window) window.scrollTo({ top: saved, behavior: 'instant' as ScrollBehavior })
        else (container as HTMLElement).scrollTop = saved
      } catch {}
    })

    const save = () => {
      try {
        const top = container === window ? window.scrollY : (container as HTMLElement).scrollTop
        sessionStorage.setItem(key, String(top))
      } catch {}
    }

    const target = container === window ? window : (container as HTMLElement)
    target.addEventListener('scroll', save, { passive: true })
    window.addEventListener('pagehide', save)

    return () => {
      save()
      target.removeEventListener('scroll', save)
      window.removeEventListener('pagehide', save)
    }
  }, [routeKey])

  return null
}
