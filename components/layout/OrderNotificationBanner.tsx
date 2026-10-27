// components/layout/OrderNotificationBanner.tsx
'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, X, Loader2 } from 'lucide-react'
import { isIosBrowserTab, usePushSubscription } from '@/hooks/usePushSubscription'
import { useNotificationNudge } from '@/hooks/useNotificationNudge'

interface Props {
  postPayment?: boolean
}

export function OrderNotificationBanner({ postPayment = false }: Props) {
  const { subscribe, isLoading } = usePushSubscription()
  const { shouldShowContextual, shouldShowPassive, snooze, markGranted } = useNotificationNudge()
  const [visible, setVisible]     = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [enabling, setEnabling]   = useState(false)

  if (isIosBrowserTab()) return null

  useEffect(() => {
    if (dismissed) return
    if (postPayment && shouldShowContextual) {
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    }
    if (!postPayment && shouldShowPassive) {
      const t = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(t)
    }
  }, [postPayment, shouldShowContextual, shouldShowPassive, dismissed])

  const handleEnable = async () => {
    if (isIosBrowserTab()) return
    setEnabling(true)
    const granted = await subscribe()
    setEnabling(false)
    if (granted) { markGranted(); setDismissed(true) }
  }

  const handleDismiss = () => { setVisible(false); setDismissed(true); snooze() }

  if (!visible || dismissed) return null

  const isBusy = enabling || isLoading

  return (
    <>
      <style>{`
        @keyframes bannerSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .notif-banner-enter { animation: bannerSlideDown 0.2s ease-out forwards; }
      `}</style>

      <div className="notif-banner-enter mb-4 w-full">

        {postPayment ? (
          /* ── POST-PAYMENT ─────────────────────────────────────────────── */
          <div className="relative w-full overflow-hidden border border-border bg-card">
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center text-ink-muted transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>

            <div className="p-4 pr-12">
              <p className="ui-mono-sm mb-1 text-ink-muted">Order placed</p>
              <p className="text-sm font-medium leading-snug text-ink">Track it with notifications</p>
              <p className="mb-4 mt-1 text-xs leading-relaxed text-ink-secondary">
                Get alerts when your order is picked up, on the way, and delivered, even when the app is closed.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleEnable}
                  disabled={isBusy}
                  className="flex h-11 w-full items-center justify-center gap-2 bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-background transition-colors duration-300 hover:bg-primary disabled:opacity-60 sm:w-auto"
                >
                  {isBusy
                    ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />Enabling...</>
                    : <><Bell className="h-4 w-4" strokeWidth={1.75} />Enable notifications</>
                  }
                </button>

                <button
                  onClick={handleDismiss}
                  className="flex h-11 w-full items-center justify-center border border-border px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors hover:text-ink sm:w-auto"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>

        ) : (
          /* ── PASSIVE ──────────────────────────────────────────────────── */
          <div className="relative w-full overflow-hidden border border-border bg-card">
            {/* Dismiss sits absolutely */}
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10 text-ink-muted hover:text-ink-secondary hover:bg-surface transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>

            <div className="p-4 pr-12">
              {/* Icon + text */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-border bg-surface">
                  <BellOff className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink leading-tight">
                    Notifications are off
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5 leading-snug">
                    Enable to never miss an order update.
                  </p>
                </div>
              </div>

              {/* Enable button — always full width, easy tap target */}
              <button
                onClick={handleEnable}
                disabled={isBusy}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink font-mono text-[10px] uppercase tracking-[0.14em] text-background transition-colors duration-300 hover:bg-primary disabled:opacity-60 active:scale-[0.99]"
              >
                {isBusy
                  ? <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />Enabling…</>
                  : <><Bell className="w-4 h-4" strokeWidth={1.75} />Enable notifications</>
                }
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
