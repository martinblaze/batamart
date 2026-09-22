'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download } from 'lucide-react'
import { ANDROID_APK_URL, isAndroidDevice } from '@/lib/app-download'

/**
 * "Get the Android app", on the landing page, for Android visitors.
 *
 * The only route to the real app used to be `InstallPrompt` — a banner that
 * appears three seconds in and snoozes itself for a week once dismissed. So a
 * visitor who waved it away had no way back to the APK at all, and anyone
 * looking for a download had nowhere to look. These two are permanent.
 *
 * Deliberately narrow: Android only (there is no iOS build), landing page only
 * (deeper marketing pages are read by people who already arrived with intent),
 * and never inside the installed app.
 */
function useShowAndroidCta(): boolean {
  const pathname = usePathname()
  // Must start false and be corrected on mount. `navigator.userAgent` and
  // `matchMedia` do not exist on the server, so deciding this during render
  // makes the first client render disagree with the server HTML and React
  // throws the hydrated tree away — a failure that only shows up on a real
  // device, never in a desktop tab.
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    const installed = window.matchMedia('(display-mode: standalone)').matches
    setEligible(isAndroidDevice() && !installed)
  }, [])

  return eligible && pathname === '/'
}

/**
 * Compact pill for the nav bar.
 *
 * Sits in the slot the "Join free" button leaves empty: that button is
 * `hidden lg:block`, so on the phones this is aimed at, the nav carried nothing
 * but a logo and a burger.
 */
export function AndroidAppCtaNav() {
  const show = useShowAndroidCta()
  if (!show) return null

  return (
    <a
      href={ANDROID_APK_URL}
      className="mk-mono flex items-center gap-1.5 whitespace-nowrap border border-current/30 px-3 py-2 text-[10px] uppercase tracking-[0.14em] transition-opacity duration-300 hover:opacity-70 lg:hidden"
    >
      <Download className="h-3.5 w-3.5" strokeWidth={2} />
      Get app
    </a>
  )
}

/** Full-width block for the footer, next to the other primary actions. */
export function AndroidAppCtaFooter() {
  const show = useShowAndroidCta()
  if (!show) return null

  return (
    <a
      href={ANDROID_APK_URL}
      className="group mt-8 flex items-center gap-4 border border-white/20 bg-white/5 px-5 py-4 transition-colors duration-300 hover:border-white/40 hover:bg-white/10"
    >
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-white/25">
        <Download className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mk-mono block text-[10px] uppercase tracking-[0.16em] opacity-50">
          Android
        </span>
        <span className="block text-[15px] font-semibold leading-tight">
          Download the BataMart app
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug opacity-55">
          Faster than the website. Allow installs from your browser when Android
          asks.
        </span>
      </span>
    </a>
  )
}
