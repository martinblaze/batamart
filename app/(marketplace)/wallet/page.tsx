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

  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .shimmer {
    background: linear-gradient(90deg, #f3f4f6 25%, #e9eaec 50%, #f3f4f6 75%);
    background-size: 1200px 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  .header-gradient {
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
  }

  .balance-card {
    background: linear-gradient(135deg, #6366f1 0%, #4c1d95 60%, #2d1b69 100%);
    box-shadow: 0 20px 60px rgba(99,102,241,0.4);
  }

  .stat-card {
    transition: transform 0.25s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.25s ease;
  }
  .stat-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(0,0,0,0.08); }

  .tx-row {
    transition: background 0.15s ease;
  }
  .tx-row:hover { background: #f9fafb; }

  .withdraw-btn {
    background: linear-gradient(135deg, #6366f1, #4c1d95);
    transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.2s ease;
    box-shadow: 0 8px 24px rgba(99,102,241,0.35);
  }
  .withdraw-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 40px rgba(99,102,241,0.45);
  }
  .withdraw-btn:active { transform: scale(0.97); }

  .pin-dot {
    transition: transform 0.15s cubic-bezier(0.34,1.4,0.64,1), background 0.15s ease;
  }
  .pin-dot-filled {
    background: #6366f1;
    transform: scale(1.15);
  }

  .action-chip {
    transition: all 0.15s cubic-bezier(0.34,1.4,0.64,1);
  }
  .action-chip:hover { transform: scale(1.04) translateY(-1px); }
  .action-chip:active { transform: scale(0.96); }

  .bank-option {
    transition: background 0.12s ease;
  }
  .bank-option:hover { background: #f5f3ff; }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.3); }
    70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
    100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  }
  .success-pulse { animation: pulse-ring 1s ease-out; }
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
  CREDIT:     { label: 'Credit',     color: 'text-emerald-700', bg: 'bg-emerald-50',  icon: <ArrowDownLeft className="w-3.5 h-3.5" /> },
  DEBIT:      { label: 'Debit',      color: 'text-red-600',     bg: 'bg-red-50',      icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  WITHDRAWAL: { label: 'Withdrawal', color: 'text-red-600',     bg: 'bg-red-50',      icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  ESCROW:     { label: 'Escrow',     color: 'text-amber-700',   bg: 'bg-amber-50',    icon: <Lock className="w-3.5 h-3.5" /> },
}

// â”€â”€ PIN Dots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PinDots({ value }: { value: string }) {
  return (
    <div className="flex justify-center gap-3 py-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`pin-dot w-3.5 h-3.5 rounded-full border-2 ${i < value.length ? 'pin-dot-filled border-indigo-500' : 'border-gray-300'}`} />
      ))}
    </div>
  )
}

// â”€â”€ Modal Shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="scale-in relative bg-white rounded-3xl w-full max-w-md shadow-2xl max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1" />
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
      if (!token) { router.push('/login'); return }
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
    if (!amount || amount < 1000) { alert('Minimum withdrawal is â‚¦1,000'); return }
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
      alert(`Withdrawal of â‚¦${payload.amount.toLocaleString()} initiated.\nRef: ${d.reference}`)
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
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
        <p className="text-gray-500 font-semibold">Loading walletâ€¦</p>
      </div>
    </div>
  )

  const totalEarned    = transactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0)
  const totalWithdrawn = transactions.filter(t => t.type === 'WITHDRAWAL' || t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-24">

      {/* â”€â”€ Header â”€â”€ */}
      <header className="header-gradient sticky top-0 z-40 shadow-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/marketplace" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4 text-white" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-black text-white">Wallet & Payouts</h1>
              <p className="text-white/50 text-xs">Manage your earnings</p>
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
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                <Key className="w-3.5 h-3.5" />
                {user.hasWithdrawalPin ? 'Change PIN' : 'Set PIN'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {/* â”€â”€ Hero Balance Card â”€â”€ */}
        <div className="fade-up balance-card rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-violet-400/10" />

          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Available Balance</p>
              <button onClick={() => setHideBalance(h => !h)} className="text-white/40 hover:text-white/70 transition-colors">
                {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-4xl sm:text-5xl font-black mb-1 tracking-tight">
              {hideBalance ? 'â‚¦ â€¢â€¢â€¢â€¢â€¢â€¢' : fmt(wallet.availableBalance)}
            </p>
            <p className="text-white/50 text-xs mb-6">Ready to withdraw Â· No fees</p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={openWithdrawModal}
                className="flex items-center gap-2 bg-white text-indigo-700 px-5 py-2.5 rounded-xl font-black text-sm shadow-lg transition-all hover:scale-105 active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4" /> Withdraw
              </button>
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2.5 rounded-xl">
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-xs font-bold text-white/80">{fmt(wallet.pendingBalance)} in escrow</span>
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€ Stats Row â”€â”€ */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: <TrendingUp className="w-4 h-4 text-emerald-600" />, bg: 'bg-emerald-50', label: 'Total Earned', value: fmtShort(totalEarned), color: 'text-emerald-700' },
            { icon: <TrendingDown className="w-4 h-4 text-red-500" />, bg: 'bg-red-50', label: 'Withdrawn', value: fmtShort(totalWithdrawn), color: 'text-red-600' },
            { icon: <Zap className="w-4 h-4 text-indigo-600" />, bg: 'bg-indigo-50', label: wallet.role === 'RIDER' ? 'Deliveries' : 'Orders', value: String(wallet.completedOrders), color: 'text-indigo-700' },
          ].map(({ icon, bg, label, value, color }) => (
            <div key={label} className="stat-card fade-up bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 sm:p-4">
              <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center mb-2`}>{icon}</div>
              <p className={`font-black text-sm sm:text-base ${color} truncate`}>{value}</p>
              <p className="text-[10px] text-gray-400 font-semibold mt-0.5 uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>

        {/* â”€â”€ PIN Status â”€â”€ */}
        {!user.hasWithdrawalPin && (
          <div className="fade-up flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
            <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-amber-800">Set a withdrawal PIN</p>
              <p className="text-xs text-amber-600">Required before you can withdraw funds</p>
            </div>
            <button
              onClick={() => { setNewPin(''); setConfirmPin(''); setSavePinError(''); setSavePinSuccess(false); setShowSetPin(true) }}
              className="flex-shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-all hover:scale-105"
            >
              Set Now
            </button>
          </div>
        )}

        {/* â”€â”€ Transaction History â”€â”€ */}
        <div className="fade-up bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="font-black text-gray-900">Transaction History</h2>
              <p className="text-xs text-gray-400 mt-0.5">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
            </div>
            {transactions.length > 0 && (
              <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">LIVE</span>
            )}
          </div>

          {transactions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 ring-1 ring-gray-100">
                <Wallet className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-black text-gray-600">No transactions yet</p>
              <p className="text-xs text-gray-400 mt-1">Your history will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map((tx) => {
                const meta = TX_META[tx.type] || TX_META.CREDIT
                const isCredit = tx.type === 'CREDIT'
                return (
                  <div key={tx.id} className="tx-row flex items-center gap-3 px-5 py-4">
                    <div className={`w-9 h-9 ${meta.bg} rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{tx.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{new Date(tx.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                        {tx.type === 'ESCROW' ? 'ðŸ”’ ' : isCredit ? '+' : 'âˆ’'}
                        {fmtShort(tx.amount)}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Bal: {fmtShort(tx.balanceAfter)}</p>
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

      {/* â”€â”€ Withdraw Modal â”€â”€ */}
      {showBiometricPrompt && (
        <ModalShell onClose={handleDeclineBiometric}>
          <div className="p-6 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-emerald-100">
                <Shield className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-gray-900">Use Biometrics for Withdrawal?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Turn on fingerprint or face unlock for fast withdrawal approval on this device.
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={handleDeclineBiometric}
                className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700">
                Not Interested
              </button>
              <button type="button" onClick={handleEnableBiometric} disabled={biometricBusy}
                className="flex-1 py-3.5 text-white rounded-2xl text-sm font-black disabled:opacity-50 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
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
                style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                <ArrowUpRight className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900">Withdraw Funds</h2>
                <p className="text-xs text-gray-400">
                  {biometricEnabled ? 'Biometric verification enabled' : 'PIN verification required'}
                </p>
              </div>
              <button onClick={() => { setShowWithdrawModal(false); setPendingWithdrawal(null); setWithdrawalRequestKey('') }}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4">
              {biometricAvailable && biometricEnabled && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                  <p className="text-xs font-bold text-emerald-700">Biometric withdrawal is active on this device. PIN is optional.</p>
                </div>
              )}
              {/* Amount */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Amount (NGN)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">â‚¦</span>
                  <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="0.00" min="1000" max={wallet.availableBalance}
                    className="w-full pl-8 pr-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                    required />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-gray-400">Min: â‚¦1,000</span>
                  <button type="button" onClick={() => setWithdrawAmount(String(wallet.availableBalance))}
                    className="text-xs text-indigo-600 font-black hover:underline">
                    Max: {fmtShort(wallet.availableBalance)}
                  </button>
                </div>
              </div>

              {/* Bank */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Bank</label>
                <div ref={bankRef}>
                  {!showBankDropdown ? (
                    <button type="button" onClick={() => { setBankSearch(''); setShowBankDropdown(true) }}
                      className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold hover:border-indigo-300 transition-all text-left focus:outline-none">
                      {selectedBank.name}
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  ) : (
                    <div className="border-2 border-indigo-300 rounded-xl overflow-hidden bg-white shadow-lg">
                      <div className="relative border-b border-gray-100">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={bankSearch} onChange={e => setBankSearch(e.target.value)}
                          placeholder="Search bankâ€¦"
                          className="w-full pl-9 pr-4 py-3 text-sm focus:outline-none bg-transparent font-medium"
                          autoFocus />
                      </div>
                      <div className="max-h-48 overflow-y-auto no-scrollbar">
                        {filteredBanks.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-gray-400">No bank found</p>
                        ) : filteredBanks.map(bank => (
                          <button key={bank.code} type="button"
                            onClick={() => { setSelectedBank(bank); setBankSearch(''); setShowBankDropdown(false) }}
                            className={`bank-option w-full text-left px-4 py-2.5 text-sm flex items-center justify-between ${selectedBank.code === bank.code ? 'text-indigo-600 font-black bg-indigo-50' : 'text-gray-800 font-medium'}`}>
                            {bank.name}
                            {selectedBank.code === bank.code && <CheckCircle2 className="w-4 h-4 text-indigo-500" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Account Number</label>
                <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit account number" maxLength={10}
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-mono tracking-widest focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                  required />
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Account Name</label>
                <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)}
                  placeholder="As it appears on your bank account"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-medium focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                  required />
              </div>

              {/* Summary */}
              {withdrawAmount && parseFloat(withdrawAmount) >= 1000 && accountNumber.length >= 10 && accountName && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm space-y-2">
                  <p className="font-black text-indigo-700 text-xs uppercase tracking-wider">Summary</p>
                  {[
                    { label: 'Amount', value: fmtShort(parseFloat(withdrawAmount)) },
                    { label: 'Bank', value: selectedBank.name },
                    { label: 'Account No.', value: accountNumber },
                    { label: 'Account Name', value: accountName },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-bold text-gray-900 text-right max-w-[55%] break-words">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {biometricError && (
                <p className="text-red-500 text-sm font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {biometricError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={withdrawing || biometricBusy}
                  className="flex-1 py-3.5 text-white rounded-2xl text-sm font-black transition-all disabled:opacity-50 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                  {(withdrawing || biometricBusy) ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (biometricEnabled && biometricAvailable ? 'Verify Biometrics â†’' : 'Enter PIN â†’')}
                </button>
              </div>
            </form>
          </div>
        </ModalShell>
      )}

      {/* â”€â”€ PIN Entry Modal â”€â”€ */}
      {showPinEntry && (
        <ModalShell onClose={() => { setShowPinEntry(false); setPinValue(''); setPinError(''); setPendingWithdrawal(null); setWithdrawalRequestKey('') }}>
          <div className="p-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
              <Lock className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">Enter PIN</h3>
              <p className="text-sm text-gray-400 mt-1">Authorise your withdrawal of {pendingWithdrawal ? fmtShort(pendingWithdrawal.amount) : ''}</p>
            </div>
            <PinDots value={pinValue} />
            <input
              type="password" inputMode="numeric" maxLength={6}
              value={pinValue} onChange={e => setPinValue(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
              className="w-full px-4 py-4 border-2 border-gray-100 rounded-2xl text-center text-3xl font-black tracking-[0.6em] focus:border-indigo-400 focus:outline-none transition-all bg-gray-50 focus:bg-white"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢" autoFocus
            />
            {pinError && (
              <p className="text-red-500 text-sm font-bold flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {pinError}
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowPinEntry(false); setPinValue(''); setPinError(''); setPendingWithdrawal(null) }}
                className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700">Cancel</button>
              <button onClick={handlePinSubmit} disabled={pinLoading || pinValue.length !== 6}
                className="flex-1 py-3.5 text-white rounded-2xl text-sm font-black disabled:opacity-50 shadow-lg transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                {pinLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* â”€â”€ Set/Change PIN Modal â”€â”€ */}
      {showSetPin && (
        <ModalShell onClose={() => { setShowSetPin(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setSavePinError('') }}>
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                <Key className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-black text-gray-900">{user.hasWithdrawalPin ? 'Change PIN' : 'Set Withdrawal PIN'}</h3>
              <p className="text-sm text-gray-400 mt-1">6-digit PIN to secure your withdrawals</p>
            </div>

            {savePinSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-3 success-pulse">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="font-black text-gray-900 text-lg">PIN {user.hasWithdrawalPin ? 'Updated' : 'Set'}!</p>
                <p className="text-sm text-gray-400 mt-1">You can now withdraw funds securely.</p>
              </div>
            ) : (
              <>
                {user.hasWithdrawalPin && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-black text-gray-500 uppercase tracking-wider">Current PIN</label>
                      <button type="button"
                        onClick={() => { setShowSetPin(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setSavePinError(''); setShowForgotPin(true); setForgotStep('send'); setForgotError(''); setForgotSuccess(false) }}
                        className="text-xs text-indigo-600 font-black hover:underline">
                        Forgot PIN?
                      </button>
                    </div>
                    <input type="password" inputMode="numeric" maxLength={6} value={currentPin}
                      onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢" autoFocus />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">New PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={newPin}
                    onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Confirm New PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢" />
                </div>
                {savePinError && (
                  <p className="text-red-500 text-sm font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {savePinError}
                  </p>
                )}
                <div className="flex gap-3">
                  <button onClick={() => { setShowSetPin(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); setSavePinError('') }}
                    className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700">Cancel</button>
                  <button onClick={handleSetPinSubmit} disabled={savePinLoading || newPin.length !== 6 || confirmPin.length !== 6}
                    className="flex-1 py-3.5 text-white rounded-2xl text-sm font-black disabled:opacity-50 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                    {savePinLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save PIN'}
                  </button>
                </div>
              </>
            )}
          </div>
        </ModalShell>
      )}

      {/* â”€â”€ Forgot PIN Modal â”€â”€ */}
      {showForgotPin && (
        <ModalShell onClose={() => { setShowForgotPin(false); setForgotError('') }}>
          <div className="p-6 space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'linear-gradient(135deg, #f97316, #dc2626)' }}>
                <RotateCcw className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-black text-gray-900">Reset PIN</h3>
              <p className="text-sm text-gray-400 mt-1">
                {forgotStep === 'send' ? "We'll send a code to your email" : `Code sent to ${forgotEmail}`}
              </p>
            </div>

            {forgotSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="font-black text-gray-900 text-lg">PIN Reset!</p>
                <p className="text-sm text-gray-400 mt-1">Your new PIN has been set.</p>
              </div>
            ) : forgotStep === 'send' ? (
              <>
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700 font-medium">
                  A 6-digit OTP will be sent to your registered email address.
                </div>
                {forgotError && <p className="text-red-500 text-sm font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {forgotError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setShowForgotPin(false); setForgotError('') }}
                    className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700">Cancel</button>
                  <button onClick={handleForgotSendOtp} disabled={forgotLoading}
                    className="flex-1 py-3.5 text-white rounded-2xl text-sm font-black disabled:opacity-50 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send OTP'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">OTP Code</label>
                  <input type="text" inputMode="numeric" maxLength={6} value={forgotOtp}
                    onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢" autoFocus />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">New PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={forgotNew}
                    onChange={e => setForgotNew(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Confirm New PIN</label>
                  <input type="password" inputMode="numeric" maxLength={6} value={forgotConfirm}
                    onChange={e => setForgotConfirm(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3.5 bg-gray-50 border-2 border-transparent rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:border-indigo-400 focus:bg-white focus:outline-none transition-all"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢" />
                </div>
                {forgotError && <p className="text-red-500 text-sm font-bold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {forgotError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setForgotStep('send'); setForgotOtp(''); setForgotError('') }}
                    className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700">â† Back</button>
                  <button onClick={handleForgotVerify}
                    disabled={forgotLoading || forgotOtp.length !== 6 || forgotNew.length !== 6 || forgotConfirm.length !== 6}
                    className="flex-1 py-3.5 text-white rounded-2xl text-sm font-black disabled:opacity-50 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Reset PIN'}
                  </button>
                </div>
                <button onClick={handleForgotSendOtp} disabled={forgotLoading}
                  className="w-full text-xs text-gray-400 hover:text-indigo-600 transition-colors text-center font-semibold">
                  Didn't receive code? Resend
                </button>
              </>
            )}
          </div>
        </ModalShell>
      )}

      {/* â”€â”€ PIN Required Modal â”€â”€ */}
      {showPinRequired && (
        <ModalShell onClose={() => setShowPinRequired(false)}>
          <div className="p-6 space-y-5 text-center">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto"
              style={{ background: 'linear-gradient(135deg, #f97316, #dc2626)' }}>
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">PIN Required</h3>
              <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
                Set a 6-digit withdrawal PIN to keep your earnings safe before you can withdraw.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowPinRequired(false)}
                className="flex-1 py-3.5 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700">Later</button>
              <button
                onClick={() => { setShowPinRequired(false); setNewPin(''); setConfirmPin(''); setSavePinError(''); setSavePinSuccess(false); setShowSetPin(true) }}
                className="flex-1 py-3.5 text-white rounded-2xl text-sm font-black shadow-lg transition-all hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4c1d95)' }}>
                Set PIN Now
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}





