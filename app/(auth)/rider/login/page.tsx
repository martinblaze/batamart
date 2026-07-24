'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bike } from 'lucide-react'

function RiderLoginForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wasForceLoggedOut, setWasForceLoggedOut] = useState(false)
  // Belt-and-braces guard against rapid multi-click double submits: React's
  // state update (setLoading) isn't guaranteed to re-render/disable the
  // button before a second click lands in the same tick, so check a ref
  // synchronously as the very first thing in the handler too.
  const submittingRef = useRef(false)

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason')
    if (reason === 'no_access') {
      localStorage.clear()
      sessionStorage.removeItem('batamart_rider_mode')
      window.dispatchEvent(new Event('auth-change'))
      setWasForceLoggedOut(true)
      return
    }

    const role = localStorage.getItem('userRole')
    if (role === 'RIDER') {
      router.replace('/rider-dashboard')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/riders/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('userRole', data.user.role)
        localStorage.setItem('userId', data.user.id)
        localStorage.setItem('userName', data.user.name)

        // 90 days, matching the rider token's expiry (see app/api/riders/login/route.ts)
        document.cookie = `token=${data.token}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 90}`
        router.replace('/rider-dashboard')
      } else {
        setError(data.error || 'Login failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center mb-4">
            <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center">
              <Bike className="w-6 h-6 text-white" strokeWidth={1.75} />
            </div>
          </div>
          <h1 className="text-[28px] font-semibold text-ink mb-2">Rider login</h1>
          <p className="text-ink-secondary">Log in to see available deliveries</p>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-soft p-8">
          {wasForceLoggedOut && (
            <div className="mb-5 bg-warning/5 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="font-medium text-ink text-sm">Access denied</p>
                <p className="text-ink-secondary text-sm mt-1">
                  Rider accounts can only access the rider dashboard, wallet, and notifications.
                  You have been logged out. Please use a regular account to access the marketplace.
                </p>
                <Link
                  href="/login"
                  className="inline-block mt-2 text-sm text-warning font-medium underline hover:no-underline"
                >
                  Use a regular account
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Email address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
                className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors"
                placeholder="Email address"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="current-password"
                className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors"
                placeholder="Password"
              />
            </div>

            {error && (
              <div className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:brightness-95 text-white rounded-lg font-medium text-[15px] disabled:opacity-50 transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Logging in…
                </span>
              ) : (
                'Log in as rider'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-ink-secondary text-sm">
              Not a rider?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Regular login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RiderLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
      </div>
    }>
      <RiderLoginForm />
    </Suspense>
  )
}
