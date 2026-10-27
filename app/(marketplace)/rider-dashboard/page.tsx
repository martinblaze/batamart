// app/(marketplace)/rider-dashboard/page.tsx
// ── Batch delivery model:
//    • Rider sees DeliveryBatches, not individual orders in the available section.
//    • Each batch may contain 1-N orders (one per seller from buyer's cart).
//    • Rider accepts the whole batch at once (one tap).
//    • Inside My Active Batches, each order has its own status buttons.
//    • Buyer gets notified PER ORDER as each one is picked up / delivered.
//    • Rider earns 70% of each order's zone-priced delivery fee.
//
// ── Race condition: accept uses batchId, server returns 409 if already taken.
// ── Availability revert: optimistic UI rolls back if API fails.
// ── No alert() / confirm() — all feedback via inline Toast.
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, AlertTriangle, MapPin, Phone, Package,
  CheckCircle, X, ShoppingBag, ArrowRight, Bike, Upload, Heart,
} from 'lucide-react'
import { authFetch } from '@/lib/auth-client'
import RiderJobs from '@/components/rider/RiderJobs'
import { ANDROID_APK_URL, isAndroidDevice } from '@/lib/app-download'
import { CAMPAIGNS, isCampaignDeliverable, isValidCampaignKey } from '@/lib/campaigns'

function CampaignItemBadge({ campaignTag }: { campaignTag?: string | null }) {
  if (!isValidCampaignKey(campaignTag)) return null
  const campaign = CAMPAIGNS[campaignTag]
  const deliverable = isCampaignDeliverable(campaignTag)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 whitespace-nowrap bg-rose-500/10 text-rose-600">
      <Heart className="w-2.5 h-2.5" strokeWidth={2} fill="currentColor" />
      {deliverable ? campaign.label : `Releases ${new Date(campaign.deliverableFrom).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`}
    </span>
  )
}

// Delivery fees are zone-priced now (not a flat ₦800) — rider always gets 70%
// of whatever that order's route costs. See lib/delivery/commission.ts.
const RIDER_SHARE_PERCENT = 0.7
const riderShareFor = (order: any) => Math.round((order?.deliveryFee || 0) * RIDER_SHARE_PERCENT)
const batchRiderTotal = (batch: any) => (batch?.orders || []).reduce((sum: number, o: any) => sum + riderShareFor(o), 0)

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
    success: 'bg-success/10 border-success/30 text-success',
    error:   'bg-danger/10 border-danger/30 text-danger',
    info:    'bg-primary/10 border-primary/30 text-primary',
  }
  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 border px-4 py-3.5 ${colors[type]}`}>
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
    RIDER_ASSIGNED: 'bg-primary/10 text-primary',
    PICKED_UP:      'bg-primary/10 text-primary',
    ON_THE_WAY:     'bg-warning/10 text-warning',
    DELIVERED:      'bg-success/10 text-success',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${map[status] ?? 'bg-surface text-ink-secondary'}`}>
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
  const [jobOrderIds,      setJobOrderIds]      = useState<string[]>([])
  const [isAvailable,      setIsAvailable]      = useState(true)
  const [actionLoading,    setActionLoading]    = useState<Record<string, boolean>>({})

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [trackingActive, setTrackingActive] = useState(false)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [lastTrackingPing, setLastTrackingPing] = useState<Date | null>(null)
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'unsupported' | null>(null)
  const [oversizedProofByOrder, setOversizedProofByOrder] = useState<Record<string, string>>({})
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

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
    if (!token) { router.push('/rider/login'); return }
    fetchRiderData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    sessionStorage.setItem('batamart_rider_mode', 'true')
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches)

    const android = isAndroidDevice()
    setIsAndroid(android)

    const existingManifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
    const previousHref = existingManifest?.getAttribute('href')
    const manifestLink = existingManifest ?? document.createElement('link')

    if (!existingManifest) {
      manifestLink.rel = 'manifest'
      document.head.appendChild(manifestLink)
    }

    manifestLink.href = '/rider-manifest.json'

    const onBeforeInstallPrompt = (event: Event) => {
      // preventDefault on every platform so Chrome's own PWA banner never
      // competes; on Android the event is then dropped, because riders get the
      // real app rather than the rider PWA.
      event.preventDefault()
      if (android) return
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

  const openRiderInstallPage = () => {
    router.push('/rider-dashboard?app=true&rider=true')
  }

  const installRiderApp = async () => {
    if (isAndroid) {
      // The rider features live in the same APK as the rest of the app, so
      // this is the same download the marketplace install prompt offers.
      showToast(
        "Downloading… tap 'Download anyway' if Chrome warns you, then open the file to install.",
        'info'
      )
      window.location.href = ANDROID_APK_URL
      return
    }

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
      // Pickups and deliveries load inside <RiderJobs>; this only needs the
      // profile and any dispute-return jobs.
      const [profileRes, batchesRes] = await Promise.all([
        authFetch('/api/auth/me'),
        authFetch('/api/riders/available-orders'),
      ])

      const profileData   = await profileRes.json()
      const batchesData   = await batchesRes.json()

      setRider(profileData.user)
      setDisputePickups(batchesData.disputePickups   || [])
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
      const res = await authFetch('/api/riders/accept-order', {
        method: 'POST',
        body: JSON.stringify({ batchId }),
      })
      const data = await res.json()

      if (res.ok && data.batch) {
        const acceptedBatch = data.batch
        setAvailableBatches((prev) => prev.filter((batch: any) => batch.id !== acceptedBatch.id))
        setMyBatches((prev) => [acceptedBatch, ...prev.filter((batch: any) => batch.id !== acceptedBatch.id)])
        showToast(
          `Batch accepted! ${data.orderCount} order${data.orderCount > 1 ? 's' : ''} to pick up. You'll earn NGN ${data.riderFee.toLocaleString()}.`,
          'success'
        )
      } else if (res.ok) {
        showToast(
          `Batch accepted! ${data.orderCount} order${data.orderCount > 1 ? 's' : ''} to pick up. You'll earn NGN ${data.riderFee.toLocaleString()}.`,
          'success'
        )
        await fetchRiderData()
      } else if (res.status === 409 && data.blockReason === 'AWAITING_SELLER_ACCEPTANCE') {
        showToast(data.error || 'Waiting on the seller(s) to accept this order.', 'info')
        await fetchRiderData()
      } else if (res.status === 409 && data.blockReason === 'CAMPAIGN_DELIVERY_NOT_STARTED') {
        showToast(data.error || 'This batch has an item that can\'t be picked up yet.', 'info')
        await fetchRiderData()
      } else if (res.status === 409) {
        showToast('Another rider just accepted this batch. Refreshing...', 'info')
        await fetchRiderData()
      } else {
        showToast(data.error || 'Failed to accept batch. Please try again.', 'error')
        await fetchRiderData()
      }
    } catch {
      showToast('Network error. Please check your connection.', 'error')
      await fetchRiderData()
    } finally {
      setActionLoading(prev => ({ ...prev, [`accept-${batchId}`]: false }))
    }
  }
  const updateStatus = async (orderId: string, status: string) => {
    if (actionLoading[`status-${orderId}`]) return
    setActionLoading(prev => ({ ...prev, [`status-${orderId}`]: true }))

    try {
      const res = await authFetch('/api/riders/update-status', {
        method: 'POST',
        body: JSON.stringify({ orderId, status }),
      })
      const data = await res.json()
      if (res.ok && data.order) {
        const updatedOrder = data.order
        setMyBatches((prev) =>
          prev
            .map((batch: any) => {
              const matchesOrder = batch.orders?.some((order: any) => order.id === updatedOrder.id)
              if (!matchesOrder) return batch

              const orders = batch.orders.map((order: any) =>
                order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
              )
              return { ...batch, orders }
            })
            .filter((batch: any) => {
              if (updatedOrder.status !== 'DELIVERED') return true
              return !(batch.orders?.length > 0 && batch.orders.every((order: any) => order.status === 'DELIVERED'))
            })
        )
        setDisputePickups((prev) =>
          prev.map((order: any) => (order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order))
        )
      } else if (res.ok) {
        await fetchRiderData()
      } else {
        showToast(data.error || 'Failed to update status.', 'error')
        await fetchRiderData()
      }
    } catch {
      showToast('Network error updating status.', 'error')
      await fetchRiderData()
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
      if (res.ok && data.order) {
        const updatedOrder = data.order
        setMyBatches((prev) =>
          prev
            .map((batch: any) => {
              const matchesOrder = batch.orders?.some((order: any) => order.id === updatedOrder.id)
              if (!matchesOrder) return batch

              const orders = batch.orders.filter((order: any) => order.id !== updatedOrder.id)
              return orders.length > 0 ? { ...batch, orders } : null
            })
            .filter((batch: any): batch is any => Boolean(batch))
        )
        setDisputePickups((prev) => prev.filter((order: any) => order.id !== updatedOrder.id))
        showToast('Oversized decline submitted. Order cancelled safely.', 'success')
      } else if (res.ok) {
        showToast('Oversized decline submitted. Order cancelled safely.', 'success')
        await fetchRiderData()
      } else {
        showToast(data.error || 'Failed to decline oversized order.', 'error')
        await fetchRiderData()
      }
    } catch {
      showToast('Network error while declining order.', 'error')
      await fetchRiderData()
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
      const res = await authFetch('/api/riders/dispute-picked-up', {
        method: 'POST',
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (res.ok && data.order) {
        const updatedOrder = data.order
        setDisputePickups((prev) =>
          prev.map((order: any) => (order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order))
        )
        setMyBatches((prev) =>
          prev.map((batch: any) => {
            const matchesOrder = batch.orders?.some((order: any) => order.id === updatedOrder.id)
            if (!matchesOrder) return batch

            const orders = batch.orders.map((order: any) =>
              order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order
            )
            return { ...batch, orders }
          })
        )
        showToast('Marked as collected. Return the item to complete this job.', 'success')
      } else if (res.ok) {
        showToast('Marked as collected. Return the item to complete this job.', 'success')
        await fetchRiderData()
      } else {
        showToast(data.error || 'Failed to update.', 'error')
        await fetchRiderData()
      }
    } catch {
      showToast('Network error.', 'error')
      await fetchRiderData()
    } finally {
      setActionLoading(prev => ({ ...prev, [`dispute-pickup-${orderId}`]: false }))
    }
  }
  const getDisputeReturnStage = (status: string) => {
    if (status === 'RIDER_ASSIGNED') return { label: 'Awaiting Pickup', tone: 'bg-warning/10 text-warning' }
    if (status === 'PICKED_UP') return { label: 'Picked Up - Head to Seller', tone: 'bg-primary/10 text-primary' }
    if (status === 'ON_THE_WAY') return { label: 'On The Way to Seller', tone: 'bg-primary/10 text-primary' }
    if (status === 'DELIVERED') return { label: 'Delivered - Waiting Seller Confirmation', tone: 'bg-success/10 text-success' }
    return { label: status.replace(/_/g, ' '), tone: 'bg-surface text-ink-secondary' }
  }

  const hasDisputePickupPending = disputePickups.some((o: any) => o.status !== 'DELIVERED')
  const blockingDisputeReturns = disputePickups.filter((o: any) => o.status !== 'DELIVERED')

  // ── Active orders count across all batches ────────────────────────────────
  const totalActiveOrders = jobOrderIds.length
  const liveOrderIds = useMemo(() => {
    const set = new Set<string>(jobOrderIds)
    disputePickups.forEach((order: any) => {
      if (['RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(order.status)) {
        set.add(order.id)
      }
    })
    return Array.from(set)
  }, [jobOrderIds, disputePickups])

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

  // Proactively check location permission on load — not just once a delivery
  // is active — so a rider without location enabled sees a persistent prompt
  // before it becomes urgent, instead of only finding out after accepting a
  // batch (when the buyer live-map would otherwise silently stay empty).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationPermission('unsupported')
      return
    }
    if (!navigator.permissions?.query) {
      // Permissions API unsupported (e.g. Safari) — fall back to a silent
      // probe; getCurrentPosition itself triggers the OS prompt if unasked.
      navigator.geolocation.getCurrentPosition(
        () => setLocationPermission('granted'),
        (err) => setLocationPermission(err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt'),
        { maximumAge: 60000, timeout: 8000 }
      )
      return
    }
    let status: PermissionStatus | null = null
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
      status = result
      setLocationPermission(result.state as 'granted' | 'denied' | 'prompt')
      result.onchange = () => setLocationPermission(result.state as 'granted' | 'denied' | 'prompt')
    }).catch(() => setLocationPermission(null))
    return () => { if (status) status.onchange = null }
  }, [])

  const requestLocationPermission = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      () => setLocationPermission('granted'),
      (err) => setLocationPermission(err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-[#000000] py-6 px-4 pb-24">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-5 p-5">
            <div className="min-w-0">
              <p className="ui-mono ui-mono-sm mb-3 flex items-center gap-2 text-ink-muted">
                <Bike className="h-3.5 w-3.5" strokeWidth={2} />
                Rider
              </p>
              <h1 className="text-[clamp(1.4rem,3.2vw,1.9rem)] leading-tight text-ink">
                {rider?.name ? `Welcome back, ${rider.name}` : 'Rider dashboard'}
              </h1>
            </div>

            {/* Availability is the one control that changes what happens next,
                so it gets solid weight; everything else stays quiet. */}
            <button
              onClick={toggleAvailability}
              disabled={actionLoading['toggle-availability']}
              className={`ui-mono ui-mono-sm inline-flex h-10 flex-shrink-0 items-center gap-2 px-4 transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                isAvailable
                  ? 'bg-success text-white'
                  : 'border border-border bg-card text-ink-secondary hover:border-ink/25 hover:text-ink'
              }`}
            >
              {actionLoading['toggle-availability'] ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> Updating…</>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {isAvailable ? 'Available' : 'Unavailable'}
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 px-5 pb-5">
            <button
              onClick={openRiderInstallPage}
              className="ui-mono ui-mono-sm inline-flex h-9 items-center gap-2 border border-border bg-card px-4 text-ink-secondary transition-colors hover:border-ink/25 hover:text-ink"
            >
              Install page
            </button>
            {/* On Android the button is always offered: `isInstalled` only
                reports whether the PWA is running standalone, which says
                nothing about whether the native app is present. */}
            {isAndroid ? (
              <button
                onClick={installRiderApp}
                className="ui-mono ui-mono-sm inline-flex h-9 items-center gap-2 bg-ink px-4 text-background transition-colors hover:bg-ink/90"
              >
                Download the app
              </button>
            ) : (
              <>
                {!isInstalled && deferredInstallPrompt && (
                  <button
                    onClick={installRiderApp}
                    className="ui-mono ui-mono-sm inline-flex h-9 items-center gap-2 bg-ink px-4 text-background transition-colors hover:bg-ink/90"
                  >
                    Install rider app
                  </button>
                )}
                {isInstalled && (
                  <div className="ui-mono ui-mono-sm inline-flex h-9 items-center gap-2 border border-success/30 bg-success/5 px-4 text-success">
                    Installed
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-px border-t border-border bg-border">
            <div className="bg-card px-4 py-4">
              <p className="ui-figure text-[clamp(1.35rem,3vw,1.9rem)] leading-none text-ink">
                {rider?.completedOrders || 0}
              </p>
              <p className="ui-mono ui-mono-sm mt-2.5 text-ink-muted">Completed</p>
            </div>
            <div className="bg-card px-4 py-4">
              <p className="ui-figure text-[clamp(1.35rem,3vw,1.9rem)] leading-none text-ink">
                {totalActiveOrders}
              </p>
              <p className="ui-mono ui-mono-sm mt-2.5 text-ink-muted">Active</p>
            </div>
            <div className="bg-card px-4 py-4">
              <p className="ui-figure text-[clamp(1.35rem,3vw,1.9rem)] leading-none text-ink">
                ₦{Number(rider?.availableBalance || 0).toLocaleString()}
              </p>
              <p className="ui-mono ui-mono-sm mt-2.5 text-ink-muted">Wallet</p>
            </div>
          </div>

          {(locationPermission === 'denied' || locationPermission === 'prompt' || locationPermission === 'unsupported') && (
            <div className="m-5 border border-warning/25 bg-warning/5 px-3.5 py-3">
              <p className="text-sm font-semibold text-warning">
                {locationPermission === 'unsupported' ? 'Location not supported on this device' : 'Turn on location'}
              </p>
              <p className="mt-0.5 text-xs text-warning">
                {locationPermission === 'unsupported'
                  ? "Buyers won't be able to see your live route on deliveries from this device."
                  : locationPermission === 'denied'
                    ? "Location access is blocked. Buyers can't see your live route until you enable it in your browser/phone settings for BataMart, then reopen the app."
                    : 'BataMart needs your location so buyers can see your live route while you deliver. Enable it now, before you accept an order.'}
              </p>
              {locationPermission === 'prompt' && (
                <button
                  onClick={requestLocationPermission}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-warning px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 transition-all"
                >
                  Enable Location
                </button>
              )}
            </div>
          )}

          {liveOrderIds.length > 0 && (
            <div className={`mt-4 rounded-xl border px-3 py-2.5 text-xs ${
              trackingError
                ? 'bg-danger/10 border-danger/30 text-danger'
                : 'bg-success/10 border-success/30 text-success'
            }`}>
              <p className="font-semibold">
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
              <AlertTriangle className="w-4 h-4 text-danger" />
              <h2 className="ui-eyebrow text-danger">Return Pickup Required</h2>
              <span className="px-2 py-0.5 bg-danger/10 text-danger rounded-full text-xs font-semibold">
                {blockingDisputeReturns.length} pending
              </span>
            </div>

            <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-sm text-danger mb-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Complete this return pickup before accepting new orders.
                You will earn your delivery share once confirmed.
              </span>
            </div>

            <div className="space-y-3">
              {disputePickups.map((order: any) => {
                const pickup = order.dispute?.pickupAddress as any
                return (
                  <div key={order.id} className="border border-danger/30 bg-card p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-xs font-semibold text-danger bg-danger/10 px-2 py-1 rounded-full">
                          Dispute Return
                        </span>
                        <p className="text-xs text-ink-muted mt-1">#{order.orderNumber}</p>
                        <p className="font-semibold text-ink mt-0.5">{order.product.name}</p>
                      </div>
                      <span className="px-3 py-1 bg-warning/10 text-warning rounded-full text-xs font-semibold">
                        ₦{riderShareFor(order).toLocaleString()} on done
                      </span>
                    </div>

                    <div className="mb-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${getDisputeReturnStage(order.status).tone}`}>
                        {getDisputeReturnStage(order.status).label}
                      </span>
                    </div>

                    {order.dispute?.reason && (
                      <div className="mb-3 p-3 bg-surface rounded-xl text-sm text-ink-secondary">
                        <p className="text-xs font-semibold text-ink-muted uppercase mb-1">Reason</p>
                        <p>{order.dispute.reason}</p>
                      </div>
                    )}

                    <div className="mb-3 p-3 bg-primary/10 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        <p className="text-xs font-semibold text-primary uppercase">Collect from buyer</p>
                      </div>
                      {pickup ? (
                        <div className="text-sm space-y-0.5">
                          <p className="font-semibold text-ink">{pickup.hostel}{pickup.room ? `, Room ${pickup.room}` : ''}</p>
                          {pickup.landmark && <p className="text-ink-secondary text-xs">{pickup.landmark}</p>}
                          <p className="text-primary font-semibold flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" /> {pickup.phone}
                          </p>
                        </div>
                      ) : (
                        <div className="text-sm space-y-0.5">
                          <p className="font-semibold text-ink">{order.deliveryHostel}, Room {order.deliveryRoom}</p>
                          {order.deliveryLandmark && <p className="text-ink-secondary text-xs">{order.deliveryLandmark}</p>}
                          <p className="text-primary font-semibold flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" /> {order.deliveryPhone}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mb-3 p-3 bg-success/10 rounded-xl">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MapPin className="w-3.5 h-3.5 text-success" />
                        <p className="text-xs font-semibold text-success uppercase">Return to seller</p>
                      </div>
                      <div className="text-sm space-y-0.5">
                        <p className="font-semibold text-ink">
                          {order.seller?.hostelName || order.product?.hostelName || 'Seller hostel not set'}
                          {order.seller?.roomNumber ? `, Room ${order.seller.roomNumber}` : ''}
                        </p>
                        {order.seller?.landmark && <p className="text-ink-secondary text-xs">{order.seller.landmark}</p>}
                        {order.seller?.phone && (
                          <p className="text-success font-semibold flex items-center gap-1 mt-1">
                            <Phone className="w-3 h-3" /> {order.seller.phone}
                          </p>
                        )}
                        <p className="text-[11px] text-ink-secondary mt-1">
                          Seller: <span className="font-semibold text-ink-secondary">{order.seller?.name || 'N/A'}</span>
                        </p>
                      </div>
                    </div>

                    {order.status === 'RIDER_ASSIGNED' && (
                      <button
                        onClick={() => markDisputePickedUp(order.id)}
                        disabled={actionLoading[`dispute-pickup-${order.id}`]}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-danger hover:brightness-95 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
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
                        className="w-full flex items-center justify-center gap-2 py-3 bg-ink hover:bg-primary text-background rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
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
                        className="w-full flex items-center justify-center gap-2 py-3 bg-success hover:brightness-95 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                      >
                        {actionLoading[`status-${order.id}`]
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                          : <><CheckCircle className="w-4 h-4" /> Delivered to Seller</>
                        }
                      </button>
                    )}

                    {order.status === 'DELIVERED' && (
                      <div className="w-full py-3 px-3 rounded-xl bg-success/10 text-success text-xs font-semibold text-center">
                        Return delivered. Waiting for seller confirmation.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Pickups & Deliveries ──────────────────────────────────────── */}
        <RiderJobs
          showToast={showToast}
          blocked={hasDisputePickupPending}
          onActiveOrderIds={setJobOrderIds}
        />

      </div>
    </div>
  )
}

