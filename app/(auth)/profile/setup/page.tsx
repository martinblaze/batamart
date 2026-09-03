'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Phone } from 'lucide-react'
import {
  AuthShell,
  AuthField,
  AuthNotice,
  AuthSubmit,
} from '@/components/auth/AuthShell'

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
          Authorization: `Bearer ${token}`,
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

  const labelClass =
    'mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary'
  const controlClass =
    'w-full border border-border bg-card text-[15px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

  return (
    <AuthShell
      eyebrow="One last step"
      title="Complete your profile"
      subtitle="Where should riders bring your orders?"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField
          label="Phone number *"
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          required
          autoComplete="tel"
          placeholder="08012345678"
          hint={
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3 w-3" strokeWidth={1.75} />
              Riders call this number when they arrive.
            </span>
          }
        />

        <div>
          <label className={labelClass}>Hostel / location *</label>
          <select
            value={formData.hostelName}
            onChange={(e) => handleChange('hostelName', e.target.value)}
            required
            className={`${controlClass} h-12 px-4`}
          >
            <option value="">Select your hostel or location</option>
            {HOSTELS.map((hostel) => (
              <option key={hostel} value={hostel}>
                {hostel}
              </option>
            ))}
          </select>
        </div>

        <AuthField
          label="Room number *"
          type="text"
          value={formData.roomNumber}
          onChange={(e) => handleChange('roomNumber', e.target.value)}
          required
          placeholder="e.g. Room 12, Block A"
        />

        <div>
          <label className={labelClass}>Landmark / description *</label>
          <textarea
            value={formData.landmark}
            onChange={(e) => handleChange('landmark', e.target.value)}
            required
            rows={3}
            className={`${controlClass} resize-none px-4 py-3`}
            placeholder="e.g. Near the water dispenser, blue door"
          />
          <p className="mt-1.5 text-xs text-ink-muted">The detail that helps a rider find you fast.</p>
        </div>

        {error && <AuthNotice>{error}</AuthNotice>}

        <AuthSubmit type="submit" loading={loading} loadingText="Saving…">
          Complete setup
        </AuthSubmit>
      </form>

      <AuthNotice tone="info" className="mt-6">
        <span className="font-medium text-ink">Why we ask.</span> Your location and phone number are
        shared only with the rider carrying your order, and only while it is in transit.
      </AuthNotice>
    </AuthShell>
  )
}
