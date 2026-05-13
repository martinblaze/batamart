'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Profile</h1>
          <p className="text-gray-500">Help us deliver to you accurately</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-BATAMART-primary focus:outline-none"
                placeholder="08012345678"
              />
              <p className="text-xs text-gray-500 mt-1">
                📞 Riders will call this number when they arrive
              </p>
            </div>

            {/* Hostel Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Hostel / Location <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.hostelName}
                onChange={(e) => handleChange('hostelName', e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-BATAMART-primary focus:outline-none"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Room Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.roomNumber}
                onChange={(e) => handleChange('roomNumber', e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-BATAMART-primary focus:outline-none"
                placeholder="e.g., Room 12, Block A"
              />
            </div>

            {/* Landmark */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Landmark / Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.landmark}
                onChange={(e) => handleChange('landmark', e.target.value)}
                required
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-BATAMART-primary focus:outline-none"
                placeholder="e.g., Near the water dispenser, blue door"
              />
              <p className="text-xs text-gray-500 mt-1">Help riders find you easily</p>
            </div>

            {error && (
              <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-BATAMART-primary hover:bg-BATAMART-dark text-white py-3.5 rounded-lg font-bold text-lg disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          </form>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>📍 Why we need this:</strong> Your location and phone help riders deliver directly to you.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

