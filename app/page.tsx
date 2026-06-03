'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'

// ── Particle Canvas ────────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -9999, y: -9999 })
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const onMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMouseMove)

    const COUNT = 200
    type Particle = {
      x: number; y: number; ox: number; oy: number
      vx: number; vy: number; size: number; alpha: number
      color: string; speed: number
    }

    const COLORS = ['#93c5fd', '#bfdbfe', '#3b82f6', '#dbeafe', '#60a5fa', '#eff6ff']

    const particles: Particle[] = Array.from({ length: COUNT }, () => {
      const x = Math.random() * window.innerWidth
      const y = Math.random() * window.innerHeight
      return {
        x, y, ox: x, oy: y,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        size: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.4 + 0.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        speed: Math.random() * 0.4 + 0.1,
      }
    })

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        p.ox += p.vx
        p.oy += p.vy

        if (p.ox < 0) p.ox = canvas.width
        if (p.ox > canvas.width) p.ox = 0
        if (p.oy < 0) p.oy = canvas.height
        if (p.oy > canvas.height) p.oy = 0

        const dx = p.ox - mouse.current.x
        const dy = p.oy - mouse.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const repulse = 90

        if (dist < repulse && dist > 0) {
          const force = (repulse - dist) / repulse
          p.x = p.ox + (dx / dist) * force * 26
          p.y = p.oy + (dy / dist) * force * 26
        } else {
          p.x += (p.ox - p.x) * 0.05
          p.y += (p.oy - p.y) * 0.05
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2, '0')
        ctx.fill()
      })

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 80) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(59,130,246,${(1 - dist / 80) * 0.08})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.55 }}
    />
  )
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const duration = 1800
        const steps = 60
        const increment = target / steps
        let current = 0
        const timer = setInterval(() => {
          current = Math.min(current + increment, target)
          setCount(Math.floor(current))
          if (current >= target) clearInterval(timer)
        }, duration / steps)
      }
    }, { threshold: 0.5 })

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// ── Scroll reveal ─────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.08 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ── Magnetic card ─────────────────────────────────────────────────────────────
function MagneticCard({ children, className = '', href }: {
  children: React.ReactNode; className?: string; href?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (e.clientX - cx) / (rect.width / 2)
    const dy = (e.clientY - cy) / (rect.height / 2)
    el.style.transform = `perspective(700px) rotateX(${-dy * 4}deg) rotateY(${dx * 4}deg) translateZ(6px)`
  }, [])

  const onLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = 'perspective(700px) rotateX(0) rotateY(0) translateZ(0)'
  }, [])

  const inner = (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ transition: 'transform 0.18s ease', transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  )

  if (href) return <Link href={href}>{inner}</Link>
  return inner
}

// ── Main Page ─────────────────────────────────────────────────────────────────
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

  const categories = [
    { name: 'Fashion & Clothing', icon: '👔', count: '3.1K items', accent: '#2563eb', light: '#eff6ff' },
    { name: 'Food Services',      icon: '🍔', count: '1.2K items', accent: '#0284c7', light: '#f0f9ff' },
    { name: 'Room Essentials',    icon: '🏠', count: '950 items',  accent: '#0369a1', light: '#e0f2fe' },
    { name: 'School Supplies',    icon: '🎒', count: '740 items',  accent: '#1d4ed8', light: '#eff6ff' },
    { name: 'Tech Gadgets',       icon: '🎧', count: '680 items',  accent: '#2563eb', light: '#dbeafe' },
    { name: 'Cosmetics',          icon: '💄', count: '520 items',  accent: '#0ea5e9', light: '#f0f9ff' },
    { name: 'Snacks',             icon: '🍿', count: '890 items',  accent: '#0284c7', light: '#e0f2fe' },
    { name: 'Books',              icon: '📚', count: '650 items',  accent: '#1e40af', light: '#eff6ff' },
  ]

  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&family=Instrument+Serif:ital@0;1&display=swap"
      />
      <style suppressHydrationWarning>{`
        .bm-page { font-family: 'DM Sans', sans-serif; }

        .hero-gradient {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 45%, #0ea5e9 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .grid-bg {
          background-image:
            linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        @keyframes pulseRing {
          0%   { box-shadow: 0 0 0 0 rgba(37,99,235,0.4); }
          70%  { box-shadow: 0 0 0 9px rgba(37,99,235,0); }
          100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
        }
        .pulse-dot { animation: pulseRing 2.2s ease infinite; }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        .float-a { animation: float 5.5s ease-in-out infinite; }
        .float-b { animation: float 4.8s ease-in-out 0.9s infinite; }
        .float-c { animation: float 6s ease-in-out 0.4s infinite; }

        @keyframes scrollLine {
          0%   { transform: scaleY(0); transform-origin: top; opacity: 1; }
          49%  { transform: scaleY(1); transform-origin: top; opacity: 1; }
          50%  { transform-origin: bottom; }
          100% { transform: scaleY(0); transform-origin: bottom; opacity: 0.2; }
        }
        .scroll-line { animation: scrollLine 2.2s ease infinite; }

        .category-card {
          transition: all 0.32s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .category-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 18px 40px rgba(37,99,235,0.1);
          border-color: #93c5fd;
        }
        .category-card:hover .cat-icon {
          transform: scale(1.15) rotate(-5deg);
        }
        .cat-icon { transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1); }

        .step-card {
          transition: all 0.32s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .step-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 44px rgba(37,99,235,0.09);
          border-color: #93c5fd;
        }

        .stat-card {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .stat-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(37,99,235,0.5), transparent);
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 16px 36px rgba(37,99,235,0.09); }

        .cta-btn {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .cta-btn::before {
          content: '';
          position: absolute;
          top: 50%; left: 50%;
          width: 0; height: 0;
          background: rgba(255,255,255,0.15);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: width 0.55s ease, height 0.55s ease;
        }
        .cta-btn:hover::before { width: 500px; height: 500px; }
        .cta-btn:hover { transform: translateY(-2px); }

        .glow-border {
          position: relative;
        }
        .glow-border::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, #93c5fd, #2563eb, #60a5fa);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.6;
        }

        .section-rule {
          height: 1px;
          background: linear-gradient(90deg, transparent, #dbeafe, transparent);
        }

        .pill-hover {
          transition: all 0.25s ease;
          cursor: default;
        }
        .pill-hover:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #1d4ed8;
          transform: translateY(-2px);
        }

        .bm-page section,
        .bm-page footer {
          position: relative;
          z-index: 1;
        }

        .hero-bg {
          background: linear-gradient(160deg, rgba(239,246,255,0.85) 0%, rgba(255,255,255,0.80) 40%, rgba(224,242,254,0.80) 70%, rgba(239,246,255,0.85) 100%);
        }
        .section-white  { background: rgba(255,255,255,0.90); }
        .section-soft   { background: rgba(248,250,255,0.90); }
        .section-blue   { background: linear-gradient(135deg, rgba(239,246,255,0.92), rgba(224,242,254,0.92)); }

        .dark .bm-page {
          background: #121212 !important;
        }
        .dark .grid-bg {
          background-image:
            linear-gradient(rgba(99,102,241,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 1px);
        }
        .dark .hero-bg {
          background: linear-gradient(160deg, rgba(15,23,42,0.96) 0%, rgba(9,14,28,0.96) 45%, rgba(30,41,59,0.94) 100%);
        }
        .dark .section-white {
          background: rgba(8,13,26,0.9);
        }
        .dark .section-soft {
          background: rgba(13,22,40,0.88);
        }
        .dark .section-blue {
          background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.94));
        }
        .dark .pill-hover:hover {
          background: #1E1E1E;
          border-color: #475569;
          color: #c7d2fe;
        }
        .dark .section-rule {
          background: linear-gradient(90deg, transparent, #334155, transparent);
        }
      `}</style>

      <div className="bm-page min-h-screen text-gray-900 relative overflow-x-hidden" style={{ background: '#f0f6ff' }}>
        <ParticleCanvas />

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="relative min-h-screen flex items-center justify-center px-4 hero-bg grid-bg">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(191,219,254,0.35) 0%, transparent 70%)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(186,230,253,0.3) 0%, transparent 70%)' }} />

          <div className="relative z-10 max-w-4xl mx-auto text-center">

            {/* Badge */}
            <Reveal>
              <div className="inline-flex items-center gap-2.5 bg-white/90 border border-blue-200 backdrop-blur-sm px-5 py-2.5 rounded-full mb-10 shadow-sm">
                <div className="pulse-dot w-1.5 h-1.5 bg-blue-600 rounded-full" />
                <span className="text-xs font-semibold text-blue-700 tracking-[0.14em] uppercase">
                  BATAMART — Campus Marketplace
                </span>
              </div>
            </Reveal>

            {/* Headline */}
            <Reveal delay={80}>
              <h1 className="text-[clamp(52px,9vw,108px)] leading-[0.93] tracking-[-0.03em] font-semibold mb-7">
                <span className="block hero-gradient">Buy. Sell.</span>
                <span className="block text-gray-900" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontStyle: 'italic' }}>Deliver.</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="text-gray-500 text-lg max-w-md mx-auto leading-relaxed mb-10 font-light">
                The smartest way for campus students to trade — secure checkout,
                structured order flow, and built-in support tools.
              </p>
            </Reveal>

            {/* CTAs */}
            <Reveal delay={240}>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-14">
                <Link
                  href={isLoggedIn ? '/marketplace' : '/signup'}
                  className={`cta-btn relative w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-9 py-3.5 rounded-xl font-semibold text-sm tracking-wide shadow-[0_0_28px_rgba(37,99,235,0.35)] hover:shadow-[0_0_44px_rgba(37,99,235,0.5)] ${isLoggedIn ? 'text-transparent' : 'text-white'}`}
                >
                  Join BATAMART — It&apos;s Free
                </Link>
                <Link
                  href="/marketplace"
                  className={`${isLoggedIn ? 'hidden' : 'cta-btn'} w-full sm:w-auto bg-white hover:bg-blue-50 border border-blue-200 hover:border-blue-400 text-blue-700 px-9 py-3.5 rounded-xl font-semibold text-sm tracking-wide shadow-sm`}
                >
                  Explore Marketplace →
                </Link>
              </div>
            </Reveal>

            {/* Floating icons */}
            <Reveal delay={340}>
              <div className="flex justify-center items-end gap-8">
                {[
                  { icon: '🛍️', label: 'Buy',     cls: 'float-a' },
                  { icon: '🔐', label: 'Escrow',  cls: 'float-b' },
                  { icon: '🛵', label: 'Deliver', cls: 'float-c' },
                ].map(({ icon, label, cls }) => (
                  <div key={label} className={`${cls} text-center`}>
                    <div className="w-16 h-16 md:w-[72px] md:h-[72px] bg-white border border-blue-100 rounded-2xl flex items-center justify-center text-[28px] md:text-[32px] shadow-md">
                      {icon}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 tracking-[0.18em] uppercase font-medium">{label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
            <span className="text-[10px] text-gray-300 tracking-[0.28em] uppercase">Scroll</span>
            <div className="w-px h-10 bg-gradient-to-b from-blue-400 to-transparent scroll-line" />
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────────────── */}
        <section className="relative py-24 px-4 section-white">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <div className="text-center mb-14">
                <p className="text-blue-500 text-[10px] tracking-[0.3em] uppercase font-semibold mb-3">The Process</p>
                <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">How BATAMART Works</h2>
                <p className="text-gray-400 max-w-sm mx-auto text-sm leading-relaxed">Built for student commerce — secure, fast, and campus-native.</p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                { num: '01', title: 'Browse & Buy',    desc: 'Explore products from campus sellers across different categories.', icon: '🔍', featured: false },
                { num: '02', title: 'Protected Payments',   desc: 'Payments run through secure providers, with seller settlement tied to order and dispute milestones.', icon: '🔐', featured: true  },
                { num: '03', title: 'Delivery Flow',   desc: 'Orders can be fulfilled through BATAMART rider workflow where available.', icon: '🛵', featured: false },
              ].map(({ num, title, desc, icon, featured }, i) => (
                <Reveal key={title} delay={i * 100}>
                  <MagneticCard
                    className={`step-card relative h-full p-7 rounded-2xl border overflow-hidden ${
                      featured
                        ? 'glow-border bg-blue-600 border-blue-500'
                        : 'bg-white border-blue-100'
                    }`}
                  >
                    {featured && (
                      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle at 70% 10%, white 0%, transparent 60%)' }} />
                    )}
                    <div className="text-3xl mb-5">{icon}</div>
                    <p className={`text-[10px] font-semibold tracking-[0.24em] uppercase mb-2 ${featured ? 'text-blue-200' : 'text-blue-400'}`}>{num}</p>
                    <h3 className={`font-semibold text-lg mb-2.5 tracking-tight ${featured ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
                    <p className={`text-sm leading-relaxed ${featured ? 'text-blue-100' : 'text-gray-500'}`}>{desc}</p>
                    <div className={`absolute bottom-5 right-5 text-[64px] font-bold leading-none select-none pointer-events-none ${featured ? 'text-white/[0.07]' : 'text-blue-600/[0.05]'}`}>{num}</div>
                  </MagneticCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <div className="section-rule mx-8" />

        {/* ── CATEGORIES ───────────────────────────────────────── */}
        <section className="relative py-24 px-4 section-soft">
          <div className="max-w-5xl mx-auto">
            <Reveal>
              <div className="text-center mb-14">
                <p className="text-blue-500 text-[10px] tracking-[0.3em] uppercase font-semibold mb-3">Products</p>
                <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">Shop by Category</h2>
                <p className="text-gray-400 text-sm">Everything a student needs — in one place.</p>
              </div>
            </Reveal>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {categories.map(({ name, icon, count, accent, light }, i) => (
                <Reveal key={name} delay={i * 55}>
                  <MagneticCard href={`/marketplace?category=${encodeURIComponent(name)}`}>
                    <div className="category-card relative p-5 rounded-xl border border-blue-100 bg-white cursor-pointer overflow-hidden group">
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
                        style={{ background: `radial-gradient(ellipse at top left, ${accent}0d, transparent 70%)` }}
                      />
                      <div
                        className="absolute top-0 left-0 right-0 h-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-t-xl"
                        style={{ background: `linear-gradient(90deg, transparent, ${accent}aa, transparent)` }}
                      />
                      <div className="cat-icon w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3.5" style={{ background: light }}>{icon}</div>
                      <h3 className="font-medium text-gray-900 text-sm leading-snug mb-1 tracking-tight">{name}</h3>
                      <p className="text-xs text-gray-400">{count}</p>
                    </div>
                  </MagneticCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <div className="section-rule mx-8" />

        {/* ── LOCATIONS ────────────────────────────────────────── */}
        <section className="relative py-24 px-4 section-white">
          <div className="max-w-3xl mx-auto text-center">
            <Reveal>
              <p className="text-blue-500 text-[10px] tracking-[0.3em] uppercase font-semibold mb-3">Coverage</p>
              <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">
                Delivering Across Your Campus
              </h2>
              <p className="text-gray-400 text-sm mb-12 max-w-xs mx-auto leading-relaxed">
                Delivery availability and timing depend on riders, distance, and seller readiness.
              </p>
            </Reveal>

            <Reveal delay={100}>
              <div className="flex flex-wrap justify-center gap-2.5">
                {['Main Hostel Block', 'Engineering Faculty', 'Sciences Complex', 'Law Faculty', 'Student Union Bldg', 'Library', 'Sports Complex', 'Admin Block'].map((loc) => (
                  <span key={loc} className="pill-hover bg-blue-50 border border-blue-100 text-blue-600 text-xs font-medium px-4 py-2 rounded-full">
                    {loc}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <div className="section-rule mx-8" />

        {/* ── STATS ────────────────────────────────────────────── */}
        <section className="relative py-24 px-4 section-blue overflow-hidden">
          <div className="relative max-w-4xl mx-auto">
            <Reveal>
              <div className="text-center mb-14">
                <p className="text-blue-500 text-[10px] tracking-[0.3em] uppercase font-semibold mb-3">By The Numbers</p>
                <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 tracking-tight">Growing Every Day</h2>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { value: 2000, suffix: '+', label: 'Active Users',      sub: 'Students trading daily',  icon: '👥' },
                { value: 5000, suffix: '+', label: 'Products Listed',   sub: 'Across all categories',   icon: '📦' },
                { value: 98,   suffix: '%', label: 'Positive Experience Rate', sub: 'Based on platform review trends',  icon: '⭐' },
              ].map(({ value, suffix, label, sub, icon }, i) => (
                <Reveal key={label} delay={i * 90}>
                  <MagneticCard>
                    <div className="stat-card relative p-8 rounded-2xl bg-white border border-blue-100 text-center shadow-sm">
                      <div className="text-2xl mb-4">{icon}</div>
                      <div className="text-5xl font-semibold text-blue-700 tabular-nums mb-2 tracking-tight">
                        <AnimatedCounter target={value} suffix={suffix} />
                      </div>
                      <p className="text-gray-900 font-medium text-sm mb-1">{label}</p>
                      <p className="text-gray-400 text-xs">{sub}</p>
                    </div>
                  </MagneticCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <div className="section-rule mx-8" />

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="relative py-32 px-4 section-white overflow-hidden">
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
            <span
              className="text-[17vw] font-semibold tracking-[-0.04em]"
              style={{ color: 'transparent', WebkitTextStroke: '1px rgba(191,219,254,0.45)' }}
            >
              BATAMART
            </span>
          </div>
          {/* Orbs */}
          <div className="absolute top-1/3 left-1/4 w-[420px] h-[420px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(219,234,254,0.5) 0%, transparent 70%)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[320px] h-[320px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(186,230,253,0.4) 0%, transparent 70%)' }} />

          <div className="relative max-w-2xl mx-auto text-center">
            <Reveal>
              <p className="text-blue-500 text-[10px] tracking-[0.3em] uppercase font-semibold mb-5">Get Started</p>
              <h2 className="text-5xl md:text-6xl font-semibold text-gray-900 leading-[1.0] tracking-[-0.03em] mb-5">
                Ready to Start
                <br />
                <span className="hero-gradient" style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontStyle: 'italic' }}>Trading?</span>
              </h2>
              <p className="text-gray-400 text-base max-w-sm mx-auto mb-10 leading-relaxed font-light">
                Join the growing campus community using BATAMART. Free to join, easy to use.
              </p>
            </Reveal>

            <Reveal delay={130}>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
                <Link
                  href="/signup"
                  className="cta-btn inline-block bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-xl font-semibold text-base tracking-wide shadow-[0_0_36px_rgba(37,99,235,0.3)] hover:shadow-[0_0_56px_rgba(37,99,235,0.5)]"
                >
                  Create Free Account
                </Link>
              </div>
              <p className="text-gray-400 text-sm">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 transition-colors font-medium">
                  Sign in →
                </Link>
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── FOOTER ───────────────────────────────────────────── */}
        <footer className="relative bg-gray-50 border-t border-blue-100 py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
              <div className="col-span-2 md:col-span-1">
                <Image
                  src="/BATAMART - logo.png"
                  alt="BATAMART Logo"
                  width={400}
                  height={400}
                  className="w-28 h-28 object-contain mb-3"
                />
                <p className="text-gray-400 text-sm leading-relaxed max-w-[200px]">
                  Student-to-student marketplace built exclusively for your campus.
                </p>
              </div>
              {[
                {
                  label: 'Product',
                  links: [
                    { name: 'Marketplace', href: '/marketplace' },
                    { name: 'Sell on BATAMART', href: '/sell' },
                  ],
                },
                {
                  label: 'Company',
                  links: [
                    { name: 'About', href: '/about' },
                    { name: 'Contact', href: '/contact' },
                  ],
                },
                {
                  label: 'Legal',
                  links: [
                    { name: 'Privacy Policy', href: '/privacy' },
                    { name: 'Terms of Use', href: '/terms' },
                  ],
                },
              ].map(({ label, links }) => (
                <div key={label}>
                  <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.22em] mb-4">{label}</h4>
                  <ul className="space-y-2.5">
                    {links.map(({ name, href }) => (
                      <li key={name}>
                        <Link href={href} className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
                          {name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent mb-8" />

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-400 text-xs">© 2026 BATAMART. Built with ❤️ for university students.</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">All systems operational</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

