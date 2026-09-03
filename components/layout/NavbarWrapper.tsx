'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Suspense, useState, useEffect } from 'react'

function NavbarContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isAndroid = searchParams.get('android') === 'true'
  const isAppParam = searchParams.get('app') === 'true'

  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    setIsStandalone(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const isApp = isAppParam || isStandalone

  // Routes that bring their own chrome. Admin has its own frame; the
  // marketing surface (app/(marketing)) ships its own nav and footer, so the
  // product navbar would be a second, conflicting header on those pages.
  const MARKETING_ROUTES = ['/about', '/contact', '/privacy', '/terms']

  const hideNav =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/admin-login') ||
    pathname === '/' ||
    MARKETING_ROUTES.some((route) => pathname?.startsWith(route))

  if (hideNav) return null

  // Android WebView — Navbar handles everything internally, no spacers
  if (isAndroid) return <Navbar />

  // App mode (PWA / standalone) — ONE spacer only for the fixed top bar (h-14 = 56px)
  // DO NOT add h-16 here — that was causing the giant gap at the top.
  // Bottom nav spacing belongs inside each page's content, not here.
  if (isApp) {
    return (
      <>
        <Navbar />
        <div className="h-14" />
      </>
    )
  }

  // Browser mode — spacer for fixed top navbar (h-16 = 64px)
  return (
    <>
      <Navbar />
      <div className="h-16" />
    </>
  )
}

export function NavbarWrapper() {
  return (
    <Suspense fallback={null}>
      <NavbarContent />
    </Suspense>
  )
}