'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function VerifyPage() {
  const router = useRouter()
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [contact, setContact] = useState('')

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
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-BATAMART-primary to-BATAMART-secondary rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3h18v4H3V3zm0 6h18v12H3V9zm2 2v8h14v-8H5zm2 2h10v4H7v-4z" />
              </svg>
            </div>
            <span className="font-bold text-2xl bg-gradient-to-r from-BATAMART-primary to-BATAMART-secondary bg-clip-text text-transparent">
              BATAMART
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Account</h1>
          <p className="text-gray-600">
            We sent a code to <span className="font-semibold text-gray-900">{contact}</span>
          </p>
        </div>

        {/* Verification Form */}
        <div className="bg-white dark:bg-[#0f1115] border border-transparent dark:border-[#272b33] rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OTP Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-4 text-center">
                Enter 6-Digit Code
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
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 dark:border-[#272b33] rounded-lg focus:border-BATAMART-primary focus:outline-none transition-colors bg-white dark:bg-[#0b0d12] text-gray-900 dark:text-[#e5e7eb]"
                  />
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-BATAMART-primary hover:bg-BATAMART-dark text-white py-3.5 rounded-lg font-bold text-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>

          {/* Resend */}
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Didn't receive code?{' '}
              <button className="text-BATAMART-primary font-semibold hover:underline">
                Resend
              </button>
            </p>
          </div>

          {/* Back Link */}
          <div className="mt-4 text-center">
            <Link href="/signup" className="text-gray-500 text-sm hover:underline">
              Back to signup
            </Link>
          </div>
        </div>

        {/* Dev Note */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800 text-center">
            <strong>Development Mode:</strong> Check your terminal/console for the OTP code
          </p>
        </div>
      </div>
    </div>
  )
}

