'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'

export interface AccordionItem {
  question: string
  answer: ReactNode
}

/**
 * One-at-a-time accordion.
 *
 * Height animates from `0` to `auto` — framer resolves the target height
 * itself, so long answers and short ones both land on the same curve, and the
 * body fades on a slightly shorter beat so the text arrives after the space
 * has been made for it.
 */
export function Accordion({
  items,
  startOpen = 0,
}: {
  items: AccordionItem[]
  startOpen?: number | null
}) {
  const [open, setOpen] = useState<number | null>(startOpen)

  return (
    <div>
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={i} className="mk-acc" data-open={isOpen}>
            <button
              className="mk-acc__btn"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span className="flex gap-5 items-baseline">
                <span className="mk-mono opacity-40 flex-none">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="mk-h3 max-w-[24ch]">{item.question}</span>
              </span>
              <span className="mk-acc__sign" aria-hidden />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.6, ease: [0.76, 0, 0.24, 1] },
                    opacity: { duration: 0.42, ease: 'easeOut' },
                  }}
                  className="overflow-hidden"
                >
                  <p className="mk-body max-w-[62ch] pb-8 pl-0 sm:pl-[3.9rem] pr-8">
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
