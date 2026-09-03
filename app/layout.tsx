import type { Metadata, Viewport } from 'next'
import { Archivo, Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import '@/styles/globals.css'
import '@/styles/app-ui.css'

import { NavbarWrapper } from '@/components/layout/NavbarWrapper'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { NotificationPrompt } from '@/hooks/usePushSubscription'
import { SuspensionGuard } from '@/components/layout/SuspensionGuard'

// PWA + UX
import PWARegister from '@/components/PWARegister'
import SplashScreen from '@/components/SplashScreen'
import InstallPrompt from '@/components/InstallPrompt'
import IosInstallPrompt from '@/components/IosInstallPrompt'
import { IOSAppShell } from '@/components/layout/IOSAppShell'
import { RoutePrefetcher } from '@/components/layout/RoutePrefetcher'
import { AppNavigationCache } from '@/components/layout/AppNavigationCache'
import { GlobalPullToRefresh } from '@/components/layout/GlobalPullToRefresh'
import { ToastContainer } from '@/components/ui/Toast'
import { KeyboardVisibilityProvider } from '@/components/layout/KeyboardVisibilityProvider'
import GirlfriendsDayIntro from '@/components/marketplace/GirlfriendsDayIntro'
import GirlfriendsDaySellTour from '@/components/tutorial/GirlfriendsDaySellTour'

/* One type system for the whole product, not just the marketing pages.
   — Inter carries body copy and UI text.
   — Archivo sets headings, prices and figures: a tighter grotesque that gives
     a number or a product title some authority at small sizes.
   — Instrument Serif is the editorial accent, rationed to a word at a time.
   — JetBrains Mono carries metadata: labels, order references, counts. */
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const display = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})
const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})
const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://batamart.com'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'BATAMART - Campus Marketplace',
    template: '%s | BATAMART',
  },
  description: 'BATAMART is a campus marketplace where students buy, sell, and manage delivery-backed orders with built-in support.',
  applicationName: 'BATAMART',
  keywords: [
    'campus marketplace',
    'student marketplace',
    'buy and sell on campus',
    'university marketplace',
    'student commerce Nigeria',
    'BATAMART',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'BATAMART',
    title: 'BATAMART - Campus Marketplace',
    description: 'Buy and sell on campus with BATAMART.',
    images: [
      {
        url: '/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'BATAMART logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BATAMART - Campus Marketplace',
    description: 'Buy and sell on campus with BATAMART.',
    images: ['/icon-512x512.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192x192.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BataMart',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1E90FF',
  interactiveWidget: 'resizes-visual',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//res.cloudinary.com" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//lh3.googleusercontent.com" />
        <meta name="application-name" content="BataMart" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'BATAMART',
              url: siteUrl,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${siteUrl}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'BATAMART',
              url: siteUrl,
              logo: `${siteUrl}/icon-512x512.png`,
            }),
          }}
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="BataMart" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* No hardcoded <link rel="manifest"> here — the metadata.manifest
            export above handles /manifest.json for most routes, and child
            routes (app/rider/layout.tsx, app/(marketplace)/rider-dashboard/
            layout.tsx) correctly override it to /rider-manifest.json via
            Next's own per-route metadata resolution. A static tag here would
            win over that per-route resolution and always force /manifest.json
            everywhere, including on rider pages. */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Must mirror isThemeableRoute() in
                  // components/layout/ThemeProvider.tsx. Applying the saved
                  // theme before hydration is what prevents a light flash on
                  // app routes — but admin and the marketing site are always
                  // light, so they must be excluded here too or they flash
                  // *dark* until the provider mounts and strips the class.
                  var p = window.location.pathname;
                  var alwaysLight = ['/admin', '/admin-login', '/about', '/contact', '/privacy', '/terms'];
                  var themeable = p !== '/' && !alwaysLight.some(function (prefix) {
                    return p === prefix || p.indexOf(prefix + '/') === 0;
                  });

                  var savedTheme = localStorage.getItem('batamart-theme');
                  var theme = (themeable && savedTheme === 'dark') ? 'dark' : 'light';
                  document.documentElement.classList.toggle('dark', theme === 'dark');
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />

        {/* ── BULLETPROOF ZOOM KILLER ── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                document.addEventListener('gesturestart', function(e) {
                  e.preventDefault();
                }, { passive: false });
                document.addEventListener('gesturechange', function(e) {
                  e.preventDefault();
                }, { passive: false });
                document.addEventListener('gestureend', function(e) {
                  e.preventDefault();
                }, { passive: false });
                document.addEventListener('touchmove', function(e) {
                  if (e.touches && e.touches.length > 1) {
                    e.preventDefault();
                  }
                }, { passive: false });
              })();
            `,
          }}
        />

        {/* ── BULLETPROOF SPLASH BLOCKER ── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (!sessionStorage.getItem('batamart_launch_path')) {
                    sessionStorage.setItem('batamart_launch_path', window.location.pathname);
                  }

                  var isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;
                  var isAppParam = window.location.search.indexOf('app=true') !== -1;
                  var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  var isMarketplace = window.location.pathname === '/marketplace';
                  var isAndroid = window.location.search.indexOf('android=true') !== -1;
                  var splashShown = sessionStorage.getItem('batamart_splash_app');
                  var shouldGuardIOSMarketplace = isiOS && isMarketplace && !splashShown;

                  if (!isAndroid && ((isStandalone || isAppParam) || shouldGuardIOSMarketplace) && !splashShown) {
                    document.documentElement.classList.add('splash-pending');
                    document.addEventListener('DOMContentLoaded', function() {
                      var style = document.createElement('style');
                      style.textContent = 'body > *:not(#__splash_screen) { visibility: hidden !important; }';
                      document.head.appendChild(style);
                    });
                  }
                } catch(e) {}
              })();
            `,
          }}
        />

        {/* ── INSTANT BODY HIDE ── */}
        <style dangerouslySetInnerHTML={{
          __html: `
            html.splash-pending body > * {
              visibility: hidden !important;
              pointer-events: none !important;
            }
            html.splash-pending #__splash_screen {
              visibility: visible !important;
              pointer-events: auto !important;
            }
          `
        }} />
      </head>

      <body
        className={`${inter.variable} ${display.variable} ${serif.variable} ${mono.variable} ${inter.className}`}
      >
        <KeyboardVisibilityProvider>
          <ThemeProvider>
            <RoutePrefetcher />
            <AppNavigationCache />
            <GlobalPullToRefresh />
            <PWARegister />
            <SplashScreen />
            <GirlfriendsDayIntro />
            <GirlfriendsDaySellTour />
            <InstallPrompt />
            <IosInstallPrompt />
            <SuspensionGuard />
            <NavbarWrapper />
            <NotificationPrompt />
            <IOSAppShell>
              {children}
            </IOSAppShell>
            <ToastContainer />
          </ThemeProvider>
        </KeyboardVisibilityProvider>
      </body>
    </html>
  )
}
