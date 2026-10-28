import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Package, ShieldCheck, Truck, Users } from 'lucide-react'

import { MagneticButton } from '@/components/marketing/MagneticButton'
import { CurveDivider } from '@/components/marketing/CurveDivider'
import {
  ImageReveal,
  MarkedText,
  Parallax,
  Reveal,
  ScrollHighlight,
} from '@/components/marketing/motion'
import { Eyebrow, PageIntro, Rules, SectionHead } from '@/components/marketing/ui'

const IMG = '/images/marketing'

export const metadata: Metadata = {
  title: 'About',
  description:
    'BataMart is a campus marketplace built for student-to-student buying and selling, with protected checkout and a campus rider delivery flow.',
  alternates: { canonical: '/about' },
}

const FIXES = [
  {
    before: 'Group chats',
    problem: 'Your order is three hundred messages up, and nobody is accountable for it.',
    answer: 'Every order has a record, a status and two named sides.',
  },
  {
    before: 'Open marketplaces',
    problem: 'Built for a country, not a campus. The seller is an hour away and the listing is six months stale.',
    answer: 'One campus at a time, so the person selling is a walk away.',
  },
  {
    before: 'Cash at the gate',
    problem: 'You hand over money first and hope the item matches the photo.',
    answer: 'Checkout runs through secure providers, and settlement waits on the order.',
  },
  {
    before: 'No recourse',
    problem: 'When something goes wrong there is nobody to raise it with.',
    answer: 'A dispute window with evidence, reviewed by support on both sides.',
  },
]

const VALUES = [
  {
    title: 'Trust & safety',
    body: 'Order tracking, dispute handling and account-level controls, combined so that a bad transaction has somewhere to go.',
  },
  {
    title: 'Community first',
    body: 'Built by students, for students. Campus commerce has its own rhythm — lecture gaps, hostel blocks, end-of-semester clear-outs — and the product is shaped around it.',
  },
  {
    title: 'Transparency',
    body: 'Clear pricing and honest reviews. Fees and rules are written down on the terms page rather than discovered at checkout.',
  },
  {
    title: 'Momentum',
    body: 'The platform changes on student feedback. What gets reported gets fixed, and what gets used gets better.',
  },
]

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Protected checkout',
    body: 'Payments are processed securely, with seller settlement tied to order completion rules in the app.',
  },
  {
    icon: Users,
    title: 'Campus community',
    body: 'Profiles, reviews and order history, so reputation follows a seller across the whole campus.',
  },
  {
    icon: Truck,
    title: 'Rider delivery',
    body: 'Deliveries run every Wednesday and Saturday for a flat ₦1,200 per order. You get status updates the whole way and a live map for the last stretch to your door.',
  },
  {
    icon: Package,
    title: 'Wide selection',
    body: 'From textbooks to tech, food to fashion — the things students actually buy from each other.',
  },
]

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About BataMart"
        title={['Built for one', 'campus at a time']}
        standfirst="A student-to-student marketplace with the money held safely in the middle, a delivery flow that ends at your door, and a support process for when something goes wrong."
        image={`${IMG}/hero-campus.webp`}
        imageAlt="Students walking between faculty buildings on campus"
        meta={[
          { label: 'Marketplace access', value: '24/7' },
          { label: 'Dispute window', value: '48h' },
          { label: 'Delivery fee', value: '₦1,200' },
          { label: 'Listing fees', value: '₦0' },
        ]}
      />

      <CurveDivider from="ink" to="paper" glow />

      {/* ═══ STORY ═════════════════════════════════════════════════════ */}
      <section className="mk-paper mk-section relative">
        <Rules />
        <div className="mk-shell relative z-10">
          <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 items-start">
            <div>
              <Eyebrow index="01">Our story</Eyebrow>
              <ScrollHighlight
                className="mk-h3 mt-9 leading-[1.34] tracking-[-0.025em] max-w-[30ch]"
                text="BataMart started from one observation: students needed a better way to buy and sell on their own campus."
              />
              <Reveal delay={0.1}>
                <div className="mk-body mt-9 max-w-[54ch] space-y-6">
                  <p>
                    Traditional online marketplaces were too broad to be useful
                    at campus scale. Social media groups were chaotic, and
                    neither had any way to establish trust between two people
                    who had never met.
                  </p>
                  <p>
                    So we built the thing that was missing. A platform only for
                    campus students, where you can buy a textbook from a
                    classmate, sell your old phone to someone in the next
                    hostel, and manage the whole order in one place with
                    transparent status updates and support tools behind it.
                  </p>
                  <p>
                    <MarkedText>The campus was already trading.</MarkedText>{' '}
                    It just had nowhere sensible to do it.
                  </p>
                </div>
              </Reveal>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:gap-6">
              <Parallax speed={-0.1}>
                <ImageReveal
                  src={`${IMG}/story-laptop.webp`}
                  alt="A student working on a laptop between lectures"
                  className="aspect-[3/4] w-full"
                />
              </Parallax>
              <Parallax speed={0.12} className="mt-12">
                <ImageReveal
                  src={`${IMG}/scene-vendor.webp`}
                  alt="A campus trader preparing an order"
                  className="aspect-[3/4] w-full"
                />
              </Parallax>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHAT WE FIXED ═════════════════════════════════════════════ */}
      <section className="mk-paper mk-section-tight relative">
        <div className="mk-shell">
          <SectionHead
            index="02"
            eyebrow="The problem"
            lines={['What campus commerce', 'looked like before']}
          />

          <div className="mt-[clamp(2.5rem,5vw,4rem)]">
            {FIXES.map((fix, i) => (
              <div key={fix.before} className="mk-row items-start">
                <span className="mk-row__wash" aria-hidden />
                <span className="mk-mono opacity-45 pt-1">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="grid gap-3 md:grid-cols-2 md:gap-10">
                  <div>
                    <h3 className="mk-h3 text-[clamp(1.15rem,1.9vw,1.6rem)]">
                      {fix.before}
                    </h3>
                    <p className="mk-body mt-2 max-w-[38ch] text-[0.94rem]">
                      {fix.problem}
                    </p>
                  </div>
                  <p className="text-[0.94rem] leading-relaxed max-w-[38ch] md:pt-1">
                    <span className="mk-mono mk-accent block mb-2">On BataMart</span>
                    {fix.answer}
                  </p>
                </div>
                <span className="hidden md:block" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <CurveDivider from="paper" to="ink" />

      {/* ═══ VALUES ════════════════════════════════════════════════════ */}
      <section className="mk-ink mk-section relative">
        <Rules />
        <div className="mk-shell relative z-10">
          <SectionHead
            index="03"
            eyebrow="Our values"
            lines={['What we hold to', 'when it costs us']}
          />

          <div className="mt-[clamp(3rem,6vw,5rem)] grid gap-px sm:grid-cols-2 bg-[rgba(240,236,228,0.14)] border border-[rgba(240,236,228,0.14)]">
            {VALUES.map((value, i) => (
              <Reveal key={value.title} delay={i * 0.08} className="mk-ink">
                <div className="p-[clamp(1.6rem,3vw,2.8rem)] h-full">
                  <span className="mk-mono mk-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mk-h3 mt-6 max-w-[14ch]">{value.title}</h3>
                  <p className="mk-body mt-5 max-w-[44ch]">{value.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MISSION ═══════════════════════════════════════════════════ */}
      <section className="mk-ink relative overflow-hidden mk-grain">
        <Parallax speed={0.2} className="absolute inset-0">
          <img
            src={`${IMG}/scene-skyline.webp`}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="w-full h-[120%] object-cover -mt-[10%]"
          />
        </Parallax>
        <div className="absolute inset-0 bg-[rgba(11,11,13,0.78)]" />

        <div className="relative z-10 mk-shell py-[clamp(5rem,12vw,10rem)]">
          <Eyebrow index="04">Our mission</Eyebrow>
          <ScrollHighlight
            className="mk-h2 mt-10 max-w-[22ch] leading-[1.06]"
            text="To give campus students a safe and convenient way to buy what they need and sell what they don't — and a stronger student community on the other side of it."
          />
        </div>
      </section>

      <CurveDivider from="ink" to="paper" glow />

      {/* ═══ FEATURES ══════════════════════════════════════════════════ */}
      <section className="mk-paper mk-section relative">
        <div className="mk-shell">
          <div className="flex flex-wrap items-end justify-between gap-8">
            <SectionHead
              index="05"
              eyebrow="What you get"
              lines={['The parts that', 'make it work']}
            />
            <Reveal delay={0.2}>
              <MagneticButton href="/marketplace" variant="ghost">
                See it in use
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
              </MagneticButton>
            </Reveal>
          </div>

          <div className="mt-[clamp(3rem,6vw,5rem)] grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.08}>
                <article className="h-full border-t border-[rgba(11,11,13,0.13)] pt-7">
                  <feature.icon
                    className="w-6 h-6 mk-accent"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <h3 className="mk-h3 mt-6 text-[clamp(1.1rem,1.6vw,1.4rem)] max-w-[14ch]">
                    {feature.title}
                  </h3>
                  <p className="mk-body mt-4 text-[0.94rem]">{feature.body}</p>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <p className="mk-body mt-[clamp(3rem,6vw,5rem)] max-w-[52ch]">
              The specifics — fees, delivery rules, dispute timing and what
              happens to a payment at each stage — are written out in full on
              the{' '}
              <Link href="/terms" className="mk-accent underline underline-offset-4">
                terms page
              </Link>
              , and how we handle your data is on the{' '}
              <Link href="/privacy" className="mk-accent underline underline-offset-4">
                privacy page
              </Link>
              .
            </p>
          </Reveal>
        </div>
      </section>
    </>
  )
}
