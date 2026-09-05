'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/**
 * The product surface's motion system.
 *
 * The marketing pages already move; the app pages did not, which is most of
 * why the PWA read as a website with a phone-shaped viewport rather than an
 * app. Everything here shares one curve and one duration scale, because motion
 * that differs per screen reads as accidental.
 */

/** Decelerating cubic. Fast to start, settling rather than stopping. */
export const EASE = [0.16, 1, 0.3, 1] as const
export const DURATION = { fast: 0.18, base: 0.38, slow: 0.5 } as const

/**
 * Route transition plus a top progress bar.
 *
 * Two separate jobs that people conflate. The bar answers "did my tap
 * register" during the network wait; the fade answers "where did the old
 * screen go". Without the bar a slow route feels broken; without the fade a
 * fast one feels like a page reload.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reduced = useReducedMotion()

  if (reduced) return <>{children}</>

  return (
    <>
      <RouteProgress />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: DURATION.base, ease: EASE }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  )
}

/**
 * Indeterminate top bar shown while a navigation is in flight.
 *
 * Deliberately eases toward 90% and waits there rather than completing: a
 * progress bar that finishes before the page arrives has lied, and users learn
 * to distrust it. It only snaps to 100% when the new route actually commits.
 */
function RouteProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [value, setValue] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const first = useRef(true)

  useEffect(() => {
    // Skip the very first render — there is no navigation to report on.
    if (first.current) {
      first.current = false
      return
    }
    timers.current.forEach(clearTimeout)
    timers.current = []

    setVisible(true)
    setValue(18)
    timers.current.push(setTimeout(() => setValue(64), 90))
    timers.current.push(setTimeout(() => setValue(88), 240))
    timers.current.push(setTimeout(() => setValue(100), 420))
    timers.current.push(setTimeout(() => setVisible(false), 640))

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [pathname])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]"
    >
      <motion.div
        className="h-full bg-primary"
        initial={false}
        animate={{ width: `${value}%`, opacity: visible ? 1 : 0 }}
        transition={{ duration: DURATION.base, ease: EASE }}
      />
    </div>
  )
}

/**
 * Reveals its children as they scroll into range.
 *
 * `once` is on by default: content that re-animates every time it re-enters
 * the viewport is distracting on a feed you scroll up and down.
 */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: DURATION.base, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Staggers a list so items arrive in sequence rather than all at once.
 * [index] is capped by the caller's data; the delay saturates so the tail of a
 * long list never waits seconds for its turn.
 */
export function RevealItem({
  children,
  index = 0,
  className = '',
}: {
  children: React.ReactNode
  index?: number
  className?: string
}) {
  return (
    <Reveal className={className} delay={Math.min(index, 8) * 0.05}>
      {children}
    </Reveal>
  )
}

/** Press-depth wrapper. The single highest-value micro-interaction there is. */
export function Pressable({
  children,
  onClick,
  className = '',
  scale = 0.97,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  scale?: number
}) {
  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileTap={{ scale }}
      transition={{ duration: DURATION.fast, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Slow, continuous drift over a still image — the "Ken Burns" effect.
 * Gives a photograph life without shipping video.
 */
export function KenBurns({
  children,
  className = '',
  maxScale = 1.08,
  seconds = 14,
}: {
  children: React.ReactNode
  className?: string
  maxScale?: number
  seconds?: number
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial={{ scale: 1 }}
      animate={{ scale: maxScale }}
      transition={{
        duration: seconds,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'reverse',
      }}
    >
      {children}
    </motion.div>
  )
}
