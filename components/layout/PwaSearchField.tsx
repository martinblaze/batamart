'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

/**
 * The PWA's search affordance.
 *
 * In the installed app the top bar carries a full-width field rather than a
 * logo and a small magnifier. Two reasons:
 *
 *  - Inside a standalone app the logo is redundant. The user launched from a
 *    home-screen icon with the name under it; repeating the brand costs the
 *    most valuable strip of screen and tells them nothing.
 *  - A field is a bigger, more obvious target than a 20px icon, and it says
 *    what it does without a label.
 *
 * `layoutId` is the important part: the search page renders a field with the
 * same id, so Framer Motion interpolates between the two across the route
 * change. The bar appears to grow into the search screen instead of the screen
 * replacing it — which is what makes a web app feel native rather than like a
 * page load.
 */
export const PWA_SEARCH_LAYOUT_ID = 'pwa-search-field'

export function PwaSearchField({
  placeholder = 'Search products, sellers…',
  className = '',
}: {
  placeholder?: string
  className?: string
}) {
  const router = useRouter()

  return (
    <motion.button
      layoutId={PWA_SEARCH_LAYOUT_ID}
      type="button"
      onClick={() => router.push('/search?app=true&focus=1')}
      aria-label="Search"
      className={`flex h-10 w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 text-left ${className}`}
      // A spring, not a duration: the field is changing size and position at
      // once, and easing that reads as a slide rather than a transformation.
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      whileTap={{ scale: 0.985 }}
    >
      <Search className="h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={2} />
      <span className="truncate text-[13px] text-ink-muted">{placeholder}</span>
    </motion.button>
  )
}

/**
 * The receiving end of the transition, rendered by the search page.
 *
 * Shares [PWA_SEARCH_LAYOUT_ID] with the bar's field, so Framer treats them as
 * one element in two places. Wraps whatever real input the page supplies.
 */
export function PwaSearchTarget({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      layoutId={PWA_SEARCH_LAYOUT_ID}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      className="w-full"
    >
      {children}
    </motion.div>
  )
}
