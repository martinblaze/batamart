'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, ChevronRight, Home, Hash, Phone, Mail, Gift } from 'lucide-react'
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

// ── Shared UI helpers — defined OUTSIDE SignupForm so they don't remount ──
// Design bible: flat surfaces only, single primary accent, no gradients.
const PageShell = ({
  children,
  selectedUniversity,
}: {
  children: React.ReactNode
  selectedUniversity: University | null
}) => (
  <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-surface">
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <h1 className="text-[28px] font-semibold text-ink tracking-tight">BataMart</h1>
        <p className="text-ink-secondary text-sm mt-1">Campus marketplace</p>
        {selectedUniversity && (
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <MapPin className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
            <span className="text-primary text-xs font-medium">
              {selectedUniversity.shortName} — {selectedUniversity.location}
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
    <div className="mb-4 p-3 rounded-lg bg-danger/5 border border-danger/20 text-sm text-danger">
      {error}
    </div>
  ) : null

const StepDots = ({ current }: { current: number }) => (
  <div className="flex justify-center gap-1.5 mb-6">
    {[1, 2, 3, 4].map(s => (
      <div
        key={s}
        className={`h-1.5 rounded-full transition-all ${
          s <= current ? 'w-6 bg-primary' : 'w-3 bg-border'
        }`}
      />
    ))}
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Update countdown display without blocking signup access ──────────────────
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
          role:         'BUYER', // ← Always sign up as BUYER. Upgrade to SELLER via become-seller flow.
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

  // ════════════════════════════════════════════════════════
  // STEP 0 — University selector
  // ════════════════════════════════════════════════════════
  if (step === 0) {
    return (
      <PageShell selectedUniversity={effectiveSelectedUniversity}>
        {countdown && (
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <p className="text-2xl mb-2">Timer</p>
            <div className="bg-white rounded-xl px-4 py-3 inline-block">
              <p className="text-xs text-primary font-medium mb-1">Countdown</p>
              <p className="text-2xl font-semibold text-primary font-mono">{countdown}</p>
              <p className="text-xs text-primary mt-1">June 22, 2026</p>
            </div>
          </div>
        )}
        <div className="bg-white border border-border rounded-xl p-8 shadow-soft">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 bg-primary">
              <MapPin className="w-7 h-7 text-white" strokeWidth={1.75} />
            </div>
            <h2 className="text-[20px] font-semibold text-ink">Select your campus</h2>
              <p className="text-sm text-ink-secondary mt-1">
              You will only see buyers, sellers, and riders from your campus.
            </p>
          </div>

          {uniLoading ? (
            <div className="flex justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            </div>
          ) : (
            <div className="space-y-3">
              {universities.map(uni => (
                <button
                  key={uni.id}
                  onClick={() => {
                    setSelectedUniversity(uni)
                    setSelectedUniversityId(uni.id)
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    effectiveSelectedUniversity?.id === uni.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-ink text-sm">{uni.shortName}</p>
                      <p className="text-xs text-ink-secondary mt-0.5">{uni.name}</p>
                      <p className="text-xs text-primary mt-0.5">{uni.location}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      effectiveSelectedUniversity?.id === uni.id
                        ? 'border-primary bg-primary'
                        : 'border-border'
                    }`}>
                      {effectiveSelectedUniversity?.id === uni.id && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {universities.length === 0 && (
                <p className="text-center text-ink-muted text-sm py-4">No campuses available yet.</p>
              )}
            </div>
          )}

          <button
            onClick={() => { if (effectiveSelectedUniversity) setStep(1) }}
            disabled={!effectiveSelectedUniversity}
            className="w-full mt-6 h-11 rounded-lg text-white font-medium text-[15px] bg-primary hover:brightness-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            Continue with {effectiveSelectedUniversity?.shortName ?? 'your campus'}
            <ChevronRight className="w-5 h-5" strokeWidth={1.75} />
          </button>

          <p className="text-center text-sm text-ink-secondary mt-4">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary">Sign in</Link>
          </p>
        </div>
      </PageShell>
    )
  }

  // ════════════════════════════════════════════════════════
  // STEP 1 — Google first, email form secondary
  // ════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <PageShell selectedUniversity={effectiveSelectedUniversity}>
        {countdown && (
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <p className="text-2xl mb-2">Timer</p>
            <div className="bg-white rounded-xl px-4 py-3 inline-block">
              <p className="text-xs text-primary font-medium mb-1">Countdown</p>
              <p className="text-2xl font-semibold text-primary font-mono">{countdown}</p>
              <p className="text-xs text-primary mt-1">June 22, 2026</p>
            </div>
          </div>
        )}
        <div className="bg-white border border-border rounded-xl p-8 shadow-soft">
          <StepDots current={1} />
          <h2 className="text-[20px] font-semibold text-ink mb-1">Create account</h2>
          <p className="text-sm text-ink-secondary mb-6">Join the {effectiveSelectedUniversity?.shortName} marketplace</p>

          <ErrorBox error={error} />

          {/* ── PRIMARY: Google Sign-Up ── */}
          <div className="mb-2">
            <GoogleAuthButton
              mode="signup"
              payload={{
                universityId: effectiveSelectedUniversity?.id,
                referralCode: referralCode || undefined,
                signupAccessCode: activeSignupAccessCode || undefined,
              }}
              onError={setError}
              onLoading={setLoading}
              onSuccess={(data) => {
                if (data?.requiresProfile && data?.signupToken) {
                  if (data?.profile?.email) setEmail(String(data.profile.email))
                  if (data?.profile?.name) setName(String(data.profile.name))
                  setOtpSessionToken(String(data.signupToken))
                  setStep(3)
                  return
                }

                if (data?.token && data?.user) {
                  clearSignupDraft()
                  localStorage.setItem('token', data.token)
                  localStorage.setItem('userName', data.user.name)
                  localStorage.setItem('userRole', data.user.role || '')
                  localStorage.setItem('userId', data.user.id)
                  document.cookie = `token=${data.token}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`
                  window.dispatchEvent(new Event('auth-change'))
                  window.location.href = '/marketplace'
                }
              }}
            />
          </div>

          <p className="text-center text-xs text-ink-muted mb-5">
            Recommended — no password needed, fast setup
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-ink-muted font-medium">or sign up with email</span>
            <div className="h-px bg-border flex-1" />
          </div>

          {/* ── SECONDARY: Email form (collapsed by default) ── */}
          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full h-11 rounded-lg border border-border text-ink-secondary font-medium text-sm hover:bg-surface transition-all flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" strokeWidth={1.75} />
              Use email & password instead
            </button>
          ) : (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Your full name"
                  className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  placeholder="08012345678"
                  className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>

              {/* ── REMOVED: "I also want to sell" checkbox ── */}
              {/* Everyone signs up as a BUYER. To sell, they click "Sell Product"
                  which redirects them to /become-seller to upgrade their account. */}

              <div>
                <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Referral Code (Optional)</label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value.toUpperCase().trim())}
                  placeholder="e.g. BATAMART-ABC123"
                  className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                <p className="text-xs text-ink-muted mt-1">Paste a code from a friend or use their referral link.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg text-white font-medium text-[15px] bg-primary hover:brightness-95 transition-all disabled:opacity-60"
              >
                {loading ? 'Sending OTP…' : 'Continue'}
              </button>

              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="w-full text-center text-xs text-ink-muted hover:text-ink-secondary transition-colors"
              >
                Back to Google Sign-Up
              </button>
            </form>
          )}

          <button
            onClick={() => {
              clearSignupDraft()
              setSelectedUniversity(null)
              setSelectedUniversityId('')
              setStep(0)
            }}
            className="w-full mt-4 text-sm text-ink-muted hover:text-ink-secondary"
          >
            Change campus
          </button>
          <p className="text-center text-sm text-ink-secondary mt-4">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary">Sign in</Link>
          </p>
        </div>
      </PageShell>
    )
  }

  // ════════════════════════════════════════════════════════
  // STEP 2 — OTP verification
  // ════════════════════════════════════════════════════════
  if (step === 2) {
    return (
        <PageShell selectedUniversity={effectiveSelectedUniversity}>
        {countdown && (
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <p className="text-2xl mb-2">Timer</p>
            <div className="bg-white rounded-xl px-4 py-3 inline-block">
              <p className="text-xs text-primary font-medium mb-1">Countdown</p>
              <p className="text-2xl font-semibold text-primary font-mono">{countdown}</p>
              <p className="text-xs text-primary mt-1">June 22, 2026</p>
            </div>
          </div>
        )}
        <div className="bg-white border border-border rounded-xl p-8 shadow-soft">
          <StepDots current={2} />
          <h2 className="text-[20px] font-semibold text-ink mb-1">Verify your email</h2>
          <p className="text-sm text-ink-secondary mb-6">
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
                className="w-12 h-12 text-center text-xl font-semibold border border-border rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            ))}
          </div>

          <button
            onClick={handleVerifyOTP}
            disabled={loading || otp.join('').length !== 6}
            className="w-full h-11 rounded-lg text-white font-medium text-[15px] bg-primary hover:brightness-95 disabled:opacity-60"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>

          <button onClick={() => setStep(1)} className="w-full mt-3 text-sm text-ink-muted hover:text-ink-secondary">
            ← Back
          </button>
        </div>
      </PageShell>
    )
  }

  // ════════════════════════════════════════════════════════
  // STEP 3 — Delivery location
  // ════════════════════════════════════════════════════════
  if (step === 3) {
    const areas: string[] = Array.isArray(effectiveSelectedUniversity?.deliveryAreas)
      ? effectiveSelectedUniversity!.deliveryAreas
      : ['Aroma', 'Tempsite', 'Express Gate', 'Ifite', 'Bus Stand', 'School Hostel']

    return (
      <PageShell selectedUniversity={effectiveSelectedUniversity}>
        {countdown && (
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <p className="text-2xl mb-2">Timer</p>
            <div className="bg-white rounded-xl px-4 py-3 inline-block">
              <p className="text-xs text-primary font-medium mb-1">Countdown</p>
              <p className="text-2xl font-semibold text-primary font-mono">{countdown}</p>
              <p className="text-xs text-primary mt-1">June 22, 2026</p>
            </div>
          </div>
        )}
        <div className="bg-white border border-border rounded-xl p-8 shadow-soft">
          <StepDots current={3} />

          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 bg-primary">
              <MapPin className="w-6 h-6 text-white" strokeWidth={1.75} />
            </div>
            <h2 className="text-[20px] font-semibold text-ink">Your delivery location</h2>
            <p className="text-sm text-ink-secondary mt-1">So riders can find you when you order</p>
          </div>

          <ErrorBox error={error} />

          {referralCode && (
            <div className="mb-4 p-3 bg-success/5 rounded-lg border border-success/20 text-sm text-success flex items-center gap-2">
              <Gift className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
              Referral code <strong>{referralCode}</strong> applied
            </div>
          )}

          <form onSubmit={handleLocationContinue} className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-2">Select your area</label>
              <div className="flex flex-wrap gap-2">
                {areas.map(area => (
                  <button
                    type="button"
                    key={area}
                    onClick={() => { setSelectedArea(area); setError('') }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border transition-all ${
                      selectedArea === area
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-surface text-ink-secondary hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Lodge Name / Landmark</label>
              <div className="relative">
                <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                <input
                  type="text"
                  value={hostelName}
                  onChange={e => setHostelName(e.target.value)}
                  required
                  placeholder="e.g. Goshen Lodge, Favour Hostel"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-surface text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Room Number</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                <input
                  type="text"
                  value={roomNumber}
                  onChange={e => setRoomNumber(e.target.value)}
                  required
                  placeholder="e.g. Room 12, Block B"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-surface text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Phone for Delivery</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                <input
                  type="tel"
                  value={deliveryPhone}
                  onChange={e => setDeliveryPhone(e.target.value)}
                  required
                  placeholder="08012345678"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-surface text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <p className="text-xs text-ink-muted mt-1">Riders will call this number when they arrive</p>
            </div>

            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-xs text-primary">Tip: you can update your delivery location anytime from your profile settings.</p>
            </div>

            <button type="submit" className="w-full h-11 rounded-lg text-white font-medium text-[15px] bg-primary hover:brightness-95">
              Continue
            </button>
          </form>

          <button onClick={() => setStep(2)} className="w-full mt-3 text-sm text-ink-muted hover:text-ink-secondary">
            ← Back
          </button>
        </div>
      </PageShell>
    )
  }

  // ════════════════════════════════════════════════════════
  // STEP 4 — Password + terms
  // ════════════════════════════════════════════════════════
  return (
      <PageShell selectedUniversity={effectiveSelectedUniversity}>
      {countdown && (
        <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20 text-center">
            <p className="text-2xl mb-2">Timer</p>
          <div className="bg-white rounded-xl px-4 py-3 inline-block">
            <p className="text-xs text-primary font-medium mb-1">Countdown</p>
            <p className="text-2xl font-semibold text-primary font-mono">{countdown}</p>
            <p className="text-xs text-primary mt-1">June 22, 2026</p>
          </div>
        </div>
      )}
      <div className="bg-white border border-border rounded-xl p-8 shadow-soft">
        <StepDots current={4} />
        <h2 className="text-[20px] font-semibold text-ink mb-1">Set your password</h2>
        <p className="text-sm text-ink-secondary mb-6">Almost done, {name}!</p>

        <ErrorBox error={error} />

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="Min 8 characters, include a number"
              className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat password"
              className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          {referralCode && (
            <div className="p-3 bg-success/5 rounded-lg border border-success/20 text-sm text-success flex items-center gap-2">
              <Gift className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
              Referral code <strong>{referralCode}</strong> applied
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-surface rounded-lg">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
              className="w-4 h-4 rounded accent-primary mt-0.5"
            />
            <label htmlFor="terms" className="text-sm text-ink-secondary">
              I agree to the{' '}
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary font-medium">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary font-medium">Privacy Policy</Link>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !agreedToTerms}
            className="w-full h-11 rounded-lg text-white font-medium text-[15px] bg-primary hover:brightness-95 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : `Join ${effectiveSelectedUniversity?.shortName ?? 'your campus'}`}
          </button>
        </form>

        <button onClick={() => setStep(3)} className="w-full mt-3 text-sm text-ink-muted hover:text-ink-secondary">
          ← Back
        </button>
      </div>
    </PageShell>
  )
}
export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-ink text-[20px] font-semibold">Loading…</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}


