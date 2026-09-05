'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/motion/AppMotion'

/**
 * Chrome for the pushed transactional screens — product, cart, checkout,
 * orders. These four were the last pages still wearing the pre-system
 * treatment: an icon in a tinted rounded box for every empty state, and sticky
 * headers that blurred whatever passed under them.
 *
 * Two things drive the design here.
 *
 * Translucency is a browser-only luxury. In the installed PWA the top bar sits
 * over a scrolling feed of photographs, and iOS composites a backdrop filter a
 * frame behind the scroll — so the header visibly lags and smears. Every
 * header below is opaque under `html.app-mode` and keeps the blur in a tab.
 *
 * An empty screen is the one place with no product photography to lean on, so
 * it has to bring its own. A 14×14 icon in a rounded square is the house style
 * of a settings page; a photograph is the house style of a shop.
 */

/** True once the window has scrolled past `threshold` pixels. */
export function useScrolledPast(threshold: number): boolean {
  const [past, setPast] = useState(false)

  useEffect(() => {
    // The installed shell scrolls #ios-scroll-area, not the window, so the
    // listener has to go on whichever one actually moves.
    const scroller = document.getElementById('ios-scroll-area')
    const read = () => (scroller ? scroller.scrollTop : window.scrollY)
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setPast(read() > threshold)
      })
    }
    onScroll()
    const target: HTMLElement | Window = scroller || window
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      target.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [threshold])

  return past
}

/**
 * Sticky header for a pushed screen: back arrow, eyebrow, title, actions.
 *
 * The hairline and the surface only appear once you have scrolled — at rest
 * the header is part of the page rather than a bar stuck on top of it.
 */
export function PageHeader({
  eyebrow,
  title,
  back,
  actions,
  variant = 'bar',
}: {
  eyebrow?: React.ReactNode
  title: string
  /** Omit to use browser history; pass `false` on a tab destination. */
  back?: string | (() => void) | false
  actions?: React.ReactNode
  /**
   * `bar` — a pushed screen. Sticks, carries a back arrow, and picks up a
   * surface once you scroll.
   *
   * `title` — a bottom-nav destination. Static, no back arrow. A tab screen
   * already sits under the app's own top bar, and a second sticky bar under
   * the first is the doubled chrome this component exists to avoid.
   */
  variant?: 'bar' | 'title'
}) {
  const router = useRouter()
  const scrolled = useScrolledPast(8)
  const isBar = variant === 'bar'

  const goBack = () => {
    if (typeof back === 'function') back()
    else if (typeof back === 'string') router.push(back)
    else router.back()
  }

  return (
    <header
      className={
        isBar
          ? `sticky top-0 z-40 transition-[background-color,border-color] duration-300 ${
              scrolled
                ? 'ui-chrome-solid border-b border-border'
                : 'border-b border-transparent bg-surface'
            }`
          : 'border-b border-border bg-card'
      }
    >
      <div
        className={`mx-auto flex max-w-6xl items-center gap-3 px-4 sm:px-6 ${
          isBar ? 'py-4' : 'py-6 sm:py-8'
        }`}
      >
        {isBar && back !== false && (
          <button
            onClick={goBack}
            aria-label="Go back"
            className="group flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-surface hover:text-ink"
          >
            <ChevronLeft
              className="h-5 w-5 transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
              strokeWidth={1.75}
            />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="ui-eyebrow mb-1 max-w-[16rem]">{eyebrow}</p>}
          <h1
            className={
              isBar
                ? 'truncate text-xl text-ink sm:text-2xl'
                : 'text-[clamp(1.6rem,3.4vw,2.4rem)] text-ink'
            }
          >
            {title}
          </h1>
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
    </header>
  )
}

/**
 * Image-led empty state.
 *
 * `href` is the way out — an empty screen that does not hand the reader
 * somewhere to go is a dead end, and these three (empty cart, no orders, no
 * results) are all recoverable in one tap.
 */
export function EmptyFigure({
  image,
  eyebrow,
  title,
  accent,
  body,
  href,
  cta,
  onClick,
}: {
  image: string
  eyebrow: string
  title: string
  accent?: string
  body: string
  href?: string
  cta: string
  onClick?: () => void
}) {
  const action = (
    <span className="group mt-7 inline-flex h-12 items-center gap-2.5 bg-white px-7 font-mono text-[11px] uppercase tracking-[0.16em] text-ink">
      {cta}
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
        strokeWidth={2}
      />
    </span>
  )

  return (
    <Reveal>
      <section className="relative min-h-[420px] overflow-hidden rounded-lg sm:min-h-[480px]">
        <Image src={image} alt="" fill sizes="100vw" className="object-cover" priority />
        {/* Four stops, not two. A two-stop scrim was still only ~0.55 opaque
            where the eyebrow sits, and the eyebrow is the lightest text on the
            card — it disappeared over the bright half of a photograph. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(19,19,17,0.96),rgba(19,19,17,0.9)_34%,rgba(19,19,17,0.62)_62%,rgba(19,19,17,0.34))]"
        />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
          <p className="ui-mono ui-mono-sm mb-2.5 text-white/65">{eyebrow}</p>
          <h1 className="text-[clamp(1.6rem,4.4vw,2.4rem)] font-semibold leading-[1.08] text-white">
            {title}
            {accent && <span className="ui-serif"> {accent}</span>}
          </h1>
          <p className="mt-3.5 max-w-[36ch] text-[13.5px] leading-relaxed text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
            {body}
          </p>
          {href ? <Link href={href}>{action}</Link> : <button onClick={onClick}>{action}</button>}
        </div>
      </section>
    </Reveal>
  )
}
