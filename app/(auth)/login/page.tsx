'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import GoogleAuthButton from '@/components/auth/GoogleAuthButton'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [suspensionMessage, setSuspensionMessage] = useState<string | null>(null)

  useEffect(() => {
    const wasSuspended = searchParams.get('suspended') === '1'
    if (!wasSuspended) return

    const fetchSuspensionInfo = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch('/api/auth/suspension-info', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (res.ok) {
          const data = await res.json()
          if (data.isSuspended) {
            setSuspensionMessage(buildSuspensionMessage(data.reason, data.until))
          }
        }
      } catch {
        setSuspensionMessage('Your account has been suspended. Please contact support.')
      }
    }
    fetchSuspensionInfo()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuspensionMessage(null)

    try {
      const response = await fetch('/api/auth/login-with-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('token',    data.token)
        localStorage.setItem('userName', data.user.name)
        localStorage.setItem('userRole', data.user.role || '')
        localStorage.setItem('userId',   data.user.id)

        document.cookie = `token=${data.token}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`

        window.dispatchEvent(new Event('auth-change'))
        router.push('/marketplace')

      } else if (response.status === 403 && data.isRider) {
        setError('__RIDER__')

      } else if (response.status === 403 && data.suspended) {
        setSuspensionMessage(buildSuspensionMessage(data.reason, data.until))

      } else if (response.status === 429) {
        setError('Too many login attempts. Please wait a few minutes and try again.')

      } else {
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">

        {/* Header */}
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-500">Login to your BATAMART account</p>
        </div>

        <div className="bg-white dark:bg-[#0f1115] border border-transparent dark:border-[#272b33] rounded-2xl shadow-xl p-8">

          {/* Suspension message */}
          {suspensionMessage && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-xl flex-shrink-0">🚫</span>
                <div>
                  <p className="font-semibold text-red-800 text-sm">Account Suspended</p>
                  <p className="text-red-700 text-sm mt-1 whitespace-pre-line">{suspensionMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rider error */}
          {error === '__RIDER__' ? (
            <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🚴</span>
                <div>
                  <p className="font-semibold text-purple-900 text-sm">Rider Account Detected</p>
                  <p className="text-purple-700 text-sm mt-1">
                    Rider accounts cannot access the marketplace. Please use the Rider Login instead.
                  </p>
                  <Link
                    href="/rider/login"
                    className="inline-block mt-3 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Go to Rider Login →
                  </Link>
                </div>
              </div>
            </div>
          ) : error ? (
            <p className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</p>
          ) : null}

          {/* ── PRIMARY: Google Sign-In ── */}
          <div className="mb-2">
            <GoogleAuthButton
              mode="login"
              onError={setError}
              onLoading={setLoading}
            />
          </div>

          <p className="text-center text-xs text-gray-400 mb-5">
            Recommended · Fast · Secure
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-xs text-gray-400 font-semibold">or continue with email</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          {/* ── SECONDARY: Email/Password (collapsed by default) ── */}
          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full py-3 rounded-lg border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Use email &amp; password instead
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-[#272b33] rounded-lg focus:border-BATAMART-primary focus:outline-none bg-white dark:bg-[#0b0d12] text-gray-900 dark:text-[#e5e7eb]"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-[#272b33] rounded-lg focus:border-BATAMART-primary focus:outline-none bg-white dark:bg-[#0b0d12] text-gray-900 dark:text-[#e5e7eb]"
                  placeholder="Enter your password"
                />
              </div>

              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-BATAMART-primary hover:underline font-semibold">
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-BATAMART-primary hover:bg-BATAMART-dark text-white py-3.5 rounded-lg font-bold text-lg disabled:opacity-50"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>

              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Back to Google Sign-In
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-BATAMART-primary font-semibold hover:underline">Sign Up</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#000000]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-BATAMART-primary border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────
function buildSuspensionMessage(reason: string | null, until: string | null): string {
  const reasonText = reason ?? 'Violation of platform terms'
  if (!until) {
    return `Your account has been permanently suspended.\n\nReason: ${reasonText}\n\nContact support if you believe this is an error.`
  }
  const untilDate = new Date(until)
  const now = new Date()
  if (untilDate.getFullYear() - now.getFullYear() > 50) {
    return `Your account has been permanently suspended.\n\nReason: ${reasonText}\n\nContact support if you believe this is an error.`
  }
  return `Your account is suspended until ${untilDate.toLocaleDateString('en-NG', { dateStyle: 'long' })}.\n\nReason: ${reasonText}\n\nContact support if you believe this is an error.`
}

