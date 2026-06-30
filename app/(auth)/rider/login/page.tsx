'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function RiderLoginForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [wasForceLoggedOut, setWasForceLoggedOut] = useState(false)

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

        document.cookie = `token=${data.token}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`
        router.push('/rider-dashboard')
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-BATAMART-primary to-BATAMART-secondary rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="5.5" cy="17.5" r="3.5" />
                <circle cx="18.5" cy="17.5" r="3.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 6h-4l-2 5.5M9 17.5h5.5l2-5.5H19" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l1.5 5.5" />
              </svg>
            </div>
            <span className="font-bold text-2xl bg-gradient-to-r from-BATAMART-primary to-BATAMART-secondary bg-clip-text text-transparent">
              BATAMART
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Rider Login</h1>
          <p className="text-gray-600">Log in to see available deliveries</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {wasForceLoggedOut && (
            <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-amber-500 text-xl flex-shrink-0">Warning</span>
              <div>
                <p className="font-semibold text-amber-900 text-sm">Access Denied</p>
                <p className="text-amber-700 text-sm mt-1">
                  Rider accounts can only access the Rider Dashboard, Wallet, and Notifications.
                  You have been logged out. Please use a regular account to access the marketplace.
                </p>
                <Link
                  href="/login"
                  className="inline-block mt-2 text-sm text-amber-800 font-semibold underline hover:no-underline"
                >
                  Use a regular account
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-BATAMART-primary focus:outline-none transition-colors"
                placeholder="Email address"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-BATAMART-primary focus:outline-none transition-colors"
                placeholder="Password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-BATAMART-primary hover:bg-BATAMART-dark text-white py-3.5 rounded-lg font-bold text-lg disabled:opacity-50 transition-all shadow-md"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  Logging in...
                </span>
              ) : (
                'Log In as Rider'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Not a rider?{' '}
              <Link href="/login" className="text-gray-500 hover:underline">
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-BATAMART-primary border-t-transparent" />
      </div>
    }>
      <RiderLoginForm />
    </Suspense>
  )
}
