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
          <div className="relative w-full rounded-2xl overflow-hidden bg-primary">
            {/* Dismiss sits absolutely so it never squeezes the content */}
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>

            {/* All content — right-padded to clear the dismiss button */}
            <div className="p-4 pr-12">

              {/* Icon + headline row */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-white/15">
                  <Bell className="w-5 h-5 text-white" strokeWidth={1.75} />
                </div>
                <p className="font-medium text-white text-sm leading-snug">
                  Order placed — track it with notifications
                </p>
              </div>

              {/* Subtext */}
              <p className="text-xs leading-relaxed mb-3 text-white/80">
                Get real-time alerts when your order is picked up, on the way,
                and delivered — even when the app is closed.
              </p>

              {/* Chips — wrap naturally on any width */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {['Pickup alert', 'On the way', 'Delivered'].map((text) => (
                  <span key={text} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white">
                    {text}
                  </span>
                ))}
              </div>

              {/* Buttons — stacked on mobile (full-width), side-by-side on sm+ */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleEnable}
                  disabled={isBusy}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 h-11 rounded-lg text-sm font-medium bg-white text-primary transition-all disabled:opacity-60 active:scale-[0.98]"
                >
                  {isBusy
                    ? <><Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />Enabling…</>
                    : <><Bell className="w-4 h-4" strokeWidth={1.75} />Enable notifications</>
                  }
                </button>

                <button
                  onClick={handleDismiss}
                  className="flex items-center justify-center w-full sm:w-auto px-4 h-11 rounded-lg text-sm font-medium bg-white/10 text-white/90 transition-colors active:scale-[0.98]"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>

        ) : (
          /* ── PASSIVE ──────────────────────────────────────────────────── */
          <div className="relative w-full rounded-2xl overflow-hidden bg-primary/5 border border-primary/20">
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
                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10">
                  <BellOff className="w-4 h-4 text-primary" strokeWidth={1.75} />
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
                className="w-full flex items-center justify-center gap-2 h-11 rounded-lg text-sm font-medium text-white bg-primary transition-all disabled:opacity-60 active:scale-[0.98]"
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
