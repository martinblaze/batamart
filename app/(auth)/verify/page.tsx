'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AuthShell,
  AuthNotice,
  AuthSubmit,
  OtpInput,
} from '@/components/auth/AuthShell'

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
      setError('Please enter the complete 6-digit code')
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

        if (result.user.hostelName) {
          router.push('/marketplace')
        } else {
          router.push('/profile/setup')
        }
      } else {
        setError(result.error || 'Invalid code')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Verification"
      title="Verify your account"
      subtitle={
        contact ? (
          <>
            We sent a six-digit code to{' '}
            <span className="font-medium text-ink">{contact}</span>
          </>
        ) : (
          'We sent a six-digit code to your inbox.'
        )
      }
      back={{ href: '/signup', label: 'Back to signup' }}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-4 block text-center font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">
            Enter 6-digit code
          </label>
          <OtpInput value={otp} onChange={setOtp} disabled={loading} />
        </div>

        {error && <AuthNotice className="text-center">{error}</AuthNotice>}

        <AuthSubmit type="submit" loading={loading} loadingText="Verifying…">
          Verify &amp; continue
        </AuthSubmit>
      </form>

      <p className="mt-6 text-center text-sm text-ink-secondary">
        Didn&apos;t receive a code?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-primary transition-opacity hover:underline disabled:opacity-50"
        >
          {resending ? 'Resending…' : resent ? 'Code resent' : 'Resend'}
        </button>
      </p>

      {!process.env.NEXT_PUBLIC_PRODUCTION && (
        <AuthNotice tone="warning" className="mt-6">
          Development mode — the code is printed to your terminal.
        </AuthNotice>
      )}

      <p className="mt-6 text-center text-sm text-ink-secondary">
        Wrong address?{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Start over
        </Link>
      </p>
    </AuthShell>
  )
}
