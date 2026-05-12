'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  User, ShoppingBag, Store, PlusCircle, Wallet, Package,
  AlertTriangle, LogOut, ChevronRight, MapPin, Phone,
  Home, Mail, Edit2, Check, X, Loader2, Menu, Gift,
  Sparkles, Bell, BellOff, Shield, Star, Search, Sun, Moon,
} from 'lucide-react'
import { ReferralCard } from '@/components/ui/ReferralCard'
import { usePushSubscription } from '@/hooks/usePushSubscription'
import { useTheme } from '@/components/layout/ThemeProvider'

const PROFILE_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }

  .header-gradient {
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
  }

  .nav-item {
    transition: background 0.12s ease, color 0.12s ease, padding-left 0.12s ease;
  }
  .nav-item:hover {
    background: #f5f3ff;
    color: #6366f1;
    padding-left: 20px;
  }

  .section-card {
    transition: box-shadow 0.2s ease;
  }
  .section-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }

  .input-field {
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  }
  .input-field:focus {
    border-color: #6366f1 !important;
    background: white !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
    outline: none;
  }

  .save-btn {
    background: linear-gradient(135deg, #6366f1, #4c1d95);
    transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.2s ease;
  }
  .save-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.35); }
  .save-btn:active:not(:disabled) { transform: scale(0.97); }

  @keyframes shimmerAnim {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .shimmer {
    background: linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%);
    background-size: 1200px 100%;
    animation: shimmerAnim 1.5s ease-in-out infinite;
  }

  .product-thumb {
    transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
  }
  .product-thumb:hover { transform: scale(1.05); }
  .product-thumb:hover img { transform: scale(1.08); }

  .tag-chip {
    transition: all 0.15s cubic-bezier(0.34,1.4,0.64,1);
  }
  .tag-chip:hover {
    background: #6366f1;
    color: white;
    transform: scale(1.05);
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

  .dark .profile-page { background: #121212 !important; }
  .dark .profile-page .bg-white { background-color: #121212 !important; }
  .dark .profile-page .bg-gray-50 { background-color: #1f2937 !important; }
  .dark .profile-page .bg-gray-100 { background-color: #243244 !important; }
  .dark .profile-page .bg-indigo-50 { background-color: rgba(99, 102, 241, 0.2) !important; }
  .dark .profile-page .bg-emerald-50 { background-color: rgba(16, 185, 129, 0.18) !important; }
  .dark .profile-page .bg-violet-50 { background-color: rgba(139, 92, 246, 0.2) !important; }
  .dark .profile-page .bg-blue-50 { background-color: rgba(59, 130, 246, 0.18) !important; }
  .dark .profile-page .bg-amber-50 { background-color: rgba(245, 158, 11, 0.18) !important; }
  .dark .profile-page .border-gray-50,
  .dark .profile-page .border-gray-100,
  .dark .profile-page .border-gray-200 { border-color: #273449 !important; }
  .dark .profile-page .text-gray-900 { color: #f8fafc !important; }
  .dark .profile-page .text-gray-800 { color: #e2e8f0 !important; }
  .dark .profile-page .text-gray-700 { color: #cbd5e1 !important; }
  .dark .profile-page .text-gray-600 { color: #94a3b8 !important; }
  .dark .profile-page .text-gray-500 { color: #94a3b8 !important; }
  .dark .profile-page .text-gray-400 { color: #64748b !important; }
  .dark .profile-page .text-indigo-600 { color: #a5b4fc !important; }
  .dark .profile-page .text-indigo-700 { color: #c7d2fe !important; }
  .dark .profile-page .text-emerald-700 { color: #6ee7b7 !important; }
  .dark .profile-page .text-red-700 { color: #fca5a5 !important; }
  .dark .profile-page .text-red-600 { color: #fca5a5 !important; }
  .dark .profile-page .text-red-500 { color: #f87171 !important; }
  .dark .profile-page .text-blue-600 { color: #93c5fd !important; }
  .dark .profile-page .text-amber-500 { color: #fcd34d !important; }
  .dark .profile-page .nav-item:hover {
    background: #1E1E1E;
    color: #a5b4fc;
  }
  .dark .profile-page .section-card:hover { box-shadow: 0 6px 24px rgba(2, 6, 23, 0.45); }
  .dark .profile-page .input-field {
    background: #111827 !important;
    border-color: #374151 !important;
    color: #f8fafc !important;
  }
  .dark .profile-page .input-field::placeholder { color: #64748b; }
  .dark .profile-page .input-field:focus {
    border-color: #818cf8 !important;
    background: #121212 !important;
    box-shadow: 0 0 0 3px rgba(129,140,248,0.18);
  }
  .dark .profile-page .shimmer {
    background: linear-gradient(90deg, #1f2937 25%, #263244 50%, #1f2937 75%);
    background-size: 1200px 100%;
  }
  .dark .profile-page .tag-chip {
    background: #1f2937 !important;
    color: #cbd5e1 !important;
    border-color: #334155 !important;
  }
  .dark .profile-page .tag-chip:hover {
    background: #6366f1 !important;
    color: #ffffff !important;
    border-color: transparent !important;
  }
`

interface UserProfile {
  id: string; name: string; email: string; phone: string
  hostelName: string; roomNumber: string; landmark: string
  role: string; isSellerMode: boolean
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isApp, setIsApp]           = useState(false)
  const [isIOSBrowser, setIsIOSBrowser] = useState(false)
  const [showIOSInstallModal, setShowIOSInstallModal] = useState(false)

  const { isSupported, isSubscribed, isLoading: notifLoading, permission, subscribe, unsubscribe } = usePushSubscription()

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
      if (!token) { router.push('/login'); return }
      const [userRes, walletRes] = await Promise.all([
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const userData  = await userRes.json()
      const walletData = await walletRes.json()
      if (userRes.ok) { setUser(userData.user); setEditedUser(userData.user) }
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
        body: JSON.stringify({ name: editedUser.name, phone: editedUser.phone, hostelName: editedUser.hostelName, roomNumber: editedUser.roomNumber, landmark: editedUser.landmark }),
      })
      const data = await response.json()
      if (response.ok) {
        setUser({ ...user!, ...editedUser }); setIsEditing(false); setSaveSuccess(true)
        if (editedUser.name) localStorage.setItem('userName', editedUser.name)
        window.dispatchEvent(new Event('auth-change'))
        setTimeout(() => setSaveSuccess(false), 3000)
      } else { setSaveError(data.error || 'Failed to update profile') }
    } catch { setSaveError('Network error. Please try again.') }
    finally { setSaving(false) }
  }

  const handleCancel = () => { setEditedUser(user || {}); setIsEditing(false); setSaveError('') }
  const handleLogout = () => { localStorage.clear(); window.dispatchEvent(new Event('auth-change')); router.push('/') }

  if (loading || !user) return (
    <div className="profile-page min-h-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#121212]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
        <p className="text-gray-500 font-semibold">Loading your profile…</p>
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
  const roleGradient = user.role === 'SELLER' ? 'from-violet-500 to-indigo-600' : user.role === 'RIDER' ? 'from-emerald-500 to-teal-600' : user.role === 'ADMIN' ? 'from-red-500 to-rose-600' : 'from-blue-500 to-indigo-600'
  const activeTheme = mounted ? theme : 'light'

  return (
    <div className="profile-page min-h-screen bg-[#f0f2f5] dark:bg-[#121212]">

      {/* ── iOS Install Modal ── */}
      {showIOSInstallModal && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setShowIOSInstallModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl max-h-[88vh] overflow-y-auto">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                  <span className="text-2xl">🛍️</span>
                </div>
                <div>
                  <p className="font-black text-gray-900">Add BataMart to Home Screen</p>
                  <p className="text-sm text-gray-500">Get the full app experience 🚀</p>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {[
                  { icon: '⎋', bg: 'bg-blue-50', title: 'Tap the Share button', sub: 'At the bottom of your Safari browser' },
                  { icon: '➕', bg: 'bg-indigo-50', title: 'Tap "Add to Home Screen"', sub: 'Scroll down in the share sheet' },
                  { icon: '✅', bg: 'bg-emerald-50', title: 'Tap "Add" to confirm', sub: 'BataMart appears on your home screen' },
                ].map(({ icon, bg, title, sub }) => (
                  <div key={title} className={`flex items-center gap-3 ${bg} rounded-2xl px-4 py-3.5`}>
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className="font-black text-sm text-gray-800">{title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowIOSInstallModal(false)}
                className="w-full text-white font-black py-4 rounded-2xl text-sm mb-3"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                Got it!
              </button>
              <button onClick={() => setShowIOSInstallModal(false)} className="w-full text-gray-400 text-sm font-medium">Maybe later</button>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile Header ── */}
      <div className="lg:hidden header-gradient sticky top-0 z-30 shadow-xl">
        <div className="flex items-center px-4 py-3.5 gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <Menu className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-black text-white flex-1">My Account</h1>
          <div className={`px-2.5 py-1 bg-gradient-to-r ${roleGradient} rounded-xl`}>
            <span className="text-[10px] font-black text-white">{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* ── Mobile Slide Menu ── */}
      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />
          <div className={`slide-menu ${isMobileMenuOpen ? 'slide-menu-open' : ''} fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white dark:bg-[#1E1E1E] z-50 lg:hidden shadow-2xl`}>
            <div className="flex flex-col h-full">
              {/* Menu header */}
              <div className="header-gradient px-5 py-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${roleGradient}`}>
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <p className="font-black text-white text-lg">{user.name}</p>
                <p className="text-white/60 text-xs mt-0.5">{user.email}</p>
                {wallet && (
                  <div className="mt-3 bg-white/10 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-white/70 text-xs font-semibold">Wallet</span>
                    <span className="text-white font-black text-sm">₦{wallet.availableBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              <nav className="flex-1 overflow-y-auto py-3">
                {menuItems.map((item, i) => (
                  <Link key={i} href={item.href} onClick={() => setIsMobileMenuOpen(false)}
                    className="nav-item flex items-center gap-4 px-5 py-3.5 text-gray-700 border-b border-gray-50">
                    <span className="text-gray-400 flex-shrink-0">{item.icon}</span>
                    <span className="font-bold text-sm">{item.label}</span>
                    <ChevronRight className="w-4 h-4 ml-auto text-gray-300 flex-shrink-0" />
                  </Link>
                ))}
              </nav>
              <div className="p-4 border-t border-gray-100">
                <button onClick={() => { setIsMobileMenuOpen(false); handleLogout() }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-2xl font-black text-sm transition-colors">
                  <LogOut className="w-5 h-5" /> Logout
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Desktop breadcrumb ── */}
      <div className="hidden lg:block header-gradient shadow-xl">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-white/50 mb-1">
                <Link href="/marketplace" className="hover:text-white/80 transition font-medium">Marketplace</Link>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-white/80 font-semibold">My Account</span>
              </div>
              <h1 className="text-xl font-black text-white">Account Overview</h1>
            </div>
            <div className={`px-3 py-1.5 bg-gradient-to-r ${roleGradient} rounded-xl shadow-lg`}>
              <span className="text-xs font-black text-white">{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

          {/* ── Desktop Sidebar ── */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-6">
              <div className="p-5 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br ${roleGradient} shadow-md`}>
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{roleLabel}</p>
                  </div>
                </div>
                {wallet && (
                  <div className="mt-3 bg-indigo-50 rounded-xl px-3 py-2.5 flex items-center justify-between">
                    <span className="text-indigo-500 text-xs font-bold">Balance</span>
                    <span className="text-indigo-700 font-black text-sm">₦{wallet.availableBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              <nav className="py-2">
                {menuItems.map((item, i) => (
                  <Link key={i} href={item.href}
                    className="nav-item flex items-center gap-3 px-4 py-3 text-gray-600 border-b border-gray-50 last:border-0">
                    <span className="text-gray-400 flex-shrink-0">{item.icon}</span>
                    <span className="font-bold text-sm">{item.label}</span>
                  </Link>
                ))}
              </nav>
              <div className="border-t border-gray-100 p-4">
                <button onClick={handleLogout}
                  className="flex items-center gap-2.5 text-red-500 hover:text-red-700 font-black text-sm w-full hover:bg-red-50 px-3 py-2.5 rounded-xl transition-all">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          </div>

          {/* ── Main Content ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Edit header */}
            <div className="fade-up flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-gray-900">Profile Details</h2>
                <p className="text-xs text-gray-400 mt-0.5">{isEditing ? '✏️ Editing mode' : 'View & manage your account'}</p>
              </div>
              {!isEditing ? (
                <button onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-black text-sm px-4 py-2 rounded-xl hover:bg-indigo-50 transition-all">
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={handleCancel}
                    className="flex items-center gap-1.5 text-gray-600 font-bold text-sm px-3 py-2 rounded-xl hover:bg-gray-100 transition-all">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="save-btn flex items-center gap-1.5 text-white font-black text-sm px-4 py-2 rounded-xl disabled:opacity-50 shadow-lg">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {/* Feedback banners */}
            {saveSuccess && (
              <div className="fade-up flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3.5 rounded-2xl">
                <Check className="w-5 h-5 flex-shrink-0" /> <span className="font-black text-sm">Profile updated!</span>
              </div>
            )}
            {saveError && (
              <div className="fade-up flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3.5 rounded-2xl">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" /> <span className="font-bold text-sm">{saveError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account Details */}
              <div className="fade-up section-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                  <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <h2 className="font-black text-gray-900 text-sm">Account Details</h2>
                  {isEditing && <span className="ml-auto text-[10px] text-indigo-600 font-black bg-indigo-50 px-2 py-0.5 rounded-full">EDITING</span>}
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
                    {isEditing ? (
                      <input type="text" value={editedUser.name || ''} onChange={e => setEditedUser({ ...editedUser, name: e.target.value })}
                        className="input-field w-full px-3.5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold" />
                    ) : (
                      <p className="text-gray-900 font-black">{user.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Email</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <p className="text-gray-700 font-semibold text-sm break-all">{user.email}</p>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Phone</label>
                    {isEditing ? (
                      <div className="flex">
                        <span className="inline-flex items-center px-3 bg-gray-100 border-2 border-r-0 border-gray-100 rounded-l-xl text-gray-500 text-xs font-bold">+234</span>
                        <input type="tel" value={(editedUser.phone || '').replace(/^\+?234/, '')}
                          onChange={e => setEditedUser({ ...editedUser, phone: e.target.value.replace(/\D/g, '') })}
                          maxLength={11}
                          className="input-field flex-1 px-3 py-3 bg-gray-50 border-2 border-transparent rounded-r-xl text-sm font-bold" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="text-gray-900 font-bold">+234 {user.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="fade-up section-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                  <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <h2 className="font-black text-gray-900 text-sm">Delivery Address</h2>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Hostel / Lodge</label>
                    {isEditing ? (
                      <input type="text" value={editedUser.hostelName || ''} onChange={e => setEditedUser({ ...editedUser, hostelName: e.target.value })}
                        placeholder="e.g. Boys Hostel, Block A"
                        className="input-field w-full px-3.5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="text-gray-900 font-bold">{user.hostelName || <span className="text-gray-400 font-medium">Not set</span>}</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Room Number</label>
                    {isEditing ? (
                      <input type="text" value={editedUser.roomNumber || ''} onChange={e => setEditedUser({ ...editedUser, roomNumber: e.target.value })}
                        placeholder="e.g. 205"
                        className="input-field w-full px-3.5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold" />
                    ) : (
                      <p className="text-gray-900 font-bold">{user.roomNumber || <span className="text-gray-400 font-medium">Not set</span>}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">Landmark</label>
                    {isEditing ? (
                      <input type="text" value={editedUser.landmark || ''} onChange={e => setEditedUser({ ...editedUser, landmark: e.target.value })}
                        placeholder="e.g. Near the cafeteria"
                        className="input-field w-full px-3.5 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold" />
                    ) : (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="text-gray-900 font-bold">{user.landmark || <span className="text-gray-400 font-medium">Not set</span>}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet balance card */}
            <div className="fade-up section-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <h2 className="font-black text-gray-900 text-sm">BataMart Balance</h2>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400 font-semibold">Available Balance</p>
                    <p className="text-2xl font-black text-gray-900 truncate">
                      ₦{wallet?.availableBalance?.toLocaleString('en-NG', { minimumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>
                  <Link href={isApp ? '/wallet?app=true' : '/wallet'}
                    className="flex-shrink-0 flex items-center gap-1.5 text-indigo-600 font-black text-sm px-4 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all">
                    View <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="fade-up section-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <h2 className="font-black text-gray-900 text-sm">Push Notifications</h2>
              </div>
              <div className="p-5">
                {isIOSBrowser ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                        <span className="text-lg">📲</span>
                      </div>
                      <div>
                        <p className="font-black text-sm text-gray-900">Push Notifications</p>
                        <p className="text-xs text-gray-400 mt-0.5">Install to Home Screen to enable</p>
                      </div>
                    </div>
                    <button onClick={() => setShowIOSInstallModal(true)}
                      className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black text-white transition-all hover:scale-105"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                      How to
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isSubscribed ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                        {isSubscribed ? <Bell className="w-5 h-5 text-emerald-600" /> : <BellOff className="w-5 h-5 text-gray-400" />}
                      </div>
                      <div>
                        <p className="font-black text-sm text-gray-900">{isSubscribed ? 'Notifications On' : 'Notifications Off'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {!isSupported ? 'Not supported in this browser'
                            : permission === 'denied' ? 'Blocked — enable in browser settings'
                              : isSubscribed ? 'You\'ll get order & payment alerts'
                                : 'Enable to get real-time alerts'}
                        </p>
                      </div>
                    </div>
                    {isSupported && permission !== 'denied' && (
                      <button onClick={isSubscribed ? unsubscribe : subscribe} disabled={notifLoading}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black transition-all hover:scale-105 disabled:opacity-50 ${isSubscribed ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-white shadow-md'}`}
                        style={!isSubscribed ? { background: 'linear-gradient(135deg, #6366f1, #4c1d95)' } : {}}>
                        {notifLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSubscribed ? 'Turn Off' : 'Enable'}
                      </button>
                    )}
                    {permission === 'denied' && <span className="text-xs text-red-500 font-black bg-red-50 px-2.5 py-1 rounded-full">Blocked</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Appearance */}
            <div className="fade-up section-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                  {activeTheme === 'dark'
                    ? <Moon className="w-3.5 h-3.5 text-indigo-600" />
                    : <Sun className="w-3.5 h-3.5 text-indigo-600" />}
                </div>
                <h2 className="font-black text-gray-900 text-sm">Appearance</h2>
              </div>
              <div className="p-5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-sm text-gray-900">
                    {activeTheme === 'dark' ? 'Dark Mode On' : 'Light Mode On'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {activeTheme === 'dark'
                      ? 'Optimized for low-light viewing.'
                      : 'Switch to dark mode for a softer night look.'}
                  </p>
                </div>
                <button
                  onClick={toggleTheme}
                  className="theme-toggle flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white shadow-md"
                  style={{ background: activeTheme === 'dark'
                    ? 'linear-gradient(135deg, #4f46e5, #312e81)'
                    : 'linear-gradient(135deg, #6366f1, #4c1d95)' }}
                >
                  {activeTheme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  {activeTheme === 'dark' ? 'Use Light' : 'Use Dark'}
                </button>
              </div>
            </div>

            {/* Referral Card */}
            <div className="fade-up"><ReferralCard /></div>

            {/* Recommended */}
            <div className="fade-up section-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <h2 className="font-black text-gray-900 text-sm">Recommended For You</h2>
                </div>
                <Link href={isApp ? '/marketplace?app=true' : '/marketplace'}
                  className="text-indigo-600 font-black text-xs flex items-center gap-1 hover:underline">
                  See All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="p-5"><RecommendedProducts isApp={isApp} /></div>
            </div>

            {/* Search History */}
            <div className="fade-up section-card bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Search className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <h2 className="font-black text-gray-900 text-sm">Search History</h2>
                </div>
                <button onClick={() => { localStorage.removeItem('BATAMART-recent-searches'); window.location.reload() }}
                  className="text-red-400 hover:text-red-600 text-xs font-bold transition-colors">
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
        const res  = await fetch('/api/products?limit=6')
        const data = await res.json()
        if (data.products) {
          const interests = JSON.parse(localStorage.getItem('BATAMART-interests') || '[]')
          const sorted = data.products.sort((a: any, b: any) => (interests.includes(b.category) ? 1 : 0) - (interests.includes(a.category) ? 1 : 0))
          setProducts(sorted.slice(0, 6))
        }
      } catch {} finally { setLoading(false) }
    }
    fetchRecommended()
  }, [])

  if (loading) return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}>
          <div className="aspect-square shimmer rounded-xl mb-2" />
          <div className="h-3 shimmer rounded-full w-3/4 mb-1" />
          <div className="h-3 shimmer rounded-full w-1/2" />
        </div>
      ))}
    </div>
  )

  if (products.length === 0) return (
    <div className="text-center py-8">
      <p className="text-gray-400 text-sm font-medium">Browse more to get personalized picks!</p>
    </div>
  )

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {products.map(product => (
        <div key={product.id} onClick={() => router.push(`/product/${product.id}`)}
          className="product-thumb cursor-pointer group overflow-hidden rounded-xl">
          <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 mb-2">
            <img src={product.images?.[0] || '/placeholder.png'} alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500" />
          </div>
          <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-snug">{product.name}</p>
          <p className="text-xs font-black text-indigo-600 mt-0.5">{fmt(product.price)}</p>
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
  if (searches.length === 0) return <div className="text-center py-8"><p className="text-gray-400 text-sm font-medium">No search history yet</p></div>
  return (
    <div className="flex flex-wrap gap-2">
      {searches.map((s, i) => (
        <button key={i} onClick={() => router.push(`/search?q=${encodeURIComponent(s)}`)}
          className="tag-chip px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-bold border border-transparent transition-all">
          {s}
        </button>
      ))}
    </div>
  )
}

