'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'

const HOSTELS = [
  'Aroma',
  'Tempsite',
  'Express Gate',
  'Ifite',
  'Amansea',
  'Bus Stand (Inside School)',
  'School Hostel (Inside School)',
]

export default function ProfileSetupPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    hostelName: '',
    roomNumber: '',
    landmark: '',
    phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Basic phone validation
    const digits = formData.phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Please enter a valid phone number')
      return
    }

    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('token')

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        router.push('/marketplace')
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update profile')
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
          <h1 className="text-[28px] font-semibold text-ink mb-2">Complete your profile</h1>
          <p className="text-ink-secondary">Help us deliver to you accurately</p>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-soft p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Phone Number */}
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">
                Phone number <span className="text-danger">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
                className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                placeholder="08012345678"
              />
              <p className="text-xs text-ink-muted mt-1 flex items-center gap-1">
                <Phone className="w-3 h-3" strokeWidth={1.75} />
                Riders will call this number when they arrive
              </p>
            </div>

            {/* Hostel Selection */}
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">
                Hostel / location <span className="text-danger">*</span>
              </label>
              <select
                value={formData.hostelName}
                onChange={(e) => handleChange('hostelName', e.target.value)}
                required
                className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                <option value="">Select your hostel/location</option>
                {HOSTELS.map((hostel) => (
                  <option key={hostel} value={hostel}>
                    {hostel}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Number */}
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">
                Room number <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.roomNumber}
                onChange={(e) => handleChange('roomNumber', e.target.value)}
                required
                className="w-full h-11 px-4 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                placeholder="e.g., Room 12, Block A"
              />
            </div>

            {/* Landmark */}
            <div>
              <label className="block text-[13px] font-medium text-ink-secondary mb-1.5">
                Landmark / description <span className="text-danger">*</span>
              </label>
              <textarea
                value={formData.landmark}
                onChange={(e) => handleChange('landmark', e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-[15px] text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                placeholder="e.g., Near the water dispenser, blue door"
              />
              <p className="text-xs text-ink-muted mt-1">Help riders find you easily</p>
            </div>

            {error && (
              <p className="bg-danger/5 border border-danger/20 text-danger px-4 py-3 rounded-lg text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:brightness-95 text-white rounded-lg font-medium text-[15px] disabled:opacity-50 transition-all"
            >
              {loading ? 'Saving…' : 'Complete setup'}
            </button>
          </form>

          <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-primary">
              <strong>Why we need this:</strong> your location and phone help riders deliver directly to you.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
