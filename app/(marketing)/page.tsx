'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUpRight } from 'lucide-react'

import { MagneticButton } from '@/components/marketing/MagneticButton'
import { KenBurnsStage, StageIndex, useStageIndex, type Frame } from '@/components/marketing/KenBurnsStage'
import { CurveDivider } from '@/components/marketing/CurveDivider'
import { StackCards, type StackItem } from '@/components/marketing/StackCards'
import { Accordion } from '@/components/marketing/Accordion'
import {
  Counter,
  ImageReveal,
  MarkedText,
  MaskLines,
  Marquee,
  Parallax,
  Reveal,
  ScrollHighlight,
} from '@/components/marketing/motion'
import { Eyebrow, Rules, SectionHead } from '@/components/marketing/ui'

const IMG = '/images/marketing'

/* ── Content ───────────────────────────────────────────────────────────── */

const HERO_FRAMES: Frame[] = [
  { src: `${IMG}/hero-market.webp`, alt: 'A student trader setting out produce for sale', caption: 'Sellers already on your campus' },
  { src: `${IMG}/hero-campus.webp`, alt: 'Students walking across a university campus', caption: 'Between lectures' },
  { src: `${IMG}/hero-rider.webp`, alt: 'A delivery rider moving through traffic', caption: 'Closed out by a rider' },
  { src: `${IMG}/hero-tomatoes.webp`, alt: 'A market trader behind baskets of produce', caption: 'Market day, digitised' },
]

const TICKER = [
  'Free to list',
  'Payment held until delivery',
  'Campus rider network',
  '48-hour dispute window',
  'Student to student',
]

const CATEGORIES = [
  { name: 'Fashion & clothing', image: 'cat-thrift', count: '3.1K items' },
  { name: 'Tech gadgets', image: 'cat-tech', count: '680 items' },
  { name: 'Food services', image: 'cat-food', count: '1.2K items' },
  { name: 'Snacks', image: 'cat-food2', count: '890 items' },
  { name: 'Cosmetics', image: 'cat-cosmetics', count: '520 items' },
  { name: 'Books', image: 'cat-books', count: '650 items' },
  { name: 'Room essentials', image: 'cat-room', count: '950 items' },
  { name: 'School supplies', image: 'cat-supplies', count: '740 items' },
]

const STEPS: StackItem[] = [
  {
    index: '01',
    title: 'Find it, or list it',
    body: 'Browse what students around you are already selling, or put up your own listing in a few minutes. Listing costs nothing, and there are no fees for keeping something up.',
    image: `${IMG}/scene-vendor.webp`,
    imageAlt: 'A street trader preparing an order',
  },
  {
    index: '02',
    title: 'Pay, protected',
    body: 'Checkout runs through secure payment providers. The seller is not settled the moment you pay — settlement is tied to the order reaching completion and the dispute window closing.',
    image: `${IMG}/scene-payment.webp`,
    imageAlt: 'A card payment being taken on a handheld terminal',
  },
  {
    index: '03',
    title: 'A rider closes it out',
    body: 'Where rider coverage is available, the order moves through the BataMart delivery flow with status updates the whole way. You have 48 hours after delivery to raise anything that went wrong.',
    image: `${IMG}/scene-parcel.webp`,
    imageAlt: 'A parcel being handed from one person to another',
  },
]

const ZONES = [
  { name: 'Main hostel block', note: 'Highest order volume', image: 'scene-building' },
  { name: 'Engineering faculty', note: 'Weekday peak, 12–4pm', image: 'story-laptop' },
  { name: 'Sciences complex', note: 'Lab-hours delivery', image: 'scene-library' },
  { name: 'Law faculty', note: 'Books & supplies heavy', image: 'cat-books' },
  { name: 'Student union bldg', note: 'Food & snacks corridor', image: 'cat-food' },
  { name: 'Library', note: 'Quiet-drop point', image: 'scene-library' },
  { name: 'Sports complex', note: 'Evening deliveries', image: 'hero-campus' },
  { name: 'Admin block', note: 'Daytime only', image: 'scene-skyline' },
]

const AUDIENCE = [
  {
    role: 'Buyers',
    face: 'face-02',
    title: 'Order without the guesswork',
    body: 'See who you are buying from, pay through a protected checkout, and track the order until it reaches you.',
    href: '/marketplace',
    cta: 'Browse the marketplace',
  },
  {
    role: 'Sellers',
    face: 'face-04',
    title: 'Turn a side hustle into a shop',
    body: 'List for free, manage orders in one place, and build a review history that follows you across campus.',
    href: '/sell',
    cta: 'Start selling',
  },
  {
    role: 'Riders',
    face: 'face-01',
    title: 'Run deliveries between classes',
    body: 'Rider onboarding is handled by the BataMart team. Reach out through support if you want to be considered.',
    href: '/contact',
    cta: 'Register interest',
  },
]

const FAQS = [
  {
    question: 'Is my payment secure?',
    answer:
      'Payments are processed through secure providers, and BataMart applies settlement and dispute rules before a seller payout is finalised. A seller is not paid out the instant you check out.',
  },
  {
    question: 'How long does delivery take?',
    answer:
      'It depends on rider availability, seller readiness and distance. Rather than promise a number we cannot hold to, the order status updates at every step inside your account.',
  },
  {
    question: 'What if something is wrong with my order?',
    answer:
      'You can open a dispute once the order is delivered or completed, within 48 hours, with at least one evidence image attached. Support then reviews both sides before anything is settled.',
  },
  {
    question: 'How do I become a seller?',
    answer:
      'From your account, use the Become Seller flow to enable seller access, then start listing. There is no listing fee.',
  },
  {
    question: 'How does referral earning work?',
    answer:
      'You share your referral link and your friend signs up. When their eligible delivery orders complete, referral rewards are credited to your wallet — currently shown in-app as ₦120 per eligible referral delivery.',
  },
  {
    question: 'Can I become a rider?',
    answer:
      'Rider onboarding is currently managed internally by the BataMart team. Contact support if you would like to express interest.',
  },
]

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [authed, setAuthed] = useState(false)
  const [frame, setFrame] = useStageIndex(HERO_FRAMES.length, 5600)
  const [zone, setZone] = useState(0)

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

  return (
    <>
      {/* ═══ HERO ══════════════════════════════════════════════════════ */}
      <section className="mk-ink relative min-h-[100svh] flex flex-col mk-grain overflow-hidden">
        <KenBurnsStage frames={HERO_FRAMES} index={frame} overlay="scrim" />
        {/* The copy lives on the left, so the ground is darkened from the left
            as well as the bottom. Photographs rotate underneath and a scrim
            tuned to one of them washes out on the next. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(100deg, rgba(11,11,13,0.86) 0%, rgba(11,11,13,0.62) 38%, rgba(11,11,13,0.12) 72%, rgba(11,11,13,0) 100%)',
          }}
        />

        <div className="relative z-10 mk-shell flex-1 flex flex-col justify-end pb-[clamp(2rem,5vw,4rem)] pt-[clamp(7rem,16vh,11rem)]">
          <Reveal y={0} delay={0.1}>
            <Eyebrow index="01">UNIZIK · Campus marketplace</Eyebrow>
          </Reveal>

          <h1 className="mk-h1 mt-8 max-w-[16ch]">
            <MaskLines
              delay={0.2}
              lines={[
                'The campus',
                'marketplace,',
                <span key="d" className="mk-serif mk-accent">delivered.</span>,
              ]}
            />
          </h1>

          {/* Kept in the left column with the headline: that is the only part
              of the frame the scrim can be relied on to hold dark while the
              photographs rotate behind it. */}
          <div className="mt-10 max-w-[52ch]">
            <Reveal delay={0.55}>
              <p className="mk-lead opacity-85">
                Buy from students two hostels away. Sell what you no longer
                need. The payment sits protected until the order actually
                lands — then a rider closes it out.
              </p>
            </Reveal>

            <Reveal delay={0.7}>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                <MagneticButton
                  href={authed ? '/marketplace' : '/signup'}
                  variant="blue"
                >
                  {authed ? 'Open marketplace' : 'Join free'}
                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                </MagneticButton>
                <MagneticButton href="/marketplace" variant="light">
                  Explore listings
                </MagneticButton>
              </div>
            </Reveal>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-between gap-6 pt-7 border-t border-[rgba(240,236,228,0.16)]">
            <StageIndex frames={HERO_FRAMES} index={frame} onSelect={setFrame} />

            <AnimatePresence mode="wait">
              <motion.p
                key={frame}
                className="mk-mono opacity-55"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 0.55, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5 }}
              >
                {HERO_FRAMES[frame].caption}
              </motion.p>
            </AnimatePresence>

            <motion.span
              className="mk-mono opacity-40 hidden sm:flex items-center gap-3"
              animate={{ y: [0, 7, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              Scroll <ArrowDown className="w-3.5 h-3.5" strokeWidth={1.75} />
            </motion.span>
          </div>
        </div>
      </section>

      {/* ═══ TICKER ════════════════════════════════════════════════════ */}
      <section className="mk-ink py-[clamp(1.5rem,3vw,2.75rem)] border-y border-[rgba(240,236,228,0.14)] overflow-hidden">
        <Marquee baseDuration={30}>
          {TICKER.map((item) => (
            <span key={item} className="mk-marquee__item">
              <span className="mk-marquee__dot" />
              {item}
            </span>
          ))}
        </Marquee>
      </section>

      <CurveDivider from="ink" to="paper" glow />

      {/* ═══ STATEMENT ═════════════════════════════════════════════════ */}
      <section className="mk-paper relative pt-[clamp(5rem,11vw,11rem)] pb-[clamp(2.5rem,5vw,5rem)]">
        <Rules />
        <div className="mk-shell relative z-10 grid gap-12 lg:grid-cols-[1.35fr_0.65fr] lg:gap-16 items-start">
          <div className="relative z-10 max-w-[62ch]">
            <Eyebrow index="02">Why it exists</Eyebrow>
            <ScrollHighlight
              className="mk-h3 mt-9 leading-[1.32] tracking-[-0.025em]"
              text="Group chats lose your order. Open marketplaces have never heard of your faculty. BataMart is built for one campus at a time — the hostels, the lecture blocks and the sellers already around you — with the money held safely in the middle and a delivery that ends at your door."
            />
            <Reveal delay={0.1}>
              <p className="mk-body mt-9 max-w-[52ch]">
                No listing fees. No stranger meeting you at a gate with a story.{' '}
                <MarkedText>Just your campus, organised.</MarkedText>
              </p>
            </Reveal>
          </div>

          {/* Lifted over the seam above — the photograph crosses the boundary
              rather than sitting politely below it. */}
          <Parallax speed={-0.16} className="hidden lg:block">
            <ImageReveal
              src={`${IMG}/story-graduate.webp`}
              alt="A graduate holding up her certificate on campus"
              className="w-full aspect-[3/4] -mt-[clamp(10rem,24vh,19rem)]"
            />
          </Parallax>
        </div>
      </section>

      {/* ═══ CATEGORIES ════════════════════════════════════════════════ */}
      <section className="mk-paper mk-section-tight relative">
        <div className="mk-shell">
          <div className="flex flex-wrap items-end justify-between gap-8 mb-[clamp(2.5rem,5vw,4.5rem)]">
            <SectionHead
              index="03"
              eyebrow="What's trading"
              lines={['Everything a', 'student actually buys']}
            />
            <Reveal delay={0.2}>
              <MagneticButton href="/marketplace" variant="ghost">
                All categories
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
              </MagneticButton>
            </Reveal>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-3 md:gap-x-5 md:gap-y-5">
            {CATEGORIES.map((category, i) => (
              <motion.div
                key={category.name}
                // Alternate columns ride lower, so the grid never resolves
                // into a plain row of equal boxes.
                className={i % 2 === 1 ? 'lg:translate-y-14' : ''}
                initial={{ opacity: 0, y: 34 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                transition={{ duration: 0.85, delay: (i % 4) * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={`/marketplace?category=${encodeURIComponent(category.name)}`}
                  className="mk-tile aspect-[3/4] w-full"
                >
                  <div className="mk-tile__media">
                    <img
                      src={`${IMG}/${category.image}.webp`}
                      alt={category.name}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="mk-tile__body">
                    <span className="mk-mono opacity-60 mb-auto">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <h3 className="mk-h3 text-[clamp(1.05rem,1.7vw,1.5rem)]">
                          {category.name}
                        </h3>
                        <p className="mk-mono opacity-55 mt-2">{category.count}</p>
                      </div>
                      <ArrowUpRight
                        className="mk-tile__arrow w-5 h-5 flex-none"
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
        {/* Clears the offset second column so the curve below never clips it. */}
        <div className="h-0 lg:h-14" />
      </section>

      <CurveDivider from="paper" to="ink" />

      {/* ═══ HOW IT WORKS ══════════════════════════════════════════════ */}
      <section className="mk-ink pt-[clamp(4rem,9vw,8rem)] pb-[clamp(6rem,12vw,11rem)]">
        <div className="mk-shell mb-[clamp(2rem,5vw,4rem)]">
          <SectionHead
            index="04"
            eyebrow="The process"
            lines={['Three steps,', 'and the money is safe', 'the whole way']}
          />
        </div>
        <div className="mk-shell">
          <StackCards items={STEPS} />
        </div>
      </section>

      {/* ═══ COVERAGE ══════════════════════════════════════════════════ */}
      <section className="mk-ink mk-section relative">
        <Rules />
        <div className="mk-shell relative z-10">
          <SectionHead
            index="05"
            eyebrow="Coverage"
            lines={['Delivering across', 'your campus']}
            body="Availability and timing depend on riders, distance and how quickly the seller is ready. These are the zones the rider flow currently runs through."
          />

          <div className="mt-[clamp(3rem,6vw,5rem)] grid gap-12 lg:grid-cols-[1.45fr_1fr] lg:gap-16 lg:items-start">
            <div onMouseLeave={() => setZone(0)}>
              {ZONES.map((entry, i) => (
                <div
                  key={entry.name}
                  className="mk-row cursor-default"
                  onMouseEnter={() => setZone(i)}
                >
                  <span className="mk-row__wash" aria-hidden />
                  <span className="mk-mono opacity-45">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="mk-h3 text-[clamp(1.1rem,1.9vw,1.65rem)] min-w-0">
                    {entry.name}
                  </span>
                  <span className="mk-mono opacity-45 hidden sm:block whitespace-nowrap pl-4">
                    {entry.note}
                  </span>
                </div>
              ))}
            </div>

            {/* The photograph answers the row you are pointing at. */}
            <div className="mk-figure aspect-[4/5] lg:sticky lg:top-32 hidden lg:block">
              <AnimatePresence mode="popLayout">
                <motion.img
                  key={ZONES[zone].image}
                  src={`${IMG}/${ZONES[zone].image}.webp`}
                  alt={ZONES[zone].name}
                  initial={{ opacity: 0, scale: 1.08 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                />
              </AnimatePresence>
              <div className="absolute inset-x-0 bottom-0 p-6 z-10 bg-gradient-to-t from-[rgba(11,11,13,0.9)] to-transparent">
                <p className="mk-mono opacity-70">{ZONES[zone].note}</p>
                <p className="mk-h3 mt-2">{ZONES[zone].name}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ NUMBERS ═══════════════════════════════════════════════════ */}
      <section className="mk-ink pb-[clamp(4rem,9vw,8rem)]">
        <div className="mk-shell">
          <Eyebrow index="06">By the numbers</Eyebrow>
          <div className="mt-10 grid gap-px sm:grid-cols-2 lg:grid-cols-4 bg-[rgba(240,236,228,0.14)] border border-[rgba(240,236,228,0.14)]">
            {[
              { value: <><Counter to={2000} />+</>, label: 'Active users', note: 'Students trading daily' },
              { value: <><Counter to={5000} />+</>, label: 'Products listed', note: 'Across every category' },
              { value: <><Counter to={98} />%</>, label: 'Positive experience', note: 'Based on platform review trends' },
              { value: <>₦<Counter to={0} /></>, label: 'Listing fees', note: 'Listing is free, always' },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.08} className="mk-ink">
                <div className="p-[clamp(1.5rem,2.6vw,2.5rem)] h-full">
                  <div className="mk-h2">{stat.value}</div>
                  <p className="mk-mono mt-5 opacity-75">{stat.label}</p>
                  <p className="mk-body text-[0.85rem] mt-2 max-w-[24ch]">{stat.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CurveDivider from="ink" to="paper" glow />

      {/* ═══ WHO IT'S FOR ══════════════════════════════════════════════ */}
      <section className="mk-paper mk-section relative">
        <Rules />
        <div className="mk-shell relative z-10">
          <SectionHead
            index="07"
            eyebrow="Who it's for"
            lines={['Three sides of', 'the same campus']}
          />

          <div className="mt-[clamp(3rem,6vw,5rem)] grid gap-x-6 gap-y-12 md:grid-cols-3">
            {AUDIENCE.map((entry, i) => (
              <Reveal key={entry.role} delay={i * 0.1}>
                <article className="h-full flex flex-col">
                  <div className="mk-figure mk-figure--zoom aspect-[4/5] mb-7">
                    <img
                      src={`${IMG}/${entry.face}.webp`}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <span className="mk-mono mk-accent">{entry.role}</span>
                  <h3 className="mk-h3 mt-4 max-w-[16ch]">{entry.title}</h3>
                  <p className="mk-body mt-4 flex-1">{entry.body}</p>
                  <Link
                    href={entry.href}
                    className="mk-mono mt-7 inline-flex items-center gap-2 border-b border-current pb-1 self-start hover:text-[#1E90FF] hover:border-[#1E90FF] transition-colors duration-300"
                  >
                    {entry.cta}
                    <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══════════════════════════════════════════════════════ */}
      <section className="mk-paper mk-section-tight pb-[clamp(5rem,11vw,10rem)]">
        <div className="mk-shell grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHead
              index="08"
              eyebrow="Questions"
              lines={['Before you', 'sign up']}
            />
            <Reveal delay={0.2}>
              <p className="mk-body mt-8 max-w-[36ch]">
                Anything not covered here, support answers directly.
              </p>
              <div className="mt-8">
                <MagneticButton href="/contact" variant="ghost">
                  Contact support
                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                </MagneticButton>
              </div>
            </Reveal>
          </div>

          <Accordion items={FAQS} startOpen={0} />
        </div>
      </section>

      <CurveDivider from="paper" to="ink" />

      {/* ═══ CTA ═══════════════════════════════════════════════════════ */}
      <section className="mk-ink relative overflow-hidden mk-grain">
        <Parallax speed={0.22} className="absolute inset-0">
          <img
            src={`${IMG}/scene-buses.webp`}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="w-full h-[120%] object-cover -mt-[10%]"
          />
        </Parallax>
        <div className="absolute inset-0 bg-[rgba(11,11,13,0.74)]" />

        <div className="relative z-10 mk-shell py-[clamp(6rem,14vw,12rem)] text-center">
          <Eyebrow className="justify-center">Get started</Eyebrow>
          <h2 className="mk-h1 mt-8 mx-auto max-w-[15ch]">
            <MaskLines
              lines={['Sell something', <span key="t" className="mk-serif mk-accent">by tonight.</span>]}
            />
          </h2>
          <Reveal delay={0.3}>
            <p className="mk-lead mt-8 mx-auto max-w-[44ch] opacity-75">
              Free to join, free to list, and the first order can go out today.
            </p>
            <div className="mt-12 flex flex-wrap justify-center items-center gap-8">
              <MagneticButton href={authed ? '/marketplace' : '/signup'} variant="blue">
                {authed ? 'Open marketplace' : 'Create free account'}
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
              </MagneticButton>
              {!authed && (
                <Link href="/login" className="mk-mono opacity-60 hover:opacity-100 transition-opacity">
                  I already have an account
                </Link>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
