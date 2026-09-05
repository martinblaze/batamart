'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bike, Mail } from 'lucide-react'
import GoogleAuthButton from '@/components/auth/GoogleAuthButton'
import { Logo } from '@/components/layout/Logo'
import { AuthLayout } from '@/components/auth/AuthLayout'

function LoginForm() {
  const router = useRouter()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [suspensionMessage, setSuspensionMessage] = useState<string | null>(null)
  const [redirectParam, setRedirectParam] = useState('')

  useEffect(() => {
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    if (redirect && redirect.startsWith('/')) setRedirectParam(redirect)
  }, [])

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
        const redirectTo = new URLSearchParams(window.location.search).get('redirect')
        router.push(redirectTo && redirectTo.startsWith('/') ? redirectTo : '/marketplace')

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
    <AuthLayout
      eyebrow="Account"
      title="Welcome"
      titleAccent="back."
      subtitle="Log in to pick up where you left off."
      back={{ href: '/', label: 'Back to home' }}
      quote="Buy and sell with students on your campus — with escrow on every order."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            href={redirectParam ? `/signup?redirect=${encodeURIComponent(redirectParam)}` : '/signup'}
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <>

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

          <p className="mb-5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            Recommended — fast and secure
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px bg-border flex-1" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">or continue with email</span>
            <div className="h-px bg-border flex-1" />
          </div>

          {/* -- SECONDARY: Email/Password (collapsed by default) -- */}
          {!showEmailForm ? (
            <button
              onClick={() => setShowEmailForm(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-border font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors duration-300 hover:border-ink/25 hover:text-ink"
            >
              <Mail className="w-4 h-4" strokeWidth={1.75} />
              Use email & password instead
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 w-full rounded-lg border border-border bg-card px-4 text-[15px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 w-full rounded-lg border border-border bg-card px-4 text-[15px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
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
                className="h-12 w-full rounded-lg bg-ink font-mono text-[11px] uppercase tracking-[0.16em] text-background transition-colors duration-300 hover:bg-primary disabled:opacity-50"
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

      </>
    </AuthLayout>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
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
