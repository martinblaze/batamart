'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { ANDROID_APK_URL, isAndroidDevice } from '@/lib/app-download'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [downloadStarted, setDownloadStarted] = useState(false)

  useEffect(() => {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const snoozedUntil = parseInt(localStorage.getItem('installPromptSnoozedUntil') || '0')
    if (Date.now() < snoozedUntil) return

    const android = isAndroidDevice()
    setIsAndroid(android)

    const handler = (e: any) => {
      // Suppressed on every platform, Android included, so Chrome's own
      // mini-infobar never competes with this banner. On Android the event is
      // then discarded — we install the real app instead of the PWA.
      e.preventDefault()
      if (android) return
      setDeferredPrompt(e)
      setTimeout(() => setShow(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Android does not wait for `beforeinstallprompt`: the APK download does
    // not depend on it, and the event never fires at all in browsers that
    // don't support PWA install (Firefox, Samsung Internet in some versions).
    if (android) {
      const timer = setTimeout(() => setShow(true), 3000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (isAndroid) {
      // Navigating rather than using <a download>: the asset is cross-origin,
      // where the download attribute is ignored. GitHub serves the release
      // asset as an attachment, so this downloads instead of navigating away.
      setDownloadStarted(true)
      window.location.href = ANDROID_APK_URL
      return
    }

    if (!deferredPrompt) return
    setInstalling(true)
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setInstalling(false)
    if (outcome === 'accepted') {
      setShow(false)
    }
  }

  const dismiss = () => {
    setDismissed(true)
    setShow(false)
    const snoozeUntil = Date.now() + 7 * 24 * 60 * 60 * 1000
    localStorage.setItem('installPromptSnoozedUntil', String(snoozeUntil))
  }

  if (!show || dismissed) return null

  return (
    <div
      className="fixed bottom-24 left-0 right-0 z-[9999] flex justify-center px-4"
      style={{ animation: 'installFadeUp 0.28s ease-out' }}
    >
      <style>{`
        @keyframes installFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="w-full max-w-sm border border-border bg-card shadow-soft">
        <div className="relative flex items-center gap-3 p-4 pr-10">
          <img
            src="/icon-192x192.png"
            alt="BataMart"
            className="h-12 w-12 flex-shrink-0 border border-border object-cover"
          />

          <div className="min-w-0 flex-1">
            <p className="ui-mono-sm text-ink-muted">{isAndroid ? 'Android app' : 'Home screen'}</p>
            <p className="mt-0.5 text-sm font-medium leading-tight text-ink">
              {isAndroid ? 'Get the BataMart app' : 'Install BataMart'}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-ink-secondary">
              {isAndroid ? 'Faster than the website. Free.' : 'Opens like an app, no browser bar.'}
            </p>
          </div>

          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center text-ink-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex border-t border-border">
          <button
            onClick={dismiss}
            className="h-11 flex-1 border-r border-border font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:text-ink"
          >
            Not now
          </button>
          <button
            onClick={install}
            disabled={installing}
            className="h-11 flex-1 bg-ink font-mono text-[10px] uppercase tracking-[0.14em] text-background transition-colors duration-300 hover:bg-primary disabled:opacity-60"
          >
            {installing ? 'Opening...' : isAndroid ? 'Download' : 'Install'}
          </button>
        </div>

        {/* Sideloading an APK is not a one-tap flow: Chrome warns about the file
            type, and installing from a browser needs a permission the user has
            probably never granted. Without this they hit the warning and stop. */}
        {isAndroid && downloadStarted && (
          <div className="border-t border-border bg-surface px-4 py-3">
            <p className="text-[11px] leading-relaxed text-ink-secondary">
              <span className="font-medium text-ink">Downloading.</span> Tap{' '}
              <span className="font-medium text-ink">Download anyway</span> if Chrome warns you,
              then open the file. You may be asked to allow installs from your browser. That&apos;s
              normal for apps outside the Play Store.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
