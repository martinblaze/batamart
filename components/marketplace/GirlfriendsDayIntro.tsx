'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Sparkles, X, ArrowRight, Gift } from 'lucide-react'
import { CAMPAIGNS, isCampaignWindowOpen } from '@/lib/campaigns'
import { isSplashPending } from '@/components/SplashScreen'

const CAMPAIGN = CAMPAIGNS.GIRLFRIENDS_DAY
const SEEN_KEY = 'batamart_gfd_intro_seen'

// One-time seasonal takeover shown the first time a signed-in user opens the
// app during the campaign window. Session-gated like SplashScreen's own
// app-boot splash, and deliberately waits for that splash to finish first
// so the two never overlap.
export default function GirlfriendsDayIntro() {
  const router = useRouter()
  const [phase, setPhase] = useState<'hidden' | 'enter' | 'visible' | 'exit'>('hidden')

  useEffect(() => {
    if (!isCampaignWindowOpen(CAMPAIGN.key)) return
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SEEN_KEY)) return
    if (!localStorage.getItem('token')) return

    let cancelled = false
    let enterTimer: ReturnType<typeof setTimeout> | null = null

    const reveal = () => {
      if (cancelled) return
      sessionStorage.setItem(SEEN_KEY, '1')
      setPhase('enter')
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!cancelled) setPhase('visible')
      }))
    }

    if (isSplashPending()) {
      const onSplashDone = () => {
        window.removeEventListener('batamart:splash-done', onSplashDone)
        enterTimer = setTimeout(reveal, 400)
      }
      window.addEventListener('batamart:splash-done', onSplashDone)
      return () => {
        cancelled = true
        window.removeEventListener('batamart:splash-done', onSplashDone)
        if (enterTimer) clearTimeout(enterTimer)
      }
    }

    enterTimer = setTimeout(reveal, 900)
    return () => { cancelled = true; if (enterTimer) clearTimeout(enterTimer) }
  }, [])

  useEffect(() => {
    if (phase !== 'visible') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const close = () => {
    setPhase('exit')
    setTimeout(() => setPhase('hidden'), 300)
  }

  const explore = () => {
    close()
    router.push('/marketplace/girlfriends-day')
  }

  if (phase === 'hidden') return null

  return (
    <div
      className={`fixed inset-0 z-[9500] flex items-center justify-center bg-ink/50 backdrop-blur-sm p-4 transition-opacity duration-300 ${
        phase === 'visible' ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`${CAMPAIGN.label} announcement`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-300 ${
          phase === 'visible' ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-rose-500 via-rose-500 to-pink-600">
          <Heart className="pointer-events-none absolute -top-2 left-[10%] h-8 w-8 text-white/15 animate-float-slow" fill="currentColor" strokeWidth={0} />
          <Heart className="pointer-events-none absolute top-4 right-[14%] h-10 w-10 text-white/15 animate-float-slower" fill="currentColor" strokeWidth={0} />
          <Sparkles className="pointer-events-none absolute bottom-3 left-[22%] h-4 w-4 text-white/25 animate-pulse-slow" />
          <Sparkles className="pointer-events-none absolute top-6 right-[30%] h-3.5 w-3.5 text-white/25 animate-pulse-slow" />

          <button
            onClick={close}
            aria-label="Dismiss"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/30">
              <Heart className="h-8 w-8 animate-heartbeat text-white" strokeWidth={1.75} fill="currentColor" />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6 text-center">
          <div>
            <div className="mb-1.5 flex items-center justify-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                <Gift className="h-2.5 w-2.5" strokeWidth={2} /> Live now
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">{CAMPAIGN.label} is here</h2>
            <p className="mt-1.5 text-sm text-ink-muted">{CAMPAIGN.tagline}</p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={explore}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-600"
            >
              Explore the collection <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              onClick={close}
              className="rounded-xl px-5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink-secondary"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
