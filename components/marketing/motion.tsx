'use client'

import {
  motion,
  useInView,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

/* ══════════════════════════════════════════════════════════════════════════
   Shared easing — one curve for the whole surface so nothing feels borrowed.
   ═════════════════════════════════════════════════════════════════════════ */
export const EASE = [0.16, 1, 0.3, 1] as const

/* ══════════════════════════════════════════════════════════════════════════
   Reveal — the default entrance. Content rises through a clipping mask
   rather than just fading, which is what separates a considered entrance
   from a stock fade-in.
   ═════════════════════════════════════════════════════════════════════════ */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className = '',
  once = true,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  once?: boolean
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.95, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/* Masked line reveal — for headlines. Each line is a clipped row whose
   inner span slides up from behind the mask edge.

   The in-view trigger has to live on the outer wrapper, not on the sliding
   spans: a span parked at y:110% sits entirely outside its own
   `overflow:hidden` row, and IntersectionObserver honours ancestor clipping,
   so a trigger on the span itself would report "never visible" and the
   headline would stay hidden forever. Driving it through variants from the
   unclipped parent avoids that deadlock. */
export function MaskLines({
  lines,
  className = '',
  lineClassName = '',
  delay = 0,
  stagger = 0.085,
}: {
  lines: ReactNode[]
  className?: string
  lineClassName?: string
  delay?: number
  stagger?: number
}) {
  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
    >
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden">
          <motion.span
            className={`block ${lineClassName}`}
            variants={{ hidden: { y: '110%' }, shown: { y: '0%' } }}
            transition={{ duration: 1.05, delay: delay + i * stagger, ease: EASE }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ScrollHighlight — the paragraph that lights up word by word as it passes
   through the viewport. Each word maps to its own slice of scroll progress.
   ═════════════════════════════════════════════════════════════════════════ */
export function ScrollHighlight({
  text,
  className = '',
  dim = 0.27,
}: {
  text: string
  className?: string
  dim?: number
}) {
  const ref = useRef<HTMLParagraphElement>(null)
  // Measured across the block itself rather than a fixed distance, so a long
  // paragraph and a short one both finish lighting up at the same point on
  // screen instead of the long one trailing half-dim off the bottom.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.92', 'end 0.62'],
  })
  const words = text.split(' ')

  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => (
        <HighlightWord
          key={i}
          progress={scrollYProgress}
          range={[i / words.length, (i + 1.6) / words.length]}
          dim={dim}
        >
          {word}
        </HighlightWord>
      ))}
    </p>
  )
}

function HighlightWord({
  children,
  progress,
  range,
  dim,
}: {
  children: ReactNode
  progress: MotionValue<number>
  range: [number, number]
  dim: number
}) {
  const opacity = useTransform(progress, range, [dim, 1])
  return (
    <span className="relative inline-block mr-[0.26em]">
      <motion.span style={{ opacity }}>{children}</motion.span>
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   MarkedText — a phrase that gets its marker-pen highlight swept in once it
   settles into view. Deliberately rationed: one per section at most.
   ═════════════════════════════════════════════════════════════════════════ */
export function MarkedText({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -25% 0px' })
  return (
    <span ref={ref} className="mk-mark" data-lit={inView}>
      {children}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Parallax — depth on scroll. `speed` is the fraction of the scrolled
   distance the element gives back; negative values push it the other way.
   ═════════════════════════════════════════════════════════════════════════ */
export function Parallax({
  children,
  speed = 0.16,
  className = '',
}: {
  children: ReactNode
  speed?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const raw = useTransform(scrollYProgress, [0, 1], ['0%', `${speed * 100}%`])
  const y = useSpring(raw, { stiffness: 220, damping: 40, mass: 0.6 })

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ImageReveal — a figure whose frame wipes open while the photo inside
   drifts back to 1:1. Two speeds in one gesture; that mismatch is the effect.
   ═════════════════════════════════════════════════════════════════════════ */
export function ImageReveal({
  src,
  alt,
  className = '',
  parallax = 0.1,
  priority = false,
}: {
  src: string
  alt: string
  className?: string
  parallax?: number
  priority?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], ['-6%', `${parallax * 100}%`])

  return (
    <motion.div
      ref={ref}
      className={`mk-figure ${className}`}
      initial={{ clipPath: 'inset(0% 0% 100% 0%)' }}
      whileInView={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 1.2, ease: EASE }}
    >
      <motion.img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        style={{ y, height: '112%', top: '-6%' }}
        initial={{ scale: 1.16 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, margin: '0px 0px -10% 0px' }}
        transition={{ duration: 1.6, ease: EASE }}
      />
    </motion.div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Counter — counts to a value the first time it lands in view.
   ═════════════════════════════════════════════════════════════════════════ */
export function Counter({
  to,
  duration = 1900,
  decimals = 0,
  prefix = '',
  suffix = '',
}: {
  to: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!inView) return
    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      // Same deceleration curve as the scroll, so numbers settle like everything else.
      const eased = 1 - Math.pow(1 - t, 4)
      setValue(to * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, to, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   Marquee — an infinite ticker that leans into the scroll. Skew and speed
   both take their cue from scroll velocity, so it reacts to the reader.
   ═════════════════════════════════════════════════════════════════════════ */
export function Marquee({
  children,
  baseDuration = 26,
  reverse = false,
  className = '',
}: {
  children: ReactNode
  baseDuration?: number
  reverse?: boolean
  className?: string
}) {
  const { scrollY } = useScroll()
  const [skew, setSkew] = useState(0)
  const previous = useRef(0)

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const delta = latest - previous.current
    previous.current = latest
    setSkew(Math.max(-7, Math.min(7, delta * 0.35)))
  })

  useEffect(() => {
    if (skew === 0) return
    const id = setTimeout(() => setSkew(0), 130)
    return () => clearTimeout(id)
  }, [skew])

  return (
    <div className={`mk-marquee ${className}`}>
      <motion.div
        className="flex"
        animate={{ skewY: skew }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        {[0, 1].map((copy) => (
          <motion.div
            key={copy}
            className="mk-marquee__row"
            aria-hidden={copy === 1}
            initial={{ x: reverse ? '-100%' : '0%' }}
            animate={{ x: reverse ? '0%' : '-100%' }}
            transition={{
              duration: baseDuration,
              ease: 'linear',
              repeat: Infinity,
            }}
          >
            {children}
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════
   ScrollProgress — a hairline that measures the document.
   ═════════════════════════════════════════════════════════════════════════ */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 380,
    damping: 44,
    restDelta: 0.001,
  })
  return <motion.div className="mk-progress" style={{ scaleX }} />
}
