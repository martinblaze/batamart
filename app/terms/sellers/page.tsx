// app/terms/sellers/page.tsx
import Link from 'next/link'

export const metadata = {
  title: 'Seller Terms & Conditions – BATAMART Marketplace',
  description: 'Terms and conditions for sellers on BATAMART Campus Marketplace',
}

const sections = [
  {
    id: '1',
    title: 'Eligibility',
    icon: '🎓',
    content: [
      'You must be a currently enrolled student, staff member, or affiliated member of a supported campus to sell on BATAMART.',
      'You must be at least 16 years of age or have the consent of a parent or guardian.',
      'Seller access is enabled through your BATAMART account role and may be restricted if your account violates platform policy.',
      'BATAMART reserves the right to revoke seller status if any eligibility requirement is found to be unmet.',
    ],
  },
  {
    id: '2',
    title: 'Permitted & Prohibited Products',
    icon: '📦',
    content: [
      'You may sell physical goods, digital items, and campus-relevant services that comply with university policies and Nigerian law.',
      'Prohibited items include: weapons, alcohol, tobacco, counterfeit goods, stolen property, explicit/adult content, prescription medications, and any item banned by campus regulations.',
      'BATAMART reserves the right to remove any listing without notice if it violates these terms or is deemed inappropriate for the campus marketplace.',
      'Selling items under false descriptions or misrepresenting condition (e.g. listing a used item as new) is strictly prohibited and may result in account suspension.',
    ],
  },
  {
    id: '3',
    title: 'Listings & Pricing',
    icon: '🏷️',
    content: [
      'All listings must include accurate photos, honest descriptions, and a fair market price.',
      'Prices must be in Nigerian Naira (₦). Price manipulation or price gouging is not permitted.',
      'BATAMART reserves the right to flag or remove listings that appear to be fraudulent, spam, or artificially inflated.',
      'Listing on BATAMART is completely free — no listing fees are charged.',
    ],
  },
  {
    id: '4',
    title: 'Payments & Escrow',
    icon: '💳',
    content: [
      "All payments are processed through BATAMART's secure escrow system. Funds are held until the buyer confirms delivery.",
      'You will receive payment into your BATAMART wallet after successful delivery confirmation by the buyer.',
      "In the event of a dispute, funds remain in escrow until the dispute is resolved by BATAMART's support team.",
      'BATAMART may charge a platform fee on transactions. Current fee rates are displayed in your seller dashboard.',
    ],
  },
  {
    id: '5',
    title: 'Withdrawals & Security',
    icon: '🔐',
    content: [
      'All withdrawal requests from your BATAMART wallet require your configured security checks (such as withdrawal PIN and account validation).',
      'You are responsible for keeping your account credentials and payout details accurate and confidential.',
      'BATAMART may temporarily hold or review withdrawal requests flagged by our risk and security systems.',
      'If a withdrawal fails repeatedly, contact support for manual review and resolution.',
    ],
  },
  {
    id: '6',
    title: 'Order Fulfillment & Delivery',
    icon: '🚚',
    content: [
      'You are responsible for ensuring your product is ready for pickup when an order is placed.',
      'Orders must be made available for pickup or delivery within the timeframe stated on your listing.',
      "BATAMART's rider network handles logistics. You must cooperate with riders and provide accurate pickup location details in your profile.",
      'Repeated failures to fulfill orders may result in penalties, including temporary or permanent suspension of your seller account.',
    ],
  },
  {
    id: '7',
    title: 'Disputes & Returns',
    icon: '⚖️',
    content: [
      'Buyers may raise a dispute within 48 hours of delivery if a product does not match its listing description.',
      "BATAMART's support team will review all disputes fairly, considering evidence from both parties.",
      "If a dispute is resolved in the buyer's favour, the funds will be refunded from escrow and the seller will bear the cost.",
      'Sellers found to have acted in bad faith (e.g. knowingly shipping wrong or damaged items) may face account suspension and forfeiture of escrow funds.',
    ],
  },
  {
    id: '8',
    title: 'Ratings & Reviews',
    icon: '⭐',
    content: [
      'Buyers may leave honest ratings and reviews after each completed transaction.',
      'Attempting to manipulate your ratings — including creating fake buyer accounts or coercing buyers — is strictly prohibited.',
      'BATAMART may remove reviews that are found to be fraudulent, abusive, or in violation of community guidelines.',
      'Consistently poor ratings may result in your listings being deprioritised or your seller account being reviewed.',
    ],
  },
  {
    id: '9',
    title: 'Account Suspension & Termination',
    icon: '🚫',
    content: [
      'BATAMART may suspend or permanently terminate your seller account for violations of these terms, fraudulent activity, or behaviour deemed harmful to the community.',
      'Upon termination, any funds held in escrow for ongoing orders will be resolved per the dispute resolution process.',
      'Funds in your BATAMART wallet at the time of termination for cause may be withheld pending investigation.',
      'You may appeal a suspension by contacting BATAMART support within 7 days of receiving the notification.',
    ],
  },
  {
    id: '10',
    title: 'Changes to These Terms',
    icon: '📝',
    content: [
      'BATAMART reserves the right to update these Seller Terms at any time. You will be notified via email or in-app notification.',
      'Continued use of your seller account after changes take effect constitutes acceptance of the updated terms.',
      'If you disagree with any changes, you may deactivate your seller account by contacting support.',
    ],
  },
]

export default function SellerTermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000]">

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/become-seller"
            className="inline-flex items-center text-sm text-gray-500 hover:text-BATAMART-primary transition-colors mb-6"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Become a Seller
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🛍️</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Seller Terms & Conditions</h1>
          <p className="text-gray-500 mt-1 text-sm">
                BATAMART Campus Marketplace &nbsp;·&nbsp; Effective: May 2026 &nbsp;·&nbsp; Version 1.1
          </p>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-blue-900 text-sm leading-relaxed">
              By registering as a seller on BATAMART, you agree to abide by these terms in addition to our general{' '}
              <Link href="/terms" className="font-semibold underline underline-offset-2 hover:text-blue-700">
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-semibold underline underline-offset-2 hover:text-blue-700">
                Privacy Policy
              </Link>
              . Please read carefully before proceeding.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Table of Contents */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Contents</h2>
          <div className="grid sm:grid-cols-2 gap-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#section-${s.id}`}
                className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-BATAMART-primary py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span>{s.icon}</span>
                <span>{s.id}. {s.title}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-5">
          {sections.map((section) => (
            <div
              key={section.id}
              id={`section-${section.id}`}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden scroll-mt-6"
            >
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/70">
                <span className="text-xl">{section.icon}</span>
                <h2 className="font-bold text-gray-900 text-base">
                  <span className="text-gray-400 font-normal mr-1.5">{section.id}.</span>
                  {section.title}
                </h2>
              </div>
              <ul className="px-6 py-5 space-y-3">
                {section.content.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700 leading-relaxed">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-BATAMART-primary flex-shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-10 bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            By clicking{' '}
            <strong className="text-gray-700">"Become a Seller"</strong>{' '}
            on the previous page, you confirm that you have read, understood, and agree to these Seller Terms & Conditions.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/become-seller"
              className="inline-flex items-center justify-center gap-2 bg-BATAMART-primary hover:bg-BATAMART-dark text-white px-8 py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              ✅ I Agree — Become a Seller
            </Link>
            <Link
              href="/marketplace"
              className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-8 py-3 rounded-xl font-semibold text-sm transition-colors"
            >
              Back to Marketplace
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-8">
          Questions? Contact us at{' '}
          <a href="mailto:support@BATAMART.com" className="hover:text-BATAMART-primary underline">
            support@BATAMART.com
          </a>
        </p>

      </div>
    </div>
  )
}

