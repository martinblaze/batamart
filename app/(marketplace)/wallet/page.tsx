// app/(marketplace)/wallet/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, RefreshCw, Shield, TrendingUp, TrendingDown,
  Wallet, ArrowDownLeft, ArrowUpRight, Lock, AlertCircle,
  CheckCircle2, X, ChevronDown, Search, Loader2, Eye,
  EyeOff, Key, RotateCcw, Zap, ChevronRight, Clock,
} from 'lucide-react'
import {
  enableWithdrawalBiometrics,
  getBiometricPreference,
  isBiometricSupported,
  setBiometricPreference,
  verifyWithdrawalBiometrics,
} from '@/lib/withdraw-biometrics'

const WALLET_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) forwards; }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }
  .scale-in { animation: scaleIn 0.28s cubic-bezier(0.34,1.4,0.64,1) forwards; }

  .shimmer {
    background: var(--color-surface);
    animation: pulse-shimmer 1.5s ease-in-out infinite;
  }
  @keyframes pulse-shimmer {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }

  .header-gradient {
    /* Ink, not accent. A full-bleed blue slab at the top of four different
       screens was the loudest thing in the product and made every one of
       them read as a different app. */
    background: var(--ui-slab);
  }

  .balance-card {
    background: var(--color-primary);
  }

  .stat-card {
    transition: transform 0.15s ease-out;
  }
  .stat-card:hover { transform: translateY(-2px); }

  .tx-row {
    transition: background 0.15s ease-out;
  }
  .tx-row:hover { background: var(--color-surface); }

  .withdraw-btn {
    background: var(--color-primary);
    transition: filter 0.15s ease-out;
  }
  .withdraw-btn:hover {
    filter: brightness(0.95);
  }
  .withdraw-btn:active { transform: scale(0.98); }

  .pin-dot {
    transition: transform 0.15s ease-out, background 0.15s ease-out;
  }
  .pin-dot-filled {
    background: var(--color-primary);
    transform: scale(1.15);
  }

  .action-chip {
    transition: transform 0.15s ease-out;
  }
  .action-chip:hover { transform: translateY(-1px); }
  .action-chip:active { transform: scale(0.96); }

  .bank-option {
    transition: background 0.15s ease-out;
  }
  .bank-option:hover { background: var(--color-surface); }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`

interface Transaction {
  id: string; type: string; amount: number; description: string
  reference: string; createdAt: string; balanceBefore: number; balanceAfter: number
}
interface WalletData { availableBalance: number; pendingBalance: number; completedOrders: number; role: string }
interface User { id: string; name: string; phone: string; email?: string; hasWithdrawalPin: boolean }
interface Bank { code: string; name: string }

const NIGERIAN_BANKS: Bank[] = [
  { code: '999992', name: 'OPay' },{ code: '999991', name: 'PalmPay' },
  { code: '50211', name: 'Kuda Bank' },{ code: '50515', name: 'Moniepoint MFB' },
  { code: '565', name: 'Carbon (One Finance)' },{ code: '566', name: 'VFD Microfinance Bank' },
  { code: '035A', name: 'ALAT by WEMA' },{ code: '125', name: 'Rubies MFB' },
  { code: '51269', name: 'Tangerine Money' },{ code: '51310', name: 'Sparkle MFB' },
  { code: '057', name: 'Zenith Bank' },{ code: '058', name: 'GTBank' },
  { code: '033', name: 'UBA' },{ code: '011', name: 'First Bank' },
  { code: '044', name: 'Access Bank' },{ code: '063', name: 'Access Bank (Diamond)' },
  { code: '050', name: 'Ecobank Nigeria' },{ code: '070', name: 'Fidelity Bank' },
  { code: '214', name: 'FCMB' },{ code: '082', name: 'Keystone Bank' },
  { code: '076', name: 'Polaris Bank' },{ code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },{ code: '068', name: 'Standard Chartered' },
  { code: '232', name: 'Sterling Bank' },{ code: '032', name: 'Union Bank' },
  { code: '215', name: 'Unity Bank' },{ code: '035', name: 'Wema Bank' },
  { code: '023', name: 'Citibank Nigeria' },{ code: '100', name: 'Suntrust Bank' },
  { code: '302', name: 'TAJ Bank' },{ code: '303', name: 'Lotus Bank' },
  { code: '104', name: 'Parallex Bank' },{ code: '105', name: 'PremiumTrust Bank' },
  { code: '102', name: 'Titan Trust Bank' },{ code: '120001', name: '9mobile 9PSB' },
  { code: '120002', name: 'HopePSB' },{ code: '120003', name: 'MTN MoMo PSB' },
  { code: '120004', name: 'Airtel Smartcash PSB' },{ code: '100002', name: 'Paga' },
  { code: '50126', name: 'Eyowo' },{ code: '50200', name: 'Kredi Money MFB' },
  { code: '51244', name: 'Ibile Microfinance Bank' },{ code: '51113', name: 'Safe Haven MFB' },
  { code: '51293', name: 'QuickFund MFB' },{ code: '51253', name: 'Stellas MFB' },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(n)

const fmtShort = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

const TX_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  CREDIT:     { label: 'Credit',     color: 'text-success', bg: 'bg-success/10',  icon: <ArrowDownLeft className="w-3.5 h-3.5" /> },
  DEBIT:      { label: 'Debit',      color: 'text-danger',     bg: 'bg-danger/10',      icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  WITHDRAWAL: { label: 'Withdrawal', color: 'text-danger',     bg: 'bg-danger/10',      icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  ESCROW:     { label: 'Escrow',     color: 'text-warning',   bg: 'bg-warning/10',    icon: <Lock className="w-3.5 h-3.5" /> },
}

// ── PIN Dots ─────────────────────────────────────────────────────────────────
function PinDots({ value }: { value: string }) {
  return (
    <div className="flex justify-center gap-3 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`pin-dot w-3.5 h-3.5 rounded-full border-2 ${i < value.length ? 'pin-dot-filled border-primary' : 'border-border'}`} />
      ))}
    </div>
  )
}

// ── Modal Shell ───────────────────────────────────────────────────────────────
function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="scale-in relative bg-card rounded-3xl w-full max-w-md shadow-soft max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1" />
        {children}
      </div>
    </div>
  )
}

export default function WalletPage() {
  const router = useRouter()
  const [user, setUser]               = useState<User | null>(null)
  const [wallet, setWallet]           = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading]         = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)
  const [hideBalance, setHideBalance] = useState(false)
  const [refreshing, setRefreshing]   = useState(false)

  // Withdraw modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount]       = useState('')
  const [accountNumber, setAccountNumber]         = useState('')
  const [accountName, setAccountName]             = useState('')
  const [selectedBank, setSelectedBank]           = useState(NIGERIAN_BANKS[0])
  const [bankSearch, setBankSearch]               = useState('')
  const [showBankDropdown, setShowBankDropdown]   = useState(false)
  const bankRef = useRef<HTMLDivElement>(null)
  const [pendingWithdrawal, setPendingWithdrawal] = useState<any>(null)
  const [withdrawalRequestKey, setWithdrawalRequestKey] = useState('')

  // PIN
  const [showPinEntry, setShowPinEntry]   = useState(false)
  const [pinValue, setPinValue]           = useState('')
  const [pinError, setPinError]           = useState('')
  const [pinLoading, setPinLoading]       = useState(false)

  // Set/Change PIN
  const [showSetPin, setShowSetPin]         = useState(false)
  const [currentPin, setCurrentPin]         = useState('')
  const [newPin, setNewPin]                 = useState('')
  const [confirmPin, setConfirmPin]         = useState('')
  const [savePinLoading, setSavePinLoading] = useState(false)
  const [savePinError, setSavePinError]     = useState('')
  const [savePinSuccess, setSavePinSuccess] = useState(false)

  // Forgot PIN
  const [showForgotPin, setShowForgotPin]       = useState(false)
  const [forgotStep, setForgotStep]             = useState<'send' | 'verify'>('send')
  const [forgotOtp, setForgotOtp]               = useState('')
  const [forgotNew, setForgotNew]               = useState('')
  const [forgotConfirm, setForgotConfirm]       = useState('')
  const [forgotLoading, setForgotLoading]       = useState(false)
  const [forgotError, setForgotError]           = useState('')
  const [forgotEmail, setForgotEmail]           = useState('')
  const [forgotSuccess, setForgotSuccess]       = useState(false)

  // PIN required
  const [showPinRequired, setShowPinRequired] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const [biometricError, setBiometricError] = useState('')

  useEffect(() => {
    if (document.getElementById('wallet-anim')) return
    const s = document.createElement('style'); s.id = 'wallet-anim'; s.textContent = WALLET_CSS
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => { if (bankRef.current && !bankRef.current.contains(e.target as Node)) setShowBankDropdown(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => { fetchWalletData() }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const available = await isBiometricSupported()
      if (mounted) setBiometricAvailable(available)
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!user) return
    const pref = getBiometricPreference(user.id)
    setBiometricEnabled(pref === 'enabled')
    setShowBiometricPrompt(Boolean(biometricAvailable && pref === null))
  }, [user, biometricAvailable])

  const fetchWalletData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
      const [uR, wR, tR] = await Promise.all([
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/wallet', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/wallet/transactions', { headers: { Authorization: `Bearer ${token}` } }),
      ])
      const [u, w, t] = await Promise.all([uR.json(), wR.json(), tR.json()])
      if (uR.ok) setUser(u.user)
      if (wR.ok) setWallet(w.wallet)
      if (tR.ok) setTransactions(t.transactions || [])
    } catch {}
    finally { setLoading(false) }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchWalletData()
    setRefreshing(false)
  }

  const filteredBanks = bankSearch.trim()
    ? NIGERIAN_BANKS.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()))
    : NIGERIAN_BANKS

  const openWithdrawModal = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        if (!data.user.hasWithdrawalPin) { setShowPinRequired(true); return }
      }
    } catch {}
    const requestKey = crypto.randomUUID()
    setWithdrawalRequestKey(requestKey)
    setWithdrawAmount(''); setAccountNumber(''); setAccountName('')
    setSelectedBank(NIGERIAN_BANKS[0]); setBankSearch(''); setPinError(''); setBiometricError('')
    setShowWithdrawModal(true)
  }

  const authenticateWithBiometric = async () => {
    if (!user) return false
    if (!biometricAvailable) return false

    setBiometricBusy(true)
    setBiometricError('')

    try {
      await verifyWithdrawalBiometrics(user.id)
      return true
    } catch {
      setBiometricError('Biometric check failed or was cancelled. Please try again.')
      return false
    } finally {
      setBiometricBusy(false)
    }
  }

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount < 1000) { alert('Minimum withdrawal is ₦1,000'); return }
    if (wallet && amount > wallet.availableBalance) { alert('Insufficient balance'); return }
    if (!accountNumber || !accountName) { alert('Please fill all fields'); return }

    const payload = { amount, accountNumber, accountName, bankCode: selectedBank.code, idempotencyKey: withdrawalRequestKey || crypto.randomUUID() }
    setPendingWithdrawal(payload)

    if (biometricEnabled && biometricAvailable) {
      const biometricOk = await authenticateWithBiometric()
      if (!biometricOk) return
      await executeWithdrawal(payload)
      return
    }

    setPinError(''); setPinValue(''); setShowPinEntry(true)
  }

  const handlePinSubmit = async () => {
    if (pinValue.length !== 6) { setPinError('Enter your 6-digit PIN'); return }
    setPinLoading(true); setPinError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/wallet/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin: pinValue }),
      })
      const data = await res.json()
      if (!res.ok) { setPinError(data.error || 'Incorrect PIN'); setPinValue(''); return }
      setShowPinEntry(false)
      await executeWithdrawal()
    } catch { setPinError('Network error.') }
    finally { setPinLoading(false) }
  }

  const executeWithdrawal = async (payloadOverride?: any) => {
    const payload = payloadOverride || pendingWithdrawal
    if (!payload) return
    setWithdrawing(true)
    try {
      const token = localStorage.getItem('token')
      const r = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) {
        if (d.error === 'PIN_REQUIRED') { setShowWithdrawModal(false); setPendingWithdrawal(null); setWithdrawalRequestKey(''); setShowPinRequired(true); return }
        alert(d.error || 'Withdrawal failed'); setPendingWithdrawal(null); return
      }
      setShowWithdrawModal(false); setPendingWithdrawal(null); setWithdrawalRequestKey(''); fetchWalletData()
      alert(`Withdrawal of ₦${payload.amount.toLocaleString()} initiated.\nRef: ${d.reference}`)
    } catch { alert('Network error.'); setPendingWithdrawal(null) }
    finally { setWithdrawing(false) }
  }

  const handleEnableBiometric = async () => {
    if (!user) return
    setBiometricBusy(true)
    setBiometricError('')
    try {
      await enableWithdrawalBiometrics(user)
      setBiometricPreference(user.id, 'enabled')
      setBiometricEnabled(true)
      setShowBiometricPrompt(false)
    } catch {
      setBiometricError('Could not enable biometrics. Please try again.')
    } finally {
      setBiometricBusy(false)
    }
  }

  const handleDeclineBiometric = () => {
    if (!user) return
    setBiometricPreference(user.id, 'disabled')
    setBiometricEnabled(false)
    setShowBiometricPrompt(false)
  }

  const handleSetPinSubmit = async () => {
    if (user?.hasWithdrawalPin && !currentPin) { setSavePinError('Enter your current PIN'); return }
    if (!/^\d{6}$/.test(newPin)) { setSavePinError('PIN must be exactly 6 digits'); return }
    if (newPin !== confirmPin) { setSavePinError('PINs do not match'); return }
    setSavePinLoading(true); setSavePinError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/wallet/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin: newPin, ...(user?.hasWithdrawalPin ? { currentPin } : {}) }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavePinSuccess(true); setUser(prev => prev ? { ...prev, hasWithdrawalPin: true } : prev)
        setTimeout(() => { setShowSetPin(false); setSavePinSuccess(false); setCurrentPin(''); setNewPin(''); setConfirmPin('') }, 2000)
      } else { setSavePinError(data.error || 'Failed to set PIN') }
    } catch { setSavePinError('Network error.') }
    finally { setSavePinLoading(false) }
  }

  const handleForgotSendOtp = async () => {
    setForgotLoading(true); setForgotError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/wallet/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'send-otp' }),
      })
      const data = await res.json()
      if (res.ok) { setForgotEmail(data.email); setForgotStep('verify') }
      else { setForgotError(data.error || 'Failed to send OTP') }
    } catch { setForgotError('Network error.') }
    finally { setForgotLoading(false) }
  }

  const handleForgotVerify = async () => {
    if (forgotOtp.length !== 6) { setForgotError('Enter the 6-digit OTP'); return }
    if (!/^\d{6}$/.test(forgotNew)) { setForgotError('PIN must be 6 digits'); return }
    if (forgotNew !== forgotConfirm) { setForgotError('PINs do not match'); return }
    setForgotLoading(true); setForgotError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/wallet/set-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otpCode: forgotOtp, pin: forgotNew }),
      })
      const data = await res.json()
      if (res.ok) {
        setForgotSuccess(true); setUser(prev => prev ? { ...prev, hasWithdrawalPin: true } : prev)
        setTimeout(() => { setShowForgotPin(false); setForgotSuccess(false); setForgotStep('send'); setForgotOtp(''); setForgotNew(''); setForgotConfirm('') }, 2000)
      } else { setForgotError(data.error || 'Failed to reset PIN') }
    } catch { setForgotError('Network error.') }
    finally { setForgotLoading(false) }
  }

  if (loading || !user || !wallet) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <p className="text-ink-secondary font-semibold">Loading wallet…</p>
      </div>
    </div>
  )

  const totalEarned    = transactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawn = transactions.filter(t => t.type === 'WITHDRAWAL' || t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="min-h-screen bg-surface pb-24">

      {/* ── Header ── */}
      <header className="header-gradient sticky top-0 z-40 shadow-soft">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/marketplace" aria-label="Back to marketplace" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/15 transition-colors duration-300 hover:border-white/40">
              <ArrowLeft className="w-4 h-4 text-white" />
            </Link>
            <div className="flex-1">
              <p className="ui-eyebrow mb-1.5 max-w-[12rem] !text-white/45">Manage your earnings</p>
              <h1 className="text-[clamp(1.25rem,2.6vw,1.75rem)] text-white">Wallet &amp; payouts</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors"
              >
                <RefreshCw className={`w-4 h-4 text-white ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => { setNewPin(''); setConfirmPin(''); setSavePinError(''); setSavePinSuccess(false); setShowSetPin(true) }}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
              >
                <Key className="w-3.5 h-3.5" />
                {user.hasWithdrawalPin ? 'Change PIN' : 'Set PIN'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* ── Hero Balance Card ── */}
        <div className="fade-up balance-card rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-primary/10" />

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">Available Balance</p>
              <button onClick={() => setHideBalance(h => !h)} className="text-white/40 hover:text-white/70 transition-colors">
                {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-4xl sm:text-5xl font-semibold mb-1 tracking-tight">
              {hideBalance ? '₦ ••••••' : fmt(wallet.availableBalance)}
            </p>
            <p className="text-white/50 text-xs mb-6">Ready to withdraw · No fees</p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={openWithdrawModal}
                className="flex items-center gap-2 bg-card text-primary px-5 py-2.5 rounded-xl font-semibold text-sm shadow-soft transition-all hover:scale-105 active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4" /> Withdraw
              </button>
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2.5 rounded-xl">
                <Lock className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs font-semibold text-white/80">{fmt(wallet.pendingBalance)} in escrow</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <TrendingUp className="w-4 h-4 text-success" />, bg: 'bg-success/10', label: 'Total Earned', value: fmtShort(totalEarned), color: 'text-success' },
            { icon: <TrendingDown className="w-4 h-4 text-danger" />, bg: 'bg-danger/10', label: 'Withdrawn', value: fmtShort(totalWithdrawn), color: 'text-danger' },
            { icon: <Zap className="w-4 h-4 text-primary" />, bg: 'bg-primary/10', label: wallet.role === 'RIDER' ? 'Deliveries' : 'Orders', value: String(wallet.completedOrders), color: 'text-primary' },
          ].map(({ icon, bg, label, value, color }) => (
            <div key={label} className="stat-card fade-up bg-card rounded-2xl border border-border shadow-soft p-3.5 sm:p-4">
              <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center mb-2`}>{icon}</div>
              <p className={`font-semibold text-sm sm:text-base ${color} truncate`}>{value}</p>
              <p className="text-[10px] text-ink-muted font-semibold mt-0.5 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* ── PIN Status ── */}
        {!user.hasWithdrawalPin && (
          <div className="fade-up flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-2xl px-4 py-3.5">
            <div className="w-8 h-8 bg-warning/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-warning">Set a withdrawal PIN</p>
              <p className="text-xs text-warning">Required before you can withdraw funds</p>
            </div>
            <button
              onClick={() => { setNewPin(''); setConfirmPin(''); setSavePinError(''); setSavePinSuccess(false); setShowSetPin(true) }}
              className="flex-shrink-0 px-3 py-1.5 bg-warning hover:brightness-95 text-white rounded-xl text-xs font-semibold transition-all hover:scale-105"
            >
              Set Now
            </button>
          </div>
        )}

        {/* ── Transaction History ── */}
        <div className="fade-up bg-card rounded-2xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-ink">Transaction History</h2>
              <p className="text-xs text-ink-muted mt-0.5">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
            </div>
            {transactions.length > 0 && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">LIVE</span>
            )}
          </div>

          {transactions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mx-auto mb-4 ring-1 ring-border">
                <Wallet className="w-8 h-8 text-ink-muted" />
              </div>
              <p className="font-semibold text-ink-secondary">No transactions yet</p>
              <p className="text-xs text-ink-muted mt-1">Your history will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((tx) => {
                const meta = TX_META[tx.type] || TX_META.CREDIT
                const isCredit = tx.type === 'CREDIT'
                return (
                  <div key={tx.id} className="tx-row flex items-center gap-3 px-5 py-4">
                    <div className={`w-9 h-9 ${meta.bg} rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink text-sm truncate">{tx.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                        <span className="text-[10px] text-ink-muted font-mono">{new Date(tx.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-semibold text-sm flex items-center justify-end gap-1 ${isCredit ? 'text-success' : 'text-danger'}`}>
                        {tx.type === 'ESCROW' ? <Lock className="w-3 h-3" strokeWidth={1.75} /> : <span>{isCredit ? '+' : '−'}</span>}
                        {fmtShort(tx.amount)}
                      </p>
                      <p className="text-[10px] text-ink-muted mt-0.5">Bal: {fmtShort(tx.balanceAfter)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MODALS
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}

      {/* ── Withdraw Modal ── */}
      {showBiometricPrompt && (
        <ModalShell onClose={handleDeclineBiometric}>
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-success/10">
                <Shield className="w-7 h-7 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-ink">Use Biometrics for Withdrawal?</h3>
              <p className="text-sm text-ink-secondary mt-1">
                Turn on fingerprint or face unlock for fast withdrawal approval on this device.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={handleDeclineBiometric}
                className="flex-1 py-3.5 border-2 border-border rounded-2xl text-sm font-semibold text-ink-secondary">
                Not Interested
              </button>
              <button type="button" onClick={handleEnableBiometric} disabled={biometricBusy}
                className="flex-1 py-3.5 text-white rounded-2xl text-sm font-semibold disabled:opacity-50 shadow-soft"
                style={{ background: 'var(--color-success)' }}>
                {biometricBusy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Turn On'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
      {showWithdrawModal && (
        <ModalShell onClose={() => { setShowWithdrawModal(false); setPendingWithdrawal(null); setWithdrawalRequestKey(''); setPinError('') }}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--color-primary)' }}>
                <ArrowUpRight className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Withdraw Funds</h2>
                <p className="text-xs text-ink-muted">
                  {biometricEnabled ? 'Biometric verification enabled' : 'PIN verification required'}
                </p>
              </div>
              <button onClick={() => { setShowWithdrawModal(false); setPendingWithdrawal(null); setWithdrawalRequestKey('') }}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl text-ink-muted hover:bg-surface transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              {biometricAvailable && biometricEnabled && (
                <div className="bg-success/10 border border-success/20 rounded-xl px-3 py-2.5">
                  <p className="text-xs font-semibold text-success">Biometric withdrawal is active on this device. PIN is optional.</p>
                </div>
              )}
              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Amount (NGN)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted font-semibold text-sm">₦</span>
                  <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="0.00" min="1000" max={wallet.availableBalance}
                    className="w-full pl-8 pr-4 py-3.5 bg-surface border-2 border-transparent rounded-xl text-sm font-semibold focus:border-primary focus:bg-card focus:outline-none transition-all"
                    required />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-ink-muted">Min: ₦1,000</span>
                  <button type="button" onClick={() => setWithdrawAmount(String(wallet.availableBalance))}
                    className="text-xs text-primary font-semibold hover:underline">
                    Max: {fmtShort(wallet.availableBalance)}
                  </button>
                </div>
              </div>

              {/* Bank */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Bank</label>
                <div ref={bankRef}>
                  {!showBankDropdown ? (
                    <button type="button" onClick={() => { setBankSearch(''); setShowBankDropdown(true) }}
                      className="w-full flex items-center justify-between px-4 py-3.5 bg-surface border-2 border-transparent rounded-xl text-sm font-semibold hover:border-primary/50 transition-all text-left focus:outline-none">
                      {selectedBank.name}
                      <ChevronDown className="w-4 h-4 text-ink-muted" />
                    </button>
                  ) : (
                    <div className="border-2 border-primary rounded-xl overflow-hidden bg-card shadow-soft">
                      <div className="relative border-b border-border">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                        <input type="text" value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                          placeholder="Search bank…"
                          className="w-full pl-9 pr-4 py-3 text-sm focus:outline-none bg-transparent font-medium"
                          autoFocus />
                      </div>
                      <div className="max-h-48 overflow-y-auto no-scrollbar">
                        {filteredBanks.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-ink-muted">No bank found</p>
                        ) : filteredBanks.map(bank => (
                          <button key={bank.code} type="button"
                            onClick={() => { setSelectedBank(bank); setBankSearch(''); setShowBankDropdown(false) }}
                            className={`bank-option w-full text-left px-4 py-2.5 text-sm flex items-center justify-between ${selectedBank.code === bank.code ? 'text-primary font-semibold bg-primary/10' : 'text-ink font-medium'}`}>
                            {bank.name}
                            {selectedBank.code === bank.code && <CheckCircle2 className="w-4 h-4 text-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Account Number</label>
                <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit account number" maxLength={10}
                  className="w-full px-4 py-3.5 bg-surface border-2 border-transparent rounded-xl text-sm font-mono tracking-widest focus:border-primary focus:bg-card focus:outline-none transition-all"
                  required />
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Account Name</label>
                <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)}
                  placeholder="As it appears on your bank account"
                  className="w-full px-4 py-3.5 bg-surface border-2 border-transparent rounded-xl text-sm font-medium focus:border-primary focus:bg-card focus:outline-none transition-all"
                  required />
              </div>

              {/* Summary */}
              {withdrawAmount && parseFloat(withdrawAmount) >= 1000 && accountNumber.length >= 10 && accountName && (
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-sm space-y-2">
                  <p className="font-semibold text-primary text-xs uppercase tracking-wider">Summary</p>
                  {[
                    { label: 'Amount', value: fmtShort(parseFloat(withdrawAmount)) },
                    { label: 'Bank', value: selectedBank.name },
                    { label: 'Account No.', value: accountNumber },
                    { label: 'Account Name', value: accountName },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-ink-secondary">{label}</span>
                      <span className="font-semibold text-ink text-right max-w-[55%] break-words">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {biometricError && (
                <p className="text-danger text-sm font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {biometricError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3.5 border-2 border-border rounded-2xl text-sm font-semibold text-ink-secondary hover:bg-surface transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={withdrawing || biometricBusy}
                  className="flex-1 py-3.5 text-white rounded-2xl text-sm font-semibold transition-all disabled:opacity-50 shadow-soft"
                  style={{ background: 'var(--color-primary)' }}>
                  {(withdrawing || biometricBusy) ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (biometricEnabled && biometricAvailable ? 'Verify Biometrics â†’' : 'Enter PIN â†’')}
                </button>
              </div>
            </form>
          </div>
        </ModalShell>
      )}

      {/* ── PIN Entry Modal ── */}
      {showPinEntry && (
        <ModalShell onClose={() => { setShowPinEntry(false); setPinValue(''); setPinError(''); setPendingWithdrawal(null); setWithdrawalRequestKey('') }}>
          <div className="p-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: 'var(--color-primary)' }}>
              <Lock className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink">Enter PIN</h3>
              <p className="text-sm text-ink-muted mt-1">Authorise your withdrawal of {pendingWithdrawal ? fmtShort(pendingWithdrawal.amount) : ''}</p>
            </div>
            <PinDots value={pinValue} />
            <input
              type="password" inputMode="numeric" maxLength={6}
              value={pinValue} onChange={e => setPinValue(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
              className="w-full px-4 py-4 border-2 border-border rounded-2xl text-center text-3xl font-semibold tracking-[0.6em] focus:border-primary focus:outline-none transition-all bg-surface focus:bg-card"
              placeholder="••••••" autoFocus
            />
            {pinError && (
              <p className="text-danger text-sm font-semibold flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {pinError}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowPinEntry(false); setPinValue(''); setPinError(''); setPendingWithdrawal(null) }}
                className="flex-1 py-3.5 border-2 border-border rounded-2xl text-sm font-semibold text-ink-secondary">Cancel</button>
              <button onClick={handlePinSubmit} disabled={pinLoading || pinValue.length !== 6}
                className="flex-1 py-3.5 text-white rounded-2xl text-sm font-semibold disabled:opacity-50 shadow-soft transition-all"
                style={{ background: 'var(--color-primary)' }}>
                {pinLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ── Set/Change PIN Modal ── */}
      {showSetPin && (
        <ModalShell onClose={() => { setShowSetPin(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setSavePinError('') }}>
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'var(--color-primary)' }}>
                <Key className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-ink">{user.hasWithdrawalPin ? 'Change PIN' : 'Set Withdrawal PIN'}</h3>
              <p className="text-sm text-ink-muted mt-1">6-digit PIN to secure your withdrawals</p>
            </div>

            {savePinSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-success/10 rounded-3xl flex items-center justify-center mx-auto mb-3 success-pulse">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <p className="font-semibold text-ink text-lg">PIN {user.hasWithdrawalPin ? 'Updated' : 'Set'}!</p>
                <p className="text-sm text-ink-muted mt-1">You can now withdraw funds securely.</p>
              </div>
            ) : (
              <>
                {user.hasWithdrawalPin && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider">Current PIN</label>
                      <button type="button"
                        onClick={() => { setShowSetPin(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setSavePinError(''); setShowForgotPin(true); setForgotStep('send'); setForgotError(''); setForgotSuccess(false) }}
                        className="text-xs text-primary font-semibold hover:underline">
                        Forgot PIN?
                      </button>
                    </div>
                    <input type="password" inputMode="numeric" maxLength={6} value={currentPin}
                      onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3.5 bg-surface border-2 border-transparent rounded-2xl text-center text-2xl font-semibold tracking-[0.5em] focus:border-primary focus:bg-card focus:outline-none transition-all"
                      placeholder="••••••" autoFocus />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">New PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-surface border-2 border-transparent rounded-2xl text-center text-2xl font-semibold tracking-[0.5em] focus:border-primary focus:bg-card focus:outline-none transition-all"
                    placeholder="••••••" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Confirm New PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-surface border-2 border-transparent rounded-2xl text-center text-2xl font-semibold tracking-[0.5em] focus:border-primary focus:bg-card focus:outline-none transition-all"
                    placeholder="••••••" />
                </div>
                {savePinError && (
                  <p className="text-danger text-sm font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {savePinError}
                  </p>
                )}
                <div className="flex gap-3">
                  <button onClick={() => { setShowSetPin(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setSavePinError('') }}
                    className="flex-1 py-3.5 border-2 border-border rounded-2xl text-sm font-semibold text-ink-secondary">Cancel</button>
                  <button onClick={handleSetPinSubmit} disabled={savePinLoading || newPin.length !== 6 || confirmPin.length !== 6}
                    className="flex-1 py-3.5 text-white rounded-2xl text-sm font-semibold disabled:opacity-50 shadow-soft"
                    style={{ background: 'var(--color-primary)' }}>
                    {savePinLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save PIN'}
                  </button>
                </div>
              </>
            )}
          </div>
        </ModalShell>
      )}

      {/* ── Forgot PIN Modal ── */}
      {showForgotPin && (
        <ModalShell onClose={() => { setShowForgotPin(false); setForgotError('') }}>
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'var(--color-danger)' }}>
                <RotateCcw className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-ink">Reset PIN</h3>
              <p className="text-sm text-ink-muted mt-1">
                {forgotStep === 'send' ? "We'll send a code to your email" : `Code sent to ${forgotEmail}`}
              </p>
            </div>

            {forgotSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-success/10 rounded-3xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <p className="font-semibold text-ink text-lg">PIN Reset!</p>
                <p className="text-sm text-ink-muted mt-1">Your new PIN has been set.</p>
              </div>
            ) : forgotStep === 'send' ? (
              <>
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4 text-sm text-primary font-medium">
                  A 6-digit OTP will be sent to your registered email address.
                </div>
                {forgotError && <p className="text-danger text-sm font-semibold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {forgotError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setShowForgotPin(false); setForgotError('') }}
                    className="flex-1 py-3.5 border-2 border-border rounded-2xl text-sm font-semibold text-ink-secondary">Cancel</button>
                  <button onClick={handleForgotSendOtp} disabled={forgotLoading}
                    className="flex-1 py-3.5 text-white rounded-2xl text-sm font-semibold disabled:opacity-50 shadow-soft"
                    style={{ background: 'var(--color-primary)' }}>
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send OTP'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">OTP Code</label>
                  <input type="text" inputMode="numeric" maxLength={6} value={forgotOtp}
                    onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-surface border-2 border-transparent rounded-2xl text-center text-2xl font-semibold tracking-[0.5em] focus:border-primary focus:bg-card focus:outline-none transition-all"
                    placeholder="••••••" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">New PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={forgotNew}
                    onChange={e => setForgotNew(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-surface border-2 border-transparent rounded-2xl text-center text-2xl font-semibold tracking-[0.5em] focus:border-primary focus:bg-card focus:outline-none transition-all"
                    placeholder="••••••" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-2">Confirm New PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={forgotConfirm}
                    onChange={e => setForgotConfirm(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-surface border-2 border-transparent rounded-2xl text-center text-2xl font-semibold tracking-[0.5em] focus:border-primary focus:bg-card focus:outline-none transition-all"
                    placeholder="••••••" />
                </div>
                {forgotError && <p className="text-danger text-sm font-semibold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {forgotError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setForgotStep('send'); setForgotOtp(''); setForgotError('') }}
                    className="flex-1 py-3.5 border-2 border-border rounded-2xl text-sm font-semibold text-ink-secondary">â† Back</button>
                  <button onClick={handleForgotVerify}
                    disabled={forgotLoading || forgotOtp.length !== 6 || forgotNew.length !== 6 || forgotConfirm.length !== 6}
                    className="flex-1 py-3.5 text-white rounded-2xl text-sm font-semibold disabled:opacity-50 shadow-soft"
                    style={{ background: 'var(--color-primary)' }}>
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Reset PIN'}
                  </button>
                </div>
                <button onClick={handleForgotSendOtp} disabled={forgotLoading}
                  className="w-full text-xs text-ink-muted hover:text-primary transition-colors text-center font-semibold">
                  Didn't receive code? Resend
                </button>
              </>
            )}
          </div>
        </ModalShell>
      )}

      {/* ── PIN Required Modal ── */}
      {showPinRequired && (
        <ModalShell onClose={() => setShowPinRequired(false)}>
          <div className="p-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto"
              style={{ background: 'var(--color-danger)' }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-ink">PIN Required</h3>
              <p className="text-sm text-ink-secondary mt-2 max-w-xs mx-auto leading-relaxed">
                Set a 6-digit withdrawal PIN to keep your earnings safe before you can withdraw.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPinRequired(false)}
                className="flex-1 py-3.5 border-2 border-border rounded-2xl text-sm font-semibold text-ink-secondary">Later</button>
              <button
                onClick={() => { setShowPinRequired(false); setNewPin(''); setConfirmPin(''); setSavePinError(''); setSavePinSuccess(false); setShowSetPin(true) }}
                className="flex-1 py-3.5 text-white rounded-2xl text-sm font-semibold shadow-soft transition-all hover:scale-[1.02]"
                style={{ background: 'var(--color-primary)' }}>
                Set PIN Now
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}





