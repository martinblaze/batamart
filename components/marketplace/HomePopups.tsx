'use client'

// Rotating promo sheet for the marketplace home: bottom sheet on mobile,
// centred card on desktop. Slides come from /api/promos/home (real data only).
// It renders nothing until that data arrives, so a slow API never blocks the page.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  canShowSheet, cleanState, filterDismissed, isBlockedPath, markDismissed, markShown,
  type Popup, type PromoState,
} from '@/lib/promos/logic'
import { loadHomePromos } from '@/components/marketplace/live/useHomePromos'

const STORAGE_KEY = 'BATAMART-promo-sheet-v1'
const OPEN_DELAY_MS = 1500
const SLIDE_MS = 5000

function readState(now: number): PromoState {
  try { return cleanState(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'), now) } catch { return cleanState(null, now) }
}
function writeState(s: PromoState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* private mode */ }
}

export default function HomePopups() {
  const pathname = usePathname()
  const [slides, setSlides] = useState<Popup[]>([])
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const touchX = useRef<number | null>(null)
  const decided = useRef(false)

  useEffect(() => {
    try { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches) } catch { /* ignore */ }
  }, [])

  // Fetch once, decide once, open after a short delay.
  useEffect(() => {
    if (decided.current || isBlockedPath(pathname)) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    loadHomePromos().then(data => {
      if (cancelled || decided.current || !data?.popups?.length) return
      const now = Date.now()
      const state = readState(now)
      if (!canShowSheet(state, now)) return
      const list = filterDismissed(data.popups, state, now)
      if (!list.length) return
      decided.current = true
      timer = setTimeout(() => {
        if (cancelled || isBlockedPath(window.location.pathname)) return
        lastFocus.current = document.activeElement as HTMLElement | null
        writeState(markShown(readState(Date.now()), Date.now()))
        setSlides(list)
        setIndex(0)
        setOpen(true)
      }, OPEN_DELAY_MS)
    })
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [pathname])

  const close = useCallback((dismissAll: boolean) => {
    setOpen(false)
    if (dismissAll) writeState(markDismissed(readState(Date.now()), slides.map(s => s.kind), Date.now()))
    try { lastFocus.current?.focus?.() } catch { /* ignore */ }
  }, [slides])

  const go = useCallback((delta: number) => {
    setIndex(i => (i + delta + slides.length) % Math.max(slides.length, 1))
  }, [slides.length])

  // Focus trap + keys
  useEffect(() => {
    if (!open) return
    const el = sheetRef.current
    el?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return }
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('a[href],button:not([disabled])'))
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
  }, [open, close, go])

  // Close if the user navigates to a blocked page.
  useEffect(() => { if (open && isBlockedPath(pathname)) setOpen(false) }, [pathname, open])

  if (!open || !slides.length) return null
  const s = slides[Math.min(index, slides.length - 1)]
  const autoplay = !reduced && !paused && slides.length > 1

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-ink/50 animate-[fadeIn_0.25s_ease-out]" onClick={() => close(true)} aria-hidden />
      <style>{`
        @keyframes promo-bar { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @keyframes promo-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .promo-sheet, .promo-bar-fill { animation: none !important } }
      `}</style>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Offers for you"
        className="promo-sheet relative max-h-[100dvh] w-full max-w-md overflow-y-auto border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-xl sm:mx-4"
        style={{ animation: reduced ? undefined : 'promo-rise 0.35s cubic-bezier(0.16,1,0.3,1)' }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={e => { setPaused(true); touchX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          const x0 = touchX.current; touchX.current = null; setPaused(false)
          if (x0 == null) return
          const dx = e.changedTouches[0].clientX - x0
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {/* progress bars */}
        <div className="flex gap-1 px-3 pt-3" aria-hidden>
          {slides.map((sl, i) => (
            <div key={sl.id} className="h-0.5 flex-1 bg-border">
              <div
                key={i === index ? `a${index}` : `b${i}`}
                className="promo-bar-fill h-full origin-left bg-primary"
                style={{
                  transform: i < index || (i === index && !autoplay) ? 'scaleX(1)' : 'scaleX(0)',
                  animation: i === index && autoplay ? `promo-bar ${SLIDE_MS}ms linear forwards` : undefined,
                }}
                onAnimationEnd={() => { if (i === index) { if (index === slides.length - 1) close(false); else go(1) } }}
              />
            </div>
          ))}
        </div>

        <button
          type="button" onClick={() => close(true)} aria-label="Close"
          className="absolute right-2 top-5 z-10 flex h-9 w-9 items-center justify-center bg-card/90 text-ink hover:bg-surface"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        {/* fixed-height body: no layout shift between slides */}
        <div className="px-4 pb-4 pt-3">
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface">
            {s.imageUrl && <img key={s.id} src={s.imageUrl} alt="" className="h-full w-full object-cover animate-[fadeIn_0.3s_ease-out]" />}
            {s.badge && <span className="absolute left-0 top-3 bg-primary px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white">{s.badge}</span>}
            {slides.length > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous offer" className="absolute left-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-card/90 text-ink hover:bg-card"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" onClick={() => go(1)} aria-label="Next offer" className="absolute right-1 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-card/90 text-ink hover:bg-card"><ChevronRight className="h-5 w-5" /></button>
              </>
            )}
          </div>
          <div className="mt-3 h-[5.5rem] overflow-hidden" aria-live="polite">
            <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-ink">{s.title}</h2>
            <p className="mt-1 line-clamp-3 text-sm text-ink-muted">{s.body}</p>
          </div>
          <Link
            href={typeof s.ctaUrl === 'string' && s.ctaUrl.startsWith('/') && !s.ctaUrl.startsWith('//') ? s.ctaUrl : '/marketplace'}
            data-autofocus
            onClick={() => writeState(markDismissed(readState(Date.now()), [s.kind], Date.now()))}
            className="mt-3 flex h-11 w-full items-center justify-center bg-primary text-sm font-medium text-white hover:opacity-90"
          >
            {s.ctaLabel}
          </Link>
          <button type="button" onClick={() => close(true)} className="mt-1 h-10 w-full text-sm text-ink-muted hover:text-ink">
            Not now
          </button>
        </div>
      </div>
    </div>
    , document.body)
}
