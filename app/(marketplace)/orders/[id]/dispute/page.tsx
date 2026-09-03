'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Upload, AlertCircle, Truck, MapPin, Phone, Loader2, X } from 'lucide-react'
import { DISPUTE_WINDOW_HOURS } from '@/lib/escrow'
import { Shell, PageHeader, EmptyState, DataRow } from '@/components/ui/Shell'
import { Button } from '@/components/ui/button'

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
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-16 sm:pt-24">
          <EmptyState
            icon={AlertCircle}
            title="Order not found"
            description={error || "This order doesn't exist, or it isn't one you have access to."}
            action={
              <Button variant="ink" onClick={() => router.push('/orders')}>
                Back to orders
              </Button>
            }
          />
        </Shell>
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
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-12 sm:pt-20">
          <div className="border border-border bg-card p-6 sm:p-10">
            <AlertCircle className="mb-6 h-9 w-9 text-warning" strokeWidth={1.5} />
            <p className="ui-eyebrow mb-4">Not eligible</p>
            <h1 className="text-[clamp(1.5rem,4vw,2rem)] leading-tight text-ink">
              This order can&apos;t be disputed
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">{msg}</p>

            <div className="ui-divide mt-8 border-t border-border">
              <DataRow label="Order status" value={order.status.replace(/_/g, ' ')} />
              <DataRow
                label="Delivered"
                value={deliveredDate ? deliveredDate.toLocaleString() : 'Not set'}
              />
              {deadline && <DataRow label="Deadline" value={deadline.toLocaleString()} />}
            </div>

            <Button variant="ink" size="lg" fullWidth className="mt-8" onClick={() => router.back()}>
              Go back
            </Button>
          </div>
        </Shell>
      </div>
    )
  }

  const labelClass =
    'mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary'
  const controlClass =
    'w-full border border-border bg-card px-4 text-[15px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Shell width="reading" className="pt-8 sm:pt-12">
        <PageHeader
          eyebrow="Support"
          back={{ href: `/orders/${orderId}`, label: `Order #${order.orderNumber}` }}
          title={
            <>
              Open a <span className="ui-serif">dispute</span>
            </>
          }
          description={`Tell us what went wrong. Disputes must be filed within ${DISPUTE_WINDOW_HOURS} hours of delivery and need photo evidence.`}
        />

        <div className="mt-10 space-y-8">
          {/* Subject of the dispute */}
          <div className="flex items-center gap-4 border border-border bg-card p-4 sm:p-5">
            <img
              src={order.product.images[0] || '/placeholder.png'}
              alt=""
              className="h-20 w-20 flex-shrink-0 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="ui-mono ui-mono-sm text-ink-muted">#{order.orderNumber}</p>
              <h2 className="mt-1.5 truncate text-base font-medium text-ink">
                {order.product.name}
              </h2>
              <p className="ui-figure mt-1 text-[15px] text-ink">
                ₦{order.totalAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-3 border border-danger/25 bg-danger/5 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" strokeWidth={1.75} />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-9">
            {/* ── What went wrong ─────────────────────────────────────────── */}
            <section>
              <p className="ui-eyebrow mb-6">What went wrong</p>

              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Reason *</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className={`${controlClass} h-12`}
                    required
                  >
                    <option value="">Select a reason</option>
                    {REASON_OPTIONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={`${controlClass} min-h-36 resize-none py-3.5 leading-relaxed`}
                    placeholder="Explain exactly what is wrong with the item — the more specific, the faster this resolves."
                    required
                  />
                </div>
              </div>
            </section>

            {/* ── Resolution ──────────────────────────────────────────────── */}
            <section>
              <p className="ui-eyebrow mb-6">Resolution</p>
              <div className="flex items-start gap-4 border border-border bg-card p-4 sm:p-5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-border bg-surface">
                  <Truck className="h-4 w-4 text-ink-secondary" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">Refund and return the item</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                    A rider collects the item and returns it to the seller. Your refund is released
                    once the return is confirmed.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Pickup address ──────────────────────────────────────────── */}
            <section>
              <p className="ui-eyebrow mb-2">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                Pickup address
              </p>
              <p className="mb-6 text-[13px] text-ink-secondary">
                Pre-filled from your delivery address. Edit it if the item is somewhere else.
              </p>

              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Hostel / area *</label>
                    <input
                      type="text"
                      value={formData.pickupHostel}
                      onChange={(e) => setFormData({ ...formData, pickupHostel: e.target.value })}
                      className={`${controlClass} h-12`}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Room number *</label>
                    <input
                      type="text"
                      value={formData.pickupRoom}
                      onChange={(e) => setFormData({ ...formData, pickupRoom: e.target.value })}
                      className={`${controlClass} h-12`}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Landmark</label>
                  <input
                    type="text"
                    value={formData.pickupLandmark}
                    onChange={(e) => setFormData({ ...formData, pickupLandmark: e.target.value })}
                    className={`${controlClass} h-12`}
                  />
                </div>

                <div>
                  <label className={`${labelClass} flex items-center gap-1.5`}>
                    <Phone className="h-3 w-3" strokeWidth={2} />
                    Contact number *
                  </label>
                  <input
                    type="tel"
                    value={formData.pickupPhone}
                    onChange={(e) => setFormData({ ...formData, pickupPhone: e.target.value })}
                    className={`${controlClass} h-12`}
                    required
                  />
                </div>
              </div>
            </section>

            {/* ── Evidence ────────────────────────────────────────────────── */}
            <section>
              <p className="ui-eyebrow mb-2">Evidence</p>
              <p className="mb-6 text-[13px] text-ink-secondary">
                Clear photos of the problem. Required — up to five.
              </p>

              <div className="border border-dashed border-border bg-card p-8 text-center">
                <Upload className="mx-auto mb-4 h-7 w-7 text-ink-muted" strokeWidth={1.5} />
                <p className="text-sm text-ink-secondary">
                  Show the damage, the wrong item, or whatever the issue is.
                </p>

                <label className="ui-mono ui-mono-sm mt-5 inline-flex cursor-pointer items-center gap-2 bg-ink px-5 py-3 text-background transition-colors hover:bg-ink/90">
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <Upload className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  {uploading ? 'Uploading…' : 'Choose images'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => uploadEvidenceFiles(e.target.files)}
                    disabled={uploading}
                  />
                </label>

                <p className="ui-mono ui-mono-sm mt-4 text-ink-muted">
                  {formData.evidence.length} / 5 uploaded
                </p>

                {formData.evidence.length > 0 && (
                  <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {formData.evidence.map((url, idx) => (
                      <div key={`${url}-${idx}`} className="group relative">
                        <img
                          src={url}
                          alt={`Evidence ${idx + 1}`}
                          className="h-20 w-full border border-border object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`Remove evidence ${idx + 1}`}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              evidence: prev.evidence.filter((_, i) => i !== idx),
                            }))
                          }
                          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-background transition-transform duration-200 hover:scale-110"
                        >
                          <X className="h-3 w-3" strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => router.back()}
                disabled={submitting || uploading}
                className="sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                size="lg"
                isLoading={submitting}
                loadingText="Submitting…"
                disabled={uploading || !!order.dispute}
                className="sm:flex-[2]"
              >
                Submit dispute
              </Button>
            </div>
          </form>
        </div>
      </Shell>
    </div>
  )
}
