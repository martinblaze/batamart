'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { KenBurns, Reveal, RevealItem } from '@/components/motion/AppMotion'

/**
 * Image-led sections for the marketplace feed.
 *
 * The feed's category row was twelve tinted squares with a line icon in each —
 * identical to one another, so the row carried no information until you read
 * every label. A photograph tells you what "Beauty & Health" contains before
 * you read the word, and it is what makes a browse surface look like a shop
 * instead of a settings screen.
 *
 * Every tile here links to a real filtered destination; none of it is
 * decoration standing in for content.
 */

/** Maps a category label to its photograph. Keys match the feed's own list. */
const CATEGORY_IMAGES: Record<string, string> = {
  Electronics: '/images/marketing/cat-electronics.webp',
  Computing: '/images/marketing/cat-computing.webp',
  Fashion: '/images/marketing/cat-fashion.webp',
  'Home & Kitchen': '/images/marketing/cat-home.webp',
  'Food & Groceries': '/images/marketing/cat-groceries.webp',
  'Beauty & Health': '/images/marketing/cat-beauty.webp',
  'Sports & Fitness': '/images/marketing/cat-sports.webp',
  'Vehicles & Transport': '/images/marketing/cat-vehicles.webp',
  'Books & Stationery': '/images/marketing/cat-books.webp',
  'Tickets & Events': '/images/marketing/cat-events.webp',
  'Kids & Baby': '/images/marketing/cat-kids.webp',
  'Arts & Crafts': '/images/marketing/cat-arts.webp',
}

export function categoryImage(label: string): string | undefined {
  return CATEGORY_IMAGES[label]
}

/** Mono eyebrow, display title, optional action. One header for the feed. */
export function FeedHeading({
  eyebrow,
  title,
  accent,
  href,
}: {
  eyebrow: string
  title: string
  accent?: string
  href?: string
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-6">
      <div className="min-w-0">
        <p className="ui-eyebrow mb-2.5 max-w-[16rem]">{eyebrow}</p>
        <h2 className="text-[clamp(1.15rem,2.4vw,1.7rem)] text-ink">
          {title}
          {accent && <span className="ui-serif"> {accent}</span>}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="group flex flex-shrink-0 items-center gap-1.5 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary"
        >
          See all
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </Link>
      )}
    </div>
  )
}

/** Photographic category tiles, scrolling sideways on a phone. */
export function CategoryTiles({ categories }: { categories: string[] }) {
  return (
    <section>
      <FeedHeading eyebrow="Shop by category" title="Find it" accent="faster." />
      <div className="ui-rail -mx-1 px-1 pb-1">
        {categories.map((label, i) => {
          const image = categoryImage(label)
          return (
            <RevealItem key={label} index={i}>
              <Link
                href={`/search?category=${encodeURIComponent(label)}`}
                className="group relative block h-[104px] w-[136px] overflow-hidden rounded-lg"
              >
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="136px"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-surface" />
                )}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.1)_45%,rgba(0,0,0,0.85))]"
                />
                <span className="absolute inset-x-2.5 bottom-2.5 text-[13px] font-semibold leading-tight text-white">
                  {label}
                </span>
              </Link>
            </RevealItem>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Full-bleed category panel with its subcategories as chips over the image.
 * The web equivalent of the mobile client's spotlight.
 */
export function CategorySpotlight({
  label,
  image,
  subcategories,
}: {
  label: string
  image: string
  subcategories: string[]
}) {
  return (
    <Reveal>
      <section className="relative h-[240px] overflow-hidden rounded-lg sm:h-[280px]">
        <KenBurns className="absolute inset-0" maxScale={1.09} seconds={20}>
          <Image src={image} alt="" fill sizes="100vw" className="object-cover" />
        </KenBurns>
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.25),rgba(0,0,0,0.05)_30%,rgba(0,0,0,0.92))]"
        />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <p className="ui-mono ui-mono-sm mb-1.5 text-white/65">Best sellers in</p>
          <Link
            href={`/search?category=${encodeURIComponent(label)}`}
            className="group inline-flex items-center gap-2"
          >
            <span className="text-[clamp(1.3rem,3.2vw,1.75rem)] font-semibold text-white">
              {label}
            </span>
            <ArrowRight
              className="h-4 w-4 text-white transition-transform duration-300 ease-out group-hover:translate-x-1"
              strokeWidth={2}
            />
          </Link>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {subcategories.slice(0, 6).map((sub) => (
              <Link
                key={sub}
                href={`/search?category=${encodeURIComponent(label)}&q=${encodeURIComponent(sub)}`}
                className="border border-white/30 bg-white/15 px-3 py-1.5 text-[11.5px] text-white backdrop-blur-sm transition-colors duration-300 hover:bg-white/25"
              >
                {sub}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Reveal>
  )
}

/** Price bands over photography. Each lands on a real filtered search. */
export function BudgetBands() {
  const bands = [
    { amount: 10000, label: 'Fashion', image: '/images/marketing/cat-fashion.webp' },
    { amount: 20000, label: 'Tech', image: '/images/marketing/cat-electronics.webp' },
    { amount: 5000, label: 'Food', image: '/images/marketing/cat-groceries.webp' },
    { amount: 30000, label: 'Room', image: '/images/marketing/cat-home.webp' },
  ]

  return (
    <section>
      <FeedHeading eyebrow="Shop to a budget" title="Everything" accent="under." />
      <div className="ui-rail -mx-1 px-1 pb-1">
        {bands.map((band, i) => (
          <RevealItem key={band.label} index={i}>
            <Link
              href={`/search?maxPrice=${band.amount}&sort=price_asc`}
              className="group relative block h-[128px] w-[152px] overflow-hidden rounded-lg"
            >
              <Image
                src={band.image}
                alt=""
                fill
                sizes="152px"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
              />
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.1),rgba(0,0,0,0.85))]"
              />
              <div className="absolute inset-x-3 bottom-3">
                <p className="ui-mono ui-mono-sm text-white/70">{band.label}</p>
                <p className="ui-figure mt-1 text-[17px] text-white">
                  Under ₦{band.amount.toLocaleString('en-NG')}
                </p>
              </div>
            </Link>
          </RevealItem>
        ))}
      </div>
    </section>
  )
}

/** Closing prompt at the foot of the feed. */
export function SellCta() {
  return (
    <Reveal>
      <Link
        href="/sell"
        className="group relative block h-[220px] overflow-hidden rounded-lg sm:h-[260px]"
      >
        <KenBurns className="absolute inset-0" maxScale={1.12} seconds={22}>
          <Image
            src="/images/marketing/sell-cta.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </KenBurns>
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.1),rgba(0,0,0,0.9))]"
        />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <p className="ui-mono ui-mono-sm mb-2 text-white/65">Got something to sell?</p>
          <p className="text-[clamp(1.4rem,3.6vw,2rem)] font-semibold leading-tight text-white">
            List it in<span className="ui-serif"> two minutes.</span>
          </p>
          <span className="mt-5 inline-flex items-center gap-2 bg-white px-5 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink">
            Start selling
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </span>
        </div>
      </Link>
    </Reveal>
  )
}

/**
 * Auto-advancing promise rail.
 *
 * Leads the feed. What sat here before was a row of stat boxes — "2,400+
 * products listed" — which is a number the reader cannot verify and does not
 * care about on arrival. These are the platform's actual guarantees, over
 * photography, which is both more useful and the thing that stops the top of
 * the page reading as a dashboard.
 */
export function PromiseCarousel() {
  const promises = [
    {
      kicker: 'Sellers keep more',
      title: 'Listing is',
      accent: 'free.',
      body: 'Put up as many items as you like. You are only charged when a sale completes.',
      image: '/images/marketing/promise-listing.webp',
    },
    {
      kicker: 'Buyer protection',
      title: 'Escrow on',
      accent: 'every order.',
      body: 'Your money is held safely and released only once you confirm the item arrived.',
      image: '/images/marketing/promise-escrow.webp',
    },
    {
      kicker: 'Campus delivery',
      title: 'Brought to your',
      accent: 'hostel.',
      body: 'BataMart riders run deliveries across campus at a flat zone-based fee.',
      image: '/images/marketing/banner-delivery.webp',
    },
    {
      kicker: 'Dispute cover',
      title: 'Raise an issue for',
      accent: '72 hours.',
      body: 'If something is wrong after delivery, open a dispute and track it from your orders.',
      image: '/images/marketing/promise-dispute.webp',
    },
  ]

  return (
    <div className="ui-rail -mx-1 px-1 pb-1">
      {promises.map((p, i) => (
        <RevealItem key={p.kicker} index={i}>
          <article className="relative h-[178px] w-[300px] overflow-hidden rounded-lg sm:w-[360px]">
            <KenBurns className="absolute inset-0" maxScale={1.08} seconds={18}>
              <Image src={p.image} alt="" fill sizes="360px" className="object-cover" />
            </KenBurns>
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_top_right,rgba(19,19,17,0.92),rgba(19,19,17,0.62))]"
            />
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-3/4 bg-[linear-gradient(to_right,rgba(19,19,17,0.72),transparent)]"
            />
            <div className="absolute inset-0 flex flex-col justify-center p-5">
              <p className="ui-mono ui-mono-sm mb-2 text-white/70">{p.kicker}</p>
              <p className="text-[22px] font-semibold leading-tight text-white">
                {p.title}
                <span className="ui-serif"> {p.accent}</span>
              </p>
              {/* /72 disappeared over the brighter half of a photograph. Body
                  copy on an image needs more weight than a caption does. */}
              <p className="mt-2 line-clamp-3 max-w-[26ch] text-[12px] leading-relaxed text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                {p.body}
              </p>
            </div>
          </article>
        </RevealItem>
      ))}
    </div>
  )
}
