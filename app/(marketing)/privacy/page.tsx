import type { Metadata } from 'next'
import Link from 'next/link'

import { CurveDivider } from '@/components/marketing/CurveDivider'
import { LegalDoc, LegalList, LegalNote, type LegalSection } from '@/components/marketing/LegalDoc'
import { MagneticButton } from '@/components/marketing/MagneticButton'
import { PageIntro } from '@/components/marketing/ui'
import { Reveal } from '@/components/marketing/motion'
import { ArrowUpRight } from 'lucide-react'

const IMG = '/images/marketing'
const LAST_UPDATED = 'January 2026'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'BataMart privacy policy: how we collect, use, share, protect and retain marketplace data.',
  alternates: { canonical: '/privacy' },
}

const SECTIONS: LegalSection[] = [
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    summary:
      'Three kinds of information, each collected because the marketplace cannot run without it.',
    body: (
      <LegalList
        items={[
          {
            term: 'Account information',
            text: 'When you create a BataMart account we collect details such as your name, email, phone number and the profile information you choose to provide.',
          },
          {
            term: 'Transaction data',
            text: 'We collect information about your purchases, sales and delivery details in order to carry out transactions and improve the service.',
          },
          {
            term: 'Usage information',
            text: 'We collect data about how you use BataMart, including pages visited, products viewed and interactions with other users.',
          },
        ]}
      />
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'How we use your information',
    body: (
      <LegalList
        items={[
          {
            term: 'Service provision',
            text: 'To operate the marketplace, process transactions, facilitate deliveries and provide customer support.',
          },
          {
            term: 'Safety and security',
            text: 'To prevent fraud, support dispute handling, secure accounts and maintain a safer trading environment.',
          },
          {
            term: 'Communication',
            text: 'To send order updates, important notices and promotional messages — the last of which you can opt out of.',
          },
          {
            term: 'Improvement',
            text: 'To analyse usage, develop new features and improve the experience.',
          },
        ]}
      />
    ),
  },
  {
    id: 'information-sharing',
    title: 'Information sharing',
    summary:
      'A marketplace only works if certain details reach the other side of a transaction. This is the full list of who sees what.',
    body: (
      <LegalList
        items={[
          {
            term: 'Between users',
            text: 'When you make a transaction, we share the information needed to complete the order — name, phone and delivery address — between buyer and seller.',
          },
          {
            term: 'With riders',
            text: 'Delivery riders receive delivery addresses and phone numbers in order to complete deliveries.',
          },
          {
            term: 'Service providers',
            text: 'We work with trusted third parties such as payment processors and SMS providers. They only access the data necessary for their service.',
          },
          {
            term: 'Legal requirements',
            text: 'We may disclose information where required by law, or to protect the rights, property or safety of BataMart, our users or others.',
          },
        ]}
      />
    ),
  },
  {
    id: 'data-security',
    title: 'Data security',
    body: (
      <>
        <LegalList
          items={[
            {
              term: 'Protection measures',
              text: 'We use industry-standard encryption, secure servers and regular security review to protect your data from unauthorised access.',
            },
            {
              term: 'Payment security',
              text: 'Payments are processed through secure, PCI-compliant payment gateways. We never store your full payment card details.',
            },
            {
              term: 'Access controls',
              text: 'Team members can only access user data where it is necessary for their role, and that access is logged and monitored.',
            },
          ]}
        />
        <LegalNote title="Your part in this">
          Keep your password confidential and tell us immediately if you think
          someone else has reached your account. Most account compromises begin
          with a reused password rather than a breach of the platform.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    summary:
      'You can see, correct, export or remove your data. Here is how each of those works in practice.',
    body: (
      <LegalList
        items={[
          {
            term: 'Access and update',
            text: 'You can view and update your personal information at any time through your account settings.',
          },
          {
            term: 'Data deletion',
            text: 'You can request deletion of your account and personal data by contacting support@batamart.com. Some data may be retained where we have a legal obligation to keep it.',
          },
          {
            term: 'Opt out',
            text: 'You can opt out of promotional email and notifications in your account settings. Transactional messages about your own orders cannot be disabled.',
          },
          {
            term: 'Data portability',
            text: 'You can request a copy of your data in a portable format by contacting support.',
          },
        ]}
      />
    ),
  },
  {
    id: 'data-retention',
    title: 'Data retention',
    summary:
      'We keep personal information for as long as it takes to provide the service and meet our legal obligations — no longer.',
    body: (
      <LegalList
        items={[
          { term: 'Active accounts', text: 'Data is retained while your account is active.' },
          {
            term: 'Deleted accounts',
            text: 'We aim to delete or anonymise most data within a reasonable processing window after an approved deletion request.',
          },
          {
            term: 'Transaction records',
            text: 'Retained for 7 years for legal and accounting purposes.',
          },
          {
            term: 'Dispute records',
            text: 'Retained as needed for support, fraud prevention and legal compliance.',
          },
        ]}
      />
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and tracking',
    body: (
      <>
        <p>
          BataMart uses cookies and similar technologies to improve your
          experience, analyse usage and personalise content.
        </p>
        <LegalList
          items={[
            {
              term: 'Essential cookies',
              text: 'Required for the platform to function at all — login, cart and security.',
            },
            {
              term: 'Analytics cookies',
              text: 'Help us understand how people actually use BataMart so we can improve it.',
            },
          ]}
        />
        <p className="mt-5">
          You can manage cookie preferences through your browser settings.
        </p>
      </>
    ),
  },
  {
    id: 'third-party-links',
    title: 'Third-party links',
    body: (
      <>
        <p>
          BataMart may contain links to external websites. We are not
          responsible for the privacy practices of those sites, and we
          encourage you to read their policies before sharing anything with
          them.
        </p>
        <LegalNote tone="warn" title="Worth knowing">
          A link leaving BataMart takes you outside everything described on
          this page. Nothing here applies once you are on someone else&apos;s
          site.
        </LegalNote>
      </>
    ),
  },
  {
    id: 'childrens-privacy',
    title: "Children's privacy",
    body: (
      <p>
        BataMart is intended for university students aged 18 and above. We do
        not knowingly collect information from anyone under 18. If we discover
        that we have collected data from someone under 18, we will delete it
        promptly.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        We may update this Privacy Policy from time to time. When we make
        significant changes we will notify you by email or through a notice on
        the platform. Continued use of BataMart after a change takes effect
        constitutes acceptance of the updated policy.
      </p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <>
      <PageIntro
        eyebrow={`Privacy policy · Last updated ${LAST_UPDATED}`}
        title={['What we know', 'about you, and why']}
        standfirst="A marketplace runs on personal information — an address so a rider can find you, a name so a seller knows who is at the door. This page sets out exactly what we collect, who it reaches and how long we keep it."
        image={`${IMG}/scene-library.webp`}
        imageAlt="A university reading room seen from above"
      />

      <CurveDivider from="ink" to="paper" glow />

      <div className="mk-paper">
        <LegalDoc
          sections={SECTIONS}
          aside={
            <div className="border-t border-[rgba(11,11,13,0.13)] pt-6">
              <p className="mk-mono opacity-40 mb-3">Questions</p>
              <a
                href="mailto:support@batamart.com"
                className="text-sm mk-accent underline underline-offset-4 break-all"
              >
                support@batamart.com
              </a>
            </div>
          }
        />
      </div>

      <CurveDivider from="paper" to="ink" />

      <section className="mk-ink py-[clamp(4rem,10vw,8rem)]">
        <div className="mk-shell">
          <Reveal>
            <p className="mk-mono opacity-40">Still not clear?</p>
            <h2 className="mk-h2 mt-7 max-w-[16ch]">
              Ask us anything about
              <span className="mk-serif mk-accent"> your data.</span>
            </h2>
            <p className="mk-body mt-7 max-w-[46ch]">
              Privacy questions go to the same support queue as everything
              else, and come back with a ticket reference.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-8">
              <MagneticButton href="/contact" variant="blue">
                Contact support
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
              </MagneticButton>
              <Link href="/terms" className="mk-mono opacity-60 hover:opacity-100 transition-opacity">
                Read the terms of service
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
