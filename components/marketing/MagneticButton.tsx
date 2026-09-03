'use client'

import Link from 'next/link'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useRef, useState, type ReactNode } from 'react'

type Variant = 'solid' | 'ghost' | 'light' | 'blue'

interface Props {
  children: ReactNode
  href?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: Variant
  disabled?: boolean
  className?: string
  /** How far the button is allowed to chase the cursor, in px. */
  pull?: number
  target?: string
  rel?: string
}

/**
 * The rubber button.
 *
 * Three things happen at once, and the overlap is what sells it:
 *
 *  1. The button chases the cursor on an under-damped spring, so it arrives
 *     with a little overshoot instead of tracking rigidly.
 *  2. The label chases harder than the shell (~1.55x), so the face appears to
 *     lag inside its own frame — the parallax that reads as depth.
 *  3. The shell stretches along the axis it is being pulled and pinches on
 *     the other, which is what a rubber sheet actually does under tension.
 *
 * The colour fill is a circle far wider than the button, parked under it. It
 * grows from the exact point the cursor crossed the edge and shrinks back
 * toward wherever the cursor left, so the wipe always agrees with the gesture.
 */
export function MagneticButton({
  children,
  href,
  onClick,
  type = 'button',
  variant = 'solid',
  disabled = false,
  className = '',
  pull = 26,
  target,
  rel,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [hot, setHot] = useState(false)
  const [origin, setOrigin] = useState({ left: '50%', top: '50%' })

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Low damping + low mass = the elastic settle. This is the whole feel.
  const spring = { stiffness: 260, damping: 15, mass: 0.4 }
  const sx = useSpring(x, spring)
  const sy = useSpring(y, spring)

  const labelX = useTransform(sx, (v) => v * 0.55)
  const labelY = useTransform(sy, (v) => v * 0.55)

  // Stretch along the pull, pinch across it.
  const scaleX = useTransform<number, number>(
    [sx, sy],
    ([dx, dy]) => 1 + Math.abs(dx) / 460 - Math.abs(dy) / 1300,
  )
  const scaleY = useTransform<number, number>(
    [sx, sy],
    ([dx, dy]) => 1 + Math.abs(dy) / 460 - Math.abs(dx) / 1300,
  )

  const track = (e: React.PointerEvent) => {
    const el = shellRef.current
    if (!el || disabled) return
    const rect = el.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    // Normalised against the half-extent so corners and edges pull evenly.
    x.set((dx / (rect.width / 2)) * pull)
    y.set((dy / (rect.height / 2)) * pull)
  }

  /** Park the fill circle's centre on the point the cursor crossed the edge. */
  const setFillOrigin = (e: React.PointerEvent) => {
    const el = shellRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setOrigin({
      left: `${e.clientX - rect.left}px`,
      top: `${e.clientY - rect.top}px`,
    })
  }

  const enter = (e: React.PointerEvent) => {
    if (disabled) return
    setFillOrigin(e)
    setHot(true)
  }

  const leave = (e: React.PointerEvent) => {
    if (disabled) return
    setFillOrigin(e)
    setHot(false)
    x.set(0)
    y.set(0)
  }

  const inner = (
    <>
      <motion.span
        className="mk-btn__fill"
        style={{ ...origin, x: '-50%', y: '-50%' }}
        animate={{ scale: hot ? 1 : 0 }}
        transition={{ duration: hot ? 0.62 : 0.42, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span className="mk-btn__label" style={{ x: labelX, y: labelY }}>
        {children}
      </motion.span>
    </>
  )

  const shellClass = `mk-btn mk-btn--${variant} ${className}`
  const isExternal = href ? /^(https?:|mailto:|tel:)/.test(href) : false

  return (
    // The padded wrapper is the magnetic field: the button starts reacting
    // before the cursor technically reaches it. Negative margin keeps that
    // field out of the layout.
    <div
      ref={shellRef}
      className="inline-flex p-[16px] m-[-16px]"
      onPointerMove={track}
      onPointerEnter={enter}
      onPointerLeave={leave}
      data-cursor="hide"
    >
      <motion.div style={{ x: sx, y: sy, scaleX, scaleY }} className="inline-flex">
        {href ? (
          isExternal ? (
            <a
              href={href}
              target={target}
              rel={rel}
              className={shellClass}
              data-hot={hot}
            >
              {inner}
            </a>
          ) : (
            <Link href={href} className={shellClass} data-hot={hot}>
              {inner}
            </Link>
          )
        ) : (
          <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={shellClass}
            data-hot={hot}
          >
            {inner}
          </button>
        )}
      </motion.div>
    </div>
  )
}

/**
 * The same magnetic follow with no chrome — for the logo, the burger, icon
 * links. Anything small enough that a full button would be too loud.
 */
export function Magnetic({
  children,
  pull = 14,
  className = '',
}: {
  children: ReactNode
  pull?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const spring = { stiffness: 280, damping: 16, mass: 0.35 }
  const sx = useSpring(x, spring)
  const sy = useSpring(y, spring)

  return (
    <motion.div
      ref={ref}
      className={`inline-flex ${className}`}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        x.set(((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * pull)
        y.set(((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * pull)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}
