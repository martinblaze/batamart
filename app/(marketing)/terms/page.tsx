import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { CurveDivider } from '@/components/marketing/CurveDivider'
import { LegalDoc, LegalList, LegalNote, type LegalSection } from '@/components/marketing/LegalDoc'
import { MagneticButton } from '@/components/marketing/MagneticButton'
import { PageIntro } from '@/components/marketing/ui'
import { Reveal } from '@/components/marketing/motion'

const IMG = '/images/marketing'
const LAST_UPDATED = 'October 2026'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'BataMart terms covering orders, delivery, disputes, referrals, user responsibilities and platform policies.',
  alternates: { canonical: '/terms' },
}

const SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement to these terms',
    summary:
      'These Terms govern your use of BataMart. Creating an account enters you into a binding agreement with us.',
    body: (
      <>
        <p>
          By accessing or using BataMart you agree to be bound by these Terms of
          Service and all applicable laws and regulations. If you do not agree
          with any part of them, you are not permitted to use the platform.
        </p>
        <p>
          These Terms cover the student-to-student marketplace, the payment and
          settlement flow that sits behind it, and the delivery and dispute
          processes attached to an order.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    title: 'Eligibility',
    body: (
      <p>
        BataMart is built for the Awka campus community. You must be at least 16
        years old to use the platform, and you must provide accurate account and
        profile information. Signing up includes a one-time check that your
        device is in Awka.
      </p>
    ),
  },
  {
    id: 'usernames',
    title: 'Usernames',
    summary:
      'Your username is how sellers recognise your parcel without ever seeing your name, phone or address.',
    body: (
      <LegalList
        items={[
          { text: 'You choose a username when you sign up, or later in your profile settings. It must be 3 to 20 letters and numbers, with no spaces or symbols.' },
          { text: 'Each username belongs to one person. Once someone has taken it, nobody else can use it.' },
          { text: 'You need a username to place an order. If you do not have one yet, checkout asks you to set one first.' },
          { text: 'Sellers see your username on your orders and write it on your parcel. They do not see your name, phone number or delivery address.' },
          { text: 'You cannot change your username while you have an order in progress. Impersonating someone, or choosing a name meant to mislead or offend, is not allowed and may lead to the name being removed.' },
        ]}
      />
    ),
  },
  {
    id: 'responsibilities',
    title: 'Your responsibilities',
    summary:
      'What you take on as a member of the marketplace — as an account holder, a seller and a buyer.',
    body: (
      <>
        <p className="font-medium text-[#0B0B0D]">Account security</p>
        <LegalList
          items={[
            { text: 'Keep your password secure and confidential.' },
            { text: 'Notify us immediately of any unauthorised access to your account.' },
            { text: 'You are responsible for all activity carried out under your account.' },
            { text: 'Do not share your account with anyone else.' },
          ]}
        />

        <p className="font-medium text-[#0B0B0D] mt-9">Prohibited activities</p>
        <LegalList
          items={[
            { text: 'Selling counterfeit, illegal or otherwise prohibited items.' },
            { text: 'Posting false or misleading product information.' },
            { text: 'Harassing, threatening or defrauding other users.' },
            { text: 'Attempting to manipulate ratings or reviews.' },
            { text: 'Using BataMart for any illegal purpose.' },
            { text: 'Creating multiple accounts to bypass restrictions.' },
          ]}
        />

        <p className="font-medium text-[#0B0B0D] mt-9">Product listings</p>
        <LegalList
          items={[
            { text: 'Provide accurate descriptions and images.' },
            { text: 'Set fair and honest prices.' },
            { text: 'Honour your listed prices and availability.' },
            { text: 'Respond promptly to buyer enquiries.' },
            { text: 'Ship items as described, within the agreed timeframes.' },
          ]}
        />

        <p className="font-medium text-[#0B0B0D] mt-9">Buying obligations</p>
        <LegalList
          items={[
            { text: 'Pay for items promptly after purchase.' },
            { text: 'Provide accurate delivery information.' },
            { text: 'Inspect items on delivery.' },
            { text: 'Report issues within 48 hours of delivery.' },
            { text: 'Treat sellers and riders with respect.' },
          ]}
        />
      </>
    ),
  },
  {
    id: 'payment',
    title: 'Payment and settlement',
    summary:
      'The money does not go straight to the seller. This is what happens to it between checkout and payout.',
    body: (
      <>
        <LegalList
          items={[
            { text: 'You can pay by card or bank transfer through secure payment gateways, or from your BataMart wallet balance.' },
            { text: 'Your payment is held in escrow. The rider and any referral reward are paid when you confirm delivery. The seller is paid 48 hours after you confirm, if no dispute has been opened.' },
            { text: 'Sellers do not receive an immediate payout at checkout.' },
            { text: 'If an order is cancelled, for example because the product is not available, the full amount is refunded to your BataMart wallet. You can spend it on any order or withdraw it. Other refunds follow our dispute resolution policy.' },
            { text: 'You can top up your wallet at any time and use it to pay for orders. Withdrawals need your wallet PIN, and the minimum withdrawal is ₦2,000.' },
            { text: 'BataMart charges a 5% commission on the product price of completed sales. The delivery fee is paid by the buyer and is not taken from the seller.' },
          ]}
        />
        <LegalNote title="Why settlement waits">
          Holding settlement until the order completes and the dispute window
          closes is what makes it safe to buy from someone you have never met.
          It is the single rule the rest of the marketplace depends on.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'delivery',
    title: 'Delivery and shipping',
    body: (
      <LegalList
        items={[
          { text: 'Deliveries run twice a week, on Wednesdays and Saturdays. Orders placed from Saturday to Tuesday are delivered on Wednesday. Orders placed from Wednesday to Friday are delivered on Saturday.' },
          { text: 'If a seller needs days to get an item ready, it is delivered on the first Wednesday or Saturday after it is ready. Checkout and your order page show your delivery day.' },
          { text: 'The delivery fee is a flat ₦1,200 per order, the same for every location. One order is one seller, so a cart with items from two sellers has two deliveries and two fees.' },
          { text: 'Riders collect from sellers and bring parcels to the BataMart sorting hub. Parcels are checked and packed by area, then a rider takes them to your door. You can follow your rider live on a map for that last stretch.' },
          { text: 'You confirm delivery yourself by tapping Mark delivered. A rider cannot mark an order delivered for you, and the rider is paid when you confirm.' },
          { text: 'If a product is not ready when the rider arrives, the order moves to the next delivery day and you are told.' },
          { text: 'If a rider finds an item too large to carry safely by motorcycle, the product amount is refunded to your wallet. The delivery fee is not refunded.' },
          { text: 'Sellers must package items securely. Buyers must be available to receive deliveries.' },
        ]}
      />
    ),
  },
  {
    id: 'disputes',
    title: 'Disputes — how it works',
    summary:
      'The dispute flow has hard conditions. Meeting them is what lets support act on your behalf.',
    body: (
      <LegalList
        items={[
          { text: 'A buyer can open a dispute only after an order is DELIVERED or COMPLETED.' },
          { text: 'The dispute must be opened within 48 hours of the delivery or completion timestamp.' },
          { text: 'At least one evidence image is required when submitting a dispute.' },
          { text: 'When a dispute opens, the order is marked DISPUTED and support reviews both sides.' },
          { text: 'If no dispute is raised inside the 48-hour window, seller settlement can be released by the platform flow.' },
        ]}
      />
    ),
  },
  {
    id: 'referrals',
    title: 'Referrals — how it works',
    body: (
      <LegalList
        items={[
          { text: 'Every user has a personal referral code and link on their Referrals page. There is nothing to apply for.' },
          { text: 'You earn ₦120 for every order your referred friends get delivered. One order is one seller, so two items from the same seller pay once, and items from different sellers pay separately.' },
          { text: 'There is no cap on how much you can earn from referrals.' },
          { text: 'The reward is credited to your wallet when your friend confirms delivery, and appears in your referral and wallet history. Orders that are cancelled or refunded do not pay a reward.' },
          { text: 'Referring yourself, or creating fake or duplicate accounts, is not allowed and forfeits any reward.' },
        ]}
      />
    ),
  },
  {
    id: 'field-marketers',
    title: 'Field marketers',
    summary:
      'A separate programme for people who bring new students onto BataMart.',
    body: (
      <LegalList
        items={[
          { text: 'Field marketers is open to signed-in users who join from its private page. It is separate from the referral programme above.' },
          { text: 'Each field marketer gets their own signup link. You earn ₦100 for every new account that signs up through it.' },
          { text: 'These earnings are kept in a separate marketing wallet, apart from your main balance. A minimum applies before you can withdraw them, and it is shown when you withdraw.' },
          { text: 'A leaderboard shows the top field marketers, and the top performers may receive gifts at BataMart’s discretion.' },
          { text: 'Fake or duplicate signups, signups from outside Awka and signing yourself up are not paid, and can lead to your removal from the programme.' },
          { text: 'A new user who joins through a field marketer link can also have their own referral code applied. The referral reward on their orders is paid to their referrer, and the ₦100 signup payment is paid to the field marketer.' },
        ]}
      />
    ),
  },
  {
    id: 'reviews',
    title: 'Reviews and ratings',
    body: (
      <LegalList
        items={[
          { text: 'Only verified buyers can leave product reviews.' },
          { text: 'Reviews must be honest and based on an actual experience.' },
          { text: 'Fake or paid reviews are prohibited.' },
          { text: 'Offensive or inappropriate reviews will be removed.' },
          { text: 'Sellers cannot remove negative reviews that are legitimate.' },
        ]}
      />
    ),
  },
  {
    id: 'suspension',
    title: 'Account suspension and termination',
    summary:
      'BataMart may suspend or terminate accounts that violate these Terms.',
    body: (
      <>
        <p>Violations include, but are not limited to:</p>
        <LegalList
          items={[
            { text: 'Selling prohibited or illegal items.' },
            { text: 'Fraudulent activity or scamming other users.' },
            { text: 'Harassment or abusive behaviour toward others.' },
            { text: 'Multiple violations of platform policies.' },
            { text: 'Attempting to circumvent platform fees or rules.' },
          ]}
        />
        <p className="mt-6">
          <strong>
            Suspended accounts may face temporary limits while a review is
            ongoing, including payout restrictions where applicable.
          </strong>
        </p>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual property',
    body: (
      <>
        <p>
          All content on BataMart — including the logo, design, text, graphics
          and software — is owned by BataMart or its licensors, and is protected
          by copyright and trademark law.
        </p>
        <p>
          You retain ownership of the content you upload, such as product
          listings, photos and descriptions, but you grant BataMart a licence to
          use that content to operate and promote the platform.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    summary:
      'BataMart provides the platform. It does not manufacture, inspect or warrant the items sold on it.',
    body: (
      <>
        <p>
          BataMart provides a platform for students to trade, but does not
          guarantee the quality, safety or legality of items listed. We are not
          responsible for:
        </p>
        <LegalList
          items={[
            { text: 'The quality or condition of products sold.' },
            { text: 'The accuracy of seller descriptions.' },
            { text: 'The actions or conduct of users.' },
            { text: 'Items lost or stolen during delivery.' },
            { text: 'Service interruptions or technical issues.' },
          ]}
        />
        <LegalNote tone="warn" title="Liability cap">
          BataMart&apos;s total liability is limited to the amount of fees paid
          to us in the past 12 months.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may modify these Terms at any time, and will notify users of
        significant changes by email or platform notification. Continued use of
        BataMart after a change constitutes acceptance of the revised Terms. If
        you do not agree to a change, you must stop using the platform.
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <>
      <PageIntro
        eyebrow={`Terms of service · Last updated ${LAST_UPDATED}`}
        title={['The rules the', 'marketplace runs on']}
        standfirst="What you agree to as a buyer, a seller and an account holder — including what happens to a payment between checkout and payout, and the exact conditions for opening a dispute."
        image={`${IMG}/scene-pottery.webp`}
        imageAlt="A market trader behind a stall of stacked goods"
        meta={[
          { label: 'Dispute window', value: '48h' },
          { label: 'Delivery fee', value: '₦1,200' },
          { label: 'Commission', value: '5%' },
          { label: 'Minimum age', value: '16' },
        ]}
      />

      <CurveDivider from="ink" to="paper" glow />

      <div className="mk-paper">
        <LegalDoc
          sections={SECTIONS}
          aside={
            <div className="border-t border-[rgba(11,11,13,0.13)] pt-6 space-y-4">
              <div>
                <p className="mk-mono opacity-40 mb-3">Selling on BataMart?</p>
                <Link
                  href="/terms/sellers"
                  className="text-sm mk-accent underline underline-offset-4"
                >
                  Read the seller terms
                </Link>
              </div>
              <div>
                <p className="mk-mono opacity-40 mb-3">Your data</p>
                <Link
                  href="/privacy"
                  className="text-sm mk-accent underline underline-offset-4"
                >
                  Privacy policy
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
            <p className="mk-mono opacity-40">Acknowledgement</p>
            <h2 className="mk-h2 mt-7 max-w-[18ch]">
              By using BataMart you accept
              <span className="mk-serif mk-accent"> all of the above.</span>
            </h2>
            <p className="mk-body mt-7 max-w-[48ch]">
              If any part of these Terms is unclear, ask before you rely on it.
              Support will answer in writing with a ticket reference.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-8">
              <MagneticButton href="/contact" variant="blue">
                Contact support
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
              </MagneticButton>
              <Link href="/terms/sellers" className="mk-mono opacity-60 hover:opacity-100 transition-opacity">
                Seller terms &amp; conditions
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
