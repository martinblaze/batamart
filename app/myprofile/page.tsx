'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { buildFeedQuery } from '@/lib/feed-signals'
import {
  User, ShoppingBag, Store, PlusCircle, Wallet, Package,
  AlertTriangle, LogOut, ChevronRight, MapPin, Phone,
  Home, Mail, Edit2, Check, X, Loader2, Menu, Gift,
  Sparkles, Shield, Star, Search, Sun, Moon,
  Share, SquarePlus, CheckCircle2, BellRing, BellOff,
} from 'lucide-react'
import { ReferralCard } from '@/components/ui/ReferralCard'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useTheme } from '@/components/layout/ThemeProvider'
import {
  enableWithdrawalBiometrics,
  getBiometricPreference,
  isBiometricSupported,
  setBiometricPreference,
} from '@/lib/withdraw-biometrics'

const PROFILE_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }

  .header-gradient {
    /* Ink, not accent. A full-bleed blue slab at the top of four different
       screens was the loudest thing in the product and made every one of
       them read as a different app. */
    background: var(--ui-slab);
  }

  .nav-item {
    transition: background 0.12s ease, color 0.12s ease, padding-left 0.12s ease;
  }
  .nav-item:hover {
    background: var(--color-surface);
    color: var(--ui-ink);
  }

  .section-card {
    transition: border-color 0.3s var(--ui-ease);
  }
  .section-card:hover { border-color: var(--ui-hairline-strong); }

  .input-field {
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  }
  .input-field:focus {
    border-color: var(--color-primary) !important;
    background: white !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
    outline: none;
  }

  .save-btn {
    background: var(--ui-slab);
    transition: background-color 0.3s var(--ui-ease), transform 0.2s var(--ui-ease);
  }
  .save-btn:hover:not(:disabled) { background: var(--color-primary); }
  .save-btn:active:not(:disabled) { transform: scale(0.985); }

  .product-thumb {
    transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
  }
  .product-thumb:hover { transform: scale(1.05); }
  .product-thumb:hover img { transform: scale(1.08); }

  .tag-chip {
    transition: all 0.15s cubic-bezier(0.34,1.4,0.64,1);
  }
  .tag-chip:hover {
    background: var(--ui-slab);
    color: white;
  }

  .slide-menu {
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
  }
  .slide-menu-open { transform: translateX(0); }

  .theme-toggle {
    transition: all 0.2s ease;
  }
  .theme-toggle:hover {
    transform: translateY(-1px);
  }

  .dark .profile-page .input-field {
    background: var(--color-background) !important;
    border-color: var(--color-border) !important;
    color: var(--color-text-primary) !important;
  }
  .dark .profile-page .input-field::placeholder { color: var(--color-text-muted); }
  .dark .profile-page .input-field:focus {
    border-color: var(--color-primary) !important;
    background: var(--color-background) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
  }
  .dark .profile-page .tag-chip:hover {
    background: var(--color-primary) !important;
    color: #ffffff !important;
    border-color: transparent !important;
  }
`

interface UserProfile {
  id: string; name: string; email: string; phone: string
  hostelName: string; roomNumber: string; landmark: string
  role: string; isSellerMode: boolean; username?: string | null
}
interface WalletData { availableBalance: number }

export default function MyProfilePage() {
  const router = useRouter()
  const { theme, mounted, toggleTheme } = useTheme()
  const [user, setUser]             = useState<UserProfile | null>(null)
  const [wallet, setWallet]         = useState<WalletData | null>(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [isEditing, setIsEditing]   = useState(false)
  const [editedUser, setEditedUser] = useState<Partial<UserProfile>>({})
  const [saveError, setSaveError]   = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  // Set when the checkout (or another page) sent the user here to finish a
  // required detail; after saving we send them back where they were.
  const [setupReason, setSetupReason] = useState<'username' | 'address' | null>(null)
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isApp, setIsApp]           = useState(false)
  const [isIOSBrowser, setIsIOSBrowser] = useState(false)
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const [biometricMessage, setBiometricMessage] = useState('')

  const { isSupported, isSubscribed, isLoading: notifLoading, permission, subscribe, unsubscribe } = usePushSubscription()
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
  const isIosBrowserTab = isIos && !isStandalone
  const isIosPwa = isIos && isStandalone

  useEffect(() => {
    if (document.getElementById('profile-anim')) return
    const s = document.createElement('style'); s.id = 'profile-anim'; s.textContent = PROFILE_CSS
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setIsApp(params.get('app') === 'true')
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    setIsIOSBrowser(isIOS && !isStandalone)
  }, [])

  useEffect(() => { fetchProfileData() }, [])

  useEffect(() => {
    let mountedFlag = true
    ;(async () => {
      const available = await isBiometricSupported()
      if (mountedFlag) setBiometricAvailable(available)
    })()
    return () => { mountedFlag = false }
  }, [])

  useEffect(() => {
    if (!user) return
    const pref = getBiometricPreference(user.id)
    setBiometricEnabled(pref === 'enabled')
  }, [user])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMobileMenuOpen(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset'
    return () => { document.body.style.overflow = 'unset' }
  }, [isMobileMenuOpen])

  const fetchProfileData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
      const [userRes, walletRes] = await Promise.all([
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const userData  = await userRes.json()
      const walletData = await walletRes.json()
      if (userRes.ok) {
        setUser(userData.user); setEditedUser(userData.user)
        const qs = new URLSearchParams(window.location.search)
        const setup = qs.get('setup')
        const back = qs.get('redirect')
        if (setup === 'username' || setup === 'address') { setSetupReason(setup); setIsEditing(true) }
        if (back && back.startsWith('/')) setReturnTo(back)
      }
      if (walletRes.ok) setWallet(walletData.wallet)
    } catch {}
    finally { setLoading(false) }
  }

  const handleSave = async () => {
    setSaving(true); setSaveError(''); setSaveSuccess(false)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editedUser.name, phone: editedUser.phone, hostelName: editedUser.hostelName, roomNumber: editedUser.roomNumber, landmark: editedUser.landmark, ...(editedUser.username ? { username: editedUser.username } : {}) }),
      })
      const data = await response.json()
      if (response.ok) {
        const saved = { ...user!, ...editedUser, username: data.user?.username ?? editedUser.username }
        setUser(saved); setEditedUser(saved); setIsEditing(false); setSaveSuccess(true)
        // Back to checkout (or wherever) once the missing detail is filled in.
        const satisfied =
          setupReason === 'username' ? !!saved.username :
          setupReason === 'address' ? !!(saved.hostelName && saved.roomNumber) : false
        if (returnTo && satisfied) { router.push(returnTo); return }
        if (editedUser.name) localStorage.setItem('userName', editedUser.name)
        window.dispatchEvent(new Event('auth-change'))
        setTimeout(() => setSaveSuccess(false), 3000)
      } else { setSaveError(data.error || 'Failed to update profile') }
    } catch { setSaveError('Network error. Please try again.') }
    finally { setSaving(false) }
  }

  const handleCancel = () => { setEditedUser(user || {}); setIsEditing(false); setSaveError('') }
  const handleLogout = () => { localStorage.clear(); window.dispatchEvent(new Event('auth-change')); router.push('/') }
  const handleBiometricToggle = async () => {
    if (!user || !biometricAvailable) return
    setBiometricBusy(true)
    setBiometricMessage('')
    try {
      if (biometricEnabled) {
        setBiometricPreference(user.id, 'disabled')
        setBiometricEnabled(false)
        setBiometricMessage('Biometric withdrawal turned off.')
      } else {
        await enableWithdrawalBiometrics(user)
        setBiometricPreference(user.id, 'enabled')
        setBiometricEnabled(true)
        setBiometricMessage('Biometric withdrawal is now on.')
      }
    } catch {
      setBiometricMessage('Could not update biometric setting. Please try again.')
    } finally {
      setBiometricBusy(false)
      setTimeout(() => setBiometricMessage(''), 3000)
    }
  }

  if (loading || !user) return (
    <div className="profile-page min-h-screen flex items-center justify-center bg-surface dark:bg-[#000000]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <p className="text-ink-secondary font-semibold">Loading your profile…</p>
      </div>
    </div>
  )

  const isSeller = user.role === 'SELLER' || user.role === 'ADMIN'
  const menuItems = [
    { icon: <ShoppingBag className="w-5 h-5" />, label: 'Marketplace', href: isApp ? '/marketplace?app=true' : '/marketplace' },
    { icon: <Store className="w-5 h-5" />, label: isSeller && user.isSellerMode ? 'My Shop' : 'My Items', href: isApp ? '/my-shop?app=true' : '/my-shop' },
    ...(isSeller && user.isSellerMode ? [{ icon: <PlusCircle className="w-5 h-5" />, label: 'Sell a Product', href: isApp ? '/sell?app=true' : '/sell' }] : []),
    { icon: <Package className="w-5 h-5" />, label: 'Orders', href: isApp ? '/orders?app=true' : '/orders' },
    { icon: <Wallet className="w-5 h-5" />, label: 'Wallet & Payouts', href: isApp ? '/wallet?app=true' : '/wallet' },
    { icon: <Gift className="w-5 h-5" />, label: 'Referrals', href: isApp ? '/referrals?app=true' : '/referrals' },
    ...(user.role !== 'RIDER' ? [{ icon: <AlertTriangle className="w-5 h-5" />, label: 'Disputes', href: isApp ? '/dispute/select-order?app=true' : '/dispute/select-order' }] : []),
  ]

  const roleLabel = user.role === 'SELLER' ? 'Seller' : user.role === 'RIDER' ? 'Rider' : user.role === 'ADMIN' ? 'Admin' : 'Buyer'
  const roleColor = 'bg-primary'
  const activeTheme = mounted ? theme : 'light'

  return (
    <div className="profile-page min-h-screen bg-surface dark:bg-[#000000]">

      {/* ── iOS Install Modal ── */}
      {showIOSInstallModal && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowIOSInstallModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card rounded-3xl p-6 shadow-soft max-h-[88vh] overflow-y-auto">
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary">
                  <ShoppingBag className="w-6 h-6 text-white" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-semibold text-ink">Add BataMart to Home Screen</p>
                  <p className="text-sm text-ink-secondary">Get the full app experience</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  { icon: Share, bg: 'bg-primary/10', iconColor: 'text-primary', title: 'Tap the Share button', sub: 'At the bottom of your Safari browser' },
                  { icon: SquarePlus, bg: 'bg-primary/10', iconColor: 'text-primary', title: 'Tap "Add to Home Screen"', sub: 'Scroll down in the share sheet' },
                  { icon: CheckCircle2, bg: 'bg-success/10', iconColor: 'text-success', title: 'Tap "Add" to confirm', sub: 'BataMart appears on your home screen' },
                ].map(({ icon: Icon, bg, iconColor, title, sub }) => (
                  <div key={title} className={`flex items-center gap-3 ${bg} px-4 py-3.5`}>
                    <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} strokeWidth={1.75} />
                    <div>
                      <p className="font-semibold text-sm text-ink">{title}</p>
                      <p className="text-xs text-ink-secondary mt-0.5">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowIOSInstallModal(false)}
                className="w-full text-white font-semibold py-4 rounded-2xl text-sm mb-3 bg-primary hover:brightness-95 transition-colors">
                Got it!
              </button>
              <button onClick={() => setShowIOSInstallModal(false)} className="w-full text-ink-muted text-sm font-medium">Maybe later</button>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile Header ── */}
      <div className="lg:hidden header-gradient sticky top-0 z-30 shadow-soft">
        <div className="flex items-center px-4 py-3.5 gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <Menu className="w-5 h-5 text-white" />
          </button>
          <h1 className="flex-1 text-[17px] text-white">My account</h1>
          <div className={`px-2.5 py-1 ${roleColor} rounded-xl`}>
            <span className="text-[10px] font-semibold text-white">{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Mobile Slide Menu ── */}
      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
          <div className={`slide-menu ${isMobileMenuOpen ? 'slide-menu-open' : ''} fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-card dark:bg-[#0f1115] z-50 lg:hidden shadow-soft`}>
            <div className="flex flex-col h-full">
              {/* Menu header */}
              <div className="header-gradient px-5 py-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${roleColor}`}>
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <p className="font-semibold text-white text-lg">{user.name}</p>
                <p className="text-white/60 text-xs mt-0.5">{user.email}</p>
                {wallet && (
                  <div className="mt-3 bg-white/10 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-white/70 text-xs font-semibold">Wallet</span>
                    <span className="text-white font-semibold text-sm">₦{wallet.availableBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              <nav className="flex-1 overflow-y-auto py-3">
                {menuItems.map((item, i) => (
                  <Link key={i} href={item.href} onClick={() => setIsMobileMenuOpen(false)}
                    className="nav-item flex items-center gap-4 px-5 py-3.5 text-ink-secondary border-b border-border">
                    <span className="text-ink-muted flex-shrink-0">{item.icon}</span>
                    <span className="font-semibold text-sm">{item.label}</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-ink-muted flex-shrink-0" />
                  </Link>
                ))}
              </nav>
              <div className="p-4 border-t border-border">
                <button onClick={() => { setIsMobileMenuOpen(false); handleLogout() }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-danger hover:bg-danger/10 rounded-2xl font-semibold text-sm transition-colors">
                  <LogOut className="w-5 h-5" /> Logout
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Desktop breadcrumb ── */}
      <div className="hidden lg:block header-gradient shadow-soft">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-2.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                <Link href="/marketplace" className="transition-colors hover:text-white/80">Marketplace</Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-white/70">My account</span>
              </div>
              <h1 className="text-[clamp(1.3rem,2.6vw,1.85rem)] text-white">Account overview</h1>
            </div>
            <div className={`px-3 py-1.5 ${roleColor} rounded-xl shadow-soft`}>
              <span className="text-xs font-semibold text-white">{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* ── Desktop Sidebar ── */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="border border-border bg-card sticky top-6">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${roleColor} shadow-soft`}>
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">{user.name}</p>
                    <p className="text-xs text-ink-muted capitalize">{roleLabel}</p>
                  </div>
                </div>
                {wallet && (
                  <div className="mt-3 flex items-center justify-between border border-border bg-surface px-3 py-2.5">
                    <span className="text-primary text-xs font-semibold">Balance</span>
                    <span className="text-primary font-semibold text-sm">₦{wallet.availableBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              <nav className="py-2">
                {menuItems.map((item, i) => (
                  <Link key={i} href={item.href}
                    className="nav-item flex items-center gap-3 px-4 py-3 text-ink-secondary border-b border-border last:border-0">
                    <span className="text-ink-muted flex-shrink-0">{item.icon}</span>
                    <span className="font-semibold text-sm">{item.label}</span>
                  </Link>
                ))}
              </nav>
              <div className="border-t border-border p-4">
                <button onClick={handleLogout}
                  className="flex items-center gap-2.5 text-danger hover:text-danger font-semibold text-sm w-full hover:bg-danger/10 px-3 py-2.5 rounded-xl transition-all">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          </div>

          {/* ── Main Content ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Edit header */}
            <div className="fade-up flex items-center justify-between border border-border bg-card px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">Profile Details</h2>
                <p className="text-xs text-ink-muted mt-0.5">{isEditing ? 'Editing mode' : 'View & manage your account'}</p>
              </div>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 text-primary hover:text-primary font-semibold text-sm px-4 py-2 rounded-xl hover:bg-primary/10 transition-all">
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={handleCancel}
                    className="flex items-center gap-1.5 text-ink-secondary font-semibold text-sm px-3 py-2 rounded-xl hover:bg-surface transition-all">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="save-btn flex items-center gap-1.5 text-white font-semibold text-sm px-4 py-2 rounded-xl disabled:opacity-50 shadow-soft">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {/* Feedback banners */}
            {saveSuccess && (
              <div className="fade-up flex items-center gap-3 bg-success/10 border border-success/30 text-success px-4 py-3.5 rounded-2xl">
                <Check className="w-5 h-5 flex-shrink-0" /> <span className="font-semibold text-sm">Profile updated!</span>
              </div>
            )}
            {saveError && (
              <div className="fade-up flex items-center gap-3 bg-danger/10 border border-danger/30 text-danger px-4 py-3.5 rounded-2xl">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" /> <span className="font-semibold text-sm">{saveError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account Details */}
              <div className="fade-up section-card border border-border bg-card">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-border bg-surface">
                    <User className="w-3.5 h-3.5 text-ink-secondary" />
                  </div>
                  <h2 className="ui-mono ui-mono-sm text-ink">Account Details</h2>
                  {isEditing && <span className="ml-auto text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">EDITING</span>}
                </div>
                <div className="p-5 space-y-4">
                  {setupReason && (
                    <p className="border border-border bg-surface px-3.5 py-3 text-sm text-ink-secondary">
                      {setupReason === 'username'
                        ? 'Choose a username to continue. Sellers will see only this, never your name or address.'
                        : 'Add your delivery address to continue.'}
                    </p>
                  )}
                  <div>
                    <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">Username</label>
                    {isEditing ? (
                      <>
                        <input type="text" value={editedUser.username || ''} maxLength={20} autoCapitalize="none" autoCorrect="off"
                          onChange={e => setEditedUser({ ...editedUser, username: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() })}
                          placeholder="letters and numbers only"
                          className="input-field h-12 w-full border border-border bg-card px-3.5 text-sm text-ink transition-[border-color,box-shadow] duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
                        <p className="text-[11px] text-ink-muted mt-1">3 to 20 letters or numbers. It goes on your parcels instead of your name.</p>
                      </>
                    ) : (
                      <p className="text-ink font-semibold">{user.username ? `@${user.username}` : <span className="text-ink-muted font-medium">Not set</span>}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">Full Name</label>
                    {isEditing ? (
                      <input type="text" value={editedUser.name || ''} onChange={e => setEditedUser({ ...editedUser, name: e.target.value })}
                        className="input-field h-12 w-full border border-border bg-card px-3.5 text-sm text-ink transition-[border-color,box-shadow] duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
                    ) : (
                      <p className="text-ink font-semibold">{user.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">Email</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-ink-muted flex-shrink-0" />
                      <p className="text-ink-secondary font-semibold text-sm break-all">{user.email}</p>
                    </div>
                    <p className="text-[11px] text-ink-muted mt-1">Cannot be changed</p>
                  </div>
                  <div>
                    <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">Phone</label>
                    {isEditing ? (
                      <div className="flex">
                        <span className="ui-mono ui-mono-sm inline-flex h-12 items-center border border-r-0 border-border bg-surface px-3 text-ink-secondary">+234</span>
                        <input type="tel" value={(editedUser.phone || '').replace(/^\+?234/, '')}
                          onChange={e => setEditedUser({ ...editedUser, phone: e.target.value.replace(/\D/g, '') })}
                          maxLength={11}
                          className="input-field h-12 flex-1 border border-border bg-card px-3 text-sm text-ink transition-[border-color,box-shadow] duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-ink-muted flex-shrink-0" />
                        <p className="text-ink font-semibold">+234 {user.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="fade-up section-card border border-border bg-card">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-border bg-surface">
                    <MapPin className="w-3.5 h-3.5 text-ink-secondary" />
                  </div>
                  <h2 className="ui-mono ui-mono-sm text-ink">Delivery Address</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">Hostel / Lodge</label>
                    {isEditing ? (
                      <input type="text" value={editedUser.hostelName || ''} onChange={e => setEditedUser({ ...editedUser, hostelName: e.target.value })}
                        placeholder="e.g. Boys Hostel, Block A"
                        className="input-field h-12 w-full border border-border bg-card px-3.5 text-sm text-ink transition-[border-color,box-shadow] duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-ink-muted flex-shrink-0" />
                        <p className="text-ink font-semibold">{user.hostelName || <span className="text-ink-muted font-medium">Not set</span>}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">Room Number</label>
                    {isEditing ? (
                      <input type="text" value={editedUser.roomNumber || ''} onChange={e => setEditedUser({ ...editedUser, roomNumber: e.target.value })}
                        placeholder="e.g. 205"
                        className="input-field h-12 w-full border border-border bg-card px-3.5 text-sm text-ink transition-[border-color,box-shadow] duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
                    ) : (
                      <p className="text-ink font-semibold">{user.roomNumber || <span className="text-ink-muted font-medium">Not set</span>}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">Landmark</label>
                    {isEditing ? (
                      <input type="text" value={editedUser.landmark || ''} onChange={e => setEditedUser({ ...editedUser, landmark: e.target.value })}
                        placeholder="e.g. Near the cafeteria"
                        className="input-field h-12 w-full border border-border bg-card px-3.5 text-sm text-ink transition-[border-color,box-shadow] duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-ink-muted flex-shrink-0" />
                        <p className="text-ink font-semibold">{user.landmark || <span className="text-ink-muted font-medium">Not set</span>}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet balance card */}
            <div className="fade-up section-card border border-border bg-card">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-border bg-surface">
                  <Wallet className="w-3.5 h-3.5 text-ink-secondary" />
                </div>
                <h2 className="ui-mono ui-mono-sm text-ink">BataMart Balance</h2>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-soft bg-primary">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-muted font-semibold">Available Balance</p>
                    <p className="text-2xl font-semibold text-ink truncate">
                      ₦{wallet?.availableBalance?.toLocaleString('en-NG', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>
                  <Link href={isApp ? '/wallet?app=true' : '/wallet'}
                    className="flex-shrink-0 flex items-center gap-1.5 text-primary font-semibold text-sm px-4 py-2 bg-primary/10 hover:bg-primary/10 rounded-xl transition-all">
                    View <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="fade-up section-card border border-border bg-card">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-border bg-surface">
                  <Shield className="w-3.5 h-3.5 text-ink-secondary" />
                </div>
                <h2 className="ui-mono ui-mono-sm text-ink">Withdrawal Biometrics</h2>
              </div>
              <div className="p-5">
                {!biometricAvailable ? (
                  <p className="text-xs text-ink-secondary">Biometrics not available on this browser/device.</p>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm text-ink">{biometricEnabled ? 'Enabled' : 'Disabled'}</p>
                      <p className="text-xs text-ink-muted mt-0.5">Use fingerprint or face unlock for withdrawals.</p>
                    </div>
                    <button
                      onClick={handleBiometricToggle}
                      disabled={biometricBusy}
                      className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 ${biometricEnabled ? 'bg-danger/10 text-danger hover:bg-danger/10' : 'bg-success text-white hover:brightness-95'}`}
                    >
                      {biometricBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : biometricEnabled ? 'Turn Off' : 'Turn On'}
                    </button>
                  </div>
                )}
                {biometricMessage && (
                  <p className={`mt-3 text-xs font-semibold ${biometricMessage.includes('Could not') ? 'text-danger' : 'text-success'}`}>
                    {biometricMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Notifications */}
            <div className="section-card border border-border bg-card">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="ui-mono ui-mono-sm text-ink">Order Notifications</h3>
                <p className="text-xs text-ink-secondary mt-0.5">Get alerted when your order is picked up and delivered</p>
                <Link href="/notification-settings" className="ui-mono ui-mono-sm mt-2 inline-block text-primary">Choose what you receive</Link>
              </div>

              <div className="px-5 py-4">
                {isIosBrowserTab && (
                  <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-xl border border-warning/20">
                    <BellRing className="w-5 h-5 flex-shrink-0 text-warning" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-semibold text-warning">Install app first to get notifications</p>
                      <p className="text-xs text-warning mt-1 leading-relaxed">
                        iPhone notifications only work when BataMart is installed to your Home Screen.
                        Tap Share in Safari → "Add to Home Screen", then open from your home screen and enable notifications here.
                      </p>
                    </div>
                  </div>
                )}

                {!isIosBrowserTab && permission === 'denied' && (
                  <div className="flex items-start gap-3 p-3 bg-danger/10 rounded-xl border border-danger/20">
                    <BellOff className="w-5 h-5 flex-shrink-0 text-danger" strokeWidth={1.75} />
                    <div>
                      <p className="text-sm font-semibold text-danger">Notifications are blocked</p>
                      <p className="text-xs text-danger mt-1 leading-relaxed">
                        {isIosPwa
                          ? 'Go to iPhone Settings → BataMart → Notifications → turn on "Allow Notifications".'
                          : 'Go to your browser Settings → Site Settings → Notifications → find BataMart and allow it.'}
                      </p>
                    </div>
                  </div>
                )}

                {isIosPwa && permission !== 'granted' && permission !== 'denied' && (
                  <div className="mb-3 p-3 bg-primary/10 rounded-xl border border-primary/20">
                    <p className="text-xs text-primary leading-relaxed">
                      After enabling below, also go to <strong>iPhone Settings → BataMart → Notifications</strong> and turn on "Allow Notifications".
                    </p>
                  </div>
                )}

                {!isIosBrowserTab && permission !== 'denied' && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {isSubscribed ? 'Notifications enabled' : 'Enable notifications'}
                      </p>
                      <p className="text-xs text-ink-secondary mt-0.5">
                        {isSubscribed
                          ? 'You\'ll be notified for orders, deliveries, and payments'
                          : 'Stay updated on your orders in real time'}
                      </p>
                    </div>
                    <button
                      onClick={isSubscribed ? unsubscribe : subscribe}
                      disabled={notifLoading || !isSupported}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isSubscribed ? 'bg-primary' : 'bg-border'
                      } ${notifLoading || !isSupported ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      role="switch"
                      aria-checked={isSubscribed}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
                          isSubscribed ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Appearance */}
            <div className="fade-up section-card border border-border bg-card">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-border bg-surface">
                  {activeTheme === 'dark'
                    ? <Moon className="w-3.5 h-3.5 text-ink-secondary" />
                    : <Sun className="w-3.5 h-3.5 text-ink-secondary" />}
                </div>
                <h2 className="ui-mono ui-mono-sm text-ink">Appearance</h2>
              </div>
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-ink">
                    {activeTheme === 'dark' ? 'Dark mode on' : 'Light mode on'}
                  </p>
                  <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                    {activeTheme === 'dark'
                      ? 'Applies while you shop. The storefront and admin stay light.'
                      : 'A softer look for night. Applies while you shop — the storefront and admin stay light.'}
                  </p>
                </div>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle ui-btn-sweep ui-mono ui-mono-sm inline-flex h-10 flex-shrink-0 items-center gap-2 bg-ink px-4 text-background transition-colors hover:bg-primary hover:text-white"
                >
                  {activeTheme === 'dark' ? <Sun className="w-3.5 h-3.5" strokeWidth={2} /> : <Moon className="w-3.5 h-3.5" strokeWidth={2} />}
                  {activeTheme === 'dark' ? 'Use light' : 'Use dark'}
                </button>
              </div>
            </div>

            {/* Referral Card */}
            <div className="fade-up"><ReferralCard /></div>

            {/* Recommended */}
            <div className="fade-up section-card border border-border bg-card">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center border border-border bg-surface">
                    <Star className="w-3.5 h-3.5 text-ink-secondary" />
                  </div>
                  <h2 className="ui-mono ui-mono-sm text-ink">Recommended For You</h2>
                </div>
                <Link href={isApp ? '/recommended?app=true' : '/recommended'}
                  className="text-primary font-semibold text-xs flex items-center gap-1 hover:underline">
                  See All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="p-5"><RecommendedProducts isApp={isApp} /></div>
            </div>

            {/* Search History */}
            <div className="fade-up section-card border border-border bg-card">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-surface rounded-lg flex items-center justify-center">
                    <Search className="w-3.5 h-3.5 text-ink-secondary" />
                  </div>
                  <h2 className="ui-mono ui-mono-sm text-ink">Search History</h2>
                </div>
                <button onClick={() => { localStorage.removeItem('BATAMART-recent-searches'); window.location.reload() }}
                  className="text-danger hover:text-danger text-xs font-semibold transition-colors">
                  Clear All
                </button>
              </div>
              <div className="p-5"><SearchHistory /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecommendedProducts({ isApp }: { isApp: boolean }) {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const router = useRouter()
  const fmt = (p: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(p)

  useEffect(() => {
    const fetchRecommended = async () => {
      try {
        // The same personalised picks as the Recommended page, so "See All"
        // continues the list instead of showing something different.
        const token = localStorage.getItem('token')
        const res  = await fetch(`/api/products/feed?${buildFeedQuery(100)}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
        const data = await res.json()
        const picks = [...(data.forYouProducts ?? []), ...(data.discoverProducts ?? [])]
        if (picks.length) setProducts(picks.slice(0, 6))
      } catch {} finally { setLoading(false) }
    }
    fetchRecommended()
  }, [])

  if (loading) return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-square animate-pulse bg-surface rounded-xl mb-2" />
          <div className="h-3 animate-pulse bg-surface rounded-full w-3/4 mb-1" />
          <div className="h-3 animate-pulse bg-surface rounded-full w-1/2" />
        </div>
      ))}
    </div>
  )

  if (products.length === 0) return (
    <div className="text-center py-8">
      <p className="text-ink-muted text-sm font-medium">Browse more to get personalized picks!</p>
    </div>
  )

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {products.map(product => (
        <div key={product.id} onClick={() => router.push(`/product/${product.id}`)}
          className="product-thumb cursor-pointer group overflow-hidden rounded-xl">
          <div className="aspect-square rounded-xl overflow-hidden bg-surface mb-2">
            <img src={product.images?.[0] || '/placeholder.png'} alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500" />
          </div>
          <p className="text-xs font-semibold text-ink line-clamp-2 leading-snug">{product.name}</p>
          <p className="text-xs font-semibold text-primary mt-0.5">{fmt(product.price)}</p>
        </div>
      ))}
    </div>
  )
}

function SearchHistory() {
  const [searches, setSearches] = useState<string[]>([])
  const router = useRouter()
  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem('BATAMART-recent-searches') || '[]') as Array<string | { keyword?: string }>
    const normalized = raw
      .map((entry) => (typeof entry === 'string' ? entry : entry?.keyword || ''))
      .filter(Boolean)
      .slice(0, 10)
    setSearches(normalized)
  }, [])
  if (searches.length === 0) return <div className="text-center py-8"><p className="text-ink-muted text-sm font-medium">No search history yet</p></div>
  return (
    <div className="flex flex-wrap gap-2">
      {searches.map((s, i) => (
        <button key={i} onClick={() => router.push(`/search?q=${encodeURIComponent(s)}`)}
          className="tag-chip px-4 py-2 bg-surface text-ink-secondary rounded-full text-sm font-semibold border border-transparent transition-all">
          {s}
        </button>
      ))}
    </div>
  )
}

