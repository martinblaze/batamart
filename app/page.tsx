'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ShoppingBag, ShieldCheck, Truck, Search, Users, Package, Star,
  Shirt, UtensilsCrossed, Home, Backpack, Headphones, ChessQueen, Cookie, BookOpen,
  ArrowRight,
} from 'lucide-react'
import { Logo } from '@/components/layout/Logo'

const categories = [
  { name: 'Fashion & clothing', icon: Shirt, count: '3.1K items' },
  { name: 'Food services', icon: UtensilsCrossed, count: '1.2K items' },
  { name: 'Room essentials', icon: Home, count: '950 items' },
  { name: 'School supplies', icon: Backpack, count: '740 items' },
  { name: 'Tech gadgets', icon: Headphones, count: '680 items' },
  { name: 'Cosmetics', icon: ChessQueen, count: '520 items' },
  { name: 'Snacks', icon: Cookie, count: '890 items' },
  { name: 'Books', icon: BookOpen, count: '650 items' },
]

const steps = [
  { num: '01', title: 'Browse & buy', desc: 'Explore products from campus sellers across different categories.', icon: Search },
  { num: '02', title: 'Protected payments', desc: 'Payments run through secure providers, with seller settlement tied to order and dispute milestones.', icon: ShieldCheck },
  { num: '03', title: 'Delivery flow', desc: 'Orders can be fulfilled through the BataMart rider workflow where available.', icon: Truck },
]

const stats = [
  { value: '2,000+', label: 'Active users', sub: 'Students trading daily', icon: Users },
  { value: '5,000+', label: 'Products listed', sub: 'Across all categories', icon: Package },
  { value: '98%', label: 'Positive experience rate', sub: 'Based on platform review trends', icon: Star },
]

const locations = ['Main hostel block', 'Engineering faculty', 'Sciences complex', 'Law faculty', 'Student union bldg', 'Library', 'Sports complex', 'Admin block']

const footerColumns = [
  { label: 'Product', links: [{ name: 'Marketplace', href: '/marketplace' }, { name: 'Sell on BataMart', href: '/sell' }] },
  { label: 'Company', links: [{ name: 'About', href: '/about' }, { name: 'Contact', href: '/contact' }] },
  { label: 'Legal', links: [{ name: 'Privacy policy', href: '/privacy' }, { name: 'Terms of use', href: '/terms' }] },
]

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const syncAuthState = () => setIsLoggedIn(Boolean(localStorage.getItem('token')))
    syncAuthState()
    window.addEventListener('storage', syncAuthState)
    window.addEventListener('auth-change', syncAuthState)
    return () => {
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener('auth-change', syncAuthState)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* ── Minimal top bar (home is outside the shared shell) ── */}
      <header className="border-b border-border">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo size={32} />
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/marketplace" className="h-11 px-5 flex items-center justify-center rounded-lg bg-primary text-white font-medium text-sm hover:brightness-95 transition-all">
                Go to marketplace
              </Link>
            ) : (
              <>
                <Link href="/login" className="h-11 px-4 flex items-center justify-center font-medium text-sm text-ink hover:text-primary transition-colors">
                  Log in
                </Link>
                <Link href="/signup" className="h-11 px-5 flex items-center justify-center rounded-lg bg-primary text-white font-medium text-sm hover:brightness-95 transition-all">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 md:py-24 bg-surface">
        <div className="max-w-[1280px] mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-border px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-xs font-medium text-ink-secondary tracking-wide uppercase">Campus marketplace</span>
          </div>

          <h1 className="text-[40px] md:text-[56px] leading-[1.1] tracking-tight font-semibold text-ink mb-5">
            Buy, sell, and deliver — <span className="text-primary">on campus.</span>
          </h1>

          <p className="text-ink-secondary text-[15px] md:text-lg max-w-lg mx-auto leading-relaxed mb-8">
            The straightforward way for campus students to trade — secure checkout,
            structured order flow, and built-in support tools.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-14">
            {isLoggedIn ? (
              <Link href="/marketplace" className="w-full sm:w-auto h-11 px-8 flex items-center justify-center gap-2 rounded-lg bg-primary text-white font-medium text-[15px] hover:brightness-95 transition-all">
                View marketplace <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </Link>
            ) : (
              <>
                <Link href="/signup" className="w-full sm:w-auto h-11 px-8 flex items-center justify-center rounded-lg bg-primary text-white font-medium text-[15px] hover:brightness-95 transition-all">
                  Join BataMart — it&apos;s free
                </Link>
                <Link href="/marketplace" className="w-full sm:w-auto h-11 px-8 flex items-center justify-center gap-2 rounded-lg bg-white border border-border text-ink font-medium text-[15px] hover:bg-surface transition-all">
                  Explore marketplace <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                </Link>
              </>
            )}
          </div>

          <div className="flex justify-center items-start gap-10 md:gap-16">
            {[
              { icon: ShoppingBag, label: 'Buy' },
              { icon: ShieldCheck, label: 'Escrow' },
              { icon: Truck, label: 'Deliver' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="text-center">
                <div className="w-14 h-14 bg-white border border-border rounded-xl flex items-center justify-center mb-2 mx-auto">
                  <Icon className="w-6 h-6 text-primary" strokeWidth={1.75} />
                </div>
                <p className="text-xs text-ink-muted tracking-wide uppercase font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1024px] mx-auto">
          <div className="text-center mb-12">
            <p className="text-primary text-xs tracking-wide uppercase font-medium mb-2">The process</p>
            <h2 className="text-[28px] md:text-[32px] font-semibold text-ink mb-2 tracking-tight">How BataMart works</h2>
            <p className="text-ink-secondary text-[15px]">Built for student commerce — secure, fast, and campus-native.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {steps.map(({ num, title, desc, icon: Icon }) => (
              <div key={title} className="p-6 rounded-xl border border-border bg-white transition-transform duration-150 ease-out hover:-translate-y-0.5">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <p className="text-xs font-medium tracking-wide uppercase text-ink-muted mb-1">{num}</p>
                <h3 className="font-medium text-[16px] text-ink mb-2">{title}</h3>
                <p className="text-sm text-ink-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ───────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-[1024px] mx-auto">
          <div className="text-center mb-12">
            <p className="text-primary text-xs tracking-wide uppercase font-medium mb-2">Products</p>
            <h2 className="text-[28px] md:text-[32px] font-semibold text-ink mb-2 tracking-tight">Shop by category</h2>
            <p className="text-ink-secondary text-[15px]">Everything a student needs — in one place.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {categories.map(({ name, icon: Icon, count }) => (
              <Link
                key={name}
                href={`/marketplace?category=${encodeURIComponent(name)}`}
                className="p-5 rounded-xl border border-border bg-white transition-transform duration-150 ease-out hover:-translate-y-0.5"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <h3 className="font-medium text-ink text-sm leading-snug mb-1">{name}</h3>
                <p className="text-xs text-ink-muted">{count}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── LOCATIONS ────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[768px] mx-auto text-center">
          <p className="text-primary text-xs tracking-wide uppercase font-medium mb-2">Coverage</p>
          <h2 className="text-[28px] md:text-[32px] font-semibold text-ink mb-2 tracking-tight">Delivering across your campus</h2>
          <p className="text-ink-secondary text-[15px] mb-10 max-w-sm mx-auto leading-relaxed">
            Delivery availability and timing depend on riders, distance, and seller readiness.
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            {locations.map((loc) => (
              <span key={loc} className="bg-surface border border-border text-ink-secondary text-xs font-medium px-4 py-2 rounded-full">
                {loc}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-[1024px] mx-auto">
          <div className="text-center mb-12">
            <p className="text-primary text-xs tracking-wide uppercase font-medium mb-2">By the numbers</p>
            <h2 className="text-[28px] md:text-[32px] font-semibold text-ink tracking-tight">Growing every day</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map(({ value, label, sub, icon: Icon }) => (
              <div key={label} className="p-8 rounded-xl bg-white border border-border text-center">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                  <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="text-[32px] font-semibold text-ink tabular-nums mb-1 tracking-tight">{value}</div>
                <p className="text-ink font-medium text-sm mb-1">{label}</p>
                <p className="text-ink-muted text-xs">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[672px] mx-auto text-center">
          <p className="text-primary text-xs tracking-wide uppercase font-medium mb-3">Get started</p>
          <h2 className="text-[32px] md:text-[40px] font-semibold text-ink leading-tight tracking-tight mb-4">
            Ready to start trading?
          </h2>
          <p className="text-ink-secondary text-[15px] max-w-sm mx-auto mb-8 leading-relaxed">
            Join the growing campus community using BataMart. Free to join, easy to use.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            {isLoggedIn ? (
              <Link href="/marketplace" className="h-11 px-10 flex items-center justify-center rounded-lg bg-primary text-white font-medium text-[15px] hover:brightness-95 transition-all">
                View marketplace
              </Link>
            ) : (
              <Link href="/signup" className="h-11 px-10 flex items-center justify-center rounded-lg bg-primary text-white font-medium text-[15px] hover:brightness-95 transition-all">
                Create free account
              </Link>
            )}
          </div>
          {!isLoggedIn && (
            <p className="text-ink-secondary text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
            </p>
          )}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer className="bg-surface border-t border-border py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1024px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <Logo size={28} />
              <p className="text-ink-muted text-sm leading-relaxed max-w-[200px] mt-3">
                Student-to-student marketplace built exclusively for your campus.
              </p>
            </div>
            {footerColumns.map(({ label, links }) => (
              <div key={label}>
                <h4 className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-3">{label}</h4>
                <ul className="space-y-2">
                  {links.map(({ name, href }) => (
                    <li key={name}>
                      <Link href={href} className="text-sm text-ink-secondary hover:text-primary transition-colors">
                        {name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="h-px bg-border mb-6" />

          <div className="flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-ink-muted text-xs">© 2026 BataMart. Built for university students.</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-success rounded-full" />
              <span className="text-xs text-ink-muted">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
