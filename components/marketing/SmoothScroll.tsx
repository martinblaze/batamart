'use client'

import Lenis from 'lenis'
import { createContext, useContext, useEffect, useRef, useState } from 'react'

type ScrollTo = (target: string | HTMLElement | number, offset?: number) => void

const LenisContext = createContext<{ scrollTo: ScrollTo }>({
  scrollTo: () => {},
})

export const useSmoothScroll = () => useContext(LenisContext)

/**
 * Window-level smooth scrolling for the marketing surface.
 *
 * Lenis drives the wheel only. Touch keeps the platform's own momentum —
 * hijacking it on mobile is the single fastest way to make a site feel worse
 * than the native scroller it replaced.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      duration: 1.15,
      // Long, flat tail — the deceleration is what reads as "expensive".
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      syncTouch: false,
      // Lets modals and any overflow-scroll panel keep their own scrolling.
      allowNestedScroll: true,
    })

    lenisRef.current = lenis
    setReady(true)

    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    }
    frame = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(frame)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  const scrollTo: ScrollTo = (target, offset = 0) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset, duration: 1.4 })
      return
    }
    // Reduced-motion, or before Lenis boots: fall back to the platform.
    const el =
      typeof target === 'string' ? document.querySelector(target) : target
    if (typeof target === 'number') {
      window.scrollTo({ top: target + offset })
    } else if (el instanceof HTMLElement) {
      window.scrollTo({ top: el.offsetTop + offset, behavior: 'smooth' })
    }
  }

  return (
    <LenisContext.Provider value={{ scrollTo }}>
      {children}
      {/* `ready` only exists to re-render consumers once Lenis is live. */}
      <span hidden data-lenis-ready={ready} />
    </LenisContext.Provider>
  )
}
