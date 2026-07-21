// app/(admin)/admin-login/page.tsx
'use client'

import { useState } from 'react'
import { Shield, Lock, Mail, AlertCircle, ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'

export default function AdminLoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        // Save token as secure cookie (works with middleware) instead of localStorage
        document.cookie = `adminToken=${data.token}; path=/; max-age=86400; SameSite=Lax`

        // Also keep in localStorage as fallback for API calls
        localStorage.setItem('adminToken', data.token)

        // Full page reload so cookie is set before middleware checks it
        setTimeout(() => {
          window.location.href = '/admin'
        }, 100)
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="text-[28px] font-semibold text-ink mb-2">Admin portal</h1>
          <p className="text-ink-secondary">BataMart marketplace management</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl border border-border p-8 shadow-soft">
          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" strokeWidth={1.75} />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">
                Admin email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-11 pl-11 pr-4 bg-surface border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="admin@batamart.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" strokeWidth={1.75} />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-11 pl-11 pr-4 bg-surface border border-border rounded-lg text-[15px] text-ink focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:brightness-95 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in to admin portal'}
            </button>
          </form>

          {/* Warning */}
          <div className="mt-6 p-4 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-warning">
              This area is restricted to authorized administrators only.
              All access attempts are logged.
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <a href="/marketplace" className="text-ink-secondary hover:text-primary text-sm transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} /> Back to marketplace
          </a>
        </div>
      </div>
    </div>
  )
}
