'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { Shell, EmptyState } from '@/components/ui/Shell';
import { ReviewComposer, ReviewSubject } from '@/components/reviews/ReviewComposer';

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
          setError('You have already reviewed this product. Redirecting…');
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
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-ink" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-16 sm:pt-24">
          <EmptyState
            icon={Package}
            title="Order not found"
            description="This order doesn't exist, or it isn't one you have access to."
            action={
              <Button variant="ink" onClick={() => router.push('/orders')}>
                Back to orders
              </Button>
            }
          />
        </Shell>
      </div>
    );
  }

  return (
    <ReviewComposer
      eyebrow="Step 01 — Product"
      title={
        <>
          Rate the <span className="ui-serif">product</span>
        </>
      }
      standfirst={`How did ${order.product?.name || 'this item'} hold up? Your rating is what other students on campus see first.`}
      backHref={`/orders/${params.id}`}
      subject={
        <ReviewSubject
          image={order.product?.images?.[0]}
          name={order.product?.name || 'Product'}
          meta={
            <>
              <p>Order #{order.id.slice(-8)}</p>
              <p className="ui-figure text-[15px] text-ink">
                ₦{order.totalAmount?.toLocaleString()}
              </p>
            </>
          }
        />
      }
      ratingQuestion="How would you rate this product?"
      commentPlaceholder="What did you like or dislike? Did it match the listing?"
      rating={rating}
      onRatingChange={setRating}
      comment={comment}
      onCommentChange={setComment}
      error={error}
      submitting={submitting}
      submitLabel="Submit & review the seller"
      onSubmit={submitReview}
      onSkip={skipReview}
      benefitsTitle="Why this matters"
      benefits={[
        'Helps other students decide before they spend.',
        'Gives the seller specific feedback they can act on.',
        'Keeps the marketplace honest for everyone on campus.',
      ]}
    />
  );
}
