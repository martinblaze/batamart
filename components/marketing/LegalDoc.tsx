'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Reveal } from './motion'
import { useSmoothScroll } from './SmoothScroll'

export interface LegalSection {
  id: string
  title: string
  /** Short lede shown under the section number, before the body. */
  summary?: string
  body: ReactNode
}

/**
 * Legal reading layout.
 *
 * A long policy is a document, not a marketing page: the job is to make it
 * navigable and easy on the eye, not to decorate it. So — a sticky contents
 * rail with a scroll-spy that tracks the section you are actually reading,
 * generous measure, numbered anchors, and nothing that moves while you read.
 */
export function LegalDoc({
  sections,
  aside,
}: {
  sections: LegalSection[]
  aside?: ReactNode
}) {
  const [active, setActive] = useState(sections[0]?.id ?? '')
  const observed = useRef<Map<string, number>>(new Map())
  const { scrollTo } = useSmoothScroll()

  useEffect(() => {
    // Track how much of each section is on screen and highlight the leader,
    // which behaves far better than "first section past the top edge" when
    // sections are wildly different lengths.
    const ratios = observed.current
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        })
        let best = ''
        let bestRatio = 0
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio
            best = id
          }
        })
        if (best) setActive(best)
      },
      { threshold: [0, 0.15, 0.35, 0.6, 0.9], rootMargin: '-84px 0px -35% 0px' },
    )

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  const jump = (id: string) => {
    const el = document.getElementById(id)
    if (el) scrollTo(el, -110)
  }

  return (
    <div className="mk-shell grid gap-14 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:gap-24 pt-[clamp(3rem,7vw,6rem)] pb-[clamp(4rem,9vw,8rem)]">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <p className="mk-mono opacity-40 mb-5">Contents</p>
        <nav className="border-l border-[rgba(11,11,13,0.13)]">
          {sections.map((section, i) => (
            <button
              key={section.id}
              onClick={() => jump(section.id)}
              className="mk-toc__link w-full text-left"
              data-active={active === section.id}
            >
              <span className="mk-mono mk-mono-sm opacity-50 pt-[3px]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>{section.title}</span>
            </button>
          ))}
        </nav>
        {aside && <div className="mt-10">{aside}</div>}
      </aside>

      <div>
        {sections.map((section, i) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-32 py-[clamp(2.25rem,4vw,3.5rem)] border-t border-[rgba(11,11,13,0.13)] first:border-t-0 first:pt-0"
          >
            <Reveal y={20}>
              <div className="flex items-baseline gap-5 mb-6">
                <span className="mk-mono mk-accent">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="mk-h3 max-w-[22ch]">{section.title}</h2>
              </div>
              {section.summary && (
                <p className="mk-lead mb-7 max-w-[58ch] text-[#0B0B0D]">
                  {section.summary}
                </p>
              )}
              <div className="mk-legal max-w-[68ch]">{section.body}</div>
            </Reveal>
          </section>
        ))}
      </div>
    </div>
  )
}

/** A definition list used inside legal bodies — clearer than nested bullets. */
export function LegalList({
  items,
}: {
  items: { term?: string; text: ReactNode }[]
}) {
  return (
    <ul className="mt-5 space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <span
            aria-hidden
            className="mt-[0.7em] h-px w-4 flex-none bg-[rgba(11,11,13,0.3)]"
          />
          <span>
            {item.term && <strong>{item.term} — </strong>}
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** A boxed emphasis note. Sharp-edged, one hairline, accent bar on the left. */
export function LegalNote({
  tone = 'accent',
  title,
  children,
}: {
  tone?: 'accent' | 'warn'
  title?: string
  children: ReactNode
}) {
  const bar = tone === 'warn' ? '#F59E0B' : '#1E90FF'
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="mt-7 border border-[rgba(11,11,13,0.13)] bg-[#E5DFD4] p-6"
      style={{ borderLeft: `2px solid ${bar}` }}
    >
      {title && <p className="mk-mono mb-3">{title}</p>}
      <div className="mk-legal text-[0.96rem]">{children}</div>
    </motion.div>
  )
}
