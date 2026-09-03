'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CheckCircle2, User } from 'lucide-react';
import { Shell, EmptyState } from '@/components/ui/Shell';
import { ReviewComposer, ReviewSubject } from '@/components/reviews/ReviewComposer';

interface Seller {
  id: string;
  name: string;
  profilePhoto?: string;
  email?: string;
}

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
  seller: Seller;
  reviews?: any[];
}

export default function ReviewSellerPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

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

        // Check if seller already reviewed
        const hasSellerReview = data.reviews && data.reviews.some((r: any) => r.type === 'SELLER');
        if (hasSellerReview) {
          setError('You have already reviewed this seller. Redirecting…');
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

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orderId: params.id,
          type: 'SELLER',
          rating,
          comment: comment || '',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // An alert() here interrupted the last step of the flow; show the
        // confirmation in place instead, then hand off to the orders list.
        setDone(true);
        setTimeout(() => router.push('/orders'), 1800);
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

  if (done) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-16 sm:pt-24">
          <div className="flex flex-col items-center border border-border bg-card px-6 py-20 text-center">
            <CheckCircle2 className="mb-6 h-10 w-10 text-success" strokeWidth={1.5} />
            <p className="ui-eyebrow mb-4 justify-center before:hidden after:hidden">Thank you</p>
            <h1 className="text-[clamp(1.5rem,4vw,2rem)] leading-tight text-ink">
              Your review is in
            </h1>
            <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-ink-secondary">
              Feedback like yours is what keeps campus sellers accountable. Taking you back to your
              orders…
            </p>
          </div>
        </Shell>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-16 sm:pt-24">
          <EmptyState
            icon={User}
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
      eyebrow="Step 02 — Seller"
      title={
        <>
          Rate the <span className="ui-serif">seller</span>
        </>
      }
      standfirst={`How was dealing with ${order.seller?.name || 'this seller'}? Communication, packaging, and whether the item matched the listing.`}
      backHref={`/orders/${params.id}`}
      subject={
        <ReviewSubject
          round
          image={order.seller?.profilePhoto}
          name={order.seller?.name || 'Seller'}
          meta={
            <>
              {order.seller?.email && <p>{order.seller.email}</p>}
              <p>Ordered: {order.product?.name}</p>
            </>
          }
        />
      }
      ratingQuestion="How would you rate this seller?"
      commentPlaceholder="Was communication good? Did the item match the description? Would you buy from them again?"
      rating={rating}
      onRatingChange={setRating}
      comment={comment}
      onCommentChange={setComment}
      error={error}
      submitting={submitting}
      submitLabel="Submit review"
      onSubmit={submitReview}
      onSkip={skipReview}
      benefitsTitle="Why this matters"
      benefits={[
        'Sets the standard other sellers on campus are held to.',
        'Recognises the people who consistently get it right.',
        'Gives buyers a reason to trust someone they have never met.',
      ]}
    />
  );
}
