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
        router.push('/login');
        return;
      }

      const response = await fetch(`/api/orders/${params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(data);
      } else if (response.status === 401 || response.status === 403) {
        router.push('/login');
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'PROCESSING': return <Package className="w-5 h-5 text-blue-500" />;
      case 'SHIPPED': return <Truck className="w-5 h-5 text-purple-500" />;
      case 'RIDER_ASSIGNED': return <Truck className="w-5 h-5 text-indigo-500" />;
      case 'PICKED_UP': return <Package className="w-5 h-5 text-orange-500" />;
      case 'ON_THE_WAY': return <Truck className="w-5 h-5 text-blue-500" />;
      case 'DELIVERED': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'COMPLETED': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'CANCELLED': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'DISPUTED': return <XCircle className="w-5 h-5 text-orange-500" />;
      default: return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'SHIPPED': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'RIDER_ASSIGNED': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'PICKED_UP': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'ON_THE_WAY': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DELIVERED': return 'bg-green-100 text-green-800 border-green-200';
      case 'COMPLETED': return 'bg-green-100 text-green-900 border-green-300';
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
      case 'DISPUTED': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusActions = () => {
    if (!order) return [];
    const actions = [];
    const userRole = getCurrentUserRole();

    if (userRole === 'SELLER') {
      if (order.status === 'PENDING') {
        actions.push({ label: 'Process Order', status: 'PROCESSING', variant: 'primary' });
      }
      if (order.status === 'PROCESSING') {
        actions.push({ label: 'Mark as Shipped', status: 'SHIPPED', variant: 'primary' });
      }
    }

    if (userRole === 'RIDER') {
      if (order.status === 'SHIPPED') {
        actions.push({ label: 'Mark as Delivered', status: 'DELIVERED', variant: 'success' });
      }
    }

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
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded mb-6"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // ── Network / server error state ───────────────────────────────────────────
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-lg text-center">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8">
          <WifiOff className="w-14 h-14 mx-auto text-red-400 mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Couldn't Load Order</h1>
          <p className="text-gray-500 mb-6 text-sm leading-relaxed">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => fetchOrder()} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => router.push('/orders')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
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
        <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
        <p className="text-gray-600 mb-6">The order you're looking for doesn't exist or you don't have access to it.</p>
        <Button onClick={() => router.push('/orders')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Orders
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
    if (s === 'OPEN') return 'bg-blue-100 text-blue-700'
    if (s === 'UNDER_REVIEW') return 'bg-amber-100 text-amber-700'
    if (s.startsWith('RESOLVED')) return 'bg-emerald-100 text-emerald-700'
    if (s === 'DISMISSED') return 'bg-gray-100 text-gray-600'
    return 'bg-gray-100 text-gray-600'
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
      <Button variant="ghost" onClick={() => router.push('/orders')} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Orders
      </Button>

      {/* Inline update error banner — replaces alert() */}
      {updateError && (
        <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Action Failed</p>
            <p className="text-sm text-red-700 mt-0.5">{updateError}</p>
          </div>
          <button
            onClick={() => setUpdateError(null)}
            className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* Order header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">
            Order #{order.orderNumber || order.id.slice(-8)}
          </h1>
          <div className="flex items-center gap-4 flex-wrap">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(order.status)}`}>
              {getStatusIcon(order.status)}
              <span className="font-medium">{order.status.replace(/_/g, ' ')}</span>
            </div>

            {isPolling && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Live
              </div>
            )}

            <div className="flex items-center gap-2 text-gray-600">
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Order Progress</h2>
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-4 h-0.5 bg-gray-200 z-0" />
            <div
              className="absolute left-0 top-4 h-0.5 bg-BATAMART-primary z-0 transition-all duration-500"
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
              { key: 'PENDING', label: 'Placed', icon: '🛒' },
              { key: 'PROCESSING', label: 'Confirmed', icon: '✅' },
              { key: 'PICKED_UP', label: 'Picked Up', icon: '📦' },
              { key: 'ON_THE_WAY', label: 'On Way', icon: '🛵' },
              { key: 'DELIVERED', label: 'Delivered', icon: '🎉' },
            ].map((step) => {
              const statusOrder = ['PENDING', 'PROCESSING', 'SHIPPED', 'RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED']
              const currentIdx = statusOrder.indexOf(order.status)
              const stepIdx = statusOrder.indexOf(step.key)
              const isDone = currentIdx >= stepIdx
              return (
                <div key={step.key} className="flex flex-col items-center z-10 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all ${isDone
                      ? 'bg-BATAMART-primary border-BATAMART-primary text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                    {step.icon}
                  </div>
                  <p className={`text-[10px] font-semibold mt-1.5 text-center ${isDone ? 'text-BATAMART-primary' : 'text-gray-400'}`}>
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
          <div className="bg-white rounded-lg border p-6">
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
                <h3 className="font-bold text-lg">{order.product?.name || 'Product'}</h3>
                <p className="text-gray-600 mt-1">{order.product?.description || 'No description'}</p>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <p className="text-sm text-gray-500">Price</p>
                    <p className="font-bold">₦{(order.productPrice || order.product?.price || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Quantity</p>
                    <p className="font-bold">{order.quantity || 1}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="font-bold">₦{((order.productPrice || order.product?.price || 0) * (order.quantity || 1)).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping & Payment */}
          <div className="grid md:grid-cols-2 gap-6">

            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Shipping Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Hostel</p>
                  <p className="font-medium">{order.deliveryHostel || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Room</p>
                  <p className="font-medium">{order.deliveryRoom || 'Not specified'}</p>
                </div>
                {order.deliveryLandmark && (
                  <div>
                    <p className="text-sm text-gray-500">Landmark</p>
                    <p className="font-medium">{order.deliveryLandmark}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{order.deliveryPhone || 'Not specified'}</p>
                </div>
                {order.orderNote && (
                  <div>
                    <p className="text-sm text-gray-500">Note to rider</p>
                    <p className="font-medium text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-sm">{order.orderNote}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Subtotal</p>
                  <p className="font-medium">₦{(order.productPrice || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Delivery Fee</p>
                  <p className="font-medium">₦{(order.deliveryFee || 0).toLocaleString()}</p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-gray-500">Total Paid</p>
                  <p className="font-bold text-lg">₦{(order.totalAmount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Status</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {order.isPaid ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-green-600">Paid</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <span className="font-medium text-yellow-600">Pending</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Reviews & Feedback
              </h2>

              <div className="flex items-center justify-between p-4 border rounded-lg mb-4 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Package className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Rate this Product</h3>
                    <p className="text-sm text-gray-600">Share your experience with {order.product?.name}</p>
                  </div>
                </div>
                {canReviewProduct ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => router.push(`/orders/${order.id}/review-product`)}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
                    >
                      <Star className="w-4 h-4" /> Review Product
                    </Button>
                    <Button variant="ghost" onClick={() => setReviewModal({ isOpen: true, type: 'PRODUCT' })}>
                      Quick Review
                    </Button>
                  </div>
                ) : order.productReviews?.length > 0 ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Product Reviewed
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">Review not available</span>
                )}
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Rate the Seller</h3>
                    <p className="text-sm text-gray-600">How was your experience with {order.seller?.name || 'the seller'}?</p>
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
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Seller Reviewed
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">Complete product review first</span>
                )}
              </div>

              {order.rider && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <Truck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-medium">Rate the Rider</h3>
                      <p className="text-sm text-gray-600">How was your delivery with {order.rider.name}?</p>
                    </div>
                  </div>
                  {canReviewRider ? (
                    <Button onClick={() => setReviewModal({ isOpen: true, type: 'RIDER' })} className="flex items-center gap-2">
                      <Star className="w-4 h-4" /> Review Rider
                    </Button>
                  ) : order.reviews?.some((r: any) => r.type === 'RIDER') ? (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Rider Reviewed
                    </span>
                  ) : (
                    <span className="text-gray-500 text-sm">Review not available</span>
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
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Buyer Information
            </h3>
            <div className="flex items-center gap-3">
              {order.buyer?.profilePhoto ? (
                <img src={order.buyer.profilePhoto} alt={order.buyer.name || 'Buyer'} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
              )}
              <div>
                <h4 className="font-medium">{order.buyer?.name || 'Anonymous'}</h4>
                <p className="text-sm text-gray-600">{order.buyer?.phone || order.buyer?.email || ''}</p>
              </div>
            </div>
          </div>

          {/* Seller Card */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Seller Information
            </h3>
            <div className="flex items-center gap-3 mb-4">
              {order.seller?.profilePhoto ? (
                <img src={order.seller.profilePhoto} alt={order.seller.name || 'Seller'} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
              )}
              <div>
                <Link href={`/seller/${order.seller?.id}`} className="font-medium text-blue-600 hover:underline">
                  {order.seller?.name || 'Seller'}
                </Link>
                <p className="text-sm text-gray-600">{order.seller?.phone || order.seller?.email || ''}</p>
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
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Rider Information
              </h3>
              <div className="flex items-center gap-3 mb-4">
                {order.rider.profilePhoto ? (
                  <img src={order.rider.profilePhoto} alt={order.rider.name || 'Rider'} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div>
                  <h4 className="font-medium">{order.rider.name}</h4>
                  <p className="text-sm text-gray-600">{order.rider.phone || order.rider.email || ''}</p>
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
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-blue-600" />
                  Rider Live Map
                </h3>
                {liveTrackingLoading && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading
                  </span>
                )}
              </div>

              {liveTrackingError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                  {liveTrackingError}
                </p>
              )}

              {liveTracking?.latestPoint ? (
                <>
                  <div className="rounded-xl overflow-hidden border border-gray-200 mb-3">
                    <iframe
                      title="Rider live location map"
                      src={liveMapUrl || undefined}
                      className="w-full h-56"
                      loading="lazy"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-blue-50 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-blue-600 font-semibold">Last update</p>
                      <p className="text-xs font-bold text-blue-800">
                        {format(new Date(liveTracking.latestPoint.at), 'h:mm:ss a')}
                      </p>
                    </div>
                    <div className="bg-violet-50 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-violet-600 font-semibold">Route points</p>
                      <p className="text-xs font-bold text-violet-800">{liveTracking.points?.length || 0} captured</p>
                    </div>
                  </div>
                  {openMapUrl && (
                    <a
                      href={openMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-blue-200 text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open in Google Maps
                    </a>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  Waiting for rider location ping...
                </p>
              )}

              {liveTracking?.checkpoints?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2 flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5" />
                    Delivery checkpoints
                  </p>
                  <div className="space-y-2 max-h-40 overflow-auto">
                    {[...liveTracking.checkpoints].reverse().slice(0, 5).map((checkpoint: any) => (
                      <div key={checkpoint.id} className="flex items-start justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-700 font-medium">{getCheckpointLabel(checkpoint)}</p>
                        <span className="text-[11px] text-gray-500 whitespace-nowrap">
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
            <div className="bg-white rounded-lg border border-orange-200 p-6">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-orange-700">
                <Shield className="w-5 h-5" />
                Dispute Filed
              </h3>
              <p className="text-sm text-gray-500 mb-4">
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
                className="w-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Track Dispute
              </Button>

              {canSellerConfirmReturn() && (
                <Button
                  onClick={handleSellerConfirmReturn}
                  disabled={confirmingReturn}
                  className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2"
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
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold mb-1 flex items-center gap-2 text-gray-700">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Something wrong?
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  If there's an issue with this order, you can open a dispute
                  within 48 hours of delivery.
                </p>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/orders/${order.id}/dispute`)}
                  className="w-full border-orange-300 text-orange-600 hover:bg-orange-50"
                >
                  Open a Dispute
                </Button>
              </div>
            )
          )}

          {/* Order Summary */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>₦{(order.productPrice || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Fee</span>
                <span>₦{(order.deliveryFee || 0).toLocaleString()}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>₦{(order.totalAmount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Review Status Summary */}
          {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-4">Review Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Product Review</span>
                  <span className={`px-2 py-1 rounded text-xs ${order.productReviews?.length > 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {order.productReviews?.length > 0 ? 'Completed ✓' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Seller Review</span>
                  <span className={`px-2 py-1 rounded text-xs ${order.reviews?.some((r: any) => r.type === 'SELLER') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {order.reviews?.some((r: any) => r.type === 'SELLER') ? 'Completed ✓' : 'Pending'}
                  </span>
                </div>
                {order.rider && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Rider Review</span>
                    <span className={`px-2 py-1 rounded text-xs ${order.reviews?.some((r: any) => r.type === 'RIDER') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {order.reviews?.some((r: any) => r.type === 'RIDER') ? 'Completed ✓' : 'Pending'}
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
