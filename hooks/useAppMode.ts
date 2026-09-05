'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * True when the page is running as the installed app.
 *
 * The standalone check has to happen in an effect, not during render. Reading
 * `matchMedia` while rendering returns false on the server and true inside an
 * installed PWA, and React throws out the whole hydrated tree when those
 * disagree — a failure that only ever reproduces on a real installed app, so it
 * survives every test in a browser tab. Starting false and correcting on mount
 * costs one repaint and nothing else.
 *
 * `?app=true` is read directly because it is identical on both sides.
 */
export function useAppMode(): boolean {
  const params = useSearchParams()
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    setStandalone(mq.matches || (window.navigator as { standalone?: boolean }).standalone === true)
    const onChange = (e: MediaQueryListEvent) => setStandalone(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return params.get('app') === 'true' || standalone
}

/** Appends `app=true` to a path when the installed app is asking for it. */
export function withAppMode(href: string, isApp: boolean): string {
  if (!isApp) return href
  return href.includes('?') ? `${href}&app=true` : `${href}?app=true`
}
