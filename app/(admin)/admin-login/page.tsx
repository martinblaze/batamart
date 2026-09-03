// app/(admin)/admin-login/page.tsx
'use client'

import { useState } from 'react'
import { Shield, Lock, Mail, AlertCircle } from 'lucide-react'
import {
  AuthShell,
  AuthField,
  AuthNotice,
  AuthSubmit,
} from '@/components/auth/AuthShell'

export default function AdminLoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' })
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
        body: JSON.stringify(formData),
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
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Restricted"
      title="Admin portal"
      subtitle="BataMart marketplace management"
      icon={Shield}
      back={{ href: '/marketplace', label: 'Back to marketplace' }}
    >
      {error && (
        <AuthNotice icon={AlertCircle} className="mb-6">
          {error}
        </AuthNotice>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          label="Admin email"
          type="email"
          icon={Mail}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="admin@batamart.com"
          autoComplete="email"
          required
        />

        <AuthField
          label="Password"
          type="password"
          icon={Lock}
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        <AuthSubmit type="submit" loading={loading} loadingText="Signing in…">
          Sign in to admin portal
        </AuthSubmit>
      </form>

      <AuthNotice tone="warning" icon={Lock} className="mt-6 text-xs">
        This area is restricted to authorised administrators. All access attempts are logged.
      </AuthNotice>
    </AuthShell>
  )
}
