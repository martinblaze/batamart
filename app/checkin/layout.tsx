import type { Metadata, Viewport } from 'next'

// Door checkers are not marketplace users: this page owns the whole screen.
export const metadata: Metadata = {
  title: 'Door check-in | BataMart',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Check-in' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
  viewportFit: 'cover',
}

export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto bg-neutral-950 text-white antialiased"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {children}
    </div>
  )
}
