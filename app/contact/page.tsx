// app/contact/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Mail, MessageCircle, HelpCircle, Clock, MapPin, Send, CheckCircle, Loader2
} from 'lucide-react'

const CATEGORIES = [
  { value: 'PAYMENT_ISSUE', label: '💳 Payment Issue' },
  { value: 'ORDER_PROBLEM', label: '📦 Order Problem' },
  { value: 'ACCOUNT_ISSUE', label: '👤 Account Issue' },
  { value: 'DISPUTE_HELP', label: '⚖️ Dispute Help' },
  { value: 'SELLER_ISSUE', label: '🛍️ Seller Issue' },
  { value: 'RIDER_ISSUE', label: '🚴 Rider Issue' },
  { value: 'BUG_REPORT', label: '🐛 Bug Report' },
  { value: 'OTHER', label: '💬 Other' },
]

const faqs = [
  {
    question: 'How do I create an account?',
    answer: "Click on \"Join BATAMART\" and fill in your details. You'll receive a verification email to activate your account."
  },
  {
    question: 'Is my payment secure?',
    answer: 'Yes. Payments are processed through secure providers, and BATAMART applies settlement and dispute rules before seller payouts are finalized.'
  },
  {
    question: 'How long does delivery take?',
    answer: 'Delivery time varies by rider availability, seller readiness, and distance. You can monitor order status updates inside your account.'
  },
  {
    question: 'What if I have an issue with my order?',
    answer: 'You can open a dispute within 72 hours of delivery. Our team will review and help resolve the issue fairly.'
  },
  {
    question: 'How do I become a seller?',
    answer: 'From your account, use the Become Seller flow to enable seller access, then start listing products.'
  },
  {
    question: 'Can I become a rider?',
    answer: 'Rider onboarding is currently managed internally by BATAMART admins. Contact support if you want to express interest.'
  },
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

  // Pre-fill for logged-in users
  useEffect(() => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      // Decode JWT payload (no verification needed — just for UX prefill)
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.userId) {
        // Fetch user info
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.user) {
              setForm(f => ({
                ...f,
                name: data.user.name || f.name,
                email: data.user.email || f.email,
              }))
            }
          })
          .catch(() => { })
      }
    } catch { }
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

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <section className="bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-white/20 px-4 py-2 rounded-full mb-6">
            <HelpCircle className="w-5 h-5" />
            <span className="font-semibold">Contact Us</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">We're Here to Help</h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Have questions? Need support? Get in touch with the BATAMART team.
            We're committed to helping you have the best experience.
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Get in Touch</h2>
            <p className="text-gray-600">Choose your preferred way to reach us</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <a href="mailto:support@BATAMART.com"
              className="bg-white p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Email Support</h3>
              <p className="text-gray-600 mb-4">Get help via email</p>
              <div className="flex items-center justify-between">
                <span className="text-BATAMART-primary font-semibold text-lg">support@BATAMART.com</span>
                <span className="text-BATAMART-primary group-hover:translate-x-2 transition-transform duration-300">→</span>
              </div>
            </a>
            <a href="https://wa.me/234XXXXXXXXXX" target="_blank" rel="noopener noreferrer"
              className="bg-white p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <MessageCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">WhatsApp</h3>
              <p className="text-gray-600 mb-4">Chat with us on WhatsApp</p>
              <div className="flex items-center justify-between">
                <span className="text-BATAMART-primary font-semibold text-lg">+234 XXX XXX XXXX</span>
                <span className="text-BATAMART-primary group-hover:translate-x-2 transition-transform duration-300">→</span>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── Contact Form ─────────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Send Us a Message</h2>
            <p className="text-gray-600">Fill in the form below and we'll get back to you within 24–48 hours.</p>
          </div>

          {status === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h3>
              <p className="text-gray-600 mb-6">
                We've received your message and sent a confirmation to <strong>{form.email}</strong>.
                Our team will get back to you within 24–48 hours.
              </p>
              <div className="bg-white border border-green-200 rounded-xl p-4 inline-block mb-6">
                <p className="text-sm text-gray-500 mb-1">Your ticket reference</p>
                <p className="text-2xl font-black text-BATAMART-primary tracking-widest">{ticketRef}</p>
              </div>
              <br />
              <button
                onClick={() => {
                  setStatus('idle')
                  setForm(f => ({ ...f, category: 'OTHER', message: '' }))
                }}
                className="text-BATAMART-primary font-semibold hover:underline"
              >
                Submit another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6 shadow-sm">

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-BATAMART-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-BATAMART-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-BATAMART-primary bg-white"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message *</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe your issue or question in detail..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-BATAMART-primary resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{form.message.length} characters — minimum 10</p>
              </div>

              {status === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-BATAMART-primary hover:bg-BATAMART-dark disabled:opacity-60 text-white py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
              >
                {status === 'loading' ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-5 h-5" /> Send Message</>
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Support Hours */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-BATAMART-light to-white p-8 md:p-12 rounded-3xl border-2 border-BATAMART-primary/20">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-20 h-20 bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-10 h-10 text-white" />
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Support Hours</h3>
                <p className="text-gray-600 text-lg mb-4">Our team is available to help you during these hours:</p>
                <div className="space-y-2 text-gray-700">
                  <p className="font-semibold">📅 Monday – Friday: <span className="text-BATAMART-primary">8:00 AM – 8:00 PM</span></p>
                  <p className="font-semibold">📅 Saturday – Sunday: <span className="text-BATAMART-primary">10:00 AM – 6:00 PM</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-8 h-8 text-purple-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Serving Global University Community</h2>
          <p className="text-xl text-gray-600 mb-8">We deliver across all areas in your CAMPUS</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-600">Quick answers to common questions</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <details key={i} className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow group">
                <summary className="font-bold text-lg text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  <span className="pr-4">{faq.question}</span>
                  <span className="text-BATAMART-primary group-open:rotate-180 transition-transform duration-300">▼</span>
                </summary>
                <p className="mt-4 text-gray-600 leading-relaxed pl-4 border-l-4 border-BATAMART-primary/20">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">Quick Links</h3>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { href: '/marketplace', emoji: '🛍️', title: 'Browse Marketplace', desc: 'Explore products from students' },
              { href: '/sell', emoji: '💰', title: 'Start Selling', desc: 'List your products for free' },
              { href: '/contact', emoji: '🚴', title: 'Rider Interest', desc: 'Contact support for rider opportunities' },
            ].map(l => (
              <Link key={l.href} href={l.href}
                className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all text-center group">
                <div className="text-4xl mb-3">{l.emoji}</div>
                <h4 className="font-bold text-gray-900 mb-2 group-hover:text-BATAMART-primary transition-colors">{l.title}</h4>
                <p className="text-sm text-gray-600">{l.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-gradient-to-br from-BATAMART-primary to-BATAMART-dark text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Still Have Questions?</h2>
          <p className="text-xl mb-8 text-white/90">Don't hesitate to reach out. We're always happy to help students!</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:support@BATAMART.com"
              className="bg-white text-BATAMART-primary hover:bg-gray-100 px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg inline-flex items-center justify-center gap-2">
              <Mail className="w-5 h-5" /> Email Us
            </a>
            <a href="https://wa.me/234XXXXXXXXXX" target="_blank" rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg inline-flex items-center justify-center gap-2">
              <MessageCircle className="w-5 h-5" /> WhatsApp Us
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
