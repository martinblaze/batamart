'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from 'framer-motion'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { MagneticButton, Magnetic } from './MagneticButton'

const LINKS = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'About', href: '/about' },
  { label: 'Sell', href: '/sell' },
  { label: 'Contact', href: '/contact' },
]

/**
 * The navigation reads the page rather than sitting on top of it.
 *
 * Over the first viewport it is pure glass — no plate, no border, white type
 * on the hero photograph. Across the next 180px it earns its background:
 * blur, then ink, then a hairline. Every step is interpolated off scroll
 * position, so there is no frame where it snaps.
 *
 * Past the fold it also tucks away on the way down and returns on the way up,
 * which is the behaviour people already expect from a long document.
 */
export function MarketingNav({ onDark = true }: { onDark?: boolean }) {
  const pathname = usePathname()
  const { scrollY } = useScroll()

  const [tucked, setTucked] = useState(false)
  const [open, setOpen] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [solid, setSolid] = useState(false)

  // The plate fades in over ~220px — long enough to read as a transition.
  // Fading the whole layer ramps its backdrop blur with it, which is both
  // smoother and cheaper than animating the filter itself.
  const plateOpacity = useTransform(scrollY, [0, 90, 220], [0, 0.35, 1])
  const lineOpacity = useTransform(scrollY, [140, 260], [0, 1])

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = scrollY.getPrevious() ?? 0
    setSolid(latest > 140)
    if (open) return
    setTucked(latest > 520 && latest > previous)
  })

  useEffect(() => {
    const sync = () => setAuthed(Boolean(localStorage.getItem('token')))
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('auth-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('auth-change', sync)
    }
  }, [])

  // Close the overlay on navigation, and don't leave the page locked.
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : ''
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [open])

  // Type colour: light while floating over the hero, ink once the plate lands.
  const light = open || (onDark && !solid)

  return (
    <>
      <motion.header
        className="mk-nav"
        data-tucked={tucked}
        style={{ color: light ? '#F1EDE6' : '#0B0B0D' }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          aria-hidden
          className="mk-nav__plate"
          style={{ opacity: open ? 0 : plateOpacity }}
        />
        <motion.div
          aria-hidden
          className="mk-nav__hairline"
          style={{ opacity: open ? 0 : lineOpacity }}
        />

        <div className="mk-nav__inner">
          <Magnetic pull={10}>
            <Link href="/" aria-label="BataMart home" className="flex items-center">
              <Image
                src="/BATAMART - logo.png"
                alt="BataMart"
                width={112}
                height={43}
                priority
                className="h-[26px] w-auto md:h-[30px] transition-all duration-500"
                style={{
                  filter: light ? 'brightness(0) invert(1)' : 'none',
                }}
              />
            </Link>
          </Magnetic>

          <nav className="mk-nav__links">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mk-navlink"
                data-active={pathname === link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-6">
            <div className="hidden lg:block">
              <MagneticButton
                href={authed ? '/marketplace' : '/signup'}
                variant={light ? 'light' : 'solid'}
                pull={18}
                className="!min-h-[2.85rem] !py-3 !px-6"
              >
                {authed ? 'Open marketplace' : 'Join free'}
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
              </MagneticButton>
            </div>

            <button
              onClick={() => setOpen((v) => !v)}
              className="mk-burger flex-col justify-center items-end gap-[6px] w-9 h-9"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
            >
              <motion.span
                className="block h-px bg-current"
                animate={{ width: open ? 24 : 26, rotate: open ? 45 : 0, y: open ? 3.5 : 0 }}
                transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
              />
              <motion.span
                className="block h-px bg-current"
                animate={{ width: open ? 24 : 17, rotate: open ? -45 : 0, y: open ? -3.5 : 0 }}
                transition={{ duration: 0.45, ease: [0.76, 0, 0.24, 1] }}
              />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mk-menu"
            initial={{ clipPath: 'inset(0% 0% 100% 0%)' }}
            animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
            exit={{ clipPath: 'inset(0% 0% 100% 0%)' }}
            transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="mk-shell w-full">
              <p className="mk-mono opacity-50 mb-8">Menu</p>
              {LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.22 + i * 0.07, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link href={link.href} className="mk-menu__link">
                    <span className="mk-mono opacity-40 mr-4 align-middle">
                      0{i + 1}
                    </span>
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                className="mt-12 flex flex-wrap items-center gap-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.6 }}
              >
                <MagneticButton
                  href={authed ? '/marketplace' : '/signup'}
                  variant="light"
                >
                  {authed ? 'Open marketplace' : 'Create free account'}
                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                </MagneticButton>
                {!authed && (
                  <Link href="/login" className="mk-mono opacity-60">
                    Log in
                  </Link>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
