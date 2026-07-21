'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  Star,
  User,
  MessageSquare,
  TrendingUp,
  Filter,
  X
} from 'lucide-react';

export default function ProductReviewsPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent');

  useEffect(() => {
    if (params.id) {
      fetchProductAndReviews();
    }
  }, [params.id]);

  const fetchProductAndReviews = async () => {
    try {
      // Fetch product details
      const productRes = await fetch(`/api/products/${params.id}`);
      if (productRes.ok) {
        const productData = await productRes.json();
        setProduct(productData.product);
      }

      // Fetch reviews
      const reviewsRes = await fetch(`/api/reviews/product?productId=${params.id}`);
      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        setReviews(reviewsData.reviews || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort reviews
  const filteredAndSortedReviews = reviews
    .filter(review => filterRating === null || review.rating === filterRating)
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'highest') {
        return b.rating - a.rating;
      } else {
        return a.rating - b.rating;
      }
    });

  // Calculate rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
    percentage: reviews.length > 0 ? (reviews.filter(r => r.rating === rating).length / reviews.length) * 100 : 0
  }));

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-border rounded w-1/3"></div>
          <div className="h-64 bg-border rounded"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-border rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-semibold mb-4">Product Not Found</h1>
        <Button onClick={() => router.push('/marketplace')}>
          Back to Marketplace
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Back button */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push(`/product/${params.id}`)}
          className="group transition-all duration-200 hover:bg-surface hover:pl-4"
        >
          <ChevronLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
          Back to Product
        </Button>
      </div>

      {/* Product Header */}
      <div className="bg-white rounded-2xl border p-6 mb-8 shadow-soft">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-border flex-shrink-0">
            <img
              src={product.images?.[0] || '/placeholder.png'}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-ink mb-2">{product.name}</h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${star <= Math.floor(product.avgRating || 0)
                          ? 'fill-warning text-warning'
                          : 'text-ink-muted'
                        }`}
                    />
                  ))}
                </div>
                <span className="text-xl font-semibold">{product.avgRating?.toFixed(1) || '0.0'}</span>
                <span className="text-ink-secondary">({product.totalReviews || 0} reviews)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Sidebar - Rating Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border p-6 sticky top-24 shadow-soft">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Rating Overview
            </h2>

            {/* Average Rating */}
            <div className="text-center mb-8 pb-8 border-b">
              <div className="text-5xl font-semibold text-ink mb-2">
                {product.avgRating?.toFixed(1) || '0.0'}
              </div>
              <div className="flex justify-center mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-6 h-6 ${star <= Math.floor(product.avgRating || 0)
                        ? 'fill-warning text-warning'
                        : 'text-ink-muted'
                      }`}
                  />
                ))}
              </div>
              <p className="text-ink-secondary">Based on {reviews.length} reviews</p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-3 mb-8">
              {ratingDistribution.map(({ rating, count, percentage }) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-16">
                    <span className="text-sm font-medium">{rating}</span>
                    <Star className="w-4 h-4 fill-warning text-warning" />
                  </div>
                  <div className="flex-1 bg-border rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-warning h-full rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-ink-secondary w-12 text-right">{count}</span>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter by Rating
                </h3>
                {filterRating !== null && (
                  <button
                    onClick={() => setFilterRating(null)}
                    className="text-xs text-primary hover:brightness-90 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setFilterRating(filterRating === rating ? null : rating)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${filterRating === rating
                        ? 'bg-primary text-white'
                        : 'bg-surface text-ink-secondary hover:bg-border'
                      }`}
                  >
                    {rating} <Star className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />
                  </button>
                ))}
              </div>
            </div>

            {/* Sort */}
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-sm mb-3">Sort By</h3>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              >
                <option value="recent">Most Recent</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Side - Reviews List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border p-6 shadow-soft">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-primary" />
                All Reviews ({filteredAndSortedReviews.length})
              </h2>
            </div>

            {filteredAndSortedReviews.length > 0 ? (
              <div className="space-y-6">
                {filteredAndSortedReviews.map((review) => (
                  <div
                    key={review.id}
                    className="pb-6 border-b last:border-b-0 last:pb-0 hover:bg-surface -mx-6 px-6 py-6 rounded-xl transition-colors duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        {review.reviewer?.profilePhoto ? (
                          <img
                            src={review.reviewer.profilePhoto}
                            alt={review.reviewer.name}
                            className="w-12 h-12 rounded-full border-2 border-border"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center border-2 border-white">
                            <User className="w-6 h-6 text-ink-secondary" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-ink">
                            {review.reviewer?.name || 'Anonymous'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${star <= review.rating
                                      ? 'fill-warning text-warning'
                                      : 'text-ink-muted'
                                    }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-ink-secondary">
                              {new Date(review.createdAt).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-success/10 text-success rounded-full text-xs font-medium border border-success/30">
                        Verified Purchase
                      </div>
                    </div>
                    <p className="text-ink-secondary leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <MessageSquare className="w-16 h-16 mx-auto text-ink-muted mb-4" />
                <h3 className="text-xl font-medium text-ink-secondary mb-2">
                  No reviews match your filter
                </h3>
                <p className="text-ink-secondary max-w-md mx-auto mb-4">
                  Try adjusting your filters to see more reviews
                </p>
                <Button
                  variant="outline"
                  onClick={() => setFilterRating(null)}
                  className="rounded-xl"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}