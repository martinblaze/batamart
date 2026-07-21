'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bike, Mail } from 'lucide-react'
import GoogleAuthButton from '@/components/auth/GoogleAuthButton'
import { Logo } from '@/components/layout/Logo'

function LoginForm() {
  const router = useRouter()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [suspensionMessage, setSuspensionMessage] = useState<string | null>(null)

  useEffect(() => {
    const wasSuspended = new URLSearchParams(window.location.search).get('suspended') === '1'
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
  }, [])

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
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center mb-4">
            <Logo size={40} />
          </div>
          <h1 className="text-[28px] font-semibold text-ink mb-2">Welcome back</h1>
          <p className="text-ink-secondary">Log in to your BataMart account</p>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-soft p-8">

          {/* Suspension message */}
          {suspensionMessage && (
            <div className="mb-6 bg-danger/5 border border-danger/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <div>
                  <p className="font-medium text-danger text-sm">Account suspended</p>
                  <p className="text-danger text-sm mt-1 whitespace-pre-line">{suspensionMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Rider error */}
          {error === '__RIDER__' ? (
            <div className="mb-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Bike className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" strokeWidth={1.75} />
                <div>
                  <p className="font-medium text-ink text-sm">Rider account detected</p>
                  <p className="text-ink-secondary text-sm mt-1">
                    Rider accounts cannot access the marketplace. Please use the rider login instead.
                  </p>
                  <Link
                    href="/rider/login"
                    className="inline-flex items-center justify-center mt-3 h-9 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:brightness-95 transition-all"
                  >
                    Go to rider login
                  </Link>
                </div>
              </div>
            </div>
          ) : error ? (
            <p className="mb-4 bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm">{error}</p>
          ) : null}

          {/* -- PRIMARY: Google Sign-In -- */}
          <div className="mb-2">
            <GoogleAuthButton
              mode="login"
              onError={setError}
              onLoading={setLoading}
            />
          </div>

          <p className="text-center text-xs text-ink-muted mb-5">
            Recommended — fast and secure
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-ink-muted font-medium">or continue with email</span>
            <div className="h-px bg-border flex-1" />
          </div>

          {/* -- SECONDARY: Email/Password (collapsed by default) -- */}
          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full h-11 rounded-lg border border-border text-ink-secondary font-medium text-sm hover:bg-surface transition-all flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" strokeWidth={1.75} />
              Use email & password instead
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
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
              </div>

              <div>
                <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="Enter your password"
                />
              </div>

              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:brightness-95 text-white rounded-lg font-medium text-[15px] disabled:opacity-50 transition-all"
              >
                {loading ? 'Logging in…' : 'Log in'}
              </button>

              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="w-full text-center text-xs text-ink-muted hover:text-ink-secondary transition-colors"
              >
                Back to Google sign-in
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-ink-secondary text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-primary font-medium hover:underline">Sign up</Link>
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
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

// -- Helper --------------------------------------------------------------------
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
