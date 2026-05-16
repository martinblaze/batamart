import Link from 'next/link'
import type { Metadata } from 'next'
import { FileText, AlertCircle, CheckCircle, XCircle, Scale, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Read BATAMART terms covering orders, delivery, disputes, referrals, user responsibilities, and platform policies.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  const lastUpdated = "January 2026"

  const sections = [
    {
      icon: CheckCircle,
      title: "Acceptance of Terms",
      content: "By accessing or using BATAMART, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this platform."
    },
    {
      icon: ShieldCheck,
      title: "Eligibility",
      content: "BATAMART is designed for campus commerce users. You must be at least 16 years old to use this platform and provide accurate account and profile information."
    }
  ]

  const userResponsibilities = [
    {
      title: "Account Security",
      items: [
        "Keep your password secure and confidential",
        "Notify us immediately of any unauthorized account access",
        "You are responsible for all activities under your account",
        "Do not share your account with others"
      ]
    },
    {
      title: "Prohibited Activities",
      items: [
        "Selling counterfeit, illegal, or prohibited items",
        "Posting false or misleading product information",
        "Harassing, threatening, or defrauding other users",
        "Attempting to manipulate ratings or reviews",
        "Using BATAMART for any illegal purposes",
        "Creating multiple accounts to bypass restrictions"
      ]
    },
    {
      title: "Product Listings",
      items: [
        "Provide accurate descriptions and images",
        "Set fair and honest prices",
        "Honor your listed prices and availability",
        "Respond promptly to buyer inquiries",
        "Ship items as described within agreed timeframes"
      ]
    },
    {
      title: "Buying Obligations",
      items: [
        "Pay for items promptly after purchase",
        "Provide accurate delivery information",
        "Inspect items upon delivery",
        "Report issues within 72 hours of delivery",
        "Treat sellers and riders with respect"
      ]
    }
  ]

  const platformPolicies = [
    {
      title: "Payment & Escrow",
      points: [
        "All payments are processed through secure payment gateways",
        "Seller settlement follows BATAMART order completion and dispute rules",
        "Sellers do not receive immediate payout at checkout",
        "Refunds are processed according to our dispute resolution policy",
        "BATAMART charges a 5% commission on completed sales"
      ]
    },
    {
      title: "Delivery & Shipping",
      points: [
        "Delivery may be facilitated through BATAMART rider flows where available",
        "Standard delivery fee is ₦800 per order",
        "Delivery timing depends on rider availability, distance, and seller readiness",
        "Sellers must package items securely",
        "Buyers must be available to receive deliveries"
      ]
    },
    {
      title: "Reviews & Ratings",
      points: [
        "Only verified buyers can leave product reviews",
        "Reviews must be honest and based on actual experience",
        "Fake or paid reviews are prohibited",
        "Offensive or inappropriate reviews will be removed",
        "Sellers cannot remove negative but legitimate reviews"
      ]
    }
  ]

  const disputeFlow = [
    "Buyer can open a dispute only after order is DELIVERED or COMPLETED.",
    "Dispute must be opened within 72 hours of delivery/completion timestamp.",
    "At least one evidence image is required when submitting a dispute.",
    "When dispute opens, order status is marked DISPUTED and support reviews both sides.",
    "If no dispute is raised in the 72-hour window, seller escrow can be released by the platform flow."
  ]

  const referralFlow = [
    "Each user gets a personal referral code/link from their BATAMART account.",
    "Referral reward is tied to completed eligible delivery orders from referred users.",
    "Current reward logic pays from delivery economics (shown in-app as ₦120 per eligible referral delivery).",
    "Rewards are credited to wallet balance and appear in referral/wallet history."
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000]">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-white/20 px-4 py-2 rounded-full mb-6">
            <FileText className="w-5 h-5" />
            <span className="font-semibold">Terms of Service</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Terms & Conditions
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Please read these terms carefully before using BATAMART. They outline your rights and
            responsibilities as a member of our community.
          </p>
          <p className="text-sm text-white/75 mt-6">
            Last Updated: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Dispute Flow */}
      <section className="py-12 px-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Dispute Flow (How It Works)</h2>
            <ul className="space-y-2">
              {disputeFlow.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-BATAMART-primary font-bold mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Referral Flow */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Referral Flow (How It Works)</h2>
            <ul className="space-y-2">
              {referralFlow.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700">
                  <span className="text-BATAMART-primary font-bold mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-xl">
            <h2 className="text-xl font-bold text-blue-900 mb-3">
              📋 Agreement to Terms
            </h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms of Service ("Terms") govern your use of BATAMART, the student-to-student
              marketplace platform for University students. By creating
              an account or using our services, you enter into a legally binding agreement with us.
            </p>
          </div>
        </div>
      </section>

      {/* Main Sections */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          {sections.map((section, index) => (
            <div key={index} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-BATAMART-light to-white p-6 border-b border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark rounded-xl flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {section.title}
                  </h2>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-700 leading-relaxed">
                  {section.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* User Responsibilities */}
      <section className="py-12 px-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Your Responsibilities
            </h2>
            <p className="text-gray-600">
              As a BATAMART user, you agree to the following obligations
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {userResponsibilities.map((section, index) => (
              <div key={index} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-BATAMART-primary" />
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2 text-gray-700">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Policies */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Platform Policies
            </h2>
            <p className="text-gray-600">
              Key policies governing how BATAMART operates
            </p>
          </div>

          <div className="space-y-6">
            {platformPolicies.map((policy, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {policy.title}
                </h3>
                <ul className="space-y-2">
                  {policy.points.map((point, pointIndex) => (
                    <li key={pointIndex} className="flex items-start gap-2 text-gray-700">
                      <span className="text-BATAMART-primary font-bold mt-1">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Account Termination */}
      <section className="py-12 px-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-red-200 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <XCircle className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                Account Suspension & Termination
              </h2>
            </div>
            <div className="space-y-4 text-gray-700">
              <p>
                BATAMART reserves the right to suspend or terminate accounts that violate these Terms.
                Violations include but are not limited to:
              </p>
              <ul className="space-y-2 pl-6">
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>Selling prohibited or illegal items</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>Fraudulent activities or scamming other users</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>Harassment or abusive behavior toward others</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>Multiple violations of platform policies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  <span>Attempting to circumvent platform fees or rules</span>
                </li>
              </ul>
              <p className="font-semibold">
                Suspended accounts may have temporary limits while reviews are ongoing, including payout restrictions where applicable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Intellectual Property */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-purple-50 border-l-4 border-purple-500 p-6 rounded-r-xl">
            <h3 className="text-xl font-bold text-purple-900 mb-3">
              📝 Intellectual Property
            </h3>
            <div className="text-gray-700 space-y-2">
              <p>
                All content on BATAMART, including the logo, design, text, graphics, and software, is owned by
                BATAMART or its licensors and protected by copyright and trademark laws.
              </p>
              <p>
                You retain ownership of content you upload (product listings, photos, descriptions) but
                grant BATAMART a license to use this content to operate and promote the platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Limitation of Liability */}
      <section className="py-12 px-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-xl">
            <h3 className="text-xl font-bold text-yellow-900 mb-3">
              ⚠️ Limitation of Liability
            </h3>
            <div className="text-gray-700 space-y-2">
              <p>
                BATAMART provides a platform for students to trade but does not guarantee the quality, safety,
                or legality of items listed. We are not responsible for:
              </p>
              <ul className="pl-6 space-y-1">
                <li>• Quality or condition of products sold</li>
                <li>• Accuracy of seller descriptions</li>
                <li>• Actions or conduct of users</li>
                <li>• Lost or stolen items during delivery</li>
                <li>• Service interruptions or technical issues</li>
              </ul>
              <p className="font-semibold mt-4">
                BATAMART's total liability is limited to the amount of fees paid to us in the past 12 months.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Changes to Terms */}
      <section className="py-12 px-4 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📢 Changes to These Terms
            </h2>
            <p className="text-gray-700 leading-relaxed">
              We may modify these Terms at any time. We will notify users of significant changes via
              email or platform notification. Continued use of BATAMART after changes constitutes acceptance
              of the revised Terms. If you do not agree to the changes, you must stop using the platform.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Questions About These Terms?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            If you have any questions or concerns about these Terms of Service, please contact us.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:support@BATAMART.com"
              className="bg-white text-BATAMART-primary hover:bg-gray-100 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl"
            >
              Email: support@BATAMART.com
            </a>
            <Link
              href="/contact"
              className="bg-BATAMART-dark/50 hover:bg-BATAMART-dark text-white border-2 border-white px-8 py-4 rounded-xl font-bold text-lg transition-all"
            >
              Contact Support
            </Link>
          </div>
          <p className="text-sm text-white/75 mt-8">
            By using BATAMART, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </section>
    </div>
  )
}

