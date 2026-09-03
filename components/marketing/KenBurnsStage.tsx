'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export interface Frame {
  src: string
  alt: string
  /** Mono caption shown against the frame counter. */
  caption?: string
}

/**
 * A slow rotating photographic ground.
 *
 * Each frame holds a continuous zoom for its whole time on screen —
 * alternating in and out so consecutive frames never drift the same way —
 * and the handover is a long crossfade rather than a cut. The zoom runs
 * linearly and outlasts the frame's turn on purpose: it should never be seen
 * arriving at a stop, because a Ken Burns move that visibly finishes is the
 * moment it stops looking like cinematography and starts looking like a CSS
 * animation.
 */
export function KenBurnsStage({
  frames,
  interval = 5600,
  className = '',
  overlay = 'scrim',
  index: controlled,
}: {
  frames: Frame[]
  interval?: number
  className?: string
  overlay?: 'scrim' | 'flat' | 'none'
  /** Omit to let the stage advance itself; pass it to keep copy in step. */
  index?: number
}) {
  const [internal, setInternal] = useState(0)
  const index = controlled ?? internal

  useEffect(() => {
    if (controlled !== undefined) return
    if (frames.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setInternal((i) => (i + 1) % frames.length), interval)
    return () => clearInterval(id)
  }, [frames.length, interval, controlled])

  const zoomIn = index % 2 === 0
  const travel = (interval + 3200) / 1000

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <AnimatePresence initial={false}>
        <motion.img
          key={index}
          src={frames[index].src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          initial={{
            opacity: 0,
            scale: zoomIn ? 1.04 : 1.22,
            x: zoomIn ? '-1%' : '1%',
          }}
          animate={{
            opacity: 1,
            scale: zoomIn ? 1.22 : 1.04,
            x: zoomIn ? '1%' : '-1%',
          }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.6, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: travel, ease: 'linear' },
            x: { duration: travel, ease: 'linear' },
          }}
        />
      </AnimatePresence>

      {overlay === 'scrim' && <div className="mk-scrim-b" />}
      {overlay === 'flat' && <div className="mk-scrim-flat" />}
    </div>
  )
}

/** The frame counter + progress ticks that sit alongside the stage. */
export function StageIndex({
  frames,
  index,
  onSelect,
}: {
  frames: Frame[]
  index: number
  onSelect: (i: number) => void
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="mk-mono opacity-70">
        {String(index + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')}
      </span>
      <div className="flex items-center gap-1.5">
        {frames.map((frame, i) => (
          <button
            key={frame.src}
            onClick={() => onSelect(i)}
            aria-label={`Show frame ${i + 1}`}
            className="h-[2px] transition-all duration-500"
            style={{
              width: i === index ? 34 : 16,
              background: i === index ? '#1E90FF' : 'rgba(241,237,230,0.32)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Same stage, but the caller owns the index — used where the surrounding
 * copy has to stay in step with the photograph behind it.
 */
export function useStageIndex(length: number, interval = 5600) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setIndex((i) => (i + 1) % length), interval)
    return () => clearInterval(id)
  }, [length, interval])

  return [index, setIndex] as const
}
