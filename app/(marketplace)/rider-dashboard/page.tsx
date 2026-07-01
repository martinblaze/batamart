// app/(marketplace)/rider-dashboard/page.tsx
// ── Batch delivery model:
//    • Rider sees DeliveryBatches, not individual orders in the available section.
//    • Each batch may contain 1-N orders (one per seller from buyer's cart).
//    • Rider accepts the whole batch at once (one tap).
//    • Inside My Active Batches, each order has its own status buttons.
//    • Buyer gets notified PER ORDER as each one is picked up / delivered.
//    • Rider earns ₦560 per order in the batch.
//
// ── Race condition: accept uses batchId, server returns 409 if already taken.
// ── Availability revert: optimistic UI rolls back if API fails.
// ── No alert() / confirm() — all feedback via inline Toast.
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, AlertTriangle, MapPin, Phone, Package,
  CheckCircle, X, ShoppingBag, ArrowRight, Bike, Upload,
} from 'lucide-react'
import { authFetch } from '@/lib/auth-client'

// ── Inline Toast ──────────────────────────────────────────────────────────────
function Toast({
  message,
  type,
  onClose,
}: {
  message: string
  type:    'success' | 'error' | 'info'
  onClose: () => void
}) {
  const colors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
  }
  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className={`flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg max-w-sm w-full pointer-events-auto ${colors[type]}`}>
        <p className="text-sm font-semibold flex-1">{message}</p>
        <button onClick={onClose} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ── Order status badge ────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    RIDER_ASSIGNED: 'bg-indigo-100 text-indigo-700',
    PICKED_UP:      'bg-blue-100 text-blue-700',
    ON_THE_WAY:     'bg-amber-100 text-amber-700',
    DELIVERED:      'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function RiderDashboardPage() {
  const router = useRouter()

  const [rider,            setRider]            = useState<any>(null)
  const [availableBatches, setAvailableBatches] = useState<any[]>([])
  const [disputePickups,   setDisputePickups]   = useState<any[]>([])
  const [myBatches,        setMyBatches]        = useState<any[]>([])
  const [loading,          setLoading]          = useState(true)
  const [isAvailable,      setIsAvailable]      = useState(true)
  const [actionLoading,    setActionLoading]    = useState<Record<string, boolean>>({})

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [trackingActive, setTrackingActive] = useState(false)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [lastTrackingPing, setLastTrackingPing] = useState<Date | null>(null)
  const [oversizedProofByOrder, setOversizedProofByOrder] = useState<Record<string, string>>({})
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  const watchIdRef = useRef<number | null>(null)
  const lastSentAtRef = useRef(0)
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null)
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const getDistanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 6371000
    const dLat = ((b.lat - a.lat) * Math.PI) / 180
    const dLng = ((b.lng - a.lng) * Math.PI) / 180
    const la1 = (a.lat * Math.PI) / 180
    const la2 = (b.lat * Math.PI) / 180
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(la1) * Math.cos(la2)
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }
    fetchRiderData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    sessionStorage.setItem('batamart_rider_mode', 'true')
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches)

    const existingManifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    const previousHref = existingManifest?.getAttribute('href')
    const manifestLink = existingManifest ?? document.createElement('link')

    if (!existingManifest) {
      manifestLink.rel = 'manifest'
      document.head.appendChild(manifestLink)
    }

    manifestLink.href = '/rider-manifest.json'

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredInstallPrompt(event)
    }

    const onInstalled = () => {
      setIsInstalled(true)
      setDeferredInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', onInstalled)
      if (previousHref) {
        manifestLink.setAttribute('href', previousHref)
      }
    }
  }, [])

  const installRiderApp = async () => {
    if (!deferredInstallPrompt) return
    deferredInstallPrompt.prompt()
    try {
      const { outcome } = await deferredInstallPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredInstallPrompt(null)
        setIsInstalled(true)
      }
    } catch {}
  }

  const fetchRiderData = async () => {
    try {
      const [profileRes, batchesRes, myBatchesRes] = await Promise.all([
        authFetch('/api/auth/me'),
        authFetch('/api/riders/available-orders'),
        authFetch('/api/riders/my-deliveries'),
      ])

      const profileData   = await profileRes.json()
      const batchesData   = await batchesRes.json()
      const myBatchData   = await myBatchesRes.json()

      setRider(profileData.user)
      setAvailableBatches(batchesData.batches        || [])
      setDisputePickups(batchesData.disputePickups   || [])
      setMyBatches(myBatchData.batches               || [])
      setIsAvailable(profileData.user.isAvailable)
    } catch (error) {
      console.error('Error fetching rider data:', error)
    } finally {
      setLoading(false)
    }
  }

  // ── Toggle availability ───────────────────────────────────────────────────
  const toggleAvailability = async () => {
    if (actionLoading['toggle-availability']) return
    const previousState = isAvailable
    setActionLoading(prev => ({ ...prev, 'toggle-availability': true }))
    setIsAvailable(!previousState) // optimistic

    try {
      const res = await authFetch('/api/riders/toggle-availability', { method: 'POST' })
      if (!res.ok) {
        setIsAvailable(previousState) // revert
        showToast('Failed to update availability. Please try again.', 'error')
      } else {
        showToast(`You are now ${!previousState ? 'available' : 'unavailable'} for orders.`, 'success')
      }
    } catch {
      setIsAvailable(previousState)
      showToast('Network error updating availability.', 'error')
    } finally {
      setActionLoading(prev => ({ ...prev, 'toggle-availability': false }))
    }
  }

  // ── Accept a whole batch ──────────────────────────────────────────────────
  const acceptBatch = async (batchId: string) => {
    if (actionLoading[`accept-${batchId}`]) return
    setActionLoading(prev => ({ ...prev, [`accept-${batchId}`]: true }))

    try {
      const res  = await authFetch('/api/riders/accept-order', {
        method: 'POST',
        body:   JSON.stringify({ batchId }),
      })
      const data = await res.json()

      if (res.ok) {
        showToast(
          `Batch accepted! ${data.orderCount} order${data.orderCount > 1 ? 's' : ''} to pick up. You'll earn ₦${data.riderFee.toLocaleString()}.`,
          'success'
        )
        await fetchRiderData()
      } else if (res.status === 409) {
        showToast('Another rider just accepted this batch. Refreshing…', 'info')
        await fetchRiderData()
      } else {
        showToast(data.error || 'Failed to accept batch. Please try again.', 'error')
      }
    } catch {
      showToast('Network error. Please check your connection.', 'error')
    } finally {
      setActionLoading(prev => ({ ...prev, [`accept-${batchId}`]: false }))
    }
  }

  // ── Update individual order status ────────────────────────────────────────
  const updateStatus = async (orderId: string, status: string) => {
    if (actionLoading[`status-${orderId}`]) return
    setActionLoading(prev => ({ ...prev, [`status-${orderId}`]: true }))

    try {
      const res  = await authFetch('/api/riders/update-status', {
        method: 'POST',
        body:   JSON.stringify({ orderId, status }),
      })
      const data = await res.json()
      if (res.ok) {
        await fetchRiderData()
      } else {
        showToast(data.error || 'Failed to update status.', 'error')
      }
    } catch {
      showToast('Network error updating status.', 'error')
    } finally {
      setActionLoading(prev => ({ ...prev, [`status-${orderId}`]: false }))
    }
  }

  const declineOversized = async (orderId: string) => {
    if (actionLoading[`oversized-${orderId}`]) return
    const proofImageUrl = oversizedProofByOrder[orderId] || ''
    setActionLoading(prev => ({ ...prev, [`oversized-${orderId}`]: true }))
    try {
      const res = await authFetch('/api/riders/decline-oversized', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          reason: 'Item Too Large For Motorcycle Delivery',
          proofImageUrl: proofImageUrl.trim() || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Oversized decline submitted. Order cancelled safely.', 'success')
        await fetchRiderData()
      } else {
        showToast(data.error || 'Failed to decline oversized order.', 'error')
      }
    } catch {
      showToast('Network error while declining order.', 'error')
    } finally {
      setActionLoading(prev => ({ ...prev, [`oversized-${orderId}`]: false }))
    }
  }

  const uploadOversizedProof = async (orderId: string, file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error')
      return
    }
    setActionLoading(prev => ({ ...prev, [`proof-${orderId}`]: true }))
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await authFetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Failed to upload proof photo.', 'error')
        return
      }
      setOversizedProofByOrder((prev) => ({ ...prev, [orderId]: data.url }))
      showToast('Proof photo uploaded.', 'success')
    } catch {
      showToast('Upload failed. Try again.', 'error')
    } finally {
      setActionLoading(prev => ({ ...prev, [`proof-${orderId}`]: false }))
    }
  }

  // ── Dispute pickup ────────────────────────────────────────────────────────
  const markDisputePickedUp = async (orderId: string) => {
    if (actionLoading[`dispute-pickup-${orderId}`]) return
    setActionLoading(prev => ({ ...prev, [`dispute-pickup-${orderId}`]: true }))

    try {
      const res  = await authFetch('/api/riders/dispute-picked-up', {
        method: 'POST',
        body:   JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('Marked as collected. Return the item to complete this job.', 'success')
        await fetchRiderData()
      } else {
        showToast(data.error || 'Failed to update.', 'error')
      }
    } catch {
      showToast('Network error.', 'error')
    } finally {
      setActionLoading(prev => ({ ...prev, [`dispute-pickup-${orderId}`]: false }))
    }
  }

  const getDisputeReturnStage = (status: string) => {
    if (status === 'RIDER_ASSIGNED') return { label: 'Awaiting Pickup', tone: 'bg-yellow-100 text-yellow-700' }
    if (status === 'PICKED_UP') return { label: 'Picked Up - Head to Seller', tone: 'bg-blue-100 text-blue-700' }
    if (status === 'ON_THE_WAY') return { label: 'On The Way to Seller', tone: 'bg-indigo-100 text-indigo-700' }
    if (status === 'DELIVERED') return { label: 'Delivered - Waiting Seller Confirmation', tone: 'bg-emerald-100 text-emerald-700' }
    return { label: status.replace(/_/g, ' '), tone: 'bg-gray-100 text-gray-600' }
  }

  const hasDisputePickupPending = disputePickups.some((o: any) => o.status !== 'DELIVERED')
  const blockingDisputeReturns = disputePickups.filter((o: any) => o.status !== 'DELIVERED')

  // ── Active orders count across all batches ────────────────────────────────
  const totalActiveOrders = myBatches.reduce((sum, b) => sum + b.orders.length, 0)
  const liveOrderIds = useMemo(() => {
    const set = new Set<string>()
    myBatches.forEach((batch: any) => {
      batch.orders.forEach((order: any) => {
        if (['RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(order.status)) {
          set.add(order.id)
        }
      })
    })
    disputePickups.forEach((order: any) => {
      if (['RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(order.status)) {
        set.add(order.id)
      }
    })
    return Array.from(set)
  }, [myBatches, disputePickups])

  useEffect(() => {
    if (liveOrderIds.length === 0) {
      setTrackingActive(false)
      setTrackingError(null)
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      watchIdRef.current = null
      lastCoordsRef.current = null
      return
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setTrackingError('Live tracking is not supported on this device.')
      setTrackingActive(false)
      return
    }

    setTrackingError(null)

    const sendLocation = async (position: GeolocationPosition) => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const now = Date.now()
      const lastPoint = lastCoordsRef.current

      const movedEnough = !lastPoint || getDistanceMeters(lastPoint, { lat, lng }) >= 12
      const intervalReached = now - lastSentAtRef.current >= 10000
      if (!movedEnough && !intervalReached) return

      lastCoordsRef.current = { lat, lng }
      lastSentAtRef.current = now

      try {
        const firstBatchId = myBatches[0]?.id
        await authFetch('/api/riders/live-location', {
          method: 'POST',
          body: JSON.stringify({
            orderIds: liveOrderIds,
            batchId: firstBatchId,
            lat,
            lng,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
          }),
        })
        setLastTrackingPing(new Date())
        setTrackingActive(true)
      } catch {
        setTrackingError('Could not send live location. Check your internet.')
      }
    }

    const handleError = (error: GeolocationPositionError) => {
      if (error.code === error.PERMISSION_DENIED) {
        setTrackingError('Location permission denied. Buyer live map is off.')
      } else {
        setTrackingError('Live location temporarily unavailable.')
      }
      setTrackingActive(false)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      watchIdRef.current = null
    }
  }, [liveOrderIds, myBatches])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-BATAMART-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] py-6 px-4 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Bike className="w-5 h-5 text-BATAMART-primary" />
                <h1 className="text-xl font-black text-gray-900">Rider Dashboard</h1>
              </div>
              <p className="text-sm text-gray-500">Welcome back, {rider?.name}!</p>
            </div>
            <button
              onClick={toggleAvailability}
              disabled={actionLoading['toggle-availability']}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isAvailable
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-200'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              {actionLoading['toggle-availability']
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                : isAvailable ? '🟢 Available' : '⚫ Unavailable'
              }
            </button>
            <div className="flex items-center gap-2">
              {!isInstalled && deferredInstallPrompt && (
                <button
                  onClick={installRiderApp}
                  className="px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  Install Rider App
                </button>
              )}
              {isInstalled && (
                <div className="px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 border border-emerald-200 bg-emerald-50 text-emerald-700">
                  Installed
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-emerald-50 p-3 rounded-xl text-center">
              <p className="text-2xl font-black text-emerald-700">{rider?.completedOrders || 0}</p>
              <p className="text-xs font-semibold text-emerald-600 mt-0.5">Completed</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl text-center">
              <p className="text-2xl font-black text-blue-700">{totalActiveOrders}</p>
              <p className="text-xs font-semibold text-blue-600 mt-0.5">Active Orders</p>
            </div>
            <div className="bg-violet-50 p-3 rounded-xl text-center">
              <p className="text-2xl font-black text-violet-700">
                ₦{((rider?.completedOrders || 0) * 560).toLocaleString()}
              </p>
              <p className="text-xs font-semibold text-violet-600 mt-0.5">Earned</p>
            </div>
          </div>

          {liveOrderIds.length > 0 && (
            <div className={`mt-4 rounded-xl border px-3 py-2.5 text-xs ${
              trackingError
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <p className="font-bold">
                {trackingError
                  ? 'Live Tracking Issue'
                  : trackingActive
                    ? 'Live Tracking On'
                    : 'Starting Live Tracking...'}
              </p>
              <p className="mt-0.5">
                {trackingError || `Buyer can view your live route for ${liveOrderIds.length} active order${liveOrderIds.length > 1 ? 's' : ''}.`}
                {!trackingError && lastTrackingPing ? ` Last sync ${lastTrackingPing.toLocaleTimeString()}.` : ''}
              </p>
            </div>
          )}
        </div>

        {/* ── Dispute Pickup Jobs ───────────────────────────────────────── */}
        {hasDisputePickupPending && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="text-base font-black text-red-600">Return Pickup Required</h2>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                {blockingDisputeReturns.length} pending
              </span>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 mb-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Complete this return pickup before accepting new orders.
                You will earn <strong>₦560</strong> once confirmed.
              </span>
            </div>

            <div className="space-y-3">
              {disputePickups.map((order: any) => {
                const pickup = order.dispute?.pickupAddress as any
                return (
                  <div key={order.id} className="bg-white border-2 border-red-300 rounded-2xl p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                          Dispute Return
                        </span>
                        <p className="text-xs text-gray-400 mt-1">#{order.orderNumber}</p>
                        <p className="font-bold text-gray-900 mt-0.5">{order.product.name}</p>
                      </div>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                        ₦560 on done
                      </span>
                    </div>

                    <div className="mb-3">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${getDisputeReturnStage(order.status).tone}`}>
                        {getDisputeReturnStage(order.status).label}
                      </span>
                    </div>

                    {order.dispute?.reason && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Reason</p>
                        <p>{order.dispute.reason}</p>
                      </div>
                    )}

                    <div className="mb-3 p-3 bg-blue-50 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-500" />
                        <p className="text-xs font-bold text-blue-600 uppercase">Collect from buyer</p>
                      </div>
                      {pickup ? (
                        <div className="text-sm space-y-0.5">
                          <p className="font-semibold text-gray-800">{pickup.hostel}{pickup.room ? `, Room ${pickup.room}` : ''}</p>
                          {pickup.landmark && <p className="text-gray-500 text-xs">{pickup.landmark}</p>}
                          <p className="text-blue-700 font-semibold flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" /> {pickup.phone}
                          </p>
                        </div>
                      ) : (
                        <div className="text-sm space-y-0.5">
                          <p className="font-semibold text-gray-800">{order.deliveryHostel}, Room {order.deliveryRoom}</p>
                          {order.deliveryLandmark && <p className="text-gray-500 text-xs">{order.deliveryLandmark}</p>}
                          <p className="text-blue-700 font-semibold flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" /> {order.deliveryPhone}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mb-3 p-3 bg-emerald-50 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                        <p className="text-xs font-bold text-emerald-700 uppercase">Return to seller</p>
                      </div>
                      <div className="text-sm space-y-0.5">
                        <p className="font-semibold text-gray-800">
                          {order.seller?.hostelName || order.product?.hostelName || 'Seller hostel not set'}
                          {order.seller?.roomNumber ? `, Room ${order.seller.roomNumber}` : ''}
                        </p>
                        {order.seller?.landmark && <p className="text-gray-500 text-xs">{order.seller.landmark}</p>}
                        {order.seller?.phone && (
                          <p className="text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" /> {order.seller.phone}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-500 mt-1">
                          Seller: <span className="font-semibold text-gray-700">{order.seller?.name || 'N/A'}</span>
                        </p>
                      </div>
                    </div>

                    {order.status === 'RIDER_ASSIGNED' && (
                      <button
                        onClick={() => markDisputePickedUp(order.id)}
                        disabled={actionLoading[`dispute-pickup-${order.id}`]}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                      >
                        {actionLoading[`dispute-pickup-${order.id}`]
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                          : 'I Have Collected the Item from Buyer'
                        }
                      </button>
                    )}

                    {order.status === 'PICKED_UP' && (
                      <button
                        onClick={() => updateStatus(order.id, 'ON_THE_WAY')}
                        disabled={actionLoading[`status-${order.id}`]}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                      >
                        {actionLoading[`status-${order.id}`]
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                          : <><ArrowRight className="w-4 h-4" /> On The Way to Seller</>
                        }
                      </button>
                    )}

                    {order.status === 'ON_THE_WAY' && (
                      <button
                        onClick={() => updateStatus(order.id, 'DELIVERED')}
                        disabled={actionLoading[`status-${order.id}`]}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                      >
                        {actionLoading[`status-${order.id}`]
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                          : <><CheckCircle className="w-4 h-4" /> Delivered to Seller</>
                        }
                      </button>
                    )}

                    {order.status === 'DELIVERED' && (
                      <div className="w-full py-3 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold text-center">
                        Return delivered. Waiting for seller confirmation.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── My Active Batches ─────────────────────────────────────────── */}
        {myBatches.length > 0 && (
          <div>
            <h2 className="text-base font-black text-gray-900 mb-3">
              My Active Batch{myBatches.length > 1 ? 'es' : ''}
            </h2>
            <div className="space-y-4">
              {myBatches.map((batch: any) => {
                const deliveredCount = batch.orders.filter((o: any) => o.status === 'DELIVERED').length
                const totalCount     = batch.orders.length

                return (
                  <div key={batch.id} className="bg-white rounded-2xl border-2 border-BATAMART-primary/20 shadow-sm overflow-hidden">
                    {/* Batch header */}
                    <div className="bg-BATAMART-primary/5 px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black text-BATAMART-primary uppercase tracking-wide">
                          Active Batch · {totalCount} order{totalCount > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">#{batch.batchNumber}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                          {deliveredCount}/{totalCount} delivered
                        </span>
                        <p className="text-xs font-black text-BATAMART-primary mt-1">
                          ₦{(totalCount * 560).toLocaleString()} total
                        </p>
                      </div>
                    </div>

                    {/* Delivery address (one buyer, same for all) */}
                    <div className="px-5 py-3 border-b border-gray-50">
                      <div className="flex items-start gap-2 bg-blue-50 rounded-xl p-3">
                        <MapPin className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-blue-700">
                            {batch.buyer.hostelName}
                            {batch.buyer.roomNumber ? ` — Room ${batch.buyer.roomNumber}` : ''}
                          </p>
                          {batch.buyer.landmark && (
                            <p className="text-xs text-blue-500 mt-0.5">{batch.buyer.landmark}</p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3 text-blue-400" />
                            <span className="text-xs font-semibold text-blue-600">{batch.buyer.phone}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Individual orders */}
                    <div className="p-4 space-y-3">
                      {batch.orders.map((order: any, idx: number) => (
                        <div key={order.id} className="border border-gray-100 rounded-xl overflow-hidden">
                          {/* Order info row */}
                          <div className="flex items-center gap-3 p-3">
                            {order.product.images?.[0] ? (
                              <img
                                src={order.product.images[0]}
                                alt={order.product.name}
                                className="w-11 h-11 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <ShoppingBag className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-800 truncate">{order.product.name}</p>
                              <p className="text-xs text-gray-400 truncate">
                                Pickup from: <span className="text-gray-600 font-semibold">{order.seller.name}</span>
                              </p>
                              {order.orderNote && <p className="text-xs text-indigo-600 truncate">Note: {order.orderNote}</p>}
                              {(order.product.estimatedWeightKg || order.product.dimensionsCm) && (
                                <p className="text-[11px] text-gray-500 truncate">
                                  {order.product.estimatedWeightKg ? `${order.product.estimatedWeightKg}kg` : ''}
                                  {order.product.estimatedWeightKg && order.product.dimensionsCm ? ' · ' : ''}
                                  {order.product.dimensionsCm ? `${order.product.dimensionsCm.length || '-'}x${order.product.dimensionsCm.width || '-'}x${order.product.dimensionsCm.height || '-'}cm` : ''}
                                </p>
                              )}
                              {order.product.hostelName && (
                                <p className="text-xs text-gray-400 truncate">{order.product.hostelName}</p>
                              )}
                              {order.seller.phone && (
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5" /> {order.seller.phone}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <StatusBadge status={order.status} />
                              <span className="text-[10px] font-bold text-gray-400">#{idx + 1}</span>
                            </div>
                          </div>

                          {/* Status action buttons */}
                          {order.status !== 'DELIVERED' && (
                            <div className="px-3 pb-3">
                              {order.status === 'RIDER_ASSIGNED' && (
                                <div className="space-y-2">
                                  <label className="w-full py-2.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 flex items-center justify-center gap-1.5 cursor-pointer hover:bg-gray-50">
                                    {actionLoading[`proof-${order.id}`]
                                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading proof...</>
                                      : <><Upload className="w-3.5 h-3.5" /> {oversizedProofByOrder[order.id] ? 'Replace Oversized Proof Photo' : 'Upload Oversized Proof Photo (Optional)'}</>
                                    }
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => uploadOversizedProof(order.id, e.target.files?.[0] || null)}
                                      disabled={actionLoading[`proof-${order.id}`]}
                                    />
                                  </label>
                                  {oversizedProofByOrder[order.id] && (
                                    <p className="text-[11px] text-emerald-600 truncate">Proof attached</p>
                                  )}
                                  <button
                                    onClick={() => updateStatus(order.id, 'PICKED_UP')}
                                    disabled={actionLoading[`status-${order.id}`]}
                                    className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold
                                               flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                                  >
                                    {actionLoading[`status-${order.id}`]
                                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</>
                                      : <><Package className="w-3.5 h-3.5" /> Mark as Picked Up</>
                                    }
                                  </button>
                                  <button
                                    onClick={() => declineOversized(order.id)}
                                    disabled={actionLoading[`oversized-${order.id}`]}
                                    className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold
                                               flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                                  >
                                    {actionLoading[`oversized-${order.id}`]
                                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                                      : 'Item Too Large For Motorcycle Delivery'
                                    }
                                  </button>
                                </div>
                              )}
                              {order.status === 'PICKED_UP' && (
                                <button
                                  onClick={() => updateStatus(order.id, 'ON_THE_WAY')}
                                  disabled={actionLoading[`status-${order.id}`]}
                                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold
                                             flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                                >
                                  {actionLoading[`status-${order.id}`]
                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</>
                                    : <><ArrowRight className="w-3.5 h-3.5" /> On The Way</>
                                  }
                                </button>
                              )}
                              {order.status === 'ON_THE_WAY' && (
                                <button
                                  onClick={() => updateStatus(order.id, 'DELIVERED')}
                                  disabled={actionLoading[`status-${order.id}`]}
                                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold
                                             flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                                >
                                  {actionLoading[`status-${order.id}`]
                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</>
                                    : <><CheckCircle className="w-3.5 h-3.5" /> Mark as Delivered</>
                                  }
                                </button>
                              )}
                            </div>
                          )}

                          {order.status === 'DELIVERED' && (
                            <div className="px-3 pb-3">
                              <div className="w-full py-2 bg-emerald-50 rounded-lg text-center text-xs font-bold text-emerald-600 flex items-center justify-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5" /> Delivered ✓
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Available Batches ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-black text-gray-900 mb-3">
            Available Batches ({availableBatches.length})
          </h2>

          {hasDisputePickupPending && (
            <div className="mb-3 p-3 bg-yellow-50 border border-yellow-300 rounded-xl text-sm text-yellow-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              New batches are locked until you complete the return pickup above.
            </div>
          )}

          {availableBatches.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Bike className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 font-semibold text-sm">No available batches right now</p>
              <p className="text-gray-300 text-xs mt-1">Check back soon</p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableBatches.map((batch: any) => (
                <div
                  key={batch.id}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${
                    hasDisputePickupPending ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {/* Batch header */}
                  <div className="bg-gray-50 px-5 py-3 flex items-center justify-between border-b border-gray-100">
                    <div>
                      <span className="text-xs font-black text-BATAMART-primary bg-BATAMART-primary/10 px-2.5 py-1 rounded-full">
                        {batch.orders.length} ORDER{batch.orders.length > 1 ? 'S' : ''} · 1 BATCH
                      </span>
                      <p className="text-xs text-gray-400 mt-1">#{batch.batchNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-600">
                        ₦{(batch.orders.length * 560).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-400">you earn</p>
                    </div>
                  </div>

                  {/* Delivery address */}
                  <div className="px-5 py-3 border-b border-gray-50">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-gray-700">
                          Deliver to: {batch.buyer.hostelName}
                          {batch.buyer.roomNumber ? ` — Room ${batch.buyer.roomNumber}` : ''}
                        </p>
                        {batch.buyer.landmark && (
                          <p className="text-xs text-gray-400">{batch.buyer.landmark}</p>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5 text-gray-400" />
                          <span className="text-xs text-gray-500">{batch.buyer.phone}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Orders list */}
                  <div className="px-5 py-3 space-y-2">
                    {batch.orders.map((order: any, idx: number) => (
                      <div key={order.id} className="flex items-center gap-3">
                        {order.product.images?.[0] ? (
                          <img
                            src={order.product.images[0]}
                            alt={order.product.name}
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0 bg-gray-100"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{order.product.name}</p>
                          <p className="text-xs text-gray-400">
                            From: {order.seller.name}
                            {order.product.hostelName ? ` · ${order.product.hostelName}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-gray-400 flex-shrink-0">#{idx + 1}</span>
                      </div>
                    ))}
                  </div>

                  {/* Accept button */}
                  <div className="px-5 pb-5">
                    <button
                      onClick={() => acceptBatch(batch.id)}
                      disabled={actionLoading[`accept-${batch.id}`] || hasDisputePickupPending}
                      className="w-full py-3 bg-BATAMART-primary hover:bg-BATAMART-dark text-white rounded-xl
                                 font-bold text-sm shadow-md shadow-BATAMART-primary/20
                                 flex items-center justify-center gap-2
                                 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {actionLoading[`accept-${batch.id}`]
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Accepting...</>
                        : <>
                            Accept Batch · ₦{(batch.orders.length * 560).toLocaleString()}
                            <ArrowRight className="w-4 h-4" />
                          </>
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

