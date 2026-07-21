'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCartStore } from '@/lib/cart-store'
import NotificationBell from '@/components/layout/NotificationBell'
import {
  ChevronDown, User, LogOut, Store, ShoppingBag, Wallet,
  Package, AlertTriangle, PlusCircle, Globe, Plus, Bike,
  LayoutGrid, Bell as BellIcon, Menu, X, Search, MapPin,
} from 'lucide-react'

import { isSplashPending } from '@/components/SplashScreen'
import { useKeyboardVisibility } from '@/components/layout/KeyboardVisibilityProvider'
import { Logo } from '@/components/layout/Logo'

function BATAMARTLogo({ appMode = false }: { appMode?: boolean }) {
  const href = appMode ? '/marketplace?app=true' : '/'
  return <Logo href={href} size={30} />
}

function AppTopBar({
  isLoggedIn,
  cartCount,
}: {
  isLoggedIn: boolean
  cartCount: number
}) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        <BATAMARTLogo appMode />
        <div className="flex items-center gap-1">
          <Link href="/search?app=true&focus=1" className="p-2 text-ink-secondary" aria-label="Search">
            <Search className="w-5 h-5" strokeWidth={1.75} />
          </Link>
          {isLoggedIn ? (
            <>
              <Link href="/cart?app=true" className="relative p-2 text-ink-secondary">
                <ShoppingBag className="w-6 h-6" strokeWidth={1.75} />
                {cartCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-primary text-white text-[10px] font-medium w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>
              <NotificationBell />
            </>
          ) : (
            <Link
              href="/login?app=true"
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-primary hover:brightness-95 transition-all"
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary">
            <Bike className="w-4 h-4 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-ink font-semibold text-sm leading-none">BataMart</p>
            <p className="text-primary text-[10px] font-medium leading-none mt-0.5">Rider mode</p>
          </div>
        </div>
        {isLoggedIn && userName && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-xs font-semibold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-ink-secondary text-xs font-medium">{userName.split(' ')[0]}</span>
          </div>
        )}
      </div>
    </nav>
  )
}

function RiderBottomNav({ onLogout }: { onLogout: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [profileOpen, setProfileOpen] = useState(false)
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [toggling, setToggling] = useState(false)
  const { isKeyboardOpen } = useKeyboardVisibility()

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
  const riderTab = searchParams.get('tab') || ''

  const handleTabPress = (href: string, active: boolean) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (active) {
      router.refresh()
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    router.push(href)
  }

  const leftTabs = [
    {
      href: '/rider-dashboard?app=true&rider=true',
      label: 'Dashboard',
      match: '/rider-dashboard',
      icon: <LayoutGrid className="w-[22px] h-[22px]" strokeWidth={1.75} />,
    },
    {
      href: '/rider-dashboard?app=true&rider=true&tab=deliveries',
      label: 'Deliveries',
      match: '/rider-dashboard',
      icon: <Package className="w-[22px] h-[22px]" strokeWidth={1.75} />,
    },
  ]

  const rightTabs = [
    {
      href: '/wallet?app=true&rider=true',
      label: 'Earnings',
      match: '/wallet',
      icon: <Wallet className="w-[22px] h-[22px]" strokeWidth={1.75} />,
    },
  ]

  return (
    <>
      <nav
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-xl border-t border-border shadow-soft transition-transform transition-opacity duration-200 ease-out ${isKeyboardOpen ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
        style={{
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
            const active = label === 'Deliveries'
              ? pathname === '/rider-dashboard' && riderTab === 'deliveries'
              : pathname === '/rider-dashboard' && riderTab !== 'deliveries'
            return (
              <Link
                key={label}
                href={href}
                onClick={handleTabPress(href, active)}
                className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
                  active ? 'text-primary' : 'text-ink-muted'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-primary" />
                )}
                <span className={active ? 'scale-110 transition-transform' : 'transition-transform'}>
                  {icon}
                </span>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            )
          })}

          <div className="flex-1 flex items-center justify-center relative">
            <button
              onClick={toggleAvailability}
              disabled={toggling || isAvailable === null}
              className="relative z-10 flex flex-col items-center justify-center -mt-5"
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-soft ${
                  isAvailable ? 'bg-success' : 'bg-ink-muted'
                }`}
                style={{ opacity: toggling ? 0.7 : 1 }}
              >
                <Bike className="w-6 h-6 text-white" strokeWidth={1.75} />
              </div>
              <span className={`text-[10px] font-medium mt-1 leading-none ${isAvailable ? 'text-success' : 'text-ink-muted'}`}>
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
                onClick={handleTabPress(href, active)}
                className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
                  active ? 'text-primary' : 'text-ink-muted'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-b-full bg-primary" />
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
              profileOpen ? 'text-primary' : 'text-ink-muted'
            }`}
          >
            <div className="w-[26px] h-[26px] rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
            </div>
            <span className="text-[10px] font-medium leading-none">Profile</span>
          </button>
        </div>
      </nav>

      {profileOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-ink/40"
            onClick={() => setProfileOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl shadow-soft border-t border-border bg-white"
            style={{
              paddingBottom: 'calc(24px + max(env(safe-area-inset-bottom), 16px))',
            }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            <div className="px-4 py-2">
              {[
                { href: '/rider-dashboard?app=true&rider=true', icon: LayoutGrid, label: 'Dashboard' },
                { href: '/wallet?app=true&rider=true', icon: Wallet, label: 'Earnings' },
                { href: '/notifications?app=true&rider=true', icon: BellIcon, label: 'Notifications' },
              ].map(({ href, icon: Icon, label }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-2 py-3.5 text-ink hover:text-primary border-b border-border last:border-0"
                >
                  <Icon className="w-5 h-5 text-ink-muted" strokeWidth={1.75} />
                  <span className="font-medium text-sm">{label}</span>
                </Link>
              ))}
            </div>
            <div className="px-6 pt-3">
              <button
                onClick={() => { setProfileOpen(false); onLogout() }}
                className="flex items-center justify-center w-full gap-2 bg-danger/10 text-danger font-medium py-3 rounded-lg border border-danger/20"
              >
                <LogOut className="w-5 h-5" strokeWidth={1.75} />
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
  const router = useRouter()
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const { isKeyboardOpen } = useKeyboardVisibility()

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + '/')

  const handleTabPress = (href: string, active: boolean) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (active) {
      router.refresh()
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    router.push(href)
  }

  const isSeller = userRole === 'SELLER' || userRole === 'ADMIN'

  const sellHref = isLoggedIn
    ? isSeller && isSellerMode ? '/sell?app=true' : '/become-seller?app=true'
    : '/login?app=true'

  const leftTabs = [
    {
      href: '/marketplace?app=true',
      label: 'Market',
      match: '/marketplace',
      icon: <Store className="w-[22px] h-[22px]" strokeWidth={1.75} />,
    },
    {
      href: isLoggedIn ? '/orders?app=true' : '/login?app=true',
      label: 'Orders',
      match: '/orders',
      icon: <Package className="w-[22px] h-[22px]" strokeWidth={1.75} />,
    },
  ]

  const rightTabs = [
    {
      href: isLoggedIn ? '/wallet?app=true' : '/login?app=true',
      label: 'Wallet',
      match: '/wallet',
      icon: <Wallet className="w-[22px] h-[22px]" strokeWidth={1.75} />,
    },
  ]

  return (
    <>
      <nav
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white/92 backdrop-blur-xl border-t border-border shadow-soft transition-transform transition-opacity duration-200 ease-out ${isKeyboardOpen ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
        style={{
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
                onClick={handleTabPress(href, active)}
                className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
                  active ? 'text-primary' : 'text-ink-muted'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-b-full" />
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
              onClick={handleTabPress(sellHref, isActive('/sell') || isActive('/become-seller'))}
              className="relative z-10 flex flex-col items-center justify-center -mt-5"
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-primary shadow-soft transition-transform active:scale-95">
                <Plus className="w-7 h-7 text-white" strokeWidth={1.75} />
              </div>
              <span className="text-[10px] font-medium text-primary mt-1 leading-none">Sell</span>
            </Link>
          </div>

          {rightTabs.map(({ href, label, match, icon }) => {
            const active = isActive(match)
            return (
              <Link
                key={label}
                href={href}
                onClick={handleTabPress(href, active)}
                className={`flex-1 flex flex-col items-center justify-center gap-[3px] relative transition-all duration-200 ease-out active:scale-[0.98] ${
                  active ? 'text-primary' : 'text-ink-muted'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-b-full" />
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
              profileOpen ? 'text-primary' : 'text-ink-muted'
            }`}
          >
            <div
              className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                isLoggedIn
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-surface text-ink-muted'
              }`}
            >
              {isLoggedIn && userName
                ? userName.charAt(0).toUpperCase()
                : <User className="w-3.5 h-3.5" strokeWidth={1.75} />}
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
            className="fixed inset-0 z-[60] bg-ink/40"
            onClick={() => setProfileOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl shadow-soft"
            style={{ paddingBottom: 'calc(24px + max(env(safe-area-inset-bottom), 16px))' }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>

            {isLoggedIn ? (
              <>
                <div className="px-6 py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-lg font-semibold">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-ink">{userName}</p>
                      <p className="text-xs text-ink-muted capitalize">{userRole.toLowerCase()}</p>
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
                        className="flex items-center gap-3 px-2 py-3.5 text-ink hover:text-primary border-b border-border last:border-0"
                      >
                        <Icon className="w-5 h-5 text-ink-muted" strokeWidth={1.75} />
                        <span className="font-medium text-sm">{label}</span>
                      </Link>
                    ))}
                </div>

                <div className="px-6 pt-2 space-y-3">
                  {(userRole === 'SELLER' || userRole === 'ADMIN') && (
                    <div className="flex items-center justify-between px-4 py-3 bg-surface rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium text-ink">Mode</p>
                        <p className="text-xs text-ink-muted">{isSellerMode ? 'You are selling' : 'You are buying'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-ink-secondary">Buying</span>
                        <button
                          onClick={() => { onToggleMode() }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSellerMode ? 'bg-primary' : 'bg-border'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isSellerMode ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className="text-xs text-ink-secondary">Selling</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => { setProfileOpen(false); onLogout() }}
                    className="flex items-center justify-center w-full gap-2 bg-danger/10 text-danger font-medium py-3 rounded-lg"
                  >
                    <LogOut className="w-5 h-5" strokeWidth={1.75} />
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="px-6 py-6 flex flex-col gap-3">
                <p className="text-center text-ink-secondary text-sm mb-2">Sign in to access your account</p>
                <Link
                  href="/login?app=true"
                  onClick={() => setProfileOpen(false)}
                  className="text-center h-11 flex items-center justify-center border border-primary text-primary rounded-lg font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/signup?app=true"
                  onClick={() => setProfileOpen(false)}
                  className="text-center h-11 flex items-center justify-center text-white rounded-lg font-medium bg-primary"
                >
                  Create account
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
    const onRiderRoute =
      pathname?.startsWith('/rider-dashboard') ||
      pathname?.startsWith('/rider/login')

    if (isRiderParam || onRiderRoute || sessionStorage.getItem('batamart_rider_mode') === 'true') {
      sessionStorage.setItem('batamart_rider_mode', 'true')
      setIsRider(true)
    } else {
      setIsRider(false)
    }
  }, [isRiderParam, pathname])

  const riderRouteAllowed =
    pathname?.startsWith('/rider-dashboard') ||
    pathname?.startsWith('/wallet') ||
    pathname?.startsWith('/notifications') ||
    pathname?.startsWith('/rider/login') ||
    pathname?.startsWith('/login')

  useEffect(() => {
    if (!isApp || !isRider) return
    if (!riderRouteAllowed) {
      router.replace('/rider-dashboard?app=true&rider=true')
    }
  }, [isApp, isRider, riderRouteAllowed, router])

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
  const [universityShortName, setUniversityShortName] = useState('')
  const [navSearch, setNavSearch]                 = useState('')
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
            setUniversityShortName(data.user.university?.shortName || '')
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
        setUniversityShortName('')
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

  const submitNavSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = navSearch.trim()
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  if (isAndroid) return null
  if (!splashDone) return null
  if (pathname === '/' || pathname?.startsWith('/rider/login')) return null

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
      className={`fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-border shadow-soft transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-4 h-16">

          <Logo size={30} />

          <form onSubmit={submitNavSearch} className="hidden md:flex flex-1 max-w-xl items-center gap-2 bg-surface border border-border rounded-lg px-3">
            <Search className="w-4 h-4 text-ink-muted flex-shrink-0" strokeWidth={1.75} />
            <input
              type="text"
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              placeholder="Search for products, brands and categories"
              className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-ink-muted py-2.5 min-w-0"
            />
            <button type="submit" className="flex-shrink-0 px-3 py-1.5 bg-primary hover:brightness-95 text-white rounded-md font-medium text-xs transition-colors flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" strokeWidth={1.75} /> Search
            </button>
          </form>

          <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
            {universityShortName && (
              <span className="flex items-center gap-1 text-xs font-medium text-ink-secondary whitespace-nowrap pr-2 border-r border-border mr-1">
                <MapPin className="w-3.5 h-3.5 text-ink-muted flex-shrink-0" strokeWidth={1.75} />
                Deliver to <span className="text-ink font-semibold">{universityShortName}</span>
              </span>
            )}
            {isLoggedIn && (
              <Link href="/cart" className="relative p-2 text-ink-secondary hover:text-primary hover:bg-surface rounded-full transition-all">
                <ShoppingBag className="w-6 h-6" strokeWidth={1.75} />
                {cartCount > 0 && (
                  <span className="absolute top-0 right-0 bg-primary text-white text-xs font-medium w-5 h-5 rounded-full flex items-center justify-center">
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
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-surface transition-all"
                >
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-ink">Hi, {userName || 'User'}</span>
                    {userRole === 'SELLER' || userRole === 'ADMIN' ? (
                      isSellerMode ? (
                        <span
                          role="link"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); router.push('/orders/sales') }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); router.push('/orders/sales') } }}
                          className="text-xs text-ink-secondary hover:text-primary hover:underline cursor-pointer"
                        >
                          Selling
                        </span>
                      ) : (
                        <span className="text-xs text-ink-secondary">
                          {userRole === 'ADMIN' ? 'Admin' : 'Buying'}
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-ink-secondary">
                        {userRole === 'ADMIN' ? 'Admin' : userRole === 'RIDER' ? 'Rider' : 'Buyer'}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-ink-secondary transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={1.75} />
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-soft border border-border py-2 z-50">
                    {/* Rider-specific dropdown */}
                    {userRole === 'RIDER' ? (
                      <>
                        <Link href="/rider-dashboard" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors ${isActive('/rider-dashboard') ? 'bg-primary/10 text-primary' : ''}`}>
                          <LayoutGrid className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} />
                          <span className="font-medium">Dashboard</span>
                        </Link>
                        <Link href="/wallet" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors ${isActive('/wallet') ? 'bg-primary/10 text-primary' : ''}`}>
                          <Wallet className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} />
                          <div className="flex items-center justify-between flex-1">
                            <span>Earnings</span>
                            {userBalance > 0 && <span className="text-xs text-success font-medium">₦{userBalance.toLocaleString()}</span>}
                          </div>
                        </Link>
                        <Link href="/notifications" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors ${isActive('/notifications') ? 'bg-primary/10 text-primary' : ''}`}>
                          <BellIcon className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} />
                          <span>Notifications</span>
                        </Link>
                      </>
                    ) : (
                      /* Regular buyer/seller dropdown */
                      <>
                        <Link href="/myprofile" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors border-b border-border">
                          <User className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} /><span className="font-medium">My Account</span>
                        </Link>
                        <Link href="/marketplace" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors ${isActive('/marketplace') ? 'bg-primary/10 text-primary' : ''}`}>
                          <Globe className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} /><span>Marketplace</span>
                        </Link>
                        <Link href="/my-shop" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors ${isActive('/my-shop') ? 'bg-primary/10 text-primary' : ''}`}>
                          <Store className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} /><span>{isSellerMode && (userRole === 'SELLER' || userRole === 'ADMIN') ? 'My Shop' : 'My Items'}</span>
                        </Link>
                        {isLoggedIn && (userRole === 'SELLER' || userRole === 'ADMIN') && isSellerMode && (
                          <Link href="/sell" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors ${isActive('/sell') ? 'bg-primary/10 text-primary' : ''}`}>
                            <PlusCircle className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} /><span>Sell</span>
                          </Link>
                        )}
                        <Link href="/orders" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors ${isActive('/orders') ? 'bg-primary/10 text-primary' : ''}`}>
                          <Package className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} /><span>Orders</span>
                        </Link>
                        <Link href="/wallet" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors ${isActive('/wallet') ? 'bg-primary/10 text-primary' : ''}`}>
                          <Wallet className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} />
                          <div className="flex items-center justify-between flex-1">
                            <span>Wallet</span>
                            {userBalance > 0 && <span className="text-xs text-success font-medium">₦{userBalance.toLocaleString()}</span>}
                          </div>
                        </Link>
                        <Link href="/dispute/select-order" onClick={() => setIsUserDropdownOpen(false)} className={`flex items-center px-4 py-3 text-ink hover:bg-surface transition-colors ${isActive('/dispute') ? 'bg-danger/10 text-danger' : ''}`}>
                          <AlertTriangle className="w-5 h-5 mr-3 text-ink-muted" strokeWidth={1.75} /><span>Disputes</span>
                        </Link>
                        {(userRole === 'SELLER' || userRole === 'ADMIN') && (
                          <div className="px-4 py-3 border-t border-border">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-ink-secondary">Mode</span>
                              <button onClick={toggleRoleMode} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSellerMode ? 'bg-primary' : 'bg-border'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSellerMode ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                              <span className="text-xs text-ink-secondary">{isSellerMode ? 'Selling' : 'Buying'}</span>
                            </div>
                          </div>
                        )}
                        {userRole === 'BUYER' && (
                          <Link href="/become-seller" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center px-4 py-3 text-primary hover:bg-primary/5 transition-colors border-t border-border">
                            <PlusCircle className="w-5 h-5 mr-3" strokeWidth={1.75} /><span className="font-medium">Become a seller</span>
                          </Link>
                        )}
                      </>
                    )}
                    <button onClick={handleLogout} className="flex items-center w-full px-4 py-3 text-danger hover:bg-danger/5 transition-colors border-t border-border">
                      <LogOut className="w-5 h-5 mr-3" strokeWidth={1.75} /><span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link href="/login" className="font-medium text-ink hover:text-primary transition-colors">Login</Link>
                <Link href="/signup" className="text-white px-4 py-2 rounded-lg font-medium transition-all text-sm bg-primary hover:brightness-95">Sign up</Link>
              </div>
            )}
          </div>

          <div className="flex md:hidden items-center gap-1 ml-auto flex-shrink-0">
            <Link href="/search?focus=1" className="p-2 rounded-lg hover:bg-surface transition-colors" aria-label="Search">
              <Search className="w-5 h-5 text-ink" strokeWidth={1.75} />
            </Link>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 rounded-lg hover:bg-surface transition-colors" aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}>
              {isMenuOpen ? <X className="w-6 h-6 text-ink" strokeWidth={1.75} /> : <Menu className="w-6 h-6 text-ink" strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-white max-h-[calc(100dvh-4rem)] overflow-y-auto">
          <div className="px-4 py-4">
            <div className="flex items-center justify-end gap-4 mb-4 pb-4 border-b border-border">
              {isLoggedIn && userRole !== 'RIDER' && (
                <Link href="/cart" className="relative p-2 text-ink-secondary hover:text-primary">
                  <ShoppingBag className="w-6 h-6" strokeWidth={1.75} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-medium w-5 h-5 rounded-full flex items-center justify-center">
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
                    <Link href="/rider-dashboard" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/rider-dashboard') ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:bg-surface'}`}>
                      <LayoutGrid className="w-5 h-5 mr-3" strokeWidth={1.75} />
                      <span>Dashboard</span>
                    </Link>
                    <Link href="/wallet" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/wallet') ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:bg-surface'}`}>
                      <Wallet className="w-5 h-5 mr-3" strokeWidth={1.75} /><span>Earnings</span>
                    </Link>
                    <Link href="/notifications" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/notifications') ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:bg-surface'}`}>
                      <BellIcon className="w-5 h-5 mr-3" strokeWidth={1.75} />
                      <span>Notifications</span>
                    </Link>
                  </>
                ) : (
                  /* Regular buyer/seller mobile menu */
                  <>
                    <Link href="/myprofile" onClick={() => setIsMenuOpen(false)} className="flex items-center px-4 py-3 rounded-lg text-white bg-primary">
                      <User className="w-5 h-5 mr-3" strokeWidth={1.75} /><span className="font-medium">My Account</span>
                    </Link>
                    <Link href="/marketplace" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/marketplace') ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:bg-surface'}`}>
                      <Globe className="w-5 h-5 mr-3" strokeWidth={1.75} /><span>Marketplace</span>
                    </Link>
                    <Link href="/my-shop" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/my-shop') ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:bg-surface'}`}>
                      <Store className="w-5 h-5 mr-3" strokeWidth={1.75} /><span>{isSellerMode && (userRole === 'SELLER' || userRole === 'ADMIN') ? 'My Shop' : 'My Items'}</span>
                    </Link>
                    {isLoggedIn && (userRole === 'SELLER' || userRole === 'ADMIN') && isSellerMode && (
                      <Link href="/sell" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/sell') ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:bg-surface'}`}>
                        <PlusCircle className="w-5 h-5 mr-3" strokeWidth={1.75} /><span>Sell</span>
                      </Link>
                    )}
                    <Link href="/orders" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/orders') ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:bg-surface'}`}>
                      <Package className="w-5 h-5 mr-3" strokeWidth={1.75} /><span>Orders</span>
                    </Link>
                    <Link href="/wallet" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/wallet') ? 'bg-primary/10 text-primary' : 'text-ink-secondary hover:bg-surface'}`}>
                      <Wallet className="w-5 h-5 mr-3" strokeWidth={1.75} />
                      <div className="flex items-center justify-between flex-1">
                        <span>Wallet</span>
                        {userBalance > 0 && <span className="text-sm text-success font-medium">₦{userBalance.toLocaleString()}</span>}
                      </div>
                    </Link>
                    <Link href="/dispute/select-order" onClick={() => setIsMenuOpen(false)} className={`flex items-center px-4 py-3 rounded-lg transition-all ${isActive('/dispute') ? 'bg-danger/10 text-danger' : 'text-ink-secondary hover:bg-surface'}`}>
                      <AlertTriangle className="w-5 h-5 mr-3" strokeWidth={1.75} /><span>Disputes</span>
                    </Link>
                  </>
                )}

                <div className="pt-4 border-t border-border mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-ink font-medium">Hi, {userName || 'User'}!</div>
                      <div className="text-sm text-ink-secondary capitalize">{userRole.toLowerCase()}</div>
                    </div>
                    {(userRole === 'SELLER' || userRole === 'ADMIN') && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-ink-secondary">{isSellerMode ? 'Selling' : 'Buying'}</span>
                        <button onClick={toggleRoleMode} className={`relative inline-flex h-5 w-10 items-center rounded-full ${isSellerMode ? 'bg-primary' : 'bg-border'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSellerMode ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { handleLogout(); setIsMenuOpen(false) }}
                    className="flex items-center justify-center w-full space-x-2 bg-danger text-white px-4 py-3 rounded-lg font-medium hover:brightness-95 transition-all"
                  >
                    <LogOut className="w-5 h-5" strokeWidth={1.75} /><span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/login" onClick={() => setIsMenuOpen(false)} className="text-center h-11 flex items-center justify-center border border-primary text-primary rounded-lg font-medium hover:bg-primary hover:text-white transition-all">Login</Link>
                <Link href="/signup" onClick={() => setIsMenuOpen(false)} className="text-center h-11 flex items-center justify-center text-white rounded-lg font-medium transition-all bg-primary hover:brightness-95">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}





