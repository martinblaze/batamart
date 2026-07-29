'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Star, ArrowLeft, Package, CheckCircle, AlertCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  images: string[];
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  product: Product;
  productReviews?: any[];
}

export default function ReviewProductPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      const response = await fetch(`/api/orders/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(data);

        // Check if product already reviewed
        const hasProductReview = data.productReviews && data.productReviews.length > 0;
        if (hasProductReview) {
          setError('You have already reviewed this product. Redirecting...');
          setTimeout(() => {
            router.push('/orders');
          }, 3000);
        }
      } else {
        setError('Failed to load order details');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      const response = await fetch('/api/reviews/product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: params.id,
          productId: order?.product?.id,
          rating,
          comment: comment || '',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirect to review seller page
        router.push(`/orders/${params.id}/review-seller`);
      } else {
        setError(data.error || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      setError('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const skipReview = () => {
    router.push('/orders');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Package className="w-16 h-16 mx-auto text-ink-muted mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Order Not Found</h1>
        <p className="text-ink-secondary mb-6">The order you're looking for doesn't exist.</p>
        <Button onClick={() => router.push('/orders')} className="mt-4">
          Back to Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-[#000000] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push(`/orders/${params.id}`)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Order
        </Button>

        <div className="bg-white rounded-2xl shadow-soft p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-primary/10 rounded-full">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-ink">Review Product</h1>
              <p className="text-ink-secondary">
                Share your experience with {order.product?.name}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg">
              <div className="flex items-center gap-2 text-danger">
                <AlertCircle className="w-5 h-5" />
                <p className="font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Product Info */}
          <div className="bg-surface rounded-xl p-6 mb-8">
            <div className="flex items-center gap-4">
              <img
                src={order.product?.images?.[0] || '/placeholder.png'}
                alt={order.product?.name}
                className="w-20 h-20 object-cover rounded-lg border-2 border-white shadow-soft"
              />
              <div>
                <h3 className="font-semibold text-lg text-ink">{order.product?.name}</h3>
                <p className="text-ink-secondary text-sm mt-1">
                  Order #{order.id.slice(-8)}
                </p>
                <p className="text-primary font-semibold text-lg mt-1">
                  ₦{order.totalAmount?.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Rating Section */}
          <div className="mb-8">
            <h3 className="font-semibold text-ink mb-4">
              How would you rate this product?
            </h3>
            <div className="flex gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-2 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`w-12 h-12 ${star <= (hoverRating || rating)
                        ? 'fill-warning text-warning'
                        : 'text-ink-muted'
                      }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-ink-secondary text-sm">
              {rating === 0 ? 'Select a rating' : `You rated ${rating} star${rating > 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Comment Section */}
          <div className="mb-8">
            <h3 className="font-semibold text-ink mb-4">
              Tell us more about your experience (Optional)
            </h3>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you like or dislike about this product? Did it meet your expectations?"
              className="w-full h-32 p-4 border border-border rounded-lg focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none"
              maxLength={300}
            />
            <div className="flex justify-end mt-2">
              <p className="text-sm text-ink-secondary">
                {comment.length}/300 characters
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={skipReview}
              className="flex-1 py-3 text-ink-secondary hover:text-ink"
            >
              Skip Review
            </Button>
            <Button
              onClick={submitReview}
              disabled={submitting || rating === 0}
              className="flex-1 py-3 bg-primary hover:brightness-95 text-white font-semibold"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Submitting...
                </>
              ) : (
                'Submit & Continue to Seller Review'
              )}
            </Button>
          </div>

          {/* Review Benefits */}
          <div className="mt-8 pt-8 border-t border-border">
            <h4 className="font-semibold text-ink mb-3">Why Your Review Matters</h4>
            <ul className="space-y-2 text-sm text-ink-secondary">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                Help other students make informed purchasing decisions
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                Provide valuable feedback to sellers
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                Build a trustworthy marketplace community
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
