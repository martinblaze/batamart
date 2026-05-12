'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCartStore } from '@/lib/cart-store'
import NotificationBell from '@/components/layout/NotificationBell'
import {
  ChevronDown, User, LogOut, Store, ShoppingBag, Wallet,
  Package, AlertTriangle, PlusCircle, Globe, Plus,
} from 'lucide-react'

import { isSplashPending } from '@/components/SplashScreen'

function BATAMARTLogo({ appMode = false }: { appMode?: boolean }) {
  const href = appMode ? '/marketplace?app=true' : '/'
  return (
    <Link href={href} className="flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/BATAMART - logo.png"
        alt="BATAMART"
        style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
      />
    </Link>
  )
}

function AppTopBar({
  isLoggedIn,
  cartCount,
}: {
  isLoggedIn: boolean
  cartCount: number
}) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/88 backdrop-blur-xl border-b border-white/70 shadow-[0_6px_22px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between h-14 px-4">
        <BATAMARTLogo appMode />
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Link href="/cart?app=true" className="relative p-2 text-gray-600">
                <ShoppingBag className="w-6 h-6" />
                {cartCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-blue-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
              <NotificationBell />
            </>
          ) : (
            <Link
              href="/login?app=true"
              className="px-4 py-1.5 rounded-lg text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #3D95E8, #4DABFF)' }}
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

function RiderTopBar({
  isLoggedIn,
  userName,
}: {
  isLoggedIn: boolean
  userName: string
}) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800"
      style={{ background: 'linear-gradient(135deg, #121212, #1E1E1E)' }}
    >
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3D95E8, #4DABFF)' }}
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="5.5" cy="17.5" r="3.5" />
              <circle cx="18.5" cy="17.5" r="3.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 6h-4l-2 5.5M9 17.5h5.5l2-5.5H19" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l1.5 5.5" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">BataMart</p>
            <p className="text-blue-400 text-[10px] font-medium leading-none mt-0.5">Rider Mode</p>
          </div>
        </div>
        {isLoggedIn && userName && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-300 text-xs font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-gray-300 text-xs font-medium">{userName.split(' ')[0]}</span>
          </div>
        )}
      </div>
    </nav>
  )
}

function RiderBottomNav({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.user) setIsAvailable(d.user.isAvailable ?? true) })
      .catch(() => {})
  }, [])

  const toggleAvailability = async () => {
    if (toggling) return
    setToggling(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/riders/toggle-availability', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setIsAvailable(prev => !prev)
    } catch {}
    finally { setToggling(false) }
  }

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + '/')

  const leftTabs = [
    {
      href: '/rider-dashboard?app=true&rider=true',
      label: 'Dashboard',
      match: '/rider-dashboard',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[22px] h-[22px]">
          <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/rider-dashboard?app=true&rider=true&tab=deliveries',
      label: 'Deliveries',
      match: '/rider-dashboard',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[22px] h-[22px]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h4" />
        </svg>
      ),
    },
  ]

  const rightTabs = [
    {
      href: '/wallet?app=true&rider=true',
      label: 'Earnings',
      match: '/wallet',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[22px] h-[22px]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8V6a2 2 0 012-2h14a2 2 0 012 2v2" />
          <circle cx="16" cy="14" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
  ]

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{
          background: '#121212',
          borderColor: '#343434',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          transform: 'translate3d(0,0,0)',
          WebkitTransform: 'translate3d(0,0,0)',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <div
          className="flex items-stretch"
          style={{
            height: 'calc(64px + max(env(safe-area-inset-bottom), 16px))',
            paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          }}
        >
          {leftTabs.map(({ href, label, match, icon }) => {
            const active = isActive(match)
            return (
              <Link
                key={label}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
                  active ? 'text-blue-400' : 'text-gray-500'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full"
                    style={{ background: 'linear-gradient(90deg, #3D95E8, #4DABFF)' }}
                  />
                )}
                <span className={active ? 'scale-110 transition-transform' : 'transition-transform'}>
                  {icon}
                </span>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            )
          })}

          <div className="flex-1 flex items-center justify-center relative">
            <div className="absolute inset-0" style={{ background: '#121212' }} />
            <button
              onClick={toggleAvailability}
              disabled={toggling || isAvailable === null}
              className="relative z-10 flex flex-col items-center justify-center -mt-5"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{
                  background: isAvailable
                    ? 'linear-gradient(135deg, #059669, #10b981)'
                    : 'linear-gradient(135deg, #374151, #4b5563)',
                  boxShadow: isAvailable
                    ? '0 4px 20px rgba(5,150,105,0.5)'
                    : '0 4px 20px rgba(0,0,0,0.4)',
                  opacity: toggling ? 0.7 : 1,
                }}
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="5.5" cy="17.5" r="3.5" />
                  <circle cx="18.5" cy="17.5" r="3.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 6h-4l-2 5.5M9 17.5h5.5l2-5.5H19" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l1.5 5.5" />
                </svg>
              </div>
              <span
                className="text-[10px] font-semibold mt-1 leading-none"
                style={{ color: isAvailable ? '#10b981' : '#6b7280' }}
              >
                {isAvailable === null ? '…' : isAvailable ? 'Online' : 'Offline'}
              </span>
            </button>
          </div>

          {rightTabs.map(({ href, label, match, icon }) => {
            const active = isActive(match)
            return (
              <Link
                key={label}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
                  active ? 'text-blue-400' : 'text-gray-500'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full"
                    style={{ background: 'linear-gradient(90deg, #3D95E8, #4DABFF)' }}
                  />
                )}
                <span className={active ? 'scale-110 transition-transform' : 'transition-transform'}>
                  {icon}
                </span>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setProfileOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
              profileOpen ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            <div className="w-[26px] h-[26px] rounded-full bg-blue-900/40 border border-blue-700/40 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-[10px] font-medium leading-none">Profile</span>
          </button>
        </div>
      </nav>

      {profileOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
            onClick={() => setProfileOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl shadow-2xl border-t border-gray-800"
            style={{
              background: '#121212',
              paddingBottom: 'calc(24px + max(env(safe-area-inset-bottom), 16px))',
            }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-700 rounded-full" />
            </div>
            <div className="px-4 py-2">
              {[
                { href: '/rider-dashboard?app=true&rider=true', icon: () => (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                ), label: 'Dashboard' },
                { href: '/wallet?app=true&rider=true', icon: Wallet, label: 'Earnings' },
                { href: '/notifications?app=true&rider=true', icon: () => (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                ), label: 'Notifications' },
              ].map(({ href, icon: Icon, label }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-2 py-3.5 text-gray-300 hover:text-blue-400 border-b border-gray-800 last:border-0"
                >
                  <Icon className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-sm">{label}</span>
                </Link>
              ))}
            </div>
            <div className="px-6 pt-3">
              <button
                onClick={() => { setProfileOpen(false); onLogout() }}
                className="flex items-center justify-center w-full gap-2 bg-red-950/60 text-red-400 font-semibold py-3 rounded-xl border border-red-900/40"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

function AppBottomNav({
  isLoggedIn,
  userRole,
  isSellerMode,
  userName,
  onLogout,
  onToggleMode,
}: {
  isLoggedIn: boolean
  userRole: string
  isSellerMode: boolean
  userName: string
  onLogout: () => void
  onToggleMode: () => void
}) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)

  // ── iOS PWA keyboard fix ──────────────────────────────────────────────────
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    if (!isIOS) return

    let lastScrollY = 0

    const onFocusIn = () => { lastScrollY = window.scrollY }

    const onFocusOut = () => {
      setTimeout(() => {
        window.scrollTo({ top: lastScrollY, behavior: 'instant' })
        const navs = document.querySelectorAll('nav')
        navs.forEach(nav => {
          nav.style.display = 'none'
          // eslint-disable-next-line @typescript-eslint/no-unused-expressions
          nav.offsetHeight
          nav.style.display = ''
        })
      }, 300)
    }

    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)
    return () => {
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
    }
  }, [])
  // ─────────────────────────────────────────────────────────────────────────

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + '/')

  const isSeller = userRole === 'SELLER' || userRole === 'ADMIN'

  const sellHref = isLoggedIn
    ? isSeller && isSellerMode ? '/sell?app=true' : '/become-seller?app=true'
    : '/login?app=true'

  const leftTabs = [
    {
      href: '/marketplace?app=true',
      label: 'Market',
      match: '/marketplace',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[22px] h-[22px]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
        </svg>
      ),
    },
    {
      href: isLoggedIn ? '/orders?app=true' : '/login?app=true',
      label: 'Orders',
      match: '/orders',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[22px] h-[22px]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h4" />
        </svg>
      ),
    },
  ]

  const rightTabs = [
    {
      href: isLoggedIn ? '/wallet?app=true' : '/login?app=true',
      label: 'Wallet',
      match: '/wallet',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-[22px] h-[22px]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8V6a2 2 0 012-2h14a2 2 0 012 2v2" />
          <circle cx="16" cy="14" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      ),
    },
  ]

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-xl border-t border-white/80"
        style={{
          boxShadow: '0 -8px 28px rgba(15,23,42,0.10)',
          transform: 'translate3d(0,0,0)',
          WebkitTransform: 'translate3d(0,0,0)',
          willChange: 'transform',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      >
        <div
          className="flex items-stretch"
          style={{
            height: 'calc(64px + max(env(safe-area-inset-bottom), 16px))',
            paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          }}
        >
          {leftTabs.map(({ href, label, match, icon }) => {
            const active = isActive(match)
            return (
              <Link
                key={label}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
                  active ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-blue-600 rounded-b-full" />
                )}
                <span className={active ? 'scale-110 transition-transform' : 'transition-transform'}>
                  {icon}
                </span>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            )
          })}

          <div className="flex-1 flex items-center justify-center relative">
            <Link
              href={sellHref}
              className="relative z-10 flex flex-col items-center justify-center -mt-5"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center transition-transform active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #3D95E8, #4DABFF)',
                  boxShadow: '0 4px 20px rgba(26,63,143,0.45)',
                }}
              >
                <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-semibold text-blue-800 mt-1 leading-none">Sell</span>
            </Link>
          </div>

          {rightTabs.map(({ href, label, match, icon }) => {
            const active = isActive(match)
            return (
              <Link
                key={label}
                href={href}
                className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
                  active ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-blue-600 rounded-b-full" />
                )}
                <span className={active ? 'scale-110 transition-transform' : 'transition-transform'}>
                  {icon}
                </span>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            )
          })}

          <button
            onClick={() => setProfileOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
              profileOpen ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <div
              className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isLoggedIn
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-200'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isLoggedIn && userName
                ? userName.charAt(0).toUpperCase()
                : <User className="w-3.5 h-3.5" />}
            </div>
            <span className="text-[10px] font-medium leading-none">
              {isLoggedIn ? 'Profile' : 'Login'}
            </span>
          </button>
        </div>
      </nav>

      {profileOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]"
            onClick={() => setProfileOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-2xl"
            style={{ paddingBottom: 'calc(24px + max(env(safe-area-inset-bottom), 16px))' }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {isLoggedIn ? (
              <>
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-blue-200 flex items-center justify-center text-blue-700 text-lg font-bold">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{userName}</p>
                      <p className="text-xs text-gray-400 capitalize">{userRole.toLowerCase()}</p>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2">
                  {[
                    { href: '/myprofile?app=true', icon: User, label: 'My Account' },
                    { href: '/my-shop?app=true', icon: Store, label: (userRole === 'SELLER' || userRole === 'ADMIN') && isSellerMode ? 'My Shop' : 'My Items' },
                    { href: '/dispute/select-order?app=true', icon: AlertTriangle, label: 'Disputes', hide: userRole === 'RIDER' },
                  ]
                    .filter(item => !item.hide)
                    .map(({ href, icon: Icon, label }) => (
                      <Link
                        key={label}
                        href={href}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-2 py-3.5 text-gray-700 hover:text-blue-600 border-b border-gray-50 last:border-0"
                      >
                        <Icon className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-sm">{label}</span>
                      </Link>
                    ))}
                </div>

                <div className="px-6 pt-2 space-y-3">
                  {(userRole === 'SELLER' || userRole === 'ADMIN') && (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Mode</p>
                        <p className="text-xs text-gray-400">{isSellerMode ? 'You are selling' : 'You are buying'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Buying</span>
                        <button
                          onClick={() => { onToggleMode() }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                          style={{ background: isSellerMode ? 'linear-gradient(135deg,#3D95E8,#4DABFF)' : '#d1d5db' }}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              isSellerMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="text-xs text-gray-500">Selling</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { setProfileOpen(false); onLogout() }}
                    className="flex items-center justify-center w-full gap-2 bg-red-50 text-red-600 font-semibold py-3 rounded-xl"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="px-6 py-6 flex flex-col gap-3">
                <p className="text-center text-gray-500 text-sm mb-2">Sign in to access your account</p>
                <Link
                  href="/login?app=true"
                  onClick={() => setProfileOpen(false)}
                  className="text-center py-3 border-2 border-blue-900 text-blue-900 rounded-xl font-semibold"
                >
                  Login
                </Link>
                <Link
                  href="/signup?app=true"
                  onClick={() => setProfileOpen(false)}
                  className="text-center py-3 text-white rounded-xl font-semibold"
                  style={{ background: 'linear-gradient(135deg, #3D95E8, #4DABFF)' }}
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

export function Navbar() {
  const router   = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isAppParam   = searchParams.get('app')     === 'true'
  const isAndroid    = searchParams.get('android') === 'true'
  const isRiderParam = searchParams.get('rider')   === 'true'

  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    setIsStandalone(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const isApp = isAppParam || isStandalone

  const [isRider, setIsRider] = useState(false)
  useEffect(() => {
    if (isRiderParam) {
      sessionStorage.setItem('batamart_rider_mode', 'true')
      setIsRider(true)
    } else {
      setIsRider(sessionStorage.getItem('batamart_rider_mode') === 'true')
    }
  }, [isRiderParam])

  const [splashDone, setSplashDone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return !isSplashPending()
  })

  useEffect(() => {
    if (splashDone) return
    const handler = () => setSplashDone(true)
    window.addEventListener('batamart:splash-done', handler)
    const fallback = setTimeout(() => setSplashDone(true), 4000)
    return () => {
      window.removeEventListener('batamart:splash-done', handler)
      clearTimeout(fallback)
    }
  }, [splashDone])

  const [isMenuOpen, setIsMenuOpen]               = useState(false)
  const [isLoggedIn, setIsLoggedIn]               = useState(false)
  const [userName, setUserName]                   = useState('')
  const [userBalance, setUserBalance]             = useState(0)
  const [userRole, setUserRole]                   = useState('')
  const [isSellerMode, setIsSellerMode]           = useState(true)
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [isVisible, setIsVisible]                 = useState(true)
  const lastScrollY  = useRef(0)
  const dropdownRef  = useRef<HTMLDivElement>(null)

  const getTotalItems = useCartStore((state) => state.getTotalItems)
  const cartCount = getTotalItems()

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    if (isIOS && isApp) return

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      lastScrollY.current = currentScrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isApp])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (token) {
        setIsLoggedIn(true)
        const storedName = localStorage.getItem('userName')
        if (storedName) setUserName(storedName)
        const sellerModePref = localStorage.getItem('sellerMode')
        if (sellerModePref !== null) setIsSellerMode(sellerModePref === 'true')
        try {
          const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` },
          })
          const data = await response.json()
          if (response.ok && data.user) {
            setUserName(data.user.name)
            setUserBalance(data.user.availableBalance || 0)
            setUserRole(data.user.role || 'BUYER')
            localStorage.setItem('userName', data.user.name)
            if (data.user.isSellerMode !== undefined) {
              setIsSellerMode(data.user.isSellerMode)
              localStorage.setItem('sellerMode', data.user.isSellerMode.toString())
            }
          }
        } catch (error) {
          console.error('Error fetching user details:', error)
        }
      } else {
        setIsLoggedIn(false)
        setUserName('')
        setUserBalance(0)
        setUserRole('')
        setIsSellerMode(true)
      }
    }
    checkAuth()
    window.addEventListener('auth-change', checkAuth)
    return () => window.removeEventListener('auth-change', checkAuth)
  }, [pathname])

  const toggleRoleMode = async () => {
    const newMode = !isSellerMode
    setIsSellerMode(newMode)
    localStorage.setItem('sellerMode', newMode.toString())
    if (userRole === 'SELLER' || userRole === 'ADMIN') {
      try {
        const token = localStorage.getItem('token')
        await fetch('/api/auth/toggle-seller-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ isSellerMode: newMode }),
        })
      } catch (error) {
        console.error('Error updating seller mode:', error)
      }
    }
    window.dispatchEvent(new Event('auth-change'))
  }

  // ── FIXED: clear cookie on logout + send riders to /rider/login ──────────
  const handleLogout = () => {
    localStorage.clear()
    document.cookie = 'token=; path=/; max-age=0'          // ← clears the cookie middleware reads
    sessionStorage.removeItem('batamart_rider_mode')
    setIsLoggedIn(false)
    setUserName('')
    setUserBalance(0)
    setUserRole('')
    setIsSellerMode(true)
    setIsUserDropdownOpen(false)
    router.push(isRider ? '/rider/login' : isApp ? '/marketplace?app=true' : '/')  // ← riders go to /rider/login
  }

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  if (isAndroid) return null
  if (!splashDone) return null
  if (pathname === '/') return null

  if (isApp) {
    if (isRider) {
      return (
        <>
          <RiderTopBar isLoggedIn={isLoggedIn} userName={userName} />
          <RiderBottomNav onLogout={handleLogout} />
        </>
      )
    }
    return (
      <>
        <AppTopBar isLoggedIn={isLoggedIn} cartCount={cartCount} />
        <AppBottomNav
          isLoggedIn={isLoggedIn}
          userRole={userRole}
          isSellerMode={isSellerMode}
          userName={userName}
          onLogout={handleLogout}
          onToggleMode={toggleRoleMode}
        />
      </>
    )
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-[#121212]/90 backdrop-blur-md border-b border-gray-200 dark:border-[#343434] shadow-sm transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/BATAMART - logo.png"
              alt="BATAMART"
              style={{ height: '45px', width: 'auto', objectFit: 'contain' }}
            />
          </Link>

          <div className="hidden md:flex items-center space-x-2">
            {isLoggedIn && (
              <Link href="/cart" className="relative p-2 text-gray-600 dark:text-[#C8C8C8] hover:text-blue-600 dark:hover:text-[#4DABFF] hover:bg-blue-50 dark:hover:bg-[#2A2A2A] rounded-full transition-all">
                <ShoppingBag className="w-6 h-6" />
                {cartCount > 0 && (
                  <span className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
            )}
            {isLoggedIn && <NotificationBell />}
            {isLoggedIn ? (
              <div className="relative ml-2" ref={dropdownRef}>
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-all"
                >
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-gray-700 dark:text-[#D7D7D7]">Hi, {userName || 'User'}</span>
                    <span className="text-xs text-gray-500 dark:text-[#A0A0A0]">
                      {userRole === 'ADMIN' ? 'Admin' : userRole === 'SELLER' ? (isSellerMode ? 'Selling' : 'Buying') : userRole === 'RIDER' ? 'Rider' : 'Buyer'}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-[#A0A0A0] transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1E1E1E] rounded-xl shadow-2xl border border-gray-200 dark:border-[#343434] py-2 z-50">
                    {/* Rider-specific dropdown */}
                    {userRole === 'RIDER' ? (
                      <>
                        <Link href="/rider-dashboard" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${isActive('/rider-dashboard') ? 'bg-indigo-50 text-indigo-600' : ''}`}>
                          <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                          </svg>
                          <span className="font-medium">Dashboard</span>
                        </Link>
                        <Link href="/wallet" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${isActive('/wallet') ? 'bg-green-50 text-green-600' : ''}`}>
                          <Wallet className="w-5 h-5 mr-3 text-gray-400" />
                          <div className="flex items-center justify-between flex-1">
                            <span>Earnings</span>
                            {userBalance > 0 && <span className="text-xs text-green-600 font-bold">₦{userBalance.toLocaleString()}</span>}
                          </div>
                        </Link>
                        <Link href="/notifications" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${isActive('/notifications') ? 'bg-blue-50 text-blue-600' : ''}`}>
                          <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <span>Notifications</span>
                        </Link>
                      </>
                    ) : (
                      /* Regular buyer/seller dropdown */
                      <>
                        <Link href="/myprofile" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100">
                          <User className="w-5 h-5 mr-3 text-gray-400" /><span className="font-medium">My Account</span>
                        </Link>
                        <Link href="/marketplace" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${isActive('/marketplace') ? 'bg-blue-50 text-blue-600' : ''}`}>
                          <Globe className="w-5 h-5 mr-3 text-gray-400" /><span>Marketplace</span>
                        </Link>
                        <Link href="/my-shop" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${isActive('/my-shop') ? 'bg-blue-50 text-blue-600' : ''}`}>
                          <Store className="w-5 h-5 mr-3 text-gray-400" /><span>{isSellerMode && (userRole === 'SELLER' || userRole === 'ADMIN') ? 'My Shop' : 'My Items'}</span>
                        </Link>
                        {isLoggedIn && (userRole === 'SELLER' || userRole === 'ADMIN') && isSellerMode && (
                          <Link href="/sell" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${isActive('/sell') ? 'bg-blue-50 text-blue-600' : ''}`}>
                            <PlusCircle className="w-5 h-5 mr-3 text-gray-400" /><span>Sell</span>
                          </Link>
                        )}
                        <Link href="/orders" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${isActive('/orders') ? 'bg-purple-50 text-purple-600' : ''}`}>
                          <Package className="w-5 h-5 mr-3 text-gray-400" /><span>Orders</span>
                        </Link>
                        <Link href="/wallet" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${isActive('/wallet') ? 'bg-green-50 text-green-600' : ''}`}>
                          <Wallet className="w-5 h-5 mr-3 text-gray-400" />
                          <div className="flex items-center justify-between flex-1">
                            <span>Wallet</span>
                            {userBalance > 0 && <span className="text-xs text-green-600 font-bold">₦{userBalance.toLocaleString()}</span>}
                          </div>
                        </Link>
                        <Link href="/dispute/select-order" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors ${isActive('/dispute') ? 'bg-red-50 text-red-600' : ''}`}>
                          <AlertTriangle className="w-5 h-5 mr-3 text-gray-400" /><span>Disputes</span>
                        </Link>
                        {(userRole === 'SELLER' || userRole === 'ADMIN') && (
                          <div className="px-4 py-3 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Mode</span>
                              <button onClick={toggleRoleMode} className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition-colors hover:bg-gray-400">
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSellerMode ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                              <span className="text-xs text-gray-500">{isSellerMode ? 'Selling' : 'Buying'}</span>
                            </div>
                          </div>
                        )}
                        {userRole === 'BUYER' && (
                          <Link href="/become-seller" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center px-4 py-3 text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100">
                            <PlusCircle className="w-5 h-5 mr-3" /><span className="font-medium">Become a Seller</span>
                          </Link>
                        )}
                      </>
                    )}
                    <button onClick={handleLogout} className="flex items-center w-full px-4 py-3 text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100">
                      <LogOut className="w-5 h-5 mr-3" /><span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/login" className="font-semibold text-blue-900 hover:text-blue-700 transition-colors">Login</Link>
                <Link href="/signup" className="text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg text-sm" style={{ background: 'linear-gradient(135deg, #3D95E8, #4DABFF)' }}>Sign Up</Link>
              </div>
            )}
          </div>

          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2A2A2A] transition-colors">
            <svg className="w-6 h-6 text-gray-700 dark:text-[#D7D7D7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-[#343434] bg-white dark:bg-[#1E1E1E] max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-4">
            <div className="flex items-center justify-end gap-4 mb-4 pb-4 border-b border-gray-200">
              {isLoggedIn && userRole !== 'RIDER' && (
                <Link href="/cart" className="relative p-2 text-gray-600 hover:text-blue-600">
                  <ShoppingBag className="w-6 h-6" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </Link>
              )}
              {isLoggedIn && <NotificationBell />}
            </div>
            {isLoggedIn ? (
              <div className="space-y-2">
                {userRole === 'RIDER' ? (
                  /* Rider-only mobile menu */
                  <>
                    <Link href="/rider-dashboard" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/rider-dashboard') ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      <span>Dashboard</span>
                    </Link>
                    <Link href="/wallet" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/wallet') ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <Wallet className="w-5 h-5 mr-3" /><span>Earnings</span>
                    </Link>
                    <Link href="/notifications" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/notifications') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <span>Notifications</span>
                    </Link>
                  </>
                ) : (
                  /* Regular buyer/seller mobile menu */
                  <>
                    <Link href="/myprofile" onClick={() => setIsMenuOpen(false)} className="flex items-center px-4 py-3 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #3D95E8, #4DABFF)' }}>
                      <User className="w-5 h-5 mr-3" /><span className="font-medium">My Account</span>
                    </Link>
                    <Link href="/marketplace" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/marketplace') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <Globe className="w-5 h-5 mr-3" /><span>Marketplace</span>
                    </Link>
                    <Link href="/my-shop" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/my-shop') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <Store className="w-5 h-5 mr-3" /><span>{isSellerMode && (userRole === 'SELLER' || userRole === 'ADMIN') ? 'My Shop' : 'My Items'}</span>
                    </Link>
                    {isLoggedIn && (userRole === 'SELLER' || userRole === 'ADMIN') && isSellerMode && (
                      <Link href="/sell" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/sell') ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <PlusCircle className="w-5 h-5 mr-3" /><span>Sell</span>
                      </Link>
                    )}
                    <Link href="/orders" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/orders') ? 'bg-purple-50 text-purple-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <Package className="w-5 h-5 mr-3" /><span>Orders</span>
                    </Link>
                    <Link href="/wallet" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/wallet') ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <Wallet className="w-5 h-5 mr-3" />
                      <div className="flex items-center justify-between flex-1">
                        <span>Wallet</span>
                        {userBalance > 0 && <span className="text-sm text-green-600 font-bold">₦{userBalance.toLocaleString()}</span>}
                      </div>
                    </Link>
                    <Link href="/dispute/select-order" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-xl transition-all ${isActive('/dispute') ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <AlertTriangle className="w-5 h-5 mr-3" /><span>Disputes</span>
                    </Link>
                  </>
                )}

                <div className="pt-4 border-t border-gray-200 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-gray-700 font-medium">Hi, {userName || 'User'}!</div>
                      <div className="text-sm text-gray-500 capitalize">{userRole.toLowerCase()}</div>
                    </div>
                    {(userRole === 'SELLER' || userRole === 'ADMIN') && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">{isSellerMode ? 'Selling' : 'Buying'}</span>
                        <button onClick={toggleRoleMode} className="relative inline-flex h-5 w-10 items-center rounded-full bg-gray-300">
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSellerMode ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { handleLogout(); setIsMenuOpen(false) }}
                    className="flex items-center justify-center w-full space-x-2 bg-red-600 text-white px-4 py-3 rounded-xl font-medium hover:bg-red-700 transition-all"
                  >
                    <LogOut className="w-5 h-5" /><span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/login" onClick={() => setIsMenuOpen(false)} className="text-center py-3 border-2 border-blue-900 text-blue-900 rounded-lg font-medium hover:bg-blue-900 hover:text-white transition-all">Login</Link>
                <Link href="/signup" onClick={() => setIsMenuOpen(false)} className="text-center py-3 text-white rounded-lg font-medium transition-all" style={{ background: 'linear-gradient(135deg, #3D95E8, #4DABFF)' }}>Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
