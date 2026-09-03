'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef, type ReactNode } from 'react'

export interface StackItem {
  index: string
  title: string
  body: string
  image: string
  imageAlt: string
  aside?: ReactNode
}

/**
 * Cards that stack as the section scrolls.
 *
 * Each card sticks a little lower than the one before it, so the previous
 * card's top edge stays visible as a stub — the stack reads as a deck being
 * dealt rather than as slides replacing each other. A card also scales down
 * and dims slightly once it is being covered, which is what gives the pile
 * its depth.
 */
export function StackCards({ items }: { items: StackItem[] }) {
  const container = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: container,
    offset: ['start start', 'end end'],
  })

  return (
    <div ref={container} className="relative">
      {items.map((item, i) => (
        <Card
          key={item.index}
          item={item}
          index={i}
          total={items.length}
          progress={scrollYProgress}
        />
      ))}
    </div>
  )
}

function Card({
  item,
  index,
  total,
  progress,
}: {
  item: StackItem
  index: number
  total: number
  progress: ReturnType<typeof useScroll>['scrollYProgress']
}) {
  // Each card owns the slice of scroll during which it is being covered.
  const start = index / total
  const scale = useTransform(progress, [start, 1], [1, 1 - (total - index - 1) * 0.05])
  const dim = useTransform(progress, [start, 1], [0, (total - index - 1) * 0.16])

  return (
    <div
      className="sticky h-[78vh] min-h-[520px] flex items-center"
      style={{ top: `calc(8rem + ${index * 2.4}rem)` }}
    >
      <motion.article
        style={{ scale, transformOrigin: 'top center' }}
        className="relative w-full h-full mk-ink-2 overflow-hidden"
      >
        <div className="grid md:grid-cols-2 h-full">
          {/* Copy sits in the upper half deliberately. The next card covers
              this one from the bottom, so anything parked down there would
              be the first thing to disappear. */}
          <div className="relative z-10 flex flex-col p-[clamp(1.5rem,3.4vw,3.5rem)]">
            <div className="flex items-center justify-between">
              <span className="mk-mono mk-accent">{item.index}</span>
              <span className="mk-mono opacity-35">
                Step {index + 1} of {total}
              </span>
            </div>

            <div className="mt-[clamp(2rem,5vw,4.5rem)]">
              <h3 className="mk-h2 max-w-[12ch]">{item.title}</h3>
              <p className="mk-body mt-6 max-w-[42ch]">{item.body}</p>
              {item.aside}
            </div>
          </div>

          <div className="relative overflow-hidden min-h-[220px]">
            <img
              src={item.image}
              alt={item.imageAlt}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to right, #141519 0%, rgba(20,21,25,0.35) 38%, rgba(20,21,25,0) 100%)',
              }}
            />
          </div>
        </div>

        {/* The shade that deepens as this card is buried. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: '#0B0B0D', opacity: dim }}
        />
      </motion.article>
    </div>
  )
}
