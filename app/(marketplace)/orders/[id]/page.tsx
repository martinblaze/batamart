'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import ReviewModal from '@/components/reviews/ReviewModal';
import ProductReviewModal from '@/components/reviews/ProductReviewModal';
import RatingBadge from '@/components/reviews/RatingBadge';
import ReviewList from '@/components/reviews/ReviewList';
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Star,
  MapPin,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Shield,
  ShoppingBag,
  MessageSquare,
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  Loader2,
  Navigation,
  Route,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { formatDeliveryDate, getOrderDeliveryDate, getEffectiveDeliveryDate, parseReadyDays } from '@/lib/delivery/schedule';
import { Shell, PageHeader, EmptyState, Skeleton, DataRow } from '@/components/ui/Shell';
import { Badge, type BadgeStatus } from '@/components/ui/Badge';

// ── Statuses where the order is still actively moving ─────────────────────────
const ACTIVE_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'AT_HUB',
  'PACKED',
  'ON_THE_WAY',
]

// Leaflet reads `window` on import, so the map is client-only.
const LiveRiderMap = dynamic(() => import('@/components/marketplace/LiveRiderMap'), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse bg-surface" />,
});

// A ping older than this means the rider's phone has stopped reporting.
const STALE_PING_MS = 45_000;

// The buyer's map is the last leg only: from the hub to their door.
const LIVE_TRACKING_STATUSES = ['ON_THE_WAY']

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [liveTracking, setLiveTracking] = useState<any>(null);
  const [liveTrackingError, setLiveTrackingError] = useState<string | null>(null);
  const [liveTrackingLoading, setLiveTrackingLoading] = useState(false);
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    type: 'SELLER' | 'RIDER' | 'PRODUCT' | null;
  }>({ isOpen: false, type: null });

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  // ── Polling: auto-refresh every 10s while order is in an active status ─────
  useEffect(() => {
    if (!order) return;

    if (!ACTIVE_STATUSES.includes(order.status)) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const interval = setInterval(() => {
      fetchOrder(true); // silent=true: don't show loading spinner on poll
    }, 10000);

    return () => clearInterval(interval);
  }, [order?.status]);

  useEffect(() => {
    if (!order?.id || !order?.riderId) {
      setLiveTracking(null)
      return
    }

    if (!LIVE_TRACKING_STATUSES.includes(order.status)) {
      setLiveTracking(null)
      return
    }

    fetchLiveTracking()
    const interval = setInterval(() => fetchLiveTracking(true), 5000)
    return () => clearInterval(interval)
  }, [order?.id, order?.riderId, order?.status])

  // Hooks must run before the loading/error early returns below.
  const livePoints = useMemo(
    () =>
      (liveTracking?.points ?? []).map((p: any) => ({ lat: p.lat, lng: p.lng, heading: p.heading })),
    [liveTracking?.points],
  );

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const lastPingAgoSec = liveTracking?.latestPoint
    ? Math.max(0, Math.round((nowTick - new Date(liveTracking.latestPoint.at).getTime()) / 1000))
    : null;
  const pingIsStale = lastPingAgoSec != null && lastPingAgoSec * 1000 > STALE_PING_MS;

  const fetchOrder = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      const response = await fetch(`/api/orders/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(data);
      } else if (response.status === 401 || response.status === 403) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      } else if (response.status === 404) {
        setOrder(null);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || `Something went wrong (${response.status}). Please try again.`);
      }
    } catch {
      setError('Unable to load this order. Check your connection and try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchLiveTracking = async (silent = false) => {
    if (!silent) setLiveTrackingLoading(true)
    setLiveTrackingError(null)
    try {
      const token = localStorage.getItem('token')
      if (!token || !order?.id) return

      const response = await fetch(`/api/orders/${order.id}/live-location`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setLiveTrackingError(data.error || 'Failed to load live tracking')
        return
      }

      const data = await response.json()
      setLiveTracking(data)
    } catch {
      setLiveTrackingError('Could not refresh rider live location.')
    } finally {
      if (!silent) setLiveTrackingLoading(false)
    }
  }

  const updateOrderStatus = async (newStatus: string) => {
    setUpdating(true);
    setUpdateError(null);
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(`/api/orders/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const updated = await response.json();
        setOrder(updated);
      } else {
        const err = await response.json().catch(() => ({}));
        setUpdateError(err.error || 'Failed to update order status. Please try again.');
      }
    } catch {
      setUpdateError('Network error. Please check your connection and try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Status colour is semantic only: success when the order has landed, danger
  // when it has gone wrong, warning while it is still waiting on someone, and
  // the accent for everything actively in motion.
  const getStatusTone = (status: string): BadgeStatus => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'DELIVERED':
      case 'COMPLETED': return 'success';
      case 'CANCELLED':
      case 'DISPUTED': return 'danger';
      case 'PROCESSING':
      case 'SHIPPED':
      case 'RIDER_ASSIGNED':
      case 'PICKED_UP':
      case 'AT_HUB':
      case 'PACKED':
      case 'ON_THE_WAY': return 'verified';
      default: return 'neutral';
    }
  };

  const getStatusActions = () => {
    if (!order) return [];
    const actions = [];
    const userRole = getCurrentUserRole();

    // Sellers accept orders from the sales list (app/(marketplace)/orders/sales),
    // not from this detail page. Riders progress a delivery from the rider
    // dashboard's own status buttons (POST /api/riders/update-status), not here.

    if (userRole === 'BUYER') {
      // Buyers can no longer cancel after payment.
    }

    return actions;
  };

  const getCurrentUserRole = () => {
    if (!order) return null;
    const currentUserId = localStorage.getItem('userId') || 'current-user-id';
    if (currentUserId === order.buyerId) return 'BUYER';
    if (currentUserId === order.product?.sellerId) return 'SELLER';
    if (currentUserId === order.riderId) return 'RIDER';
    return null;
  };

  const handleMarkDelivered = async () => {
    if (!order?.id) return
    if (!window.confirm('Confirm you have received this order? The rider will be paid once you do.')) return
    setUpdating(true)
    setUpdateError(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/orders/confirm-delivery', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUpdateError(data.error || 'Could not mark as delivered')
        return
      }
      await fetchOrder(true)
    } catch {
      setUpdateError('Network error. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const canSellerConfirmReturn = () => {
    return (
      userRole === 'SELLER' &&
      !!order?.dispute &&
      order.dispute.status === 'UNDER_REVIEW' &&
      order.dispute.resolution === '__RETURN_DELIVERED_TO_SELLER__'
    )
  }

  const handleSellerConfirmReturn = async () => {
    if (!order?.dispute?.id) return
    setConfirmingReturn(true)
    setUpdateError(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/disputes/${order.dispute.id}/confirm-return`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      const data = await res.json()
      if (!res.ok) {
        setUpdateError(data.error || 'Failed to confirm return')
        return
      }
      await fetchOrder(true)
    } catch {
      setUpdateError('Network error while confirming return')
    } finally {
      setConfirmingReturn(false)
    }
  }

  const canReviewProduct = (order?.status === 'DELIVERED' || order?.status === 'COMPLETED') &&
    order?.productReviews?.length === 0;

  const canReviewSeller = (order?.status === 'DELIVERED' || order?.status === 'COMPLETED') &&
    !order?.reviews?.some((r: any) => r.type === 'SELLER');

  const canReviewRider = (order?.status === 'DELIVERED' || order?.status === 'COMPLETED') &&
    order?.rider &&
    !order?.reviews?.some((r: any) => r.type === 'RIDER');

  // ── Loading skeleton ───────────────────────────────────────────────────────
  // Shaped like the page it is standing in for, so the layout does not jump
  // when the order lands.
  if (loading) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell className="pt-8 sm:pt-12">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-6 h-10 w-2/5" />
          <Skeleton className="mt-4 h-4 w-3/5" />
          <Skeleton className="mt-10 h-24 w-full" />
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Skeleton className="h-52 w-full" />
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
            <div className="space-y-6">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </Shell>
      </div>
    );
  }

  // ── Network / server error state ───────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-16 sm:pt-24">
          <EmptyState
            icon={WifiOff}
            title="Couldn't load this order"
            description={error}
            action={
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button onClick={() => fetchOrder()} variant="ink" leftIcon={<RefreshCw className="h-4 w-4" />}>
                  Try again
                </Button>
                <Button variant="secondary" onClick={() => router.back()} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                  Back
                </Button>
              </div>
            }
          />
        </Shell>
      </div>
    );
  }

  // ── Order not found ────────────────────────────────────────────────────────
  if (!order) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-16 sm:pt-24">
          <EmptyState
            icon={Package}
            title="Order not found"
            description="This order doesn't exist, or it isn't one you have access to."
            action={
              <Button variant="ink" onClick={() => router.back()} leftIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            }
          />
        </Shell>
      </div>
    );
  }

  const statusActions = getStatusActions();
  const userRole = getCurrentUserRole();

  // ── Dispute status label helper ────────────────────────────────────────────
  const getDisputeStatusLabel = (s: string) => {
    switch (s) {
      case 'OPEN': return 'Open — Awaiting Review'
      case 'UNDER_REVIEW': return 'Under Review'
      case 'RESOLVED_BUYER_FAVOR': return 'Resolved — Refund Issued'
      case 'RESOLVED_SELLER_FAVOR': return 'Resolved — No Refund'
      case 'RESOLVED_COMPROMISE': return 'Partial Refund'
      case 'DISMISSED': return 'Dismissed'
      default: return s
    }
  }

  const getDisputeStatusTone = (s: string): BadgeStatus => {
    if (s === 'OPEN') return 'verified'
    if (s === 'UNDER_REVIEW') return 'warning'
    if (s.startsWith('RESOLVED')) return 'success'
    return 'neutral'
  }

  const getCheckpointLabel = (checkpoint: any) => {
    if (checkpoint?.status === 'RIDER_ASSIGNED') return 'Rider accepted order'
    if (checkpoint?.status === 'PICKED_UP') return 'Item picked up'
    if (checkpoint?.status === 'ON_THE_WAY') return 'Rider on the way'
    if (checkpoint?.status === 'DELIVERED') return 'Marked delivered'
    if (checkpoint?.action === 'RIDER_TRACKING_STARTED') return 'Live tracking started'
    return checkpoint?.status?.replace(/_/g, ' ') || 'Tracking update'
  }

  const openMapUrl = liveTracking?.latestPoint
    ? `https://www.google.com/maps/search/?api=1&query=${liveTracking.latestPoint.lat},${liveTracking.latestPoint.lng}`
    : null

  return (
    <div className="min-h-screen bg-surface pb-20">
      <Shell className="pt-8 sm:pt-12">

      {/* Inline update error banner — replaces alert() */}
      {updateError && (
        <div className="mb-6 flex items-start gap-3 border border-danger/25 bg-danger/5 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-danger">Action failed</p>
            <p className="mt-0.5 text-sm text-danger">{updateError}</p>
          </div>
          <button
            onClick={() => setUpdateError(null)}
            aria-label="Dismiss"
            className="flex-shrink-0 text-lg leading-none text-danger transition-opacity hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}

      {/* Order header */}
      <PageHeader
        eyebrow="Order"
        back={{ href: '/orders', label: 'All orders' }}
        title={<span className="ui-figure">#{order.orderNumber || order.id.slice(-8)}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Badge status={getStatusTone(order.status)} icon={undefined}>
              {order.status.replace(/_/g, ' ')}
            </Badge>

            {isPolling && (
              <span className="ui-mono ui-mono-sm inline-flex items-center gap-1.5 text-success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                Live
              </span>
            )}

            <span className="inline-flex items-center gap-2 text-sm text-ink-secondary">
              <Calendar className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
              {format(new Date(order.createdAt), 'MMM dd, yyyy · h:mm a')}
            </span>
          </span>
        }
        actions={
          statusActions.length > 0 ? (
            <>
              {statusActions.map((action) => (
                <Button
                  key={action.status}
                  variant={action.variant as 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'}
                  onClick={() => updateOrderStatus(action.status)}
                  disabled={updating}
                >
                  {updating ? 'Updating…' : action.label}
                </Button>
              ))}
            </>
          ) : undefined
        }
      />

      {/* ── Order progress tracker ─────────────────────────────────────────── */}
      {ACTIVE_STATUSES.includes(order.status) && (
        <div className="ui-panel mt-8">
          <p className="ui-eyebrow mb-7">In progress</p>
          <div className="relative flex items-start justify-between">
            {/* The rail sits behind the markers at their vertical centre. */}
            <div className="absolute left-0 right-0 top-[13px] z-0 h-px bg-border" />
            <div
              className="absolute left-0 top-[13px] z-0 h-px bg-ink transition-[width] duration-700 ease-out"
              style={{
                width: `${order.status === 'PENDING' ? 0 :
                    order.status === 'PROCESSING' ? 20 :
                      order.status === 'SHIPPED' ? 40 :
                        order.status === 'RIDER_ASSIGNED' ? 55 :
                          order.status === 'PICKED_UP' ? 66 :
                            order.status === 'AT_HUB' ? 72 :
                              order.status === 'PACKED' ? 78 :
                            order.status === 'ON_THE_WAY' ? 85 : 100
                  }%`
              }}
            />
            {[
              { key: 'PENDING', label: 'Placed', icon: ShoppingBag },
              { key: 'PROCESSING', label: 'Confirmed', icon: CheckCircle },
              { key: 'PICKED_UP', label: 'Picked up', icon: Package },
              { key: 'AT_HUB', label: 'At hub', icon: Package },
              { key: 'ON_THE_WAY', label: 'On the way', icon: Truck },
              { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle },
            ].map((step, i) => {
              const statusOrder = ['PENDING', 'PROCESSING', 'SHIPPED', 'RIDER_ASSIGNED', 'PICKED_UP', 'AT_HUB', 'PACKED', 'ON_THE_WAY', 'DELIVERED']
              const currentIdx = statusOrder.indexOf(order.status)
              const stepIdx = statusOrder.indexOf(step.key)
              const isDone = currentIdx >= stepIdx
              const StepIcon = step.icon
              return (
                <div key={step.key} className="z-10 flex flex-1 flex-col items-center">
                  <div
                    className={`flex h-[26px] w-[26px] items-center justify-center border transition-colors duration-500 ${
                      isDone
                        ? 'border-ink bg-ink text-background'
                        : 'border-border bg-card text-ink-muted'
                    }`}
                  >
                    <StepIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </div>
                  <p
                    className={`ui-mono ui-mono-sm mt-3 text-center leading-tight transition-colors duration-500 ${
                      isDone ? 'text-ink' : 'text-ink-muted'
                    }`}
                  >
                    {step.label}
                  </p>
                  <span className="ui-mono ui-mono-sm mt-1 text-ink-muted/60">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-8">
        {/* ── Left column ───────────────────────────────────────────────────── */}
        <div className="space-y-8 lg:col-span-2">

          {/* Product card */}
          <section className="ui-panel">
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="ui-eyebrow">Item</p>
              <Link
                href={`/product/${order.product?.id}`}
                className="group ui-mono ui-mono-sm inline-flex flex-shrink-0 items-center gap-1.5 text-ink-secondary transition-colors hover:text-ink"
              >
                View product
                <ExternalLink className="h-3 w-3" strokeWidth={2} />
              </Link>
            </div>

            <div className="flex flex-col gap-6 sm:flex-row">
              {order.product?.images?.[0] && (
                <Link
                  href={`/product/${order.product?.id}`}
                  className="ui-tile group block w-full flex-shrink-0 sm:w-40"
                >
                  <div className="ui-tile__media aspect-square">
                    <img
                      src={order.product.images[0]}
                      alt={order.product.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </Link>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="text-lg leading-snug text-ink">{order.product?.name || 'Product'}</h3>
                {order.product?.description && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-secondary">
                    {order.product.description}
                  </p>
                )}

                <div className="mt-6 grid grid-cols-3 gap-px border border-border bg-border">
                  <div className="bg-card px-3 py-3">
                    <p className="ui-mono ui-mono-sm text-ink-muted">Price</p>
                    <p className="ui-figure mt-1.5 text-[15px] text-ink">
                      ₦{(order.productPrice || order.product?.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-card px-3 py-3">
                    <p className="ui-mono ui-mono-sm text-ink-muted">Qty</p>
                    <p className="ui-figure mt-1.5 text-[15px] text-ink">{order.quantity || 1}</p>
                  </div>
                  <div className="bg-card px-3 py-3">
                    <p className="ui-mono ui-mono-sm text-ink-muted">Total</p>
                    <p className="ui-figure mt-1.5 text-[15px] text-ink">
                      ₦{((order.productPrice || order.product?.price || 0) * (order.quantity || 1)).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Shipping & Payment */}
          <div className="grid gap-6 md:grid-cols-2">

            <section className="ui-panel">
              <p className="ui-eyebrow mb-6">
                <Truck className="h-3.5 w-3.5" strokeWidth={1.75} />
                Delivery
              </p>
              {userRole === 'BUYER' && order.status === 'ON_THE_WAY' && (
                <div className="mb-6 border border-border bg-surface p-4">
                  <p className="text-sm text-ink">Once the rider hands you the parcel, mark it as delivered.</p>
                  <Button onClick={handleMarkDelivered} variant="ink" size="sm" className="mt-3" disabled={updating}>
                    {updating ? 'Saving…' : 'Mark as delivered'}
                  </Button>
                </div>
              )}
              <div className="ui-divide">
                <DataRow label="Delivery day" value={formatDeliveryDate(getEffectiveDeliveryDate(order, Math.max(parseReadyDays(order.product?.deliveryEstimate), ...((order.items ?? []).map((i: any) => parseReadyDays(i.product?.deliveryEstimate))))))} />
                <DataRow label="Hostel" value={order.deliveryHostel || 'Not specified'} />
                <DataRow label="Room" value={order.deliveryRoom || 'Not specified'} />
                {order.deliveryLandmark && (
                  <DataRow label="Landmark" value={order.deliveryLandmark} />
                )}
                {order.product?.landmark && order.deliveryLandmark && (
                  <DataRow
                    label="Route"
                    value={
                      <span className="inline-flex flex-wrap items-center justify-end gap-1.5 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
                        {order.product.landmark}
                        <ArrowRight className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
                        {order.deliveryLandmark}
                      </span>
                    }
                  />
                )}
                <DataRow label="Phone" value={order.deliveryPhone || 'Not specified'} />
              </div>

              {order.orderNote && (
                <div className="mt-5 border border-warning/25 bg-warning/5 px-3.5 py-3">
                  <p className="ui-mono ui-mono-sm text-warning">Note to rider</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink">{order.orderNote}</p>
                </div>
              )}
            </section>

            <section className="ui-panel">
              <p className="ui-eyebrow mb-6">
                <CreditCard className="h-3.5 w-3.5" strokeWidth={1.75} />
                Payment
              </p>
              <div className="ui-divide">
                <DataRow label="Subtotal" value={`₦${(order.productPrice || 0).toLocaleString()}`} />
                <DataRow label="Delivery fee" value={`₦${(order.deliveryFee || 0).toLocaleString()}`} />
                <DataRow
                  label="Total paid"
                  emphasis
                  value={`₦${(order.totalAmount || 0).toLocaleString()}`}
                />
                <DataRow
                  label="Status"
                  value={
                    order.isPaid ? (
                      <Badge status="success" icon={CheckCircle}>Paid</Badge>
                    ) : (
                      <Badge status="warning" icon={Clock}>Pending</Badge>
                    )
                  }
                />
              </div>
            </section>
          </div>

          {/* Reviews Section */}
          {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
            <section className="ui-panel">
              <p className="ui-eyebrow mb-6">
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
                Feedback
              </p>

              <div className="grid gap-px border border-border bg-border">
                <ReviewPrompt
                  icon={Package}
                  title="Rate this product"
                  description={`Share your experience with ${order.product?.name || 'this item'}.`}
                  done={order.productReviews?.length > 0}
                  doneLabel="Product reviewed"
                  unavailableLabel="Review not available"
                  action={
                    canReviewProduct ? (
                      <>
                        <Button
                          size="sm"
                          variant="ink"
                          onClick={() => router.push(`/orders/${order.id}/review-product`)}
                          leftIcon={<Star className="h-3.5 w-3.5" strokeWidth={1.75} />}
                        >
                          Review
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReviewModal({ isOpen: true, type: 'PRODUCT' })}
                        >
                          Quick
                        </Button>
                      </>
                    ) : null
                  }
                />

                <ReviewPrompt
                  icon={User}
                  title="Rate the seller"
                  description={`How was dealing with ${order.seller?.name || 'the seller'}?`}
                  done={order.reviews?.some((r: any) => r.type === 'SELLER')}
                  doneLabel="Seller reviewed"
                  unavailableLabel="Complete the product review first"
                  action={
                    canReviewSeller ? (
                      <>
                        <Button
                          size="sm"
                          variant="ink"
                          onClick={() => router.push(`/orders/${order.id}/review-seller`)}
                          leftIcon={<Star className="h-3.5 w-3.5" strokeWidth={1.75} />}
                        >
                          Review
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReviewModal({ isOpen: true, type: 'SELLER' })}
                        >
                          Quick
                        </Button>
                      </>
                    ) : null
                  }
                />

                {order.rider && (
                  <ReviewPrompt
                    icon={Truck}
                    title="Rate the rider"
                    description={`How was the delivery from ${order.rider.name}?`}
                    done={order.reviews?.some((r: any) => r.type === 'RIDER')}
                    doneLabel="Rider reviewed"
                    unavailableLabel="Review not available"
                    action={
                      canReviewRider ? (
                        <Button
                          size="sm"
                          variant="ink"
                          onClick={() => setReviewModal({ isOpen: true, type: 'RIDER' })}
                          leftIcon={<Star className="h-3.5 w-3.5" strokeWidth={1.75} />}
                        >
                          Review
                        </Button>
                      ) : null
                    }
                  />
                )}
              </div>

              {((order.reviews && order.reviews.length > 0) || (order.productReviews && order.productReviews.length > 0)) && (
                <div className="mt-8 border-t border-border pt-7">
                  <p className="ui-eyebrow mb-5">Your reviews</p>
                  <ReviewList reviews={[...(order.reviews || []), ...(order.productReviews || [])]} />
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────────────────── */}
        <div className="space-y-8">

          {/* Buyer Card */}
          <PartyCard
            eyebrow="Buyer"
            name={order.buyer?.name || 'Anonymous'}
            contact={order.buyer?.phone || order.buyer?.email || ''}
            photo={order.buyer?.profilePhoto}
          />

          {/* Seller Card */}
          <PartyCard
            eyebrow="Seller"
            name={order.seller?.name || 'Seller'}
            contact={order.seller?.phone || order.seller?.email || ''}
            photo={order.seller?.profilePhoto}
            href={order.seller?.id ? `/seller/${order.seller.id}` : undefined}
          >
            <RatingBadge
              rating={order.seller?.avgRating || 0}
              reviewCount={order.seller?.totalReviews || 0}
              trustLevel={order.seller?.trustLevel || 'BRONZE'}
            />
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              className="mt-4"
              onClick={() => router.push(`/seller/${order.seller?.id}`)}
            >
              View seller profile
            </Button>
          </PartyCard>

          {/* Rider Card */}
          {order.rider && (
            <PartyCard
              eyebrow="Rider"
              name={order.rider.name}
              contact={order.rider.phone || order.rider.email || ''}
              photo={order.rider.profilePhoto}
            >
              <RatingBadge
                rating={order.rider.avgRating || 0}
                reviewCount={order.rider.totalReviews || 0}
                trustLevel={order.rider.trustLevel || 'BRONZE'}
              />
            </PartyCard>
          )}

          {/* ── Dispute card ──────────────────────────────────────────────── */}
          {userRole === 'BUYER' && order.rider && LIVE_TRACKING_STATUSES.includes(order.status) && (
            <section className="ui-panel">
              <div className="mb-5 flex items-center justify-between gap-4">
                <p className="ui-eyebrow">
                  <Navigation className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Live map
                </p>
                {liveTrackingLoading && (
                  <span className="ui-mono ui-mono-sm inline-flex flex-shrink-0 items-center gap-1.5 text-ink-muted">
                    <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                    Syncing
                  </span>
                )}
              </div>

              {liveTrackingError && (
                <p className="mb-4 border border-danger/25 bg-danger/5 px-3.5 py-2.5 text-xs text-danger">
                  {liveTrackingError}
                </p>
              )}

              {liveTracking?.latestPoint ? (
                <>
                  <div className="relative overflow-hidden border border-border">
                    <LiveRiderMap points={livePoints} className="h-72 w-full" />
                    <span
                      className={`ui-mono ui-mono-sm absolute left-2 top-2 z-[500] border bg-card px-2 py-1 ${
                        pingIsStale ? 'border-warning/40 text-warning' : 'border-border text-ink'
                      }`}
                    >
                      {pingIsStale ? 'Signal lost' : 'Live'}
                    </span>
                  </div>
                  {pingIsStale && (
                    <p className="mt-3 border border-warning/25 bg-warning/5 px-3.5 py-2.5 text-xs text-warning">
                      Last seen {lastPingAgoSec != null && lastPingAgoSec >= 120
                        ? `${Math.round(lastPingAgoSec / 60)} min`
                        : `${lastPingAgoSec}s`} ago. The rider&apos;s phone may be offline or out of signal. The pin will move again when it reconnects.
                    </p>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
                    <div className="bg-card px-3 py-2.5">
                      <p className="ui-mono ui-mono-sm text-ink-muted">Last ping</p>
                      <p className="ui-figure mt-1 text-[13px] text-ink">
                        {lastPingAgoSec != null && lastPingAgoSec < 60 ? `${lastPingAgoSec}s ago` : format(new Date(liveTracking.latestPoint.at), 'h:mm:ss a')}
                      </p>
                    </div>
                    <div className="bg-card px-3 py-2.5">
                      <p className="ui-mono ui-mono-sm text-ink-muted">Route points</p>
                      <p className="ui-figure mt-1 text-[13px] text-ink">
                        {liveTracking.points?.length || 0}
                      </p>
                    </div>
                  </div>

                  {openMapUrl && (
                    <a
                      href={openMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ui-mono ui-mono-sm mt-4 inline-flex w-full items-center justify-center gap-2 border border-border py-3 text-ink-secondary transition-colors hover:border-ink/25 hover:text-ink"
                    >
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
                      Open in Google Maps
                    </a>
                  )}
                </>
              ) : (
                <p className="border border-dashed border-border bg-surface px-3.5 py-3 text-sm text-ink-secondary">
                  Waiting for the rider&apos;s first location ping…
                </p>
              )}

              {liveTracking?.checkpoints?.length > 0 && (
                <div className="mt-6 border-t border-border pt-5">
                  <p className="ui-eyebrow mb-4">
                    <Route className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Checkpoints
                  </p>
                  <div className="ui-divide max-h-44 overflow-auto border border-border">
                    {[...liveTracking.checkpoints].reverse().slice(0, 5).map((checkpoint: any) => (
                      <div
                        key={checkpoint.id}
                        className="flex items-start justify-between gap-3 bg-card px-3.5 py-2.5"
                      >
                        <p className="text-xs text-ink">{getCheckpointLabel(checkpoint)}</p>
                        <span className="ui-mono ui-mono-sm whitespace-nowrap text-ink-muted">
                          {format(new Date(checkpoint.at), 'h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {order.dispute ? (
            <section className="ui-panel border-warning/30">
              <p className="ui-eyebrow mb-4 text-warning">
                <Shield className="h-3.5 w-3.5" strokeWidth={1.75} />
                Dispute filed
              </p>
              <p className="text-sm leading-relaxed text-ink-secondary">
                A dispute has been opened on this order. Track the case and talk to the support
                team from there.
              </p>
              <div className="mt-5">
                <Badge status={getDisputeStatusTone(order.dispute.status)}>
                  {getDisputeStatusLabel(order.dispute.status)}
                </Badge>
              </div>
              <Button
                variant="ink"
                fullWidth
                className="mt-6"
                onClick={() => router.push(`/disputes/${order.dispute.id}`)}
                leftIcon={<Shield className="h-4 w-4" strokeWidth={1.75} />}
              >
                Track dispute
              </Button>

              {canSellerConfirmReturn() && (
                <Button
                  variant="success"
                  fullWidth
                  className="mt-3"
                  onClick={handleSellerConfirmReturn}
                  isLoading={confirmingReturn}
                  loadingText="Confirming…"
                  leftIcon={<CheckCircle className="h-4 w-4" strokeWidth={1.75} />}
                >
                  I received the returned item
                </Button>
              )}
            </section>
          ) : (
            userRole === 'BUYER' &&
            (order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
              <section className="ui-panel">
                <p className="ui-eyebrow mb-4">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} />
                  Something wrong?
                </p>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  If there is a problem with this order, you can open a dispute within 48 hours of
                  delivery.
                </p>
                <Button
                  variant="secondary"
                  fullWidth
                  className="mt-6 border-warning/40 text-warning hover:bg-warning/5 hover:border-warning/60"
                  onClick={() => router.push(`/orders/${order.id}/dispute`)}
                >
                  Open a dispute
                </Button>
              </section>
            )
          )}

          {/* Order Summary */}
          <section className="ui-panel">
            <p className="ui-eyebrow mb-5">Summary</p>
            <div className="ui-divide">
              <DataRow label="Subtotal" value={`₦${(order.productPrice || 0).toLocaleString()}`} />
              <DataRow label="Delivery fee" value={`₦${(order.deliveryFee || 0).toLocaleString()}`} />
              <DataRow label="Total" emphasis value={`₦${(order.totalAmount || 0).toLocaleString()}`} />
            </div>
          </section>

          {/* Review Status Summary */}
          {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
            <section className="ui-panel">
              <p className="ui-eyebrow mb-5">Review status</p>
              <div className="ui-divide">
                <DataRow
                  label="Product"
                  value={<ReviewStatusBadge done={order.productReviews?.length > 0} />}
                />
                <DataRow
                  label="Seller"
                  value={<ReviewStatusBadge done={order.reviews?.some((r: any) => r.type === 'SELLER')} />}
                />
                {order.rider && (
                  <DataRow
                    label="Rider"
                    value={<ReviewStatusBadge done={order.reviews?.some((r: any) => r.type === 'RIDER')} />}
                  />
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Review Modals */}
      {reviewModal.type === 'PRODUCT' && (
        <ProductReviewModal
          isOpen={reviewModal.isOpen}
          onClose={() => setReviewModal({ isOpen: false, type: null })}
          orderId={order.id}
          productId={order.product?.id}
          productName={order.product?.name}
          onReviewSubmitted={() => { fetchOrder(); setReviewModal({ isOpen: false, type: null }) }}
        />
      )}

      {(reviewModal.type === 'SELLER' || reviewModal.type === 'RIDER') && (
        <ReviewModal
          isOpen={reviewModal.isOpen}
          onClose={() => setReviewModal({ isOpen: false, type: null })}
          orderId={order.id}
          type={reviewModal.type}
          revieweeName={
            reviewModal.type === 'SELLER'
              ? order.seller?.name || 'Seller'
              : order.rider?.name || 'Rider'
          }
          onReviewSubmitted={() => { fetchOrder(); setReviewModal({ isOpen: false, type: null }) }}
        />
      )}
      </Shell>
    </div>
  );
}

/* ── Local pieces ─────────────────────────────────────────────────────────────
   These three shapes each repeated two or three times in the markup above, so
   they read better named than inlined. */

/** One "rate the X" row: identity on the left, the action or its resolution on the right. */
function ReviewPrompt({
  icon: Icon,
  title,
  description,
  done,
  doneLabel,
  unavailableLabel,
  action,
}: {
  icon: React.ElementType
  title: string
  description: string
  done?: boolean
  doneLabel: string
  unavailableLabel: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-border bg-surface">
          <Icon className="h-4 w-4 text-ink-secondary" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{description}</p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 sm:pl-4">
        {action ? (
          action
        ) : done ? (
          <Badge status="success" icon={CheckCircle}>{doneLabel}</Badge>
        ) : (
          <span className="text-xs text-ink-muted">{unavailableLabel}</span>
        )}
      </div>
    </div>
  )
}

/** Buyer / seller / rider identity panel. */
function PartyCard({
  eyebrow,
  name,
  contact,
  photo,
  href,
  children,
}: {
  eyebrow: string
  name: string
  contact?: string
  photo?: string | null
  href?: string
  children?: React.ReactNode
}) {
  return (
    <section className="ui-panel">
      <p className="ui-eyebrow mb-5">{eyebrow}</p>
      <div className="flex items-center gap-3.5">
        {photo ? (
          <img src={photo} alt="" className="h-12 w-12 flex-shrink-0 object-cover" />
        ) : (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border border-border bg-surface">
            <User className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
          </div>
        )}
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="text-sm font-medium text-ink transition-colors hover:text-primary">
              {name}
            </Link>
          ) : (
            <h4 className="text-sm font-medium text-ink">{name}</h4>
          )}
          {contact && <p className="mt-0.5 truncate text-xs text-ink-secondary">{contact}</p>}
        </div>
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  )
}

function ReviewStatusBadge({ done }: { done?: boolean }) {
  return done ? (
    <Badge status="success">Completed</Badge>
  ) : (
    <Badge status="warning">Pending</Badge>
  )
}
