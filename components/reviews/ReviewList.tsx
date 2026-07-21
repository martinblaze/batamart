'use client';

import { Star, User } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string | Date;
  reviewer?: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
  order?: {
    product?: {
      name: string;
    };
  };
}

interface ReviewListProps {
  reviews: Review[];
  emptyMessage?: React.ReactNode;
}

export default function ReviewList({ reviews, emptyMessage }: ReviewListProps) {
  if (reviews.length === 0 && emptyMessage) {
    return <div>{emptyMessage}</div>;
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-ink-secondary">
        <Star className="w-12 h-12 mx-auto mb-2 text-border" />
        <p>No reviews yet</p>
      </div>
    );
  }

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="border border-border rounded-lg p-4">
          {/* Reviewer Info */}
          <div className="flex items-start gap-3 mb-3">
            {review.reviewer?.avatar ? (
              <img
                src={review.reviewer.avatar}
                alt={review.reviewer.name || 'User'}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
                <User className="w-5 h-5 text-ink-secondary" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">
                    {review.reviewer?.name || 'Anonymous'}
                  </h4>
                  <p className="text-sm text-ink-secondary">
                    {formatDate(review.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= review.rating
                          ? 'fill-warning text-warning'
                          : 'text-border'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Review Comment */}
          <p className="text-ink-secondary">{review.comment}</p>

          {/* Product Name (if available) */}
          {review.order?.product?.name && (
            <p className="text-sm text-ink-secondary mt-2">
              Product: {review.order.product.name}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}