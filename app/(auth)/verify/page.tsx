'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/layout/Logo'

export default function VerifyPage() {
  const router = useRouter()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [contact, setContact] = useState('')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    const signupData = sessionStorage.getItem('signup_data')
    const loginData = sessionStorage.getItem('login_data')

    if (signupData) {
      const data = JSON.parse(signupData)
      setContact(data.phone || data.email)
    } else if (loginData) {
      const data = JSON.parse(loginData)
      setContact(data.phone || data.email)
    } else {
      router.push('/signup')
    }
  }, [router])

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`)
      nextInput?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`)
      prevInput?.focus()
    }
  }

  const handleResend = async () => {
    if (resending) return
    setResending(true)
    setError('')
    setResent(false)
    try {
      const signupData = sessionStorage.getItem('signup_data')
      const loginData = sessionStorage.getItem('login_data')
      const data = JSON.parse(signupData || loginData || '{}')

      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, isLogin: !!loginData }),
      })

      if (response.ok) {
        setResent(true)
      } else {
        const result = await response.json()
        setError(result.error || 'Could not resend the code')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const otpCode = otp.join('')

    if (otpCode.length !== 6) {
      setError('Please enter complete OTP')
      return
    }

    setLoading(true)
    setError('')

    try {
      const signupData = sessionStorage.getItem('signup_data')
      const loginData = sessionStorage.getItem('login_data')
      const data = JSON.parse(signupData || loginData || '{}')

      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: data.phone,
          email: data.email,
          code: otpCode,
          name: data.name,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        localStorage.setItem('token', result.token)
        localStorage.setItem('userName', result.user.name)
        sessionStorage.removeItem('signup_data')
        sessionStorage.removeItem('login_data')

        // Redirect based on whether profile is complete
        if (result.user.hostelName) {
          router.push('/marketplace')
        } else {
          router.push('/profile/setup')
        }
      } else {
        setError(result.error || 'Invalid OTP')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center mb-4">
            <Logo size={40} />
          </div>
          <h1 className="text-[28px] font-semibold text-ink mb-2">Verify your account</h1>
          <p className="text-ink-secondary">
            We sent a code to <span className="font-medium text-ink">{contact}</span>
          </p>
        </div>

        {/* Verification Form */}
        <div className="bg-white border border-border rounded-xl shadow-soft p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP Input */}
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-4 text-center">
                Enter 6-digit code
              </label>
              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-semibold border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors bg-surface text-ink"
                  />
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:brightness-95 text-white rounded-lg font-medium text-[15px] transition-all disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify & continue'}
            </button>
          </form>

          {/* Resend */}
          <div className="mt-6 text-center">
            <p className="text-ink-secondary text-sm">
              Didn&apos;t receive a code?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-primary font-medium hover:underline disabled:opacity-50"
              >
                {resending ? 'Resending…' : resent ? 'Code resent' : 'Resend'}
              </button>
            </p>
          </div>

          {/* Back Link */}
          <div className="mt-4 text-center">
            <Link href="/signup" className="text-ink-secondary text-sm hover:underline">
              Back to signup
            </Link>
          </div>
        </div>

        {/* Dev Note */}
        <div className="mt-6 bg-warning/5 border border-warning/20 rounded-lg p-4">
          <p className="text-sm text-warning text-center">
            <strong>Development mode:</strong> check your terminal/console for the OTP code
          </p>
        </div>
      </div>
    </div>
  )
}

