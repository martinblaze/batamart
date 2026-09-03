'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bike } from 'lucide-react'
import {
  AuthShell,
  AuthField,
  AuthNotice,
  AuthSubmit,
} from '@/components/auth/AuthShell'

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
    <AuthShell
      eyebrow="Deliveries"
      title="Rider login"
      subtitle="Log in to see the runs available to you right now."
      icon={Bike}
      footer={
        <>
          Not a rider?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Regular login
          </Link>
        </>
      }
    >
      {wasForceLoggedOut && (
        <AuthNotice tone="warning" icon={AlertTriangle} title="Access denied" className="mb-5">
          Rider accounts can only reach the rider dashboard, wallet and notifications. You have been
          logged out — use a regular account for the marketplace.
          <Link
            href="/login"
            className="mt-2 block font-medium underline transition-all hover:no-underline"
          >
            Use a regular account
          </Link>
        </AuthNotice>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          label="Email address"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />

        <AuthField
          label="Password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          autoComplete="current-password"
          placeholder="Enter your password"
        />

        {error && <AuthNotice>{error}</AuthNotice>}

        <AuthSubmit type="submit" loading={loading} loadingText="Logging in…">
          Log in as rider
        </AuthSubmit>
      </form>
    </AuthShell>
  )
}

export default function RiderLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
        </div>
      }
    >
      <RiderLoginForm />
    </Suspense>
  )
}
