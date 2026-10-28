import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { CurveDivider } from '@/components/marketing/CurveDivider'
import { LegalDoc, LegalList, LegalNote, type LegalSection } from '@/components/marketing/LegalDoc'
import { MagneticButton } from '@/components/marketing/MagneticButton'
import { PageIntro } from '@/components/marketing/ui'
import { Reveal } from '@/components/marketing/motion'

const IMG = '/images/marketing'

export const metadata: Metadata = {
  title: 'Seller Terms & Conditions',
  description:
    'Terms and conditions for sellers on the BataMart campus marketplace — eligibility, listings, escrow, fulfilment, disputes and payouts.',
  alternates: { canonical: '/terms/sellers' },
}

const SECTIONS: LegalSection[] = [
  {
    id: 'eligibility',
    title: 'Eligibility',
    body: (
      <LegalList
        items={[
          { text: 'You must be a currently enrolled student, staff member, or affiliated member of a supported campus to sell on BataMart.' },
          { text: 'You must be at least 16 years of age, or have the consent of a parent or guardian.' },
          { text: 'Seller access is enabled through your BataMart account role, and may be restricted if your account violates platform policy.' },
          { text: 'BataMart reserves the right to revoke seller status if any eligibility requirement is found to be unmet.' },
        ]}
      />
    ),
  },
  {
    id: 'products',
    title: 'Permitted and prohibited products',
    summary:
      'What you may list, and the categories that will be removed on sight.',
    body: (
      <>
        <LegalList
          items={[
            { text: 'You may sell physical goods, digital items and campus-relevant services that comply with university policy and Nigerian law.' },
            { text: 'Prohibited items include weapons, alcohol, tobacco, counterfeit goods, stolen property, explicit or adult content, prescription medication, and anything banned by campus regulations.' },
            { text: 'BataMart may remove any listing without notice if it violates these terms or is inappropriate for a campus marketplace.' },
            { text: 'Selling items under false descriptions or misrepresenting condition — listing a used item as new, for example — is strictly prohibited and may result in account suspension.' },
          ]}
        />
        <LegalNote tone="warn" title="This one is not negotiable">
          Misrepresenting condition is the fastest route to a suspended seller
          account, because it is the thing that costs every other seller on the
          platform their credibility.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'listings',
    title: 'Listings and pricing',
    body: (
      <LegalList
        items={[
          { text: 'All listings must include accurate photos, honest descriptions and a fair market price.' },
          { text: 'Prices must be in Nigerian Naira (₦). Price manipulation and price gouging are not permitted.' },
          { text: 'BataMart may flag or remove listings that appear fraudulent, spam, or artificially inflated.' },
          { text: 'Listing on BataMart is completely free — no listing fees are charged.' },
          { text: 'Editing a listing’s name, photos, description or price sends it back for review. It is hidden from the marketplace until it is approved again. Changing stock, pausing it or updating the ready time does not need a new review.' },
        ]}
      />
    ),
  },
  {
    id: 'payments',
    title: 'Payments and escrow',
    summary:
      'Funds are held until the buyer confirms delivery and the 48-hour dispute window passes. This is the core of the seller agreement.',
    body: (
      <LegalList
        items={[
          { text: "All payments are processed through BataMart's secure escrow system. The buyer's money is held while the order is collected, delivered and confirmed." },
          { text: 'You are paid into your BataMart wallet 48 hours after the buyer confirms delivery, if no dispute has been opened in that time. It is not paid when the order is placed.' },
          { text: "In the event of a dispute, funds remain in escrow until the dispute is resolved by BataMart's support team." },
          { text: 'BataMart charges a 5% commission on the product price of each completed order. The delivery fee is paid by the buyer and is not taken from you.' },
          { text: 'If an order is cancelled before pickup, for example because the product is not available, the buyer is refunded and the money held for you is released back.' },
        ]}
      />
    ),
  },
  {
    id: 'withdrawals',
    title: 'Withdrawals and security',
    body: (
      <LegalList
        items={[
          { text: 'All withdrawal requests from your BataMart wallet require your configured security checks, such as a withdrawal PIN and account validation. The minimum withdrawal is ₦2,000.' },
          { text: 'You are responsible for keeping your account credentials and payout details accurate and confidential.' },
          { text: 'BataMart may temporarily hold or review withdrawal requests flagged by our risk and security systems.' },
          { text: 'If a withdrawal fails repeatedly, contact support for manual review and resolution.' },
        ]}
      />
    ),
  },
  {
    id: 'fulfilment',
    title: 'Order fulfilment and delivery',
    body: (
      <LegalList
        items={[
          { text: 'Set an honest ready time on every listing, from 1 to 30 days. BataMart staff may phone you after an order to confirm when it will be ready.' },
          { text: 'Deliveries run on Wednesdays and Saturdays. Riders collect from you on the delivery day, which is the first Wednesday or Saturday after your item is ready.' },
          { text: "BataMart's rider network handles logistics. You must cooperate with riders and keep accurate pickup location details in your profile." },
          { text: "You see the buyer's username, not their name, phone number or address. Wrap each parcel well and write the buyer's @username and the order code on it." },
          { text: 'When the rider collects the parcel, tap Mark picked up on the order. Riders cannot mark it picked up for you.' },
          { text: 'If a rider arrives and your product is not ready, the order moves to the next delivery day and the buyer is told.' },
          { text: 'Items that are too large to carry safely by motorcycle can be declined by the rider. The buyer is refunded, your listing goes under review and you receive a strike. The first strike is a warning, the second a 3-day suspension, the third a 14-day suspension and the fourth is permanent.' },
          { text: 'Repeated failures to fulfil orders may result in penalties, including temporary or permanent suspension of your seller account.' },
        ]}
      />
    ),
  },
  {
    id: 'disputes',
    title: 'Disputes and returns',
    body: (
      <LegalList
        items={[
          { text: 'Buyers may raise a dispute within 48 hours of delivery if a product does not match its listing description.' },
          { text: "BataMart's support team reviews all disputes fairly, considering evidence from both parties." },
          { text: "If a dispute is resolved in the buyer's favour, the funds are refunded from escrow and the seller bears the cost." },
          { text: 'Sellers found to have acted in bad faith — knowingly shipping wrong or damaged items — may face account suspension and forfeiture of escrow funds.' },
        ]}
      />
    ),
  },
  {
    id: 'ratings',
    title: 'Ratings and reviews',
    body: (
      <LegalList
        items={[
          { text: 'Buyers may leave honest ratings and reviews after each completed transaction.' },
          { text: 'Attempting to manipulate your ratings — including creating fake buyer accounts or coercing buyers — is strictly prohibited.' },
          { text: 'BataMart may remove reviews found to be fraudulent, abusive, or in violation of community guidelines.' },
          { text: 'Consistently poor ratings may result in listings being deprioritised, or your seller account being reviewed.' },
        ]}
      />
    ),
  },
  {
    id: 'termination',
    title: 'Account suspension and termination',
    body: (
      <LegalList
        items={[
          { text: 'BataMart may suspend or permanently terminate your seller account for violations of these terms, fraudulent activity, or behaviour harmful to the community.' },
          { text: 'On termination, funds held in escrow for ongoing orders are resolved through the dispute resolution process.' },
          { text: 'Funds in your wallet at the time of a termination for cause may be withheld pending investigation.' },
          { text: 'You may appeal a suspension by contacting BataMart support within 7 days of receiving the notification.' },
        ]}
      />
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <LegalList
        items={[
          { text: 'BataMart may update these Seller Terms at any time. You will be notified by email or in-app notification.' },
          { text: 'Continued use of your seller account after changes take effect constitutes acceptance of the updated terms.' },
          { text: 'If you disagree with any change, you may deactivate your seller account by contacting support.' },
        ]}
      />
    ),
  },
]

export default function SellerTermsPage() {
  return (
    <>
      <PageIntro
        eyebrow="Seller terms · Effective May 2026 · Version 1.1"
        title={['Selling on', 'BataMart']}
        standfirst="Everything you take on when you switch your account to a seller — what you can list, when you get paid, and what happens when an order goes wrong."
        image={`${IMG}/hero-market.webp`}
        imageAlt="A student trader arranging goods for sale"
        meta={[
          { label: 'Listing fees', value: '₦0' },
          { label: 'Payout', value: '48h after delivery' },
          { label: 'Dispute window', value: '48h' },
          { label: 'Appeal window', value: '7 days' },
        ]}
      />

      <CurveDivider from="ink" to="paper" glow />

      <div className="mk-paper">
        <LegalDoc
          sections={SECTIONS}
          aside={
            <div className="border-t border-[rgba(11,11,13,0.13)] pt-6 space-y-4">
              <div>
                <p className="mk-mono opacity-40 mb-3">Not a seller yet?</p>
                <Link
                  href="/become-seller"
                  className="text-sm mk-accent underline underline-offset-4"
                >
                  Become a seller
                </Link>
              </div>
              <div>
                <p className="mk-mono opacity-40 mb-3">General terms</p>
                <Link
                  href="/terms"
                  className="text-sm mk-accent underline underline-offset-4"
                >
                  Terms of service
                </Link>
              </div>
            </div>
          }
        />
      </div>

      <CurveDivider from="paper" to="ink" />

      <section className="mk-ink py-[clamp(4rem,10vw,8rem)]">
        <div className="mk-shell">
          <Reveal>
            <p className="mk-mono opacity-40">Ready when you are</p>
            <h2 className="mk-h2 mt-7 max-w-[16ch]">
              Turn your account into
              <span className="mk-serif mk-accent"> a shop.</span>
            </h2>
            <p className="mk-body mt-7 max-w-[46ch]">
              Listing is free, and there is no fee for keeping something up.
              You are only charged when a sale completes.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-8">
              <MagneticButton href="/become-seller" variant="blue">
                Become a seller
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
              </MagneticButton>
              <Link href="/contact" className="mk-mono opacity-60 hover:opacity-100 transition-opacity">
                Ask support first
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
