'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
  })
}

function unblockPage() {
  document.documentElement.classList.remove('splash-pending')
}

function isAppModeNow(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    window.location.search.indexOf('app=true') !== -1
  )
}

// Exported helper
// Called synchronously by MarketplacePage on first render to decide whether
// to show a blank white screen while splash is active.
export function isSplashPending(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const isAndroid = window.location.search.indexOf('android=true') !== -1

    if (isAndroid) return false

    // Splash is app/PWA mode only.
    if (isAppModeNow() && !sessionStorage.getItem('batamart_splash_app')) return true

    return false
  } catch {
    return false
  }
}

export default function SplashScreen() {
  const [visible, setVisible] = useState<boolean>(() => isSplashPending())
  const [phase, setPhase] = useState<'idle' | 'in' | 'out'>('idle')

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    let outTimer: ReturnType<typeof setTimeout> | null = null
    let doneTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const isAndroid = searchParams.get('android') === 'true'
    const isAppMode = isAppModeNow()

    // Android has its own native splash - unblock page immediately
    if (isAndroid) {
      setVisible(false)
      unblockPage()
      return
    }

    const shouldShowAppSplash =
      isAppMode && !sessionStorage.getItem('batamart_splash_app')

    // No splash needed - unblock immediately and signal done
    if (!shouldShowAppSplash) {
      setVisible(false)
      unblockPage()
      window.dispatchEvent(new CustomEvent('batamart:splash-done'))
      return
    }

    // Mark session so splash doesn't repeat
    sessionStorage.setItem('batamart_splash_app', '1')
    setPhase('idle')

    // Preload logo fully before showing anything
    preloadImage('/BATAMART - logo.png').then(() => {
      if (cancelled) return

      setVisible(true)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!cancelled) setPhase('in')
        })
      })

      outTimer = setTimeout(() => {
        if (!cancelled) setPhase('out')
      }, 2500)

      doneTimer = setTimeout(() => {
        if (cancelled) return

        setVisible(false)
        unblockPage()
        // Signal marketplace page that splash is finished
        window.dispatchEvent(new CustomEvent('batamart:splash-done'))
        if (isAppMode && pathname === '/') {
          router.replace('/marketplace?app=true')
        }
      }, 3000)
    })

    return () => {
      cancelled = true
      if (outTimer) clearTimeout(outTimer)
      if (doneTimer) clearTimeout(doneTimer)
    }
  }, [pathname, searchParams, router])

  if (!visible) return null

  const logoStyle: React.CSSProperties = {
    opacity: phase === 'in' ? 1 : 0,
    transform: phase === 'out' ? 'translateY(-8px)' : 'translateY(0)',
    transition:
      phase === 'in'
        ? 'opacity 700ms cubic-bezier(0.45,0,0.55,1) 200ms'
        : phase === 'out'
          ? 'opacity 400ms ease, transform 400ms ease'
          : 'none',
  }

  const textStyle: React.CSSProperties = {
    opacity: phase === 'in' ? 1 : 0,
    transform:
      phase === 'in' ? 'translateY(0)'
        : phase === 'out' ? 'translateY(-20px)'
          : 'translateY(30px)',
    transition:
      phase === 'in'
        ? 'opacity 700ms cubic-bezier(0.45,0,0.55,1) 600ms, transform 700ms cubic-bezier(0.45,0,0.55,1) 600ms'
        : phase === 'out'
          ? 'opacity 400ms ease, transform 400ms ease'
          : 'none',
  }

  return (
    <div
      id="__splash_screen"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
    >
      <img
        src="/BATAMART - logo.png"
        alt="BataMart"
        style={{
          width: '280px',
          height: '120px',
          objectFit: 'contain',
          ...logoStyle,
        }}
      />
      <p
        style={{
          marginTop: '12px',
          color: '#1E90FF',
          fontSize: '16px',
          fontWeight: 600,
          ...textStyle,
        }}
      >
        Campus Marketplace
      </p>
    </div>
  )
}

