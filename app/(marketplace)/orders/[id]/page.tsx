'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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

// ── Statuses where the order is still actively moving ─────────────────────────
const ACTIVE_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
]

const LIVE_TRACKING_STATUSES = ['RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY']

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
    const interval = setInterval(() => fetchLiveTracking(true), 8000)
    return () => clearInterval(interval)
  }, [order?.id, order?.riderId, order?.status])

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

  // Design bible: status colors reserved for true status only — no per-stage color variety.
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="w-5 h-5 text-warning" strokeWidth={1.75} />;
      case 'PROCESSING': return <Package className="w-5 h-5 text-primary" strokeWidth={1.75} />;
      case 'SHIPPED': return <Truck className="w-5 h-5 text-primary" strokeWidth={1.75} />;
      case 'RIDER_ASSIGNED': return <Truck className="w-5 h-5 text-primary" strokeWidth={1.75} />;
      case 'PICKED_UP': return <Package className="w-5 h-5 text-primary" strokeWidth={1.75} />;
      case 'ON_THE_WAY': return <Truck className="w-5 h-5 text-primary" strokeWidth={1.75} />;
      case 'DELIVERED': return <CheckCircle className="w-5 h-5 text-success" strokeWidth={1.75} />;
      case 'COMPLETED': return <CheckCircle className="w-5 h-5 text-success" strokeWidth={1.75} />;
      case 'CANCELLED': return <XCircle className="w-5 h-5 text-danger" strokeWidth={1.75} />;
      case 'DISPUTED': return <XCircle className="w-5 h-5 text-danger" strokeWidth={1.75} />;
      default: return <Clock className="w-5 h-5 text-ink-secondary" strokeWidth={1.75} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-warning/10 text-warning border-warning/30';
      case 'PROCESSING': return 'bg-primary/10 text-primary border-primary/30';
      case 'SHIPPED': return 'bg-primary/10 text-primary border-primary/30';
      case 'RIDER_ASSIGNED': return 'bg-primary/10 text-primary border-primary/30';
      case 'PICKED_UP': return 'bg-primary/10 text-primary border-primary/30';
      case 'ON_THE_WAY': return 'bg-primary/10 text-primary border-primary/30';
      case 'DELIVERED': return 'bg-success/10 text-success border-success/30';
      case 'COMPLETED': return 'bg-success/10 text-success border-success/30';
      case 'CANCELLED': return 'bg-danger/10 text-danger border-danger/30';
      case 'DISPUTED': return 'bg-danger/10 text-danger border-danger/30';
      default: return 'bg-surface text-ink border-border';
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
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-border rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-border rounded mb-6"></div>
          <div className="h-32 bg-border rounded"></div>
        </div>
      </div>
    );
  }

  // ── Network / server error state ───────────────────────────────────────────
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-lg text-center">
        <div className="bg-white rounded-2xl border border-danger/20 shadow-soft p-8">
          <WifiOff className="w-14 h-14 mx-auto text-danger mb-4" />
          <h1 className="text-xl font-semibold text-ink mb-2">Couldn't Load Order</h1>
          <p className="text-ink-secondary mb-6 text-sm leading-relaxed">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => fetchOrder()} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Order not found ────────────────────────────────────────────────────────
  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Package className="w-16 h-16 mx-auto text-ink-muted mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Order Not Found</h1>
        <p className="text-ink-secondary mb-6">The order you're looking for doesn't exist or you don't have access to it.</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
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

  const getDisputeStatusBadge = (s: string) => {
    if (s === 'OPEN') return 'bg-primary/10 text-primary'
    if (s === 'UNDER_REVIEW') return 'bg-warning/10 text-warning'
    if (s.startsWith('RESOLVED')) return 'bg-success/10 text-success'
    if (s === 'DISMISSED') return 'bg-surface text-ink-secondary'
    return 'bg-surface text-ink-secondary'
  }

  const getCheckpointLabel = (checkpoint: any) => {
    if (checkpoint?.status === 'RIDER_ASSIGNED') return 'Rider accepted order'
    if (checkpoint?.status === 'PICKED_UP') return 'Item picked up'
    if (checkpoint?.status === 'ON_THE_WAY') return 'Rider on the way'
    if (checkpoint?.status === 'DELIVERED') return 'Marked delivered'
    if (checkpoint?.action === 'RIDER_TRACKING_STARTED') return 'Live tracking started'
    return checkpoint?.status?.replace(/_/g, ' ') || 'Tracking update'
  }

  const liveMapUrl = liveTracking?.latestPoint
    ? `https://www.google.com/maps?q=${liveTracking.latestPoint.lat},${liveTracking.latestPoint.lng}&z=16&output=embed`
    : null

  const openMapUrl = liveTracking?.latestPoint
    ? `https://www.google.com/maps/search/?api=1&query=${liveTracking.latestPoint.lat},${liveTracking.latestPoint.lng}`
    : null

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">

      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {/* Inline update error banner — replaces alert() */}
      {updateError && (
        <div className="mb-6 flex items-start gap-3 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger">Action Failed</p>
            <p className="text-sm text-danger mt-0.5">{updateError}</p>
          </div>
          <button
            onClick={() => setUpdateError(null)}
            className="text-danger hover:text-danger text-lg leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Order header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-2">
            Order #{order.orderNumber || order.id.slice(-8)}
          </h1>
          <div className="flex items-center gap-4 flex-wrap">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(order.status)}`}>
              {getStatusIcon(order.status)}
              <span className="font-medium">{order.status.replace(/_/g, ' ')}</span>
            </div>

            {isPolling && (
              <div className="flex items-center gap-1.5 text-xs text-success font-semibold">
                <span className="w-2 h-2 bg-success/100 rounded-full animate-pulse" />
                Live
              </div>
            )}

            <div className="flex items-center gap-2 text-ink-secondary">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(order.createdAt), 'MMM dd, yyyy h:mm a')}</span>
            </div>
          </div>
        </div>

        {statusActions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
            {statusActions.map((action) => (
              <Button
                key={action.status}
                variant={action.variant as 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'}
                onClick={() => updateOrderStatus(action.status)}
                disabled={updating}
              >
                {updating ? 'Updating...' : action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* ── Order progress tracker ─────────────────────────────────────────── */}
      {ACTIVE_STATUSES.includes(order.status) && (
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-4">Order Progress</h2>
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-border z-0" />
            <div
              className="absolute left-0 top-4 h-0.5 bg-primary z-0 transition-all duration-500"
              style={{
                width: `${order.status === 'PENDING' ? 0 :
                    order.status === 'PROCESSING' ? 20 :
                      order.status === 'SHIPPED' ? 40 :
                        order.status === 'RIDER_ASSIGNED' ? 55 :
                          order.status === 'PICKED_UP' ? 70 :
                            order.status === 'ON_THE_WAY' ? 85 : 100
                  }%`
              }}
            />
            {[
              { key: 'PENDING', label: 'Placed', icon: ShoppingBag },
              { key: 'PROCESSING', label: 'Confirmed', icon: CheckCircle },
              { key: 'PICKED_UP', label: 'Picked up', icon: Package },
              { key: 'ON_THE_WAY', label: 'On the way', icon: Truck },
              { key: 'DELIVERED', label: 'Delivered', icon: CheckCircle },
            ].map((step) => {
              const statusOrder = ['PENDING', 'PROCESSING', 'SHIPPED', 'RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED']
              const currentIdx = statusOrder.indexOf(order.status)
              const stepIdx = statusOrder.indexOf(step.key)
              const isDone = currentIdx >= stepIdx
              const StepIcon = step.icon
              return (
                <div key={step.key} className="flex flex-col items-center z-10 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isDone
                      ? 'bg-primary border-primary text-white'
                      : 'bg-white border-border text-ink-muted'
                    }`}>
                    <StepIcon className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                  <p className={`text-[10px] font-medium mt-1.5 text-center ${isDone ? 'text-primary' : 'text-ink-muted'}`}>
                    {step.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* ── Left column ───────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Product card */}
          <div className="bg-white rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Product Details</h2>
              <Link href={`/product/${order.product?.id}`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View Product
                </Button>
              </Link>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              {order.product?.images?.[0] && (
                <img
                  src={order.product.images[0]}
                  alt={order.product.name}
                  className="w-32 h-32 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{order.product?.name || 'Product'}</h3>
                <p className="text-ink-secondary mt-1">{order.product?.description || 'No description'}</p>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-sm text-ink-secondary">Price</p>
                    <p className="font-semibold">₦{(order.productPrice || order.product?.price || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-secondary">Quantity</p>
                    <p className="font-semibold">{order.quantity || 1}</p>
                  </div>
                  <div>
                    <p className="text-sm text-ink-secondary">Total</p>
                    <p className="font-semibold">₦{((order.productPrice || order.product?.price || 0) * (order.quantity || 1)).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping & Payment */}
          <div className="grid md:grid-cols-2 gap-6">

            <div className="bg-white rounded-lg border border-border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Shipping Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-ink-secondary">Hostel</p>
                  <p className="font-medium">{order.deliveryHostel || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-ink-secondary">Room</p>
                  <p className="font-medium">{order.deliveryRoom || 'Not specified'}</p>
                </div>
                {order.deliveryLandmark && (
                  <div>
                    <p className="text-sm text-ink-secondary">Landmark</p>
                    <p className="font-medium">{order.deliveryLandmark}</p>
                  </div>
                )}
                {order.product?.landmark && order.deliveryLandmark && (
                  <div>
                    <p className="text-sm text-ink-secondary">Delivery Route</p>
                    <p className="font-medium inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-ink-muted" />
                      {order.product.landmark} <ArrowRight className="w-3.5 h-3.5 text-ink-muted" /> {order.deliveryLandmark}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-ink-secondary">Phone</p>
                  <p className="font-medium">{order.deliveryPhone || 'Not specified'}</p>
                </div>
                {order.orderNote && (
                  <div>
                    <p className="text-sm text-ink-secondary">Note to rider</p>
                    <p className="font-medium text-warning bg-warning/10 rounded-lg px-3 py-2 text-sm">{order.orderNote}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-ink-secondary">Subtotal</p>
                  <p className="font-medium">₦{(order.productPrice || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-ink-secondary">Delivery Fee</p>
                  <p className="font-medium">₦{(order.deliveryFee || 0).toLocaleString()}</p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-ink-secondary">Total Paid</p>
                  <p className="font-semibold text-lg">₦{(order.totalAmount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-ink-secondary">Payment Status</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {order.isPaid ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-success" />
                        <span className="font-medium text-success">Paid</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-warning" />
                        <span className="font-medium text-warning">Pending</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
            <div className="bg-white rounded-lg border border-border p-6">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Reviews & Feedback
              </h2>

              <div className="flex items-center justify-between p-4 border border-border rounded-lg mb-4 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="font-medium">Rate this product</h3>
                    <p className="text-sm text-ink-secondary">Share your experience with {order.product?.name}</p>
                  </div>
                </div>
                {canReviewProduct ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push(`/orders/${order.id}/review-product`)}
                      className="flex items-center gap-2 bg-primary hover:brightness-95"
                    >
                      <Star className="w-4 h-4" strokeWidth={1.75} /> Review product
                    </Button>
                    <Button variant="ghost" onClick={() => setReviewModal({ isOpen: true, type: 'PRODUCT' })}>
                      Quick Review
                    </Button>
                  </div>
                ) : order.productReviews?.length > 0 ? (
                  <span className="text-success font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Product Reviewed
                  </span>
                ) : (
                  <span className="text-ink-secondary text-sm">Review not available</span>
                )}
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">Rate the Seller</h3>
                    <p className="text-sm text-ink-secondary">How was your experience with {order.seller?.name || 'the seller'}?</p>
                  </div>
                </div>
                {canReviewSeller ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push(`/orders/${order.id}/review-seller`)}
                      className="flex items-center gap-2"
                    >
                      <Star className="w-4 h-4" /> Review Seller
                    </Button>
                    <Button variant="ghost" onClick={() => setReviewModal({ isOpen: true, type: 'SELLER' })}>
                      Quick Review
                    </Button>
                  </div>
                ) : order.reviews?.some((r: any) => r.type === 'SELLER') ? (
                  <span className="text-success font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Seller Reviewed
                  </span>
                ) : (
                  <span className="text-ink-secondary text-sm">Complete product review first</span>
                )}
              </div>

              {order.rider && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/10 rounded-lg">
                      <Truck className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <h3 className="font-medium">Rate the Rider</h3>
                      <p className="text-sm text-ink-secondary">How was your delivery with {order.rider.name}?</p>
                    </div>
                  </div>
                  {canReviewRider ? (
                    <Button onClick={() => setReviewModal({ isOpen: true, type: 'RIDER' })} className="flex items-center gap-2">
                      <Star className="w-4 h-4" /> Review Rider
                    </Button>
                  ) : order.reviews?.some((r: any) => r.type === 'RIDER') ? (
                    <span className="text-success font-medium flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Rider Reviewed
                    </span>
                  ) : (
                    <span className="text-ink-secondary text-sm">Review not available</span>
                  )}
                </div>
              )}

              {((order.reviews && order.reviews.length > 0) || (order.productReviews && order.productReviews.length > 0)) && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold mb-4">Your Reviews</h3>
                  <ReviewList reviews={[...(order.reviews || []), ...(order.productReviews || [])]} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Buyer Card */}
          <div className="bg-white rounded-lg border border-border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Buyer Information
            </h3>
            <div className="flex items-center gap-3">
              {order.buyer?.profilePhoto ? (
                <img src={order.buyer.profilePhoto} alt={order.buyer.name || 'Buyer'} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-border flex items-center justify-center">
                  <User className="w-6 h-6 text-ink-secondary" />
                </div>
              )}
              <div>
                <h4 className="font-medium">{order.buyer?.name || 'Anonymous'}</h4>
                <p className="text-sm text-ink-secondary">{order.buyer?.phone || order.buyer?.email || ''}</p>
              </div>
            </div>
          </div>

          {/* Seller Card */}
          <div className="bg-white rounded-lg border border-border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Seller Information
            </h3>
            <div className="flex items-center gap-3 mb-4">
              {order.seller?.profilePhoto ? (
                <img src={order.seller.profilePhoto} alt={order.seller.name || 'Seller'} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-border flex items-center justify-center">
                  <User className="w-6 h-6 text-ink-secondary" />
                </div>
              )}
              <div>
                <Link href={`/seller/${order.seller?.id}`} className="font-medium text-primary hover:underline">
                  {order.seller?.name || 'Seller'}
                </Link>
                <p className="text-sm text-ink-secondary">{order.seller?.phone || order.seller?.email || ''}</p>
              </div>
            </div>
            <RatingBadge
              rating={order.seller?.avgRating || 0}
              reviewCount={order.seller?.totalReviews || 0}
              trustLevel={order.seller?.trustLevel || 'BRONZE'}
            />
            <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => router.push(`/seller/${order.seller?.id}`)}>
              View Seller Profile
            </Button>
          </div>

          {/* Rider Card */}
          {order.rider && (
            <div className="bg-white rounded-lg border border-border p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Rider Information
              </h3>
              <div className="flex items-center gap-3 mb-4">
                {order.rider.profilePhoto ? (
                  <img src={order.rider.profilePhoto} alt={order.rider.name || 'Rider'} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-border flex items-center justify-center">
                    <User className="w-6 h-6 text-ink-secondary" />
                  </div>
                )}
                <div>
                  <h4 className="font-medium">{order.rider.name}</h4>
                  <p className="text-sm text-ink-secondary">{order.rider.phone || order.rider.email || ''}</p>
                </div>
              </div>
              <RatingBadge
                rating={order.rider.avgRating || 0}
                reviewCount={order.rider.totalReviews || 0}
                trustLevel={order.rider.trustLevel || 'BRONZE'}
              />
            </div>
          )}

          {/* ── Dispute card ──────────────────────────────────────────────── */}
          {userRole === 'BUYER' && order.rider && LIVE_TRACKING_STATUSES.includes(order.status) && (
            <div className="bg-white rounded-lg border border-border p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" />
                  Rider Live Map
                </h3>
                {liveTrackingLoading && (
                  <span className="text-xs text-ink-secondary flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading
                  </span>
                )}
              </div>

              {liveTrackingError && (
                <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 mb-3">
                  {liveTrackingError}
                </p>
              )}

              {liveTracking?.latestPoint ? (
                <>
                  <div className="rounded-xl overflow-hidden border border-border mb-3">
                    <iframe
                      title="Rider live location map"
                      src={liveMapUrl || undefined}
                      className="w-full h-56"
                      loading="lazy"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-primary/10 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-primary font-semibold">Last update</p>
                      <p className="text-xs font-semibold text-primary">
                        {format(new Date(liveTracking.latestPoint.at), 'h:mm:ss a')}
                      </p>
                    </div>
                    <div className="bg-primary/10 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-primary font-semibold">Route points</p>
                      <p className="text-xs font-semibold text-primary">{liveTracking.points?.length || 0} captured</p>
                    </div>
                  </div>
                  {openMapUrl && (
                    <a
                      href={openMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/30 text-primary font-semibold text-sm hover:bg-primary/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Google Maps
                    </a>
                  )}
                </>
              ) : (
                <p className="text-sm text-ink-secondary bg-surface border border-border rounded-lg px-3 py-2">
                  Waiting for rider location ping...
                </p>
              )}

              {liveTracking?.checkpoints?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs uppercase tracking-wide text-ink-secondary font-semibold mb-2 flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5" />
                    Delivery checkpoints
                  </p>
                  <div className="space-y-2 max-h-40 overflow-auto">
                    {[...liveTracking.checkpoints].reverse().slice(0, 5).map((checkpoint: any) => (
                      <div key={checkpoint.id} className="flex items-start justify-between gap-2 bg-surface rounded-lg px-3 py-2">
                        <p className="text-xs text-ink-secondary font-medium">{getCheckpointLabel(checkpoint)}</p>
                        <span className="text-[11px] text-ink-secondary whitespace-nowrap">
                          {format(new Date(checkpoint.at), 'h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {order.dispute ? (
            <div className="bg-white rounded-lg border border-warning/30 p-6">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-warning">
                <Shield className="w-5 h-5" />
                Dispute Filed
              </h3>
              <p className="text-sm text-ink-secondary mb-4">
                A dispute has been opened for this order. Track your case and
                communicate with the support team.
              </p>
              <div className="mb-4">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getDisputeStatusBadge(order.dispute.status)}`}>
                  {getDisputeStatusLabel(order.dispute.status)}
                </span>
              </div>
              <Button
                onClick={() => router.push(`/disputes/${order.dispute.id}`)}
                className="w-full bg-warning hover:brightness-95 text-white flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Track Dispute
              </Button>

              {canSellerConfirmReturn() && (
                <Button
                  onClick={handleSellerConfirmReturn}
                  disabled={confirmingReturn}
                  className="w-full mt-3 bg-success hover:brightness-95 text-white flex items-center justify-center gap-2"
                >
                  {confirmingReturn
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</>
                    : <><CheckCircle className="w-4 h-4" /> I Received Returned Item</>
                  }
                </Button>
              )}
            </div>
          ) : (
            userRole === 'BUYER' &&
            (order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
              <div className="bg-white rounded-lg border border-border p-6">
                <h3 className="font-semibold mb-1 flex items-center gap-2 text-ink-secondary">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Something wrong?
                </h3>
                <p className="text-sm text-ink-secondary mb-4">
                  If there's an issue with this order, you can open a dispute
                  within 48 hours of delivery.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/orders/${order.id}/dispute`)}
                  className="w-full border-warning/30 text-warning hover:bg-warning/10"
                >
                  Open a Dispute
                </Button>
              </div>
            )
          )}

          {/* Order Summary */}
          <div className="bg-white rounded-lg border border-border p-6">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-ink-secondary">Subtotal</span>
                <span>₦{(order.productPrice || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-secondary">Delivery Fee</span>
                <span>₦{(order.deliveryFee || 0).toLocaleString()}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-semibold">
                <span>Total</span>
                <span>₦{(order.totalAmount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Review Status Summary */}
          {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
            <div className="bg-white rounded-lg border border-border p-6">
              <h3 className="font-semibold mb-4">Review Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Product Review</span>
                  <span className={`px-2 py-1 rounded text-xs ${order.productReviews?.length > 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {order.productReviews?.length > 0 ? 'Completed' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Seller Review</span>
                  <span className={`px-2 py-1 rounded text-xs ${order.reviews?.some((r: any) => r.type === 'SELLER') ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {order.reviews?.some((r: any) => r.type === 'SELLER') ? 'Completed' : 'Pending'}
                  </span>
                </div>
                {order.rider && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-secondary">Rider Review</span>
                    <span className={`px-2 py-1 rounded text-xs ${order.reviews?.some((r: any) => r.type === 'RIDER') ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {order.reviews?.some((r: any) => r.type === 'RIDER') ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                )}
              </div>
            </div>
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
    </div>
  );
}
