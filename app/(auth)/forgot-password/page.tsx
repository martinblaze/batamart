'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/layout/Logo'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
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
        alert('Password reset successful! You can now login.')
        router.push('/login')
      } else {
        setError(data.error || 'Failed to reset password')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center mb-4">
            <Logo size={40} />
          </div>
          <h1 className="text-[28px] font-semibold text-ink mb-2">Reset password</h1>
          <p className="text-ink-secondary">Step {step} of 3</p>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-soft p-8">

          {/* Step 1: Email input */}
          {step === 1 && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="you@example.com"
                />
                <p className="text-xs text-ink-muted mt-1">We&apos;ll send a reset code to this email</p>
              </div>

              {error && <p className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:brightness-95 text-white rounded-lg font-medium text-[15px] disabled:opacity-50 transition-all"
              >
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-ink-secondary text-sm">
                  Code sent to <span className="font-medium text-ink">{email}</span>
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink-secondary mb-4 text-center">Enter 6-digit code</label>
                <div className="flex justify-center gap-2">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className="w-12 h-14 text-center text-2xl font-semibold border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                    />
                  ))}
                </div>
              </div>

              {error && <p className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm text-center">{error}</p>}

              <button
                onClick={handleVerifyOTP}
                className="w-full h-11 bg-primary hover:brightness-95 text-white rounded-lg font-medium text-[15px] transition-all"
              >
                Verify code
              </button>

              <div className="text-center">
                <button
                  onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); setError('') }}
                  className="text-sm text-ink-secondary hover:text-primary"
                >
                  Use different email
                </button>
              </div>

              {/* Dev helper */}
              {!process.env.NEXT_PUBLIC_PRODUCTION && (
                <div className="bg-warning/5 border border-warning/20 rounded-lg p-3">
                  <p className="text-xs text-warning text-center">Dev mode: check terminal for OTP code</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: New password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="Min 8 characters, include a number"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="Repeat your password"
                />
              </div>

              {error && <p className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:brightness-95 text-white rounded-lg font-medium text-[15px] disabled:opacity-50 transition-all"
              >
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-ink-secondary hover:text-primary">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
