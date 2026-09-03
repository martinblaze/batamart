'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import {
  AuthShell,
  AuthField,
  AuthNotice,
  AuthSteps,
  AuthSubmit,
  OtpInput,
} from '@/components/auth/AuthShell'

const STEP_COPY = [
  { eyebrow: 'Recovery', title: 'Reset password', subtitle: 'Tell us the email on the account and we will send a reset code.' },
  { eyebrow: 'Recovery', title: 'Check your inbox', subtitle: 'Enter the six-digit code we just sent.' },
  { eyebrow: 'Recovery', title: 'Choose a new password', subtitle: 'Pick something you have not used here before.' },
]

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters'
    if (!/\d/.test(pwd)) return 'Password must contain at least one number'
    return ''
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, isLogin: true }),
      })

      const data = await response.json()
      if (response.ok) {
        setStep(2)
      } else {
        setError(data.error || 'Failed to send reset code')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = () => {
    if (otp.join('').length !== 6) {
      setError('Please enter the complete 6-digit code')
      return
    }
    setError('')
    setStep(3)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const pwdError = validatePassword(password)
    if (pwdError) { setError(pwdError); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otpCode: otp.join(''),
          newPassword: password,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        // A blocking alert() in the middle of a reset flow is jarring — show
        // the confirmation in place, then hand off to login.
        setDone(true)
        setTimeout(() => router.push('/login'), 1600)
      } else {
        setError(data.error || 'Failed to reset password')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="Recovery"
        title="Password updated"
        subtitle="Taking you to the login screen…"
      >
        <div className="flex flex-col items-center py-6 text-center">
          <CheckCircle2 className="mb-5 h-10 w-10 text-success" strokeWidth={1.5} />
          <p className="text-sm leading-relaxed text-ink-secondary">
            You can now log in with your new password.
          </p>
          <Link
            href="/login"
            className="ui-mono ui-mono-sm mt-7 inline-flex h-11 items-center bg-ink px-6 text-background transition-colors hover:bg-primary"
          >
            Go to login
          </Link>
        </div>
      </AuthShell>
    )
  }

  const copy = STEP_COPY[step - 1]

  return (
    <AuthShell
      eyebrow={copy.eyebrow}
      title={copy.title}
      subtitle={copy.subtitle}
      back={{ href: '/login', label: 'Back to login' }}
    >
      <AuthSteps current={step} total={3} />

      {step === 1 && (
        <form onSubmit={handleSendOTP} className="space-y-5">
          <AuthField
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            hint="We'll send a reset code to this address."
          />

          {error && <AuthNotice>{error}</AuthNotice>}

          <AuthSubmit type="submit" loading={loading} loadingText="Sending…">
            Send reset code
          </AuthSubmit>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <p className="text-center text-sm text-ink-secondary">
            Code sent to <span className="font-medium text-ink">{email}</span>
          </p>

          <div>
            <label className="mb-4 block text-center font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">
              Enter 6-digit code
            </label>
            <OtpInput value={otp} onChange={setOtp} />
          </div>

          {error && <AuthNotice className="text-center">{error}</AuthNotice>}

          <AuthSubmit type="button" onClick={handleVerifyOTP}>
            Verify code
          </AuthSubmit>

          <button
            type="button"
            onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); setError('') }}
            className="w-full text-center text-xs text-ink-muted transition-colors hover:text-ink-secondary"
          >
            Use a different email
          </button>

          {!process.env.NEXT_PUBLIC_PRODUCTION && (
            <AuthNotice tone="warning">
              Development mode — the code is printed to your terminal.
            </AuthNotice>
          )}
        </div>
      )}

      {step === 3 && (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <AuthField
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="At least 8 characters, including a number"
          />
          <AuthField
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Repeat your password"
          />

          {error && <AuthNotice>{error}</AuthNotice>}

          <AuthSubmit type="submit" loading={loading} loadingText="Resetting…">
            Reset password
          </AuthSubmit>
        </form>
      )}
    </AuthShell>
  )
}
