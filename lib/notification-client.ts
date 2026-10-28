'use client'

// Shared by the notification bell and the notifications page so both stay in
// step with the server and with each other.

import { useEffect, useRef } from 'react'

/**
 * Ids the user has just marked read. A refresh that was already in flight, or a
 * slow response, must not flip them back to unread, so lists coming from the
 * server are passed through applyRecentlyRead before they are shown.
 */
export const recentlyRead = new Map<string, number>()

export function rememberRead(ids: string[]) {
  const now = Date.now()
  ids.forEach(id => recentlyRead.set(id, now))
}

export function applyRecentlyRead<T extends { id: string; isRead: boolean }>(list: T[]): T[] {
  const now = Date.now()
  recentlyRead.forEach((at, id) => {
    if (now - at > 60_000) recentlyRead.delete(id)
  })
  return list.map(n => (recentlyRead.has(n.id) ? { ...n, isRead: true } : n))
}

/**
 * Calls `refresh` whenever fresh notifications are likely:
 *  - a push arrives (the service worker tells every open page)
 *  - the tab becomes visible or gets focus again
 *  - every `intervalMs` while the tab is visible, as a fallback
 */
export function useNotificationRefresh(refresh: () => void, intervalMs = 20_000) {
  const latest = useRef(refresh)
  latest.current = refresh

  useEffect(() => {
    const run = () => latest.current()
    const whenVisible = () => {
      if (document.visibilityState === 'visible') run()
    }

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_RECEIVED') return
      // The record is written alongside the push, so check again shortly after.
      setTimeout(run, 600)
      setTimeout(run, 2500)
    }

    const timer = setInterval(whenVisible, intervalMs)
    document.addEventListener('visibilitychange', whenVisible)
    window.addEventListener('focus', whenVisible)
    navigator.serviceWorker?.addEventListener('message', onMessage)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', whenVisible)
      window.removeEventListener('focus', whenVisible)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [intervalMs])
}
