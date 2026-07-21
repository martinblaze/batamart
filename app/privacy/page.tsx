import Link from 'next/link'
import type { Metadata } from 'next'
import { Shield, Eye, Lock, Database, UserCheck, Bell, Calendar, Cookie, AlertTriangle, Baby, FileEdit, Check } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'BATAMART privacy policy: how we collect, use, share, protect, and retain marketplace data.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  const lastUpdated = "January 2026"

  const sections = [
    {
      icon: Database,
      title: "Information We Collect",
      content: [
        {
          subtitle: "Account Information",
          text: "When you create a BATAMART account, we collect details such as your name, email, phone number, and profile information you provide."
        },
        {
          subtitle: "Transaction Data",
          text: "We collect information about your purchases, sales, and delivery details to facilitate transactions and improve our services."
        },
        {
          subtitle: "Usage Information",
          text: "We collect data about how you use BATAMART, including pages visited, products viewed, and interactions with other users."
        }
      ]
    },
    {
      icon: Eye,
      title: "How We Use Your Information",
      content: [
        {
          subtitle: "Service Provision",
          text: "We use your information to operate the marketplace, process transactions, facilitate deliveries, and provide customer support."
        },
        {
          subtitle: "Safety & Security",
          text: "Your data helps us prevent fraud, support dispute handling, secure accounts, and maintain a safer trading environment."
        },
        {
          subtitle: "Communication",
          text: "We use your contact information to send order updates, important notices, and promotional messages (which you can opt out of)."
        },
        {
          subtitle: "Improvement",
          text: "We analyze usage data to improve our platform, develop new features, and enhance user experience."
        }
      ]
    },
    {
      icon: UserCheck,
      title: "Information Sharing",
      content: [
        {
          subtitle: "Between Users",
          text: "When you make a transaction, we share necessary information (name, phone, delivery address) between buyer and seller to complete the order."
        },
        {
          subtitle: "With Riders",
          text: "Delivery riders receive delivery addresses and phone numbers to complete deliveries."
        },
        {
          subtitle: "Service Providers",
          text: "We work with trusted third-party services (payment processors, SMS providers) who help us operate BATAMART. They only access data necessary for their services."
        },
        {
          subtitle: "Legal Requirements",
          text: "We may disclose information if required by law or to protect the rights, property, or safety of BATAMART, our users, or others."
        }
      ]
    },
    {
      icon: Lock,
      title: "Data Security",
      content: [
        {
          subtitle: "Protection Measures",
          text: "We use industry-standard encryption, secure servers, and regular security audits to protect your data from unauthorized access."
        },
        {
          subtitle: "Payment Security",
          text: "All payments are processed through secure, PCI-compliant payment gateways. We never store your full payment card details."
        },
        {
          subtitle: "Access Controls",
          text: "Our team members only have access to user data when necessary for their role, and all access is logged and monitored."
        }
      ]
    },
    {
      icon: Bell,
      title: "Your Rights",
      content: [
        {
          subtitle: "Access & Update",
          text: "You can view and update your personal information anytime through your account settings."
        },
        {
          subtitle: "Data Deletion",
          text: "You can request deletion of your account and personal data by contacting us at support@BATAMART.com. Some data may be retained for legal obligations."
        },
        {
          subtitle: "Opt-Out",
          text: "You can opt out of promotional emails and notifications through your account settings. Transactional messages cannot be disabled."
        },
        {
          subtitle: "Data Portability",
          text: "You can request a copy of your data in a portable format by contacting our support team."
        }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-surface dark:bg-[#000000]">
      {/* Hero Section */}
      <section className="bg-primary text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-white/20 px-4 py-2 rounded-full mb-6">
            <Shield className="w-5 h-5" />
            <span className="font-semibold">Privacy Policy</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold mb-6">
            Your Privacy Matters to Us
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            We're committed to protecting your personal information and being transparent
            about how we collect, use, and share your data.
          </p>
          <p className="text-sm text-white/75 mt-6">
            Last Updated: {lastUpdated}
          </p>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-primary/10 border-l-4 border-primary p-6 rounded-r-xl">
            <p className="text-ink-secondary leading-relaxed">
              <strong className="text-ink">Welcome to BATAMART's Privacy Policy.</strong> This policy explains how
              BATAMART ("we," "us," or "our") collects, uses, shares, and protects your personal information when you
              use our student marketplace platform. By using BATAMART, you agree to the practices described in this policy.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Sections */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-12">
          {sections.map((section, index) => (
            <div key={index} className="bg-white rounded-2xl border border-border shadow-soft hover:shadow-soft transition-shadow duration-300 overflow-hidden">
              <div className="bg-primary/5 p-6 border-b border-border">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <section.icon className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-semibold text-ink">
                    {section.title}
                  </h2>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {section.content.map((item, itemIndex) => (
                  <div key={itemIndex} className="space-y-2">
                    <h3 className="text-lg font-semibold text-ink">
                      {item.subtitle}
                    </h3>
                    <p className="text-ink-secondary leading-relaxed pl-4 border-l-2 border-primary/20">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Data Retention */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-surface p-8 rounded-2xl border border-border">
            <h2 className="text-2xl font-semibold text-ink mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" strokeWidth={1.75} /> Data Retention
            </h2>
            <p className="text-ink-secondary leading-relaxed mb-4">
              We retain your personal information for as long as necessary to provide our services and comply
              with legal obligations. Specifically:
            </p>
            <ul className="space-y-2 text-ink-secondary">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-success mt-1 flex-shrink-0" strokeWidth={2} />
                <span><strong>Active accounts:</strong> Data is retained while your account is active</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-success mt-1 flex-shrink-0" strokeWidth={2} />
                <span><strong>Deleted accounts:</strong> We aim to delete or anonymise most data within a reasonable processing window after approved deletion requests</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-success mt-1 flex-shrink-0" strokeWidth={2} />
                <span><strong>Transaction records:</strong> Retained for 7 years for legal and accounting purposes</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-success mt-1 flex-shrink-0" strokeWidth={2} />
                <span><strong>Dispute records:</strong> Retained as needed for support, fraud prevention, and legal compliance</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Cookies */}
      <section className="py-12 px-4 bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-2xl border border-border shadow-soft">
            <h2 className="text-2xl font-semibold text-ink mb-4 flex items-center gap-2">
              <Cookie className="w-5 h-5 text-primary" strokeWidth={1.75} /> Cookies & Tracking
            </h2>
            <p className="text-ink-secondary leading-relaxed mb-4">
              BATAMART uses cookies and similar technologies to improve your experience, analyze usage, and personalize content.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-surface p-4 rounded-xl">
                <h4 className="font-semibold text-ink mb-2">Essential Cookies</h4>
                <p className="text-sm text-ink-secondary">Required for the platform to function (login, cart, security)</p>
              </div>
              <div className="bg-surface p-4 rounded-xl">
                <h4 className="font-semibold text-ink mb-2">Analytics Cookies</h4>
                <p className="text-sm text-ink-secondary">Help us understand how users interact with BATAMART</p>
              </div>
            </div>
            <p className="text-sm text-ink-secondary mt-4">
              You can manage cookie preferences through your browser settings.
            </p>
          </div>
        </div>
      </section>

      {/* Third-Party Links */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-warning/10 border-l-4 border-warning p-6 rounded-r-xl">
            <h3 className="text-lg font-semibold text-ink mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" strokeWidth={1.75} /> Third-Party Links
            </h3>
            <p className="text-ink-secondary">
              BATAMART may contain links to external websites. We are not responsible for the privacy practices
              of these third-party sites. We encourage you to read their privacy policies.
            </p>
          </div>
        </div>
      </section>

      {/* Children's Privacy */}
      <section className="py-12 px-4 bg-surface">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-2xl border border-border shadow-soft">
            <h2 className="text-2xl font-semibold text-ink mb-4 flex items-center gap-2">
              <Baby className="w-5 h-5 text-primary" strokeWidth={1.75} /> Children's Privacy
            </h2>
            <p className="text-ink-secondary leading-relaxed">
              BATAMART is intended for University students aged 18 and above. We do not knowingly collect
              information from individuals under 18. If we discover we have collected data from someone
              under 18, we will delete it promptly.
            </p>
          </div>
        </div>
      </section>

      {/* Changes to Policy */}
      <section className="py-12 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-primary/5 border-l-4 border-primary p-6 rounded-r-xl">
            <h3 className="text-lg font-semibold text-ink mb-2 flex items-center gap-2">
              <FileEdit className="w-5 h-5 text-primary" strokeWidth={1.75} /> Changes to This Policy
            </h3>
            <p className="text-ink-secondary">
              We may update this Privacy Policy from time to time. When we make significant changes,
              we'll notify you via email or through a notice on the platform. Continued use of BATAMART
              after changes constitutes acceptance of the updated policy.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4 bg-primary text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-semibold mb-4">
            Questions About Your Privacy?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            If you have questions or concerns about this Privacy Policy or how we handle your data,
            we're here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:support@BATAMART.com"
              className="bg-white text-primary hover:bg-surface px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-soft hover:shadow-soft"
            >
              Email: support@BATAMART.com
            </a>
            <Link
              href="/contact"
              className="bg-white/10 hover:bg-white/20 text-white border-2 border-white px-8 py-4 rounded-xl font-semibold text-lg transition-all"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

