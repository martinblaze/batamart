'use client'

import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Don't show if previously dismissed
    if (localStorage.getItem('installPromptDismissed')) return

    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShow(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
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
    localStorage.setItem('installPromptDismissed', 'true')
  }

  if (!show || dismissed) return null

  return (
    <div
      className="fixed bottom-24 left-0 right-0 z-[9999] flex justify-center px-4"
      style={{ animation: 'slideUpFade 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
    >
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .install-btn-shimmer {
          background: linear-gradient(90deg, #3D95E8 0%, #4DABFF 40%, #3D95E8 60%, #3D95E8 100%);
          background-size: 200% auto;
          animation: shimmer 2.4s linear infinite;
        }
      `}</style>

      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: '#fff',
          boxShadow: '0 8px 40px rgba(26,63,143,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          border: '1px solid rgba(59,158,245,0.2)',
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-1 w-full"
          style={{ background: 'linear-gradient(90deg, #3D95E8, #4DABFF)' }}
        />

        <div className="p-4 flex items-center gap-3">
          {/* App icon */}
          <div
            className="relative flex-shrink-0"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(26,63,143,0.25)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-192x192.png"
              alt="BataMart"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm leading-tight">
              Install BataMart
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Add to home screen for the best experience
            </p>

            {/* Stars */}
            <div className="flex items-center gap-1 mt-1">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-[10px] text-gray-400 ml-1">Free</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={install}
              disabled={installing}
              className="install-btn-shimmer text-white text-xs font-bold px-4 py-2 rounded-xl transition-opacity"
              style={{ opacity: installing ? 0.7 : 1, minWidth: 72 }}
            >
              {installing ? 'Opening…' : 'Install'}
            </button>
            <button
              onClick={dismiss}
              className="text-[11px] text-gray-400 text-center hover:text-gray-600 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
