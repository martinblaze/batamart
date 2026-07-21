'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Shield, Upload, AlertCircle, Truck, MapPin, Phone, Loader2, X } from 'lucide-react'
import { DISPUTE_WINDOW_HOURS } from '@/lib/escrow'

interface Order {
  id: string
  orderNumber: string
  totalAmount: number
  product: { name: string; images: string[] }
  seller: { name: string }
  status: string
  deliveredAt: string | null
  completedAt?: string | null
  deliveryHostel: string
  deliveryRoom: string
  deliveryLandmark: string
  deliveryPhone: string
  dispute?: { id: string; status: string; createdAt: string }
}

const REASON_OPTIONS = [
  'DAMAGED_ITEM',
  'FAKE_PRODUCT',
  'EXPIRED_PRODUCT',
  'NOT_AS_DESCRIBED',
  'WRONG_ITEM',
  'MISSING_PARTS',
  'OTHER',
]

export default function OpenDisputePage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    reason: '',
    description: '',
    resolutionPreference: 'REFUND_WITH_PICKUP',
    evidence: [] as string[],
    pickupHostel: '',
    pickupRoom: '',
    pickupLandmark: '',
    pickupPhone: '',
  })

  useEffect(() => { fetchOrder() }, [orderId])

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      if (response.ok) {
        if (data.dispute) setError('This order already has an open dispute.')
        setOrder(data)
        setFormData(prev => ({
          ...prev,
          pickupHostel: data.deliveryHostel || '',
          pickupRoom: data.deliveryRoom || '',
          pickupLandmark: data.deliveryLandmark || '',
          pickupPhone: data.deliveryPhone || '',
        }))
      } else {
        setError('Order not found')
      }
    } catch {
      setError('Failed to load order')
    } finally {
      setLoading(false)
    }
  }

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const uploadEvidenceFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (formData.evidence.length >= 5) {
      setError('You can upload up to 5 evidence images.')
      return
    }

    setUploading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const selected = Array.from(files).slice(0, Math.max(0, 5 - formData.evidence.length))
      const urls: string[] = []

      for (const file of selected) {
        const base64 = await fileToBase64(file)
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ image: base64 }),
        })
        const data = await response.json()
        if (!response.ok || !data.url) {
          throw new Error(data.error || 'Failed to upload evidence image')
        }
        urls.push(data.url)
      }

      setFormData(prev => ({ ...prev, evidence: [...prev.evidence, ...urls] }))
    } catch (err: any) {
      setError(err?.message || 'Failed to upload evidence')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.reason) return setError('Please select a dispute reason.')
    if (!formData.description.trim()) return setError('Please describe the issue in detail.')
    if (formData.evidence.length < 1) return setError('Upload at least one evidence image.')
    if (!formData.pickupPhone.trim()) return setError('Please provide a contact number for rider pickup.')

    setSubmitting(true)
    setError('')

    if (order?.dispute) {
      setError('This order already has a dispute.')
      setSubmitting(false)
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          orderId,
          reason: formData.reason,
          description: formData.description,
          resolutionPreference: formData.resolutionPreference,
          evidence: formData.evidence,
          pickupAddress: {
            hostel: formData.pickupHostel,
            room: formData.pickupRoom,
            landmark: formData.pickupLandmark,
            phone: formData.pickupPhone,
          },
        }),
      })
      const data = await response.json()
      if (response.ok) {
        router.push(`/disputes/${data.dispute.id}`)
      } else {
        setError(data.error || 'Failed to open dispute')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-warning border-t-transparent" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-danger mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-ink mb-2">Order Not Found</h2>
          <p className="text-ink-secondary">{error}</p>
        </div>
      </div>
    )
  }

  const deliveredDate = order.deliveredAt ? new Date(order.deliveredAt) : order.completedAt ? new Date(order.completedAt) : null
  const deadline = deliveredDate
    ? new Date(deliveredDate.getTime() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000)
    : null
  const isValidStatus = ['DELIVERED', 'COMPLETED'].includes(order.status)
  const isWithinTimeWindow = deadline ? Date.now() <= deadline.getTime() : false
  const canDispute = deliveredDate && isWithinTimeWindow && isValidStatus

  if (!canDispute) {
    let msg = ''
    if (!isValidStatus) msg = 'Only delivered or completed orders can be disputed.'
    else if (!deliveredDate) msg = 'Order delivery date is not set. Please contact support.'
    else if (!isWithinTimeWindow) msg = `Dispute window has expired (must be within ${DISPUTE_WINDOW_HOURS} hours of delivery).`

    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="text-center max-w-md bg-white p-8 rounded-xl shadow-soft">
          <AlertCircle className="w-16 h-16 text-warning mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-ink mb-2">Cannot Open Dispute</h2>
          <p className="text-ink-secondary mb-6">{msg}</p>
          <div className="mb-6 p-4 bg-surface rounded-lg text-left">
            <p className="text-sm text-ink-secondary mb-1"><strong>Order Status:</strong> {order.status}</p>
            <p className="text-sm text-ink-secondary"><strong>Delivered At:</strong> {deliveredDate ? deliveredDate.toLocaleString() : 'Not set'}</p>
            {deadline && <p className="text-sm text-ink-secondary mt-1"><strong>Deadline:</strong> {deadline.toLocaleString()}</p>}
          </div>
          <button onClick={() => router.back()} className="px-6 py-3 bg-border hover:brightness-95 text-ink rounded-lg font-medium transition-colors">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-[#000000] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-soft p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-danger" />
            <div>
              <h1 className="text-2xl font-semibold text-ink">Open a Dispute</h1>
              <p className="text-sm text-ink-secondary">Order #{order.orderNumber}</p>
            </div>
          </div>

          <div className="mb-6 p-4 bg-surface rounded-lg flex gap-4">
            <img src={order.product.images[0] || '/placeholder.png'} alt={order.product.name} className="w-20 h-20 object-cover rounded" />
            <div className="flex-1">
              <h3 className="font-semibold text-ink">{order.product.name}</h3>
              <p className="text-sm font-semibold text-warning mt-1">₦{order.totalAmount.toLocaleString()}</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="mb-6 p-4 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning">
            <strong>Note:</strong> Disputes must be filed within {DISPUTE_WINDOW_HOURS} hours after delivery, with evidence images.
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-2">Reason *</label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-warning/40 focus:border-transparent text-sm mb-3"
                required
              >
                <option value="">Select reason</option>
                {REASON_OPTIONS.map(reason => (
                  <option key={reason} value={reason}>{reason.replace(/_/g, ' ')}</option>
                ))}
              </select>

              <label className="block text-sm font-medium text-ink-secondary mb-2">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-warning/40 focus:border-transparent min-h-36 resize-none"
                placeholder="Explain exactly what is wrong with the product..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-3">Resolution</label>
              <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-warning bg-warning/10">
                <div className="p-2 rounded-lg mt-0.5 bg-warning/10">
                  <Truck className="w-4 h-4 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-warning">Refund + Return Item</p>
                  <p className="text-xs text-ink-secondary mt-0.5">A rider will collect the item and return it before refund is released.</p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-ink-secondary" />
                <label className="text-sm font-medium text-ink-secondary">Confirm Pickup Address</label>
              </div>
              <p className="text-xs text-ink-secondary mb-3">Pre-filled from your delivery address. Edit if needed.</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">Hostel / Area *</label>
                    <input type="text" value={formData.pickupHostel} onChange={(e) => setFormData({ ...formData, pickupHostel: e.target.value })} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-warning/40 focus:border-transparent" required />
                  </div>
                  <div>
                    <label className="block text-xs text-ink-secondary mb-1">Room Number *</label>
                    <input type="text" value={formData.pickupRoom} onChange={(e) => setFormData({ ...formData, pickupRoom: e.target.value })} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-warning/40 focus:border-transparent" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1">Landmark</label>
                  <input type="text" value={formData.pickupLandmark} onChange={(e) => setFormData({ ...formData, pickupLandmark: e.target.value })} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-warning/40 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs text-ink-secondary mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Contact Number *</label>
                  <input type="tel" value={formData.pickupPhone} onChange={(e) => setFormData({ ...formData, pickupPhone: e.target.value })} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:ring-2 focus:ring-warning/40 focus:border-transparent" required />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-2">Evidence Images (required)</label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 text-ink-muted mx-auto mb-2" />
                <p className="text-sm text-ink-secondary">Upload clear photos showing the issue (max 5)</p>

                <label className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-warning/100 hover:brightness-95 text-white rounded-lg text-sm font-semibold cursor-pointer transition-colors">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Uploading...' : 'Choose Images'}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadEvidenceFiles(e.target.files)} disabled={uploading} />
                </label>

                <p className="text-xs text-ink-muted mt-2">{formData.evidence.length} / 5 uploaded</p>

                {formData.evidence.length > 0 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {formData.evidence.map((url, idx) => (
                      <div key={`${url}-${idx}`} className="relative">
                        <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-20 object-cover rounded-md border border-border" />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, evidence: prev.evidence.filter((_, i) => i !== idx) }))}
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => router.back()} className="flex-1 px-6 py-3 border border-border rounded-lg font-medium text-ink-secondary hover:bg-surface transition-colors" disabled={submitting || uploading}>
                Cancel
              </button>
              <button type="submit" className="flex-1 px-6 py-3 bg-danger hover:brightness-95 text-white rounded-lg font-semibold disabled:opacity-50 transition-colors" disabled={submitting || uploading || !!order.dispute}>
                {submitting ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
