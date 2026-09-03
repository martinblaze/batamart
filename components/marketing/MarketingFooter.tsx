'use client'

import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { MagneticButton } from './MagneticButton'
import { Reveal } from './motion'

const COLUMNS = [
  {
    label: 'Marketplace',
    links: [
      { name: 'Browse products', href: '/marketplace' },
      { name: 'Most bought', href: '/most-bought' },
      { name: 'Sellers', href: '/sellers' },
      { name: 'Start selling', href: '/sell' },
    ],
  },
  {
    label: 'Company',
    links: [
      { name: 'About', href: '/about' },
      { name: 'Contact', href: '/contact' },
      { name: 'Referrals', href: '/referrals' },
    ],
  },
  {
    label: 'Legal',
    links: [
      { name: 'Privacy policy', href: '/privacy' },
      { name: 'Terms of service', href: '/terms' },
      { name: 'Seller terms', href: '/terms/sellers' },
    ],
  },
]

export function MarketingFooter() {
  const ref = useRef<HTMLElement>(null)
  const [year, setYear] = useState('')

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end end'],
  })
  // The wordmark rises out of its own baseline as the footer completes.
  const markY = useTransform(scrollYProgress, [0, 1], ['22%', '0%'])

  // Rendered client-side so a cached page can never show a stale year.
  useEffect(() => setYear(String(new Date().getFullYear())), [])

  return (
    <footer ref={ref} className="mk-ink relative overflow-hidden">
      <div className="mk-shell pt-[clamp(4rem,9vw,8rem)] pb-10">
        <div className="grid gap-14 lg:grid-cols-[1.25fr_1fr] lg:gap-24">
          <div>
            <Reveal>
              <p className="mk-eyebrow mk-mono mb-7">Get started</p>
              <h2 className="mk-h2 max-w-[13ch]">
                Your campus is
                <br />
                <span className="mk-serif mk-accent">already trading.</span>
              </h2>
              <p className="mk-body mt-7 max-w-[46ch]">
                Free to join, free to list. Bring what you are selling, find
                what you need, and let the delivery flow handle the rest.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-8">
                <MagneticButton href="/signup" variant="blue">
                  Create free account
                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                </MagneticButton>
                <Link href="/marketplace" className="mk-mono opacity-60 hover:opacity-100 transition-opacity">
                  Browse first
                </Link>
              </div>
            </Reveal>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10">
            {COLUMNS.map((column) => (
              <div key={column.label}>
                <p className="mk-mono opacity-40 mb-5">{column.label}</p>
                <ul className="space-y-3">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[0.94rem] opacity-70 hover:opacity-100 hover:text-[#1E90FF] transition-all duration-300"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col md:flex-row md:items-center md:justify-between gap-5 pt-8 border-t border-[rgba(240,236,228,0.14)]">
          <p className="mk-mono opacity-40">
            © {year || '2026'} BataMart — built for university students
          </p>
          <div className="flex items-center gap-6">
            <a href="mailto:support@batamart.com" className="mk-mono opacity-40 hover:opacity-100 transition-opacity">
              support@batamart.com
            </a>
            <span className="flex items-center gap-2 mk-mono opacity-40">
              <span className="mk-round w-1.5 h-1.5 bg-[#22C55E] inline-block" />
              All systems operational
            </span>
          </div>
        </div>
      </div>

      {/* Oversized wordmark, cropped by the page edge — the last thing you see. */}
      <div className="overflow-hidden px-[var(--gutter)]" aria-hidden>
        <motion.p
          style={{ y: markY }}
          className="mk-display leading-[0.72] text-center select-none"
          // Hairline outline rather than a filled slab: it closes the page
          // without competing with the call to action above it.
        >
          <span
            style={{
              WebkitTextStroke: '1px rgba(241,237,230,0.22)',
              color: 'transparent',
              display: 'block',
              whiteSpace: 'nowrap',
              // Sized so all eight characters clear the gutters at every
              // width — a wordmark clipped mid-word reads as a bug, not as a
              // crop.
              fontSize: 'clamp(2rem, 16.5vw, 18rem)',
            }}
          >
            BATAMART
          </span>
        </motion.p>
      </div>
    </footer>
  )
}
