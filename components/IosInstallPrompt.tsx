'use client'

import { useEffect, useState } from 'react'

export default function IosInstallPrompt() {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const snoozedUntil = parseInt(localStorage.getItem('iosInstallSnoozedUntil') || '0')
    const isSnoozed = Date.now() < snoozedUntil

    if (!isIos || isStandalone || isSnoozed) return

    setTimeout(() => setShow(true), 4000)
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
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceCaret {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(4px); }
        }
        .ios-prompt-sheet {
          animation: iosSlideUp 0.45s cubic-bezier(0.32, 0.72, 0, 1) forwards;
        }
        .bounce-caret {
          animation: bounceCaret 1.4s ease-in-out infinite;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
        onClick={dismiss}
      />

      {/* Sheet */}
      <div
        className="ios-prompt-sheet fixed bottom-0 left-0 right-0 z-[9999] rounded-t-3xl overflow-hidden"
        style={{
          background: '#fff',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pt-3 pb-5">
          <div className="flex items-center gap-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-192x192.png"
              alt="BataMart"
              className="w-14 h-14 rounded-2xl"
              style={{ boxShadow: '0 4px 16px rgba(26,63,143,0.2)' }}
            />
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                Add BataMart to
                <br />Home Screen
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Get the full app experience 🚀
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">

            {/* Step 1 */}
            <div
              className="flex items-center gap-3 p-3 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #eff6ff, #f0f9ff)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3D95E8, #4DABFF)', boxShadow: '0 4px 10px rgba(77,171,255,0.28)' }}
              >
                {/* iOS Share icon */}
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  Tap the Share button
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  At the bottom of your Safari browser
                </p>
              </div>
              <div className="bounce-caret">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Step 2 */}
            <div
              className="flex items-center gap-3 p-3 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 4px 10px rgba(5,150,105,0.3)' }}
              >
                {/* Plus icon */}
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  Tap "Add to Home Screen"
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Scroll down in the share sheet to find it
                </p>
              </div>
            </div>

            {/* Step 3 — Notifications */}
            <div
              className="flex items-center gap-3 p-3 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #fef3c7, #fffbeb)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', boxShadow: '0 4px 10px rgba(245,158,11,0.3)' }}
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  Then enable notifications
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Open the installed app → Profile → Enable Notifications
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={dismiss}
            className="mt-5 w-full py-3.5 rounded-2xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #3D95E8, #4DABFF)', boxShadow: '0 4px 16px rgba(77,171,255,0.28)' }}
          >
            Got it!
          </button>

          <button
            onClick={dismiss}
            className="mt-2 w-full py-2 text-xs text-gray-400"
          >
            Maybe later
          </button>
        </div>
      </div>

      {/* Arrow pointing to Safari share button */}
      <div
        className="fixed bottom-0 left-1/2 z-[9997]"
        style={{
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}
      />
    </>
  )
}
