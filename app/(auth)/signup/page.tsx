'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, ChevronRight, Home, Hash, Phone } from 'lucide-react'
import GoogleAuthButton from '@/components/auth/GoogleAuthButton'
import { SIGNUP_REOPENS_AT_ISO, hasSignupAccessCode, normalizeSignupAccessCode } from '@/lib/signup-access'

const SIGNUP_DRAFT_KEY = 'batamart_signup_draft'
const SIGNUP_DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const EMPTY_OTP = ['', '', '', '', '', '']

type SignupDraft = {
  step?: number
  email?: string
  name?: string
  phone?: string
  otp?: string[]
  otpSessionToken?: string
  selectedUniversityId?: string
  selectedArea?: string
  hostelName?: string
  roomNumber?: string
  deliveryPhone?: string
  referralCode?: string
  signupAccessCode?: string
  showEmailForm?: boolean
  updatedAt: number
}

function normalizeOtpDigits(value: unknown): string[] {
  const digits = Array.isArray(value) ? value.map(String).join('') : String(value ?? '')
  return digits.replace(/\D/g, '').slice(0, 6).split('').concat(EMPTY_OTP).slice(0, 6)
}

function readSignupDraft(): SignupDraft | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(SIGNUP_DRAFT_KEY)
    if (!raw) return null

    const draft = JSON.parse(raw) as SignupDraft
    if (!draft.updatedAt || Date.now() - draft.updatedAt > SIGNUP_DRAFT_TTL_MS) {
      localStorage.removeItem(SIGNUP_DRAFT_KEY)
      return null
    }

    return draft
  } catch {
    return null
  }
}

function writeSignupDraft(draft: SignupDraft) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Ignore storage quota / privacy mode failures.
  }
}

function clearSignupDraft() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SIGNUP_DRAFT_KEY)
  } catch {
    // Ignore storage failures.
  }
}
interface University {
  id:            string
  name:          string
  shortName:     string
  slug:          string
  location:      string
  deliveryAreas: string[]
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Shared UI helpers Ã¢â‚¬â€ defined OUTSIDE SignupForm so they don't remount Ã¢â€â‚¬Ã¢â€â‚¬
const bgStyle  = { background: 'linear-gradient(180deg,#000000,#070a10 46%,#000000)' }
const btnStyle = { background: 'linear-gradient(135deg,#3D95E8,#4DABFF)' }

const PageShell = ({
  children,
  selectedUniversity,
}: {
  children: React.ReactNode
  selectedUniversity: University | null
}) => (
  <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={bgStyle}>
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight">BATAMART</h1>
        <p className="text-blue-300 text-sm mt-1">Campus Marketplace</p>
        {selectedUniversity && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30">
            <MapPin className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-blue-300 text-xs font-semibold">
              {selectedUniversity.shortName}
            </span>
          </div>
        )}
      </div>
      {children}
    </div>
  </div>
)

const ErrorBox = ({ error }: { error: string }) =>
  error ? (
    <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
      {error}
    </div>
  ) : null

const StepDots = ({ current }: { current: number }) => (
  <div className="flex justify-center gap-1.5 mb-6">
    {[1, 2, 3, 4].map(s => (
      <div
        key={s}
        className={`h-1.5 rounded-full transition-all ${
          s < current  ? 'w-6 bg-blue-500' :
          s === current ? 'w-6 bg-blue-400' :
          'w-3 bg-gray-200'
        }`}
      />
    ))}
  </div>
)

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

function SignupForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep]                             = useState(0)
  const [universities, setUniversities]             = useState<University[]>([])
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null)
  const [selectedUniversityId, setSelectedUniversityId] = useState('')
  const [uniLoading, setUniLoading]                 = useState(true)

  const [email, setEmail] = useState('')
  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')

  const [otp, setOtp]                         = useState<string[]>(EMPTY_OTP)
  const [otpSessionToken, setOtpSessionToken] = useState('')

  const [selectedArea, setSelectedArea]   = useState('')
  const [hostelName, setHostelName]       = useState('')
  const [roomNumber, setRoomNumber]       = useState('')
  const [deliveryPhone, setDeliveryPhone] = useState('')

  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreedToTerms, setAgreedToTerms]     = useState(false)
  const [referralCode, setReferralCode]       = useState(() => {
    if (typeof window === 'undefined') return ''
    const urlRef = new URLSearchParams(window.location.search).get('ref')
    return hasSignupAccessCode(urlRef) ? '' : normalizeSignupAccessCode(urlRef || '')
  })
  const [signupAccessCode, setSignupAccessCode] = useState(() => {
    if (typeof window === 'undefined') return ''
    const urlRef = new URLSearchParams(window.location.search).get('ref')
    return hasSignupAccessCode(urlRef) ? normalizeSignupAccessCode(urlRef) : ''
  })

  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)

  // Ã¢â€â‚¬Ã¢â€â‚¬ Signup timer state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [countdown, setCountdown]               = useState('')
  const searchRef = normalizeSignupAccessCode(searchParams.get('ref'))
  const locationRef = typeof window === 'undefined'
    ? ''
    : normalizeSignupAccessCode(new URLSearchParams(window.location.search).get('ref'))
  const activeSignupAccessCode =
    hasSignupAccessCode(signupAccessCode) ? signupAccessCode :
    hasSignupAccessCode(searchRef) ? searchRef :
    hasSignupAccessCode(locationRef) ? locationRef :
    ''
  const signupOpenAt = new Date(SIGNUP_REOPENS_AT_ISO).getTime()
  const effectiveSelectedUniversity = selectedUniversity ?? universities[0] ?? null

  // Ã¢â€â‚¬Ã¢â€â‚¬ Update countdown display without blocking signup access Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  useEffect(() => {
    const ref = normalizeSignupAccessCode(searchParams.get('ref') || new URLSearchParams(window.location.search).get('ref'))
    if (hasSignupAccessCode(ref)) {
      setSignupAccessCode(ref)
      setReferralCode('')
      return
    }

    if (ref) {
      setSignupAccessCode('')
      setReferralCode(ref)
    }
  }, [searchParams])

  useEffect(() => {
    const draft = readSignupDraft()
    if (!draft) {
      setDraftRestored(true)
      return
    }

    setStep(draft.step ?? 0)
    setEmail(draft.email ?? '')
    setName(draft.name ?? '')
    setPhone(draft.phone ?? '')
    setOtp(normalizeOtpDigits(draft.otp))
    setOtpSessionToken(draft.otpSessionToken ?? '')
    setSelectedUniversityId(draft.selectedUniversityId ?? '')
    setSelectedArea(draft.selectedArea ?? '')
    setHostelName(draft.hostelName ?? '')
    setRoomNumber(draft.roomNumber ?? '')
    setDeliveryPhone(draft.deliveryPhone ?? '')
    setReferralCode(draft.referralCode ?? '')
    setSignupAccessCode(draft.signupAccessCode ?? '')
    setShowEmailForm(Boolean(draft.showEmailForm))
    setDraftRestored(true)
  }, [])

  useEffect(() => {
    if (step === 3 && phone && !deliveryPhone) {
      setDeliveryPhone(phone)
    }
  }, [step])

  useEffect(() => {
    fetch('/api/universities')
      .then(r => r.json())
      .then(data => {
        const loadedUniversities = data.universities ?? []
        setUniversities(loadedUniversities)
      })
      .catch(() => {})
      .finally(() => setUniLoading(false))
  }, [])

  useEffect(() => {
    if (!universities.length) return

    const nextSelected = universities.find(university => university.id === selectedUniversityId) ?? universities[0] ?? null
    setSelectedUniversity(nextSelected)
  }, [universities, selectedUniversityId])

  useEffect(() => {
    if (!draftRestored) return

    writeSignupDraft({
      step,
      email,
      name,
      phone,
      otp,
      otpSessionToken,
      selectedUniversityId: selectedUniversity?.id ?? selectedUniversityId,
      selectedArea,
      hostelName,
      roomNumber,
      deliveryPhone,
      referralCode,
      signupAccessCode,
      showEmailForm,
      updatedAt: Date.now(),
    })
  }, [
    draftRestored,
    step,
    email,
    name,
    phone,
    otp,
    otpSessionToken,
    selectedUniversity?.id,
    selectedUniversityId,
    selectedArea,
    hostelName,
    roomNumber,
    deliveryPhone,
    referralCode,
    signupAccessCode,
    showEmailForm,
  ])

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters'
    if (!/\d/.test(pwd)) return 'Password must contain at least one number'
    return ''
  }

  const validatePhone = (ph: string) => {
    const digits = ph.replace(/\D/g, '')
    if (digits.length < 10) return 'Enter a valid phone number'
    if (digits.length > 15) return 'Enter a valid phone number'
    return ''
  }

  const validateEmailDomain = (emailAddr: string) => {
    const domain = emailAddr.split('@')[1]?.toLowerCase() || ''
    const allowedDomains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'protonmail.com']
    if (!allowedDomains.includes(domain)) {
      return 'Please use a legitimate email (@gmail, @outlook, @yahoo, @hotmail, @protonmail)'
    }
    return ''
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailDomainError = validateEmailDomain(email)
    if (emailDomainError) { setError(emailDomainError); return }
    const phoneError = validatePhone(phone)
    if (phoneError) { setError(phoneError); return }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/send-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, referralCode: referralCode || undefined, signupAccessCode: activeSignupAccessCode || undefined }),
      })
      const data = await response.json()
      
      if (response.ok) { setStep(2) }
      else { setError(data.error || 'Failed to send OTP') }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '')
    if (!digits) {
      const nextOtp = [...otp]
      nextOtp[index] = ''
      setOtp(nextOtp)
      return
    }

    const nextOtp = [...otp]
    digits.slice(0, 6 - index).split('').forEach((digit, offset) => {
      nextOtp[index + offset] = digit
    })
    setOtp(nextOtp)

    const focusIndex = Math.min(index + digits.length, 5)
    document.getElementById(`otp-${focusIndex}`)?.focus()
  }

  const handleOtpPaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '')
    if (!pasted) return

    e.preventDefault()
    const nextOtp = [...otp]
    pasted.slice(0, 6 - index).split('').forEach((digit, offset) => {
      nextOtp[index + offset] = digit
    })
    setOtp(nextOtp)

    const focusIndex = Math.min(index + pasted.length, 5)
    document.getElementById(`otp-${focusIndex}`)?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const handleVerifyOTP = async () => {
    const code = otp.join('')
    if (code.length !== 6) { setError('Please enter the complete 6-digit code'); return }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, otpCode: code }),
      })
      const data = await response.json()
      if (response.ok && data.otpSessionToken) {
        setOtpSessionToken(data.otpSessionToken)
        setStep(3)
      } else {
        setError(data.error || 'Invalid OTP')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLocationContinue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedArea)        { setError('Please select your delivery area'); return }
    if (!hostelName.trim())   { setError('Please enter your lodge or landmark name'); return }
    if (!roomNumber.trim())   { setError('Please enter your room number'); return }
    const phoneErr = validatePhone(deliveryPhone)
    if (phoneErr) { setError(phoneErr); return }
    setError('')
    setStep(4)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms) { setError('Please agree to the Terms of Service'); return }
    const pwdError = validatePassword(password)
    if (pwdError) { setError(pwdError); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    const accountPhone = (phone || deliveryPhone || '').trim()
    const phoneErr = validatePhone(accountPhone)
    if (phoneErr) { setError(phoneErr); return }
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/signup-with-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, name, phone: accountPhone, password, otpSessionToken,
          role:         'BUYER', // Ã¢â€ Â Always sign up as BUYER. Upgrade to SELLER via become-seller flow.
          referralCode: referralCode || undefined,
          signupAccessCode: activeSignupAccessCode || undefined,
          universityId: effectiveSelectedUniversity!.id,
          hostelName:   hostelName.trim(),
          roomNumber:   roomNumber.trim(),
          landmark:     selectedArea,
        }),
      })
      const data = await response.json()
      
      if (response.ok) {
        clearSignupDraft()
        localStorage.setItem('token',    data.token)
        localStorage.setItem('userName', data.user.name)
        localStorage.setItem('userRole', data.user.role)
        localStorage.setItem('userId',   data.user.id)
        router.push('/marketplace')
      } else {
        setError(data.error || 'Signup failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  // STEP 0 — University selector
  if (step === 0) {
    return (
      <PageShell selectedUniversity={effectiveSelectedUniversity}>
        {countdown && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-50 border-2 border-blue-200 text-center">
            <p className="text-2xl mb-2">⏱️</p>
            <h3 className="font-black text-blue-900 text-lg mb-1">Signup Timer</h3>
            <p className="text-sm text-blue-700 mb-2">Signups are open now. This timer is just a visual reminder.</p>
            <div className="bg-white rounded-xl px-4 py-3 inline-block">
              <p className="text-xs text-blue-600 font-semibold mb-1">Countdown</p>
              <p className="text-2xl font-black text-blue-600 font-mono">{countdown}</p>
              <p className="text-xs text-blue-500 mt-1">June 22, 2026</p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-[#0f1115] border border-transparent dark:border-[#272b33] rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={btnStyle}>
              <MapPin className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Select Your Campus</h2>
            <p className="text-sm text-gray-500 mt-1">You will only see buyers, sellers, and riders from your campus.</p>
          </div>

          {uniLoading ? (
            <div className="flex justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-3">
              {universities.map(uni => (
                <button
                  key={uni.id}
                  type="button"
                  onClick={() => {
                    setSelectedUniversity(uni)
                    setSelectedUniversityId(uni.id)
                  }}
                  className={`w-full text-left px-4 py-3 rounded-2xl border-2 transition-all ${
                    selectedUniversity?.id === uni.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <p className="font-bold">{uni.shortName}</p>
                  <p className="text-sm opacity-80">{uni.name}</p>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!effectiveSelectedUniversity}
            className="w-full mt-5 py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60"
            style={btnStyle}
          >
            Continue
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-blue-600">Sign in</Link>
          </p>
        </div>
      </PageShell>
    )
  }

  // STEP 2 — OTP verification
  if (step === 2) {
    return (
      <PageShell selectedUniversity={effectiveSelectedUniversity}>
        {countdown && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-50 border-2 border-blue-200 text-center">
            <p className="text-2xl mb-2">⏱️</p>
            <h3 className="font-black text-blue-900 text-lg mb-1">Signup Timer</h3>
            <p className="text-sm text-blue-700 mb-2">Signups are open now. This timer is just a visual reminder.</p>
            <div className="bg-white rounded-xl px-4 py-3 inline-block">
              <p className="text-xs text-blue-600 font-semibold mb-1">Countdown</p>
              <p className="text-2xl font-black text-blue-600 font-mono">{countdown}</p>
              <p className="text-xs text-blue-500 mt-1">June 22, 2026</p>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-[#0f1115] border border-transparent dark:border-[#272b33] rounded-3xl p-8 shadow-2xl">
          <StepDots current={2} />
          <h2 className="text-xl font-black text-gray-900 mb-1">Verify your email</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter the 6-digit code sent to <strong>{email}</strong>
          </p>

          <ErrorBox error={error} />

          <div className="flex justify-center gap-2 mb-6">
            {otp.map((digit, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onPaste={e => handleOtpPaste(i, e)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-12 h-12 text-center text-xl font-bold border-2 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            ))}
          </div>

          <button
            onClick={handleVerifyOTP}
            disabled={loading || otp.join('').length !== 6}
            className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60"
            style={btnStyle}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <button onClick={() => setStep(0)} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600">
            Back
          </button>
        </div>
      </PageShell>
    )
  }
  // STEP 3 Ã¢â‚¬â€ Delivery location
  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  if (step === 3) {
    const areas: string[] = Array.isArray(effectiveSelectedUniversity?.deliveryAreas)
      ? effectiveSelectedUniversity!.deliveryAreas
      : ['Aroma', 'Tempsite', 'Express Gate', 'Ifite', 'Bus Stand', 'School Hostel']

    return (
      <PageShell selectedUniversity={effectiveSelectedUniversity}>
        {countdown && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-50 border-2 border-blue-200 text-center">
            <p className="text-2xl mb-2">Ã¢ÂÂ±Ã¯Â¸Â</p>
            <h3 className="font-black text-blue-900 text-lg mb-1">Signup Timer</h3>
            <p className="text-sm text-blue-700 mb-2">Signups are open now. This timer is just a visual reminder.</p>
            <div className="bg-white rounded-xl px-4 py-3 inline-block">
              <p className="text-xs text-blue-600 font-semibold mb-1">Countdown</p>
              <p className="text-2xl font-black text-blue-600 font-mono">{countdown}</p>
              <p className="text-xs text-blue-500 mt-1">June 22, 2026</p>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-[#0f1115] border border-transparent dark:border-[#272b33] rounded-3xl p-8 shadow-2xl">
          <StepDots current={3} />

          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={btnStyle}>
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-black text-gray-900">Your Delivery Location</h2>
            <p className="text-sm text-gray-500 mt-1">So riders can find you when you order</p>
          </div>

          <ErrorBox error={error} />

          {referralCode && (
            <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-100 text-sm text-green-700">
              Ã°Å¸Å½Â Referral code <strong>{referralCode}</strong> applied
            </div>
          )}

          <form onSubmit={handleLocationContinue} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Select Your Area</label>
              <div className="flex flex-wrap gap-2">
                {areas.map(area => (
                  <button
                    type="button"
                    key={area}
                    onClick={() => { setSelectedArea(area); setError('') }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                      selectedArea === area
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <span className="text-base">Ã°Å¸â€œÂ</span>
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Lodge Name / Landmark</label>
              <div className="relative">
                <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={hostelName}
                  onChange={e => setHostelName(e.target.value)}
                  required
                  placeholder="e.g. Goshen Lodge, Favour Hostel"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Room Number</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={roomNumber}
                  onChange={e => setRoomNumber(e.target.value)}
                  required
                  placeholder="e.g. Room 12, Block B"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone for Delivery</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={deliveryPhone}
                  onChange={e => setDeliveryPhone(e.target.value)}
                  required
                  placeholder="08012345678"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Riders will call this number when they arrive</p>
            </div>

            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-700">
                Ã°Å¸â€™Â¡ You can update your delivery location anytime from your profile settings.
              </p>
            </div>

            <button type="submit" className="w-full py-4 rounded-2xl text-white font-bold text-base" style={btnStyle}>
              Continue
            </button>
          </form>

          <button onClick={() => setStep(2)} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600">
            Back
          </button>
        </div>
      </PageShell>
    )
  }

  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  // STEP 4 Ã¢â‚¬â€ Password + terms
  // Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
  return (
      <PageShell selectedUniversity={effectiveSelectedUniversity}>
      {countdown && (
        <div className="mb-6 p-4 rounded-2xl bg-blue-50 border-2 border-blue-200 text-center">
          <p className="text-2xl mb-2">Ã¢ÂÂ±Ã¯Â¸Â</p>
          <h3 className="font-black text-blue-900 text-lg mb-1">Signup Timer</h3>
          <p className="text-sm text-blue-700 mb-2">Signups are open now. This timer is just a visual reminder.</p>
          <div className="bg-white rounded-xl px-4 py-3 inline-block">
            <p className="text-xs text-blue-600 font-semibold mb-1">Countdown</p>
            <p className="text-2xl font-black text-blue-600 font-mono">{countdown}</p>
            <p className="text-xs text-blue-500 mt-1">June 22, 2026</p>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-[#0f1115] border border-transparent dark:border-[#272b33] rounded-3xl p-8 shadow-2xl">
        <StepDots current={4} />
        <h2 className="text-xl font-black text-gray-900 mb-1">Set your password</h2>
        <p className="text-sm text-gray-500 mb-6">Almost done, {name}!</p>

        <ErrorBox error={error} />

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Min 8 characters, include a number"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {referralCode && (
            <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-sm text-green-700">
              Ã°Å¸Å½Â Referral code <strong>{referralCode}</strong> applied
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-600 mt-0.5"
            />
            <label htmlFor="terms" className="text-sm text-gray-700">
              I agree to the{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold">Privacy Policy</Link>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !agreedToTerms}
            className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-60"
            style={btnStyle}
          >
            {loading ? 'Creating accountÃ¢â‚¬Â¦' : `Join ${effectiveSelectedUniversity?.shortName ?? 'your campus'} Ã°Å¸Å½â€°`}
          </button>
        </form>

        <button onClick={() => setStep(3)} className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600">
            Back
        </button>
      </div>
    </PageShell>
  )
}
// nothing really
export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg,#000000,#070a10 46%,#000000)' }}>
        <div className="text-white text-xl font-bold">LoadingÃ¢â‚¬Â¦</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}


