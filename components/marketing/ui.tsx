'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { MaskLines, Reveal } from './motion'

/** The four hairline columns that sit behind a section. */
export function Rules() {
  return (
    <div className="mk-rules" aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </div>
  )
}

/** Mono index label — "(01) — The process". */
export function Eyebrow({
  index,
  children,
  className = '',
}: {
  index?: string
  children: ReactNode
  className?: string
}) {
  return (
    <p className={`mk-eyebrow mk-mono ${className}`}>
      {index && <span className="mk-accent">({index})</span>}
      <span>{children}</span>
    </p>
  )
}

/** Section header: eyebrow, masked headline, optional standfirst. */
export function SectionHead({
  index,
  eyebrow,
  lines,
  body,
  align = 'left',
  className = '',
}: {
  index?: string
  eyebrow: string
  lines: ReactNode[]
  body?: ReactNode
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div
      className={`${align === 'center' ? 'text-center max-w-[52ch] mx-auto' : ''} ${className}`}
    >
      <Eyebrow index={index} className={align === 'center' ? 'justify-center' : ''}>
        {eyebrow}
      </Eyebrow>
      <MaskLines className="mk-h2 block mt-7" lines={lines} />
      {body && (
        <Reveal delay={0.15}>
          <p className={`mk-body mt-7 max-w-[52ch] ${align === 'center' ? 'mx-auto' : ''}`}>
            {body}
          </p>
        </Reveal>
      )}
    </div>
  )
}

/**
 * Interior page opener.
 *
 * The photograph sits behind at half scroll speed and darkens as it leaves,
 * so the title detaches from it on the way out instead of the whole block
 * sliding away as one flat plane.
 */
export function PageIntro({
  eyebrow,
  title,
  standfirst,
  image,
  imageAlt,
  meta,
}: {
  eyebrow: string
  title: ReactNode[]
  standfirst?: ReactNode
  image: string
  imageAlt: string
  meta?: { label: string; value: string }[]
}) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '28%'])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.14])
  const shade = useTransform(scrollYProgress, [0, 1], [0.55, 0.88])
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '-14%'])

  return (
    <section
      ref={ref}
      className="mk-ink relative overflow-hidden mk-grain"
      style={{ minHeight: 'clamp(560px, 84vh, 900px)' }}
    >
      <motion.div className="absolute inset-0" style={{ y, scale }}>
        <img
          src={image}
          alt={imageAlt}
          className="absolute inset-0 w-full h-full object-cover"
          fetchPriority="high"
          decoding="async"
        />
      </motion.div>
      <motion.div
        className="absolute inset-0"
        style={{ background: '#0B0B0D', opacity: shade }}
      />
      {/* A second, top-weighted scrim. The flat shade alone leaves the
          navigation and the eyebrow fighting whatever happens to be bright in
          the upper third of the photograph. */}
      <div
        className="absolute inset-x-0 top-0 h-[45%] pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(11,11,13,0.72) 0%, rgba(11,11,13,0.28) 55%, rgba(11,11,13,0) 100%)',
        }}
      />

      <motion.div
        style={{ y: contentY }}
        className="relative z-10 mk-shell flex flex-col justify-end"
        // The opener is bottom-aligned so the headline sits on the same
        // baseline as the sections that follow it.
      >
        <div className="pt-[clamp(9rem,18vh,13rem)] pb-[clamp(3rem,7vw,6rem)]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <MaskLines className="mk-h1 block mt-8" lines={title} delay={0.1} />
          {standfirst && (
            <Reveal delay={0.4}>
              <p className="mk-lead mt-9 max-w-[54ch] opacity-75">{standfirst}</p>
            </Reveal>
          )}

          {meta && (
            <Reveal delay={0.55}>
              <dl className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-7 border-t border-[rgba(240,236,228,0.14)] pt-8">
                {meta.map((entry) => (
                  <div key={entry.label}>
                    <dt className="mk-mono opacity-40 mb-2">{entry.label}</dt>
                    <dd className="mk-h3">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          )}
        </div>
      </motion.div>
    </section>
  )
}

/** A quiet full-width statistic row. */
export function StatRow({
  stats,
}: {
  stats: { value: ReactNode; label: string; note?: string }[]
}) {
  return (
    <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4 bg-[rgba(240,236,228,0.14)]">
      {stats.map((stat, i) => (
        <Reveal key={stat.label} delay={i * 0.08} className="mk-ink">
          <div className="p-[clamp(1.4rem,2.4vw,2.4rem)] h-full">
            <div className="mk-h2">{stat.value}</div>
            <p className="mk-mono mt-4 opacity-70">{stat.label}</p>
            {stat.note && (
              <p className="mk-body text-[0.85rem] mt-2 max-w-[26ch]">{stat.note}</p>
            )}
          </div>
        </Reveal>
      ))}
    </div>
  )
}
