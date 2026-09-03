'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const GROUND = {
  ink: '#0B0B0D',
  inkSoft: '#141519',
  paper: '#F1EDE6',
  paper2: '#E5DFD4',
  blue: '#1E90FF',
} as const

export type Ground = keyof typeof GROUND

/**
 * The seam between two grounds.
 *
 * Instead of cutting from one background to the next, the incoming ground
 * arrives as a very wide, very shallow ellipse that rises over the outgoing
 * one. The arc is deepest as the seam enters the viewport and eases toward
 * flat as it leaves, so the change of ground reads as a movement the page
 * makes rather than an edge you crossed.
 *
 * Only `scaleY` animates, so the whole thing stays on the compositor.
 */
export function CurveDivider({
  from,
  to,
  glow = false,
  flip = false,
  height = 'clamp(60px, 9vw, 150px)',
}: {
  from: Ground
  to: Ground
  /** Halo at the apex — use it where the seam should feel lit, not just cut. */
  glow?: boolean
  /** Dips the incoming ground downward instead of arcing it up. */
  flip?: boolean
  height?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Deep on arrival, flat on exit.
  const scaleY = useTransform(scrollYProgress, [0, 0.5, 1], [1.45, 1, 0.55])

  return (
    <div
      ref={ref}
      aria-hidden
      className="mk-curve"
      style={{ background: GROUND[from], height, overflow: 'hidden' }}
    >
      <motion.div
        style={{
          position: 'absolute',
          left: '-25%',
          width: '150%',
          height: '100%',
          bottom: flip ? 'auto' : 0,
          top: flip ? 0 : 'auto',
          background: GROUND[to],
          borderRadius: flip
            ? '0 0 50% 50% / 0 0 100% 100%'
            : '50% 50% 0 0 / 100% 100% 0 0',
          transformOrigin: flip ? 'top center' : 'bottom center',
          scaleY,
        }}
      />
      {glow && (
        <motion.div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: flip ? 'auto' : '-40%',
            top: flip ? '-40%' : 'auto',
            width: 'min(1100px, 90vw)',
            aspectRatio: '2.4 / 1',
            transform: 'translateX(-50%)',
            background:
              'radial-gradient(ellipse at center, rgba(30,144,255,0.55) 0%, rgba(30,144,255,0.16) 42%, rgba(30,144,255,0) 72%)',
            pointerEvents: 'none',
            scaleY,
          }}
        />
      )}
    </div>
  )
}
