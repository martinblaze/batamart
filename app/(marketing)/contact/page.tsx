'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Check, ChevronDown, Loader2 } from 'lucide-react'

import { MagneticButton } from '@/components/marketing/MagneticButton'
import { CurveDivider } from '@/components/marketing/CurveDivider'
import { Accordion } from '@/components/marketing/Accordion'
import { Reveal } from '@/components/marketing/motion'
import { Eyebrow, PageIntro, Rules, SectionHead } from '@/components/marketing/ui'

const IMG = '/images/marketing'

const CATEGORIES = [
  { value: 'PAYMENT_ISSUE', label: 'Payment issue' },
  { value: 'ORDER_PROBLEM', label: 'Order problem' },
  { value: 'ACCOUNT_ISSUE', label: 'Account issue' },
  { value: 'DISPUTE_HELP', label: 'Dispute help' },
  { value: 'SELLER_ISSUE', label: 'Seller issue' },
  { value: 'RIDER_ISSUE', label: 'Rider issue' },
  { value: 'BUG_REPORT', label: 'Bug report' },
  { value: 'OTHER', label: 'Other' },
]

const CHANNELS = [
  {
    label: 'Email support',
    value: 'support@batamart.com',
    href: 'mailto:support@batamart.com',
    note: 'Answered within 24–48 hours',
  },
  {
    label: 'WhatsApp',
    value: '+234 XXX XXX XXXX',
    href: 'https://wa.me/234XXXXXXXXXX',
    note: 'Fastest during support hours',
    external: true,
  },
]

const FAQS = [
  {
    question: 'How do I create an account?',
    answer:
      'Choose "Join BataMart" and fill in your details. You will receive a verification email to activate the account.',
  },
  {
    question: 'Is my payment secure?',
    answer:
      'Payments are processed through secure providers, and BataMart applies settlement and dispute rules before seller payouts are finalised.',
  },
  {
    question: 'How long does delivery take?',
    answer:
      'Deliveries run every Wednesday and Saturday. Orders placed from Saturday to Tuesday arrive on Wednesday, and orders placed from Wednesday to Friday arrive on Saturday. If a seller needs a few days to get your item ready, it goes out on the first Wednesday or Saturday after that. Checkout and your order page show your delivery day, and you can follow the rider live on a map for the last stretch.',
  },
  {
    question: 'What if I have an issue with my order?',
    answer:
      'The order must be delivered or completed, you must open the dispute within 48 hours, and you must attach at least one evidence image. Support then reviews both parties.',
  },
  {
    question: 'How exactly does referral earning work?',
    answer:
      'You share your referral code or link and your friend signs up with it. For every order of theirs that gets delivered, ₦120 goes into your wallet. There is no limit. One order is one seller, so two items from the same seller pay once and items from different sellers pay separately. The reward is paid when your friend confirms the delivery.',
  },
  {
    question: 'What is my username for?',
    answer:
      'Sellers write your username on your parcel instead of your name and address, so your details stay private. You choose it when you sign up or in your profile settings, and you need one to place an order. It can be 3 to 20 letters and numbers.',
  },
  {
    question: 'How do I become a seller?',
    answer:
      'From your account, use the Become Seller flow to enable seller access, then start listing products.',
  },
  {
    question: 'Can I become a rider?',
    answer:
      'Rider onboarding is currently managed internally by BataMart admins. Contact support if you want to express interest.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
}

const QUICK_LINKS = [
  { href: '/marketplace', title: 'Browse marketplace', desc: 'Explore products from students on your campus' },
  { href: '/sell', title: 'Start selling', desc: 'List your products — free, and with no listing fee' },
  { href: '/terms', title: 'Read the terms', desc: 'Fees, delivery rules and how disputes are handled' },
]

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    category: 'OTHER',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [ticketRef, setTicketRef] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Prefill for signed-in users. The JWT is only decoded here for the user id
  // check — the actual name and email come back from the authenticated call.
  useEffect(() => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (!payload.userId) return

      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.user) {
            setForm((f) => ({
              ...f,
              name: data.user.name || f.name,
              email: data.user.email || f.email,
            }))
          }
        })
        .catch(() => {})
    } catch {}
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to send message. Please try again.')
        setStatus('error')
        return
      }

      setTicketRef(data.ticketRef)
      setStatus('success')
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setStatus('error')
    }
  }

  const tooShort = form.message.trim().length < 10

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PageIntro
        eyebrow="Contact"
        title={['Something wrong?', 'Tell us properly.']}
        standfirst="Payments, orders, disputes, seller and rider questions — every message opens a ticket with a reference you can quote back to us."
        image={`${IMG}/scene-buses.webp`}
        imageAlt="Yellow campus-route buses waiting at a stop"
        meta={[
          { label: 'First response', value: '24–48h' },
          { label: 'Mon – Fri', value: '8am – 8pm' },
          { label: 'Sat – Sun', value: '10am – 6pm' },
          { label: 'Ticket ref', value: 'On send' },
        ]}
      />

      <CurveDivider from="ink" to="paper" glow />

      {/* ═══ CHANNELS ══════════════════════════════════════════════════ */}
      <section className="mk-paper mk-section-tight relative">
        <Rules />
        <div className="mk-shell relative z-10">
          <SectionHead
            index="01"
            eyebrow="Direct lines"
            lines={['Reach a person']}
          />

          <div className="mt-[clamp(2.5rem,5vw,4rem)]">
            {CHANNELS.map((channel, i) => (
              <a
                key={channel.label}
                href={channel.href}
                target={channel.external ? '_blank' : undefined}
                rel={channel.external ? 'noopener noreferrer' : undefined}
                className="mk-row"
              >
                <span className="mk-row__wash" aria-hidden />
                <span className="mk-mono opacity-45">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>
                  <span className="mk-h3 block text-[clamp(1.15rem,2vw,1.8rem)]">
                    {channel.value}
                  </span>
                  <span className="mk-mono opacity-50 mt-2 block">
                    {channel.label} — {channel.note}
                  </span>
                </span>
                <ArrowUpRight className="w-5 h-5 mk-tile__arrow" strokeWidth={1.5} />
              </a>
            ))}
          </div>
        </div>
      </section>

      <CurveDivider from="paper" to="ink" />

      {/* ═══ FORM ══════════════════════════════════════════════════════ */}
      <section className="mk-ink mk-section relative">
        <Rules />
        <div className="mk-shell relative z-10 grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHead
              index="02"
              eyebrow="Open a ticket"
              lines={['Send us', 'the details']}
              body="The more specific you are — order reference, what you expected, what arrived — the faster support can settle it."
            />
          </div>

          <div>
            <AnimatePresence mode="wait">
              {status === 'success' ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="border border-[rgba(240,236,228,0.16)] p-[clamp(1.75rem,4vw,3rem)]"
                >
                  <span className="mk-round w-12 h-12 border border-[#22C55E] flex items-center justify-center">
                    <Check className="w-5 h-5 text-[#22C55E]" strokeWidth={2} />
                  </span>
                  <h3 className="mk-h3 mt-8">Message sent.</h3>
                  <p className="mk-body mt-4 max-w-[46ch]">
                    A confirmation is on its way to <strong className="text-[#F1EDE6]">{form.email}</strong>.
                    Support will come back to you within 24–48 hours.
                  </p>

                  <div className="mt-9 border-t border-[rgba(240,236,228,0.16)] pt-7">
                    <p className="mk-mono opacity-45">Your ticket reference</p>
                    <p className="mk-h2 mk-accent mt-3 tracking-[0.06em]">{ticketRef}</p>
                  </div>

                  <button
                    onClick={() => {
                      setStatus('idle')
                      setForm((f) => ({ ...f, category: 'OTHER', message: '' }))
                    }}
                    className="mk-mono mt-9 inline-flex items-center gap-2 border-b border-current pb-1 hover:text-[#1E90FF] transition-colors"
                  >
                    Send another message
                    <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-11"
                >
                  <div className="grid gap-11 sm:grid-cols-2">
                    <label className="block">
                      <span className="mk-field__label">01 — Full name</span>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Your name"
                        className="mk-input"
                      />
                    </label>
                    <label className="block">
                      <span className="mk-field__label">02 — Email address</span>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="you@example.com"
                        className="mk-input"
                      />
                    </label>
                  </div>

                  <label className="block relative">
                    <span className="mk-field__label">03 — What is this about</span>
                    <select
                      value={form.category}
                      onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="mk-select"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="w-4 h-4 absolute right-0 bottom-4 pointer-events-none opacity-50"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </label>

                  <label className="block">
                    <span className="mk-field__label">04 — Message</span>
                    <textarea
                      required
                      rows={6}
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder="Describe the issue, and include an order reference if you have one."
                      className="mk-textarea"
                    />
                    <span
                      className="mk-mono mk-mono-sm mt-3 block"
                      style={{ opacity: tooShort && form.message.length > 0 ? 1 : 0.4 }}
                    >
                      {form.message.length} characters — minimum 10
                    </span>
                  </label>

                  {status === 'error' && (
                    <motion.p
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-l-2 border-[#EF4444] pl-4 py-2 text-[#EF4444] text-sm"
                    >
                      {errorMsg}
                    </motion.p>
                  )}

                  <div className="flex flex-wrap items-center gap-8 pt-2">
                    <MagneticButton
                      type="submit"
                      variant="blue"
                      disabled={status === 'loading'}
                    >
                      {status === 'loading' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                          Sending
                        </>
                      ) : (
                        <>
                          Send message
                          <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
                        </>
                      )}
                    </MagneticButton>
                    <span className="mk-mono opacity-40 max-w-[24ch]">
                      You will get a ticket reference on send
                    </span>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ═══ HOURS & COVERAGE ══════════════════════════════════════════ */}
      <section className="mk-ink pb-[clamp(4rem,9vw,8rem)]">
        <div className="mk-shell">
          <div className="grid gap-px sm:grid-cols-3 bg-[rgba(240,236,228,0.14)] border border-[rgba(240,236,228,0.14)]">
            {[
              { label: 'Monday – Friday', value: '8:00 — 20:00' },
              { label: 'Saturday – Sunday', value: '10:00 — 18:00' },
              { label: 'Coverage', value: 'Your campus' },
            ].map((entry, i) => (
              <Reveal key={entry.label} delay={i * 0.08} className="mk-ink">
                <div className="p-[clamp(1.5rem,2.6vw,2.5rem)] h-full">
                  <p className="mk-mono opacity-45">{entry.label}</p>
                  <p className="mk-h3 mt-4">{entry.value}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CurveDivider from="ink" to="paper" glow />

      {/* ═══ FAQ ═══════════════════════════════════════════════════════ */}
      <section className="mk-paper mk-section relative">
        <div className="mk-shell grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionHead
              index="03"
              eyebrow="Common questions"
              lines={['Answered', 'already']}
            />
          </div>
          <Accordion items={FAQS} startOpen={0} />
        </div>
      </section>

      {/* ═══ QUICK LINKS ═══════════════════════════════════════════════ */}
      <section className="mk-paper pb-[clamp(5rem,11vw,10rem)]">
        <div className="mk-shell">
          <Eyebrow index="04">Elsewhere</Eyebrow>
          <div className="mt-9 grid gap-x-6 gap-y-10 md:grid-cols-3">
            {QUICK_LINKS.map((link, i) => (
              <Reveal key={link.href} delay={i * 0.08}>
                <Link
                  href={link.href}
                  className="group block border-t border-[rgba(11,11,13,0.13)] pt-7 h-full"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="mk-h3 text-[clamp(1.1rem,1.6vw,1.4rem)] max-w-[15ch]">
                      {link.title}
                    </h3>
                    <ArrowUpRight
                      className="w-5 h-5 flex-none transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1"
                      strokeWidth={1.5}
                    />
                  </div>
                  <p className="mk-body mt-4 text-[0.94rem]">{link.desc}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
