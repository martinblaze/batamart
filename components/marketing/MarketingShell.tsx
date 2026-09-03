'use client'

import { useEffect } from 'react'
import { SmoothScroll } from './SmoothScroll'
import { Cursor } from './Cursor'
import { ScrollProgress } from './motion'
import { MarketingNav } from './MarketingNav'
import { MarketingFooter } from './MarketingFooter'

/**
 * The marketing surface's own shell.
 *
 * `mk-active` on <html> is what lets marketing.css unwind the product app's
 * scroll container and bottom-nav padding for these routes — see the
 * `html.mk-active` block in styles/marketing.css. It has to be a class on the
 * root element rather than a wrapper style because the containers being
 * corrected are ancestors of this component, not descendants.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('mk-active')
    return () => root.classList.remove('mk-active')
  }, [])

  return (
    <SmoothScroll>
      <div className="mk">
        <ScrollProgress />
        <Cursor />
        <MarketingNav />
        <main>{children}</main>
        <MarketingFooter />
      </div>
    </SmoothScroll>
  )
}
