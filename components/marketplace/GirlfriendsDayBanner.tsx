'use client'

import Link from 'next/link'
import { Heart, Gift, ArrowRight } from 'lucide-react'
import { CAMPAIGNS, isCampaignWindowOpen } from '@/lib/campaigns'

const CAMPAIGN = CAMPAIGNS.GIRLFRIENDS_DAY

// Promo banner for the active seasonal campaign. Links out to the dedicated
// campaign page; the page itself decides what to render if nothing is tagged yet.
export default function GirlfriendsDayBanner() {
  if (!isCampaignWindowOpen(CAMPAIGN.key)) return null

  return (
    <Link
      href="/marketplace/girlfriends-day"
      className="group relative block overflow-hidden rounded-xl border border-rose-200/60 bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-5 sm:px-7 sm:py-6"
    >
      <Heart className="pointer-events-none absolute -top-2 left-[12%] h-8 w-8 text-white/15 animate-float-slow" strokeWidth={1.5} fill="currentColor" />
      <Heart className="pointer-events-none absolute top-1/2 right-[8%] h-10 w-10 -translate-y-1/2 text-white/10 animate-float-slower" strokeWidth={1.5} fill="currentColor" />
      <Heart className="pointer-events-none absolute bottom-0 left-[42%] h-6 w-6 text-white/10 animate-float-slow" strokeWidth={1.5} fill="currentColor" />

      <div className="relative flex items-center gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-2 ring-white/30">
          <Heart className="h-5 w-5 text-white animate-heartbeat" strokeWidth={1.75} fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-semibold text-white tracking-tight">{CAMPAIGN.label}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              <Gift className="h-2.5 w-2.5" strokeWidth={2} /> Live now
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-white/85">{CAMPAIGN.tagline}</p>
        </div>
        <div className="hidden flex-shrink-0 items-center gap-1.5 rounded-lg bg-card px-3.5 py-2 text-sm font-semibold text-rose-600 transition-transform group-hover:translate-x-0.5 sm:flex">
          Shop the edit <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
      </div>
    </Link>
  )
}
