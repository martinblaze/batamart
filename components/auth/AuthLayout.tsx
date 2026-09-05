'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { KenBurns, Reveal } from '@/components/motion/AppMotion'

/**
 * The shared frame for login and signup on the web.
 *
 * The old auth pages were a centred card on an empty ground — the layout a
 * form generator produces, and the reason the first screen a new user meets
 * looked unfinished next to the marketing site.
 *
 * Two arrangements, one component:
 *
 *  - **Desktop** splits the viewport. Photography holds the left half at full
 *    bleed; the form sits on the right with room to breathe. A 400px card
 *    floating in the middle of a 1440px screen wastes the space that makes a
 *    desktop feel considered.
 *  - **Mobile / PWA** stacks: the photograph becomes a shallow hero and the
 *    form rides over its foot, matching the Flutter client's auth screens so
 *    the two surfaces read as one product.
 */
export function AuthLayout({
  eyebrow,
  title,
  titleAccent,
  subtitle,
  children,
  footer,
  back,
  image = '/images/marketing/auth-hero.webp',
  quote,
}: {
  eyebrow: string
  title: string
  /** Set in the italic serif directly after the title — one or two words. */
  titleAccent?: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  back?: { href: string; label: string }
  image?: string
  /** Optional line set over the desktop photograph. */
  quote?: string
}) {
  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── Photography ─────────────────────────────────────────────── */}
      <div className="relative h-[34vh] min-h-[240px] overflow-hidden lg:h-auto lg:min-h-screen">
        <KenBurns className="absolute inset-0" maxScale={1.1} seconds={18}>
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
        </KenBurns>

        {/* Two stops: a light wash lifts contrast across the whole frame, a
            heavier foot anchors the type. Never set auth copy directly on a
            photograph — contrast varies by device and by image. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.34),rgba(0,0,0,0.12)_42%,rgba(0,0,0,0.86))]"
        />

        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-12">
          <Reveal>
            <Logo size={30} className="mb-8 hidden lg:flex [&_img]:brightness-0 [&_img]:invert" />
          </Reveal>
          {quote && (
            <Reveal delay={0.08}>
              <p className="hidden max-w-[34ch] text-[26px] leading-[1.15] text-white lg:block">
                {quote}
              </p>
            </Reveal>
          )}
          <Reveal delay={0.12}>
            <p className="ui-mono ui-mono-sm mt-6 hidden text-white/55 lg:block">
              Campus marketplace · Escrow on every order
            </p>
          </Reveal>
        </div>
      </div>

      {/* ── Form ────────────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center px-4 pb-14 lg:px-10">
        {/* Pulled up over the photograph on mobile so the two read as one
            composition rather than two stacked blocks. */}
        <div className="-mt-8 w-full max-w-[440px] lg:mt-0">
          {back && (
            <Link
              href={back.href}
              className="group mb-6 hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-secondary transition-colors hover:text-ink lg:inline-flex"
            >
              <ArrowLeft
                className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
                strokeWidth={2}
              />
              {back.label}
            </Link>
          )}

          <div className="border border-border bg-card p-6 sm:p-8">
            <Reveal>
              <div className="mb-7">
                <Logo size={30} className="mb-6 lg:hidden" />
                <p className="ui-eyebrow mb-3 max-w-[14rem]">{eyebrow}</p>
                <h1 className="text-[clamp(1.8rem,4.5vw,2.4rem)] leading-[1.04] text-ink">
                  {title}
                  {titleAccent && <span className="ui-serif"> {titleAccent}</span>}
                </h1>
                {subtitle && (
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
                    {subtitle}
                  </p>
                )}
              </div>
            </Reveal>

            <Reveal delay={0.06}>{children}</Reveal>
          </div>

          {footer && (
            <Reveal delay={0.1}>
              <div className="mt-6 text-center text-sm text-ink-secondary">{footer}</div>
            </Reveal>
          )}
        </div>
      </div>
    </div>
  )
}
