'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Star, User, MessageSquare, X } from 'lucide-react';
import { Shell, PageHeader, EmptyState, Skeleton } from '@/components/ui/Shell';
import { Badge } from '@/components/ui/Badge';

/** Five stars at a given size, filled to `value`. */
function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' }[size];
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${dims} ${
            star <= Math.floor(value) ? 'fill-warning text-warning' : 'fill-border text-border'
          }`}
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

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
      const productRes = await fetch(`/api/products/${params.id}`);
      if (productRes.ok) {
        const productData = await productRes.json();
        setProduct(productData.product);
      }

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

  const filteredAndSortedReviews = reviews
    .filter((review) => filterRating === null || review.rating === filterRating)
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'highest') {
        return b.rating - a.rating;
      } else {
        return a.rating - b.rating;
      }
    });

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
    percentage:
      reviews.length > 0
        ? (reviews.filter((r) => r.rating === rating).length / reviews.length) * 100
        : 0,
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell className="pt-8 sm:pt-12">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-6 h-10 w-2/5" />
          <div className="mt-12 grid gap-10 lg:grid-cols-3">
            <Skeleton className="h-96 w-full" />
            <div className="space-y-4 lg:col-span-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </Shell>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-16 sm:pt-24">
          <EmptyState
            icon={MessageSquare}
            title="Product not found"
            description="This listing may have been removed by its seller."
            action={
              <Button variant="ink" onClick={() => router.push('/marketplace')}>
                Back to marketplace
              </Button>
            }
          />
        </Shell>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <Shell className="pt-8 sm:pt-12">
        <PageHeader
          eyebrow="Reviews"
          back={{ href: `/product/${params.id}`, label: 'Back to product' }}
          title={product.name}
          description={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Stars value={product.avgRating || 0} size="md" />
              <span className="ui-figure text-lg text-ink">
                {product.avgRating?.toFixed(1) || '0.0'}
              </span>
              <span className="text-sm text-ink-secondary">
                {product.totalReviews || 0} review{(product.totalReviews || 0) === 1 ? '' : 's'}
              </span>
            </span>
          }
          actions={
            product.images?.[0] ? (
              <div className="h-20 w-20 overflow-hidden border border-border bg-card">
                <img src={product.images[0]} alt="" className="h-full w-full object-cover" />
              </div>
            ) : undefined
          }
        />

        <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-8">
          {/* ── Rating overview ───────────────────────────────────────────── */}
          <aside className="lg:col-span-1">
            <div className="ui-panel lg:sticky lg:top-6">
              <p className="ui-eyebrow mb-7">Overview</p>

              <div className="border-b border-border pb-7 text-center">
                <p className="ui-figure text-[3.5rem] leading-none text-ink">
                  {product.avgRating?.toFixed(1) || '0.0'}
                </p>
                <div className="mt-4 flex justify-center">
                  <Stars value={product.avgRating || 0} size="lg" />
                </div>
                <p className="ui-mono ui-mono-sm mt-4 text-ink-muted">
                  Based on {reviews.length} review{reviews.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="space-y-2.5 border-b border-border py-7">
                {ratingDistribution.map(({ rating, count, percentage }) => (
                  <button
                    key={rating}
                    onClick={() => setFilterRating(filterRating === rating ? null : rating)}
                    className="group flex w-full items-center gap-3 text-left"
                    aria-pressed={filterRating === rating}
                  >
                    <span className="ui-mono ui-mono-sm flex w-6 items-center gap-1 text-ink-muted">
                      {rating}
                    </span>
                    <Star className="h-3 w-3 flex-shrink-0 fill-warning text-warning" strokeWidth={0} />
                    <div className="h-[3px] flex-1 overflow-hidden bg-surface">
                      <div
                        className="h-full bg-warning transition-[width] duration-700 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="ui-mono ui-mono-sm w-6 text-right text-ink-muted transition-colors group-hover:text-ink">
                      {count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="border-b border-border py-7">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="ui-mono ui-mono-sm text-ink">Filter</p>
                  {filterRating !== null && (
                    <button
                      onClick={() => setFilterRating(null)}
                      className="ui-mono ui-mono-sm inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-ink"
                    >
                      <X className="h-3 w-3" strokeWidth={2} />
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <button
                      key={rating}
                      onClick={() => setFilterRating(filterRating === rating ? null : rating)}
                      data-active={filterRating === rating}
                      className="ui-chip"
                    >
                      {rating}
                      <Star className="h-3 w-3" fill="currentColor" strokeWidth={0} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-7">
                <label className="ui-mono ui-mono-sm mb-3 block text-ink">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-10 w-full border border-border bg-card px-3 text-sm text-ink transition-colors hover:border-ink/25 focus:border-ink/40 focus:outline-none"
                >
                  <option value="recent">Most recent</option>
                  <option value="highest">Highest rating</option>
                  <option value="lowest">Lowest rating</option>
                </select>
              </div>
            </div>
          </aside>

          {/* ── Review list ───────────────────────────────────────────────── */}
          <section className="lg:col-span-2">
            <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
              <h2 className="text-[clamp(1.15rem,2.2vw,1.45rem)] leading-tight text-ink">
                {filteredAndSortedReviews.length} review
                {filteredAndSortedReviews.length === 1 ? '' : 's'}
              </h2>
              {filterRating !== null && (
                <span className="ui-mono ui-mono-sm text-ink-muted">
                  Filtered to {filterRating} star{filterRating === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {filteredAndSortedReviews.length > 0 ? (
              <div className="ui-divide mt-2">
                {filteredAndSortedReviews.map((review) => (
                  <article key={review.id} className="py-7">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3.5">
                        {review.reviewer?.profilePhoto ? (
                          <img
                            src={review.reviewer.profilePhoto}
                            alt=""
                            className="h-11 w-11 flex-shrink-0 object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border bg-card">
                            <User className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">
                            {review.reviewer?.name || 'Anonymous'}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Stars value={review.rating} />
                            <span className="ui-mono ui-mono-sm text-ink-muted">
                              {new Date(review.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Badge status="success">Verified purchase</Badge>
                    </div>

                    {review.comment && (
                      <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-ink-secondary">
                        {review.comment}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                className="mt-8"
                icon={MessageSquare}
                title={reviews.length === 0 ? 'No reviews yet' : 'No reviews match that filter'}
                description={
                  reviews.length === 0
                    ? 'Be the first to review this product once your order arrives.'
                    : 'Try a different star rating, or clear the filter to see everything.'
                }
                action={
                  filterRating !== null ? (
                    <Button variant="secondary" onClick={() => setFilterRating(null)}>
                      Clear filter
                    </Button>
                  ) : undefined
                }
              />
            )}
          </section>
        </div>
      </Shell>
    </div>
  );
}
