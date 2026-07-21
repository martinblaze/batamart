'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

const PULL_THRESHOLD = 80
const PULL_MAX = 110
const PULL_DEAD_ZONE = 8
const PULL_RESIST = 0.4

function isMarketplace(pathname: string | null) {
  return pathname === '/marketplace'
}

export function GlobalPullToRefresh() {
  const pathname = usePathname()
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let startY = 0
    let deltaY = 0
    let active = false
    let locked = false

    const getScrollTop = () => {
      const iosArea = document.getElementById('ios-scroll-area')
      return iosArea ? iosArea.scrollTop : window.scrollY
    }

    const onTouchStart = (event: TouchEvent) => {
      if (getScrollTop() > 0) {
        startY = 0
        deltaY = 0
        active = false
        locked = false
        return
      }

      startY = event.touches[0]?.clientY || 0
      deltaY = 0
      active = false
      locked = false
    }

    const onTouchMove = (event: TouchEvent) => {
      if (startY === 0) return

      const currentY = event.touches[0]?.clientY || 0
      const delta = currentY - startY
      if (delta <= 0 || delta < PULL_DEAD_ZONE) return

      if (!locked) {
        locked = true
        active = true
      }

      deltaY = delta
      setPullDistance(Math.min(delta * PULL_RESIST, PULL_MAX))
    }

    const onTouchEnd = () => {
      if (!active) return
      const triggered = deltaY * PULL_RESIST >= PULL_THRESHOLD

      active = false
      locked = false
      startY = 0

      if (triggered) {
        setRefreshing(true)
        setPullDistance(PULL_THRESHOLD)
        window.dispatchEvent(new Event('batamart:clear-session-cache'))
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_RUNTIME_CACHE' })
        }
        window.setTimeout(() => window.location.reload(), 120)
        return
      }

      setPullDistance(0)
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [pathname])

  if (pullDistance <= 0) return null

  return (
    <div
      className="fixed left-1/2 top-3 z-[9999] -translate-x-1/2 pointer-events-none"
      style={{ transform: `translate(-50%, ${Math.max(0, pullDistance - 48)}px)` }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft border border-border">
        <RefreshCw
          className={`h-5 w-5 text-primary ${refreshing ? 'animate-spin' : ''}`}
          strokeWidth={1.75}
          style={{ transform: refreshing ? undefined : `rotate(${pullDistance * 2}deg)` }}
        />
      </div>
    </div>
  )
}
