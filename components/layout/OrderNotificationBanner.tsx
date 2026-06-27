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
        @keyframes bellPulse {
          0%,100% { transform: rotate(0deg) scale(1); }
          15%      { transform: rotate(14deg) scale(1.05); }
          30%      { transform: rotate(-10deg) scale(1.05); }
          45%      { transform: rotate(8deg); }
          60%      { transform: rotate(-5deg); }
          75%      { transform: rotate(3deg); }
        }
        .notif-banner-enter { animation: bannerSlideDown 0.38s cubic-bezier(0.34,1.2,0.64,1) forwards; }
        .bell-pulse         { animation: bellPulse 1.8s ease 0.5s both; }
      `}</style>

      <div className="notif-banner-enter mb-4 w-full">

        {postPayment ? (
          /* ── POST-PAYMENT ─────────────────────────────────────────────── */
          <div
            className="relative w-full rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg,#3D95E8 0%,#3D95E8 55%,#4DABFF 100%)',
              boxShadow: '0 4px 24px rgba(26,63,143,0.28)',
            }}
          >
            {/* shimmer top line */}
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)' }}
            />

            {/* Dismiss sits absolutely so it never squeezes the content */}
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10 transition-colors"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* All content — right-padded to clear the dismiss button */}
            <div className="p-4 pr-12">

              {/* Icon + headline row */}
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bell-pulse"
                  style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
                >
                  <Bell className="w-5 h-5 text-white" />
                </div>
                <p className="font-bold text-white text-sm leading-snug">
                  🎉 Order placed! Track it with notifications.
                </p>
              </div>

              {/* Subtext */}
              <p className="text-xs leading-relaxed mb-3"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                Get real-time alerts when your order is picked up, on the way,
                and delivered — even when the app is closed.
              </p>

              {/* Chips — wrap naturally on any width */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {[
                  { icon: '📦', text: 'Pickup alert' },
                  { icon: '🛵', text: 'On the way' },
                  { icon: '✅', text: 'Delivered' },
                ].map(({ icon, text }) => (
                  <span key={text}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.92)' }}
                  >
                    {icon} {text}
                  </span>
                ))}
              </div>

              {/* Buttons — stacked on mobile (full-width), side-by-side on sm+ */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleEnable}
                  disabled={isBusy}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.96)',
                    color: '#3D95E8',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
                    minHeight: '44px',
                  }}
                >
                  {isBusy
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Enabling…</>
                    : <><Bell className="w-4 h-4" />Enable Notifications</>
                  }
                </button>

                <button
                  onClick={handleDismiss}
                  className="flex items-center justify-center w-full sm:w-auto px-4 rounded-xl text-sm font-medium transition-colors active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.13)',
                    color: 'rgba(255,255,255,0.82)',
                    minHeight: '44px',
                  }}
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </div>

        ) : (
          /* ── PASSIVE ──────────────────────────────────────────────────── */
          <div
            className="relative w-full rounded-2xl overflow-hidden"
            style={{
              background: '#eef3ff',
              border: '1px solid rgba(59,130,246,0.18)',
            }}
          >
            {/* Dismiss sits absolutely */}
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center z-10 transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="p-4 pr-12">
              {/* Icon + text */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(26,63,143,0.1)' }}
                >
                  <BellOff className="w-4 h-4" style={{ color: '#3D95E8' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 leading-tight">
                    Notifications are off
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                    Enable to never miss an order update.
                  </p>
                </div>
              </div>

              {/* Enable button — always full width, easy tap target */}
              <button
                onClick={handleEnable}
                disabled={isBusy}
                className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg,#3D95E8,#4DABFF)',
                  boxShadow: '0 2px 8px rgba(26,63,143,0.25)',
                  minHeight: '44px',
                }}
              >
                {isBusy
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Enabling…</>
                  : <><Bell className="w-4 h-4" />Enable Notifications</>
                }
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
