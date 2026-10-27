'use client'

import { useEffect, useState } from 'react'
import { Bell, Share, SquarePlus, X } from 'lucide-react'

const STEPS = [
  { icon: Share, title: 'Tap the Share button', note: 'At the bottom of Safari' },
  { icon: SquarePlus, title: 'Tap "Add to Home Screen"', note: 'Scroll down in the share sheet to find it' },
  { icon: Bell, title: 'Then enable notifications', note: 'Open the installed app, then Profile, then Enable Notifications' },
]

export default function IosInstallPrompt() {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const snoozedUntil = parseInt(localStorage.getItem('iosInstallSnoozedUntil') || '0')
    const isSnoozed = Date.now() < snoozedUntil

    if (!isIos || isStandalone || isSnoozed) return

    const timer = setTimeout(() => setShow(true), 4000)
    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    setDismissed(true)
    setShow(false)
    const snoozeUntil = Date.now() + 7 * 24 * 60 * 60 * 1000
    localStorage.setItem('iosInstallSnoozedUntil', String(snoozeUntil))
  }

  if (!show || dismissed) return null

  return (
    <>
      <style>{`
        @keyframes iosSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ios-prompt-sheet { animation: iosSlideUp 0.3s ease-out forwards; }
      `}</style>

      <div className="fixed inset-0 z-[9998] bg-ink/40" onClick={dismiss} aria-hidden="true" />

      <div
        role="dialog"
        aria-label="Add BataMart to your Home Screen"
        className="ios-prompt-sheet fixed bottom-0 left-0 right-0 z-[9999] border-t border-border bg-card"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-md">
          <div className="flex items-start gap-3 p-5 pb-4">
            <img
              src="/icon-192x192.png"
              alt="BataMart"
              className="h-12 w-12 flex-shrink-0 border border-border object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="ui-mono-sm text-ink-muted">Home screen</p>
              <h2 className="mt-0.5 text-lg font-semibold leading-tight text-ink">Add BataMart to your Home Screen</h2>
            </div>
            <button
              onClick={dismiss}
              aria-label="Close"
              className="-mr-1 flex h-7 w-7 flex-shrink-0 items-center justify-center text-ink-muted transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <ol className="ui-divide border-y border-border">
            {STEPS.map(({ icon: Icon, title, note }, i) => (
              <li key={title} className="ui-row flex items-center gap-3 px-5 py-3.5">
                <span className="ui-mono-sm w-5 flex-shrink-0 text-ink-muted">0{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-ink-secondary">{note}</p>
                </div>
                <Icon className="h-5 w-5 flex-shrink-0 text-ink" strokeWidth={1.5} />
              </li>
            ))}
          </ol>

          <div className="flex gap-px p-5 pt-4">
            <button
              onClick={dismiss}
              className="h-11 flex-1 border border-border font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:text-ink"
            >
              Maybe later
            </button>
            <button
              onClick={dismiss}
              className="h-11 flex-1 bg-ink font-mono text-[10px] uppercase tracking-[0.14em] text-background transition-colors duration-300 hover:bg-primary"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
