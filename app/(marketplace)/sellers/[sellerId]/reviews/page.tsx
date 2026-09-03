'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { MessageSquare, Star, User, WifiOff } from 'lucide-react'
import { Shell, PageHeader, EmptyState, Skeleton } from '@/components/ui/Shell'
import { Badge } from '@/components/ui/Badge'

/** Shape returned by GET /api/sellers/[sellerId]/reviews. */
interface SellerReview {
  id: string
  user: string
  avatar: string | null
  rating: number
  comment: string | null
  createdAt: string
  orderNumber: string | null
}

function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const dims = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5'
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
  )
}

export default function SellerReviewsPage() {
  const { sellerId } = useParams() as { sellerId: string }
  const [reviews, setReviews] = useState<SellerReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch(`/api/sellers/${sellerId}/reviews`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        setReviews(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Failed to fetch reviews:', err)
        setError('Could not load reviews. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    if (sellerId) fetchReviews()
  }, [sellerId])

  const average =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0

  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((r) => r.rating === rating).length,
    percentage:
      reviews.length > 0
        ? (reviews.filter((r) => r.rating === rating).length / reviews.length) * 100
        : 0,
  }))

  if (loading) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell className="pt-8 sm:pt-12">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-6 h-10 w-2/5" />
          <div className="mt-12 grid gap-10 lg:grid-cols-3">
            <Skeleton className="h-72 w-full" />
            <div className="space-y-4 lg:col-span-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </Shell>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface pb-20">
        <Shell width="narrow" className="pt-16 sm:pt-24">
          <EmptyState
            icon={WifiOff}
            title="Couldn't load reviews"
            description={error}
            action={
              <Link
                href={`/seller/${sellerId}`}
                className="inline-flex items-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-ink/90"
              >
                Back to seller
              </Link>
            }
          />
        </Shell>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface pb-20">
      <Shell className="pt-8 sm:pt-12">
        <PageHeader
          eyebrow="Seller feedback"
          back={{ href: `/seller/${sellerId}`, label: 'Back to seller' }}
          title={
            <>
              What buyers <span className="ui-serif">say</span>
            </>
          }
          description={
            reviews.length > 0
              ? `${reviews.length} verified review${reviews.length === 1 ? '' : 's'} from completed orders.`
              : 'No reviews have been left for this seller yet.'
          }
        />

        {reviews.length === 0 ? (
          <EmptyState
            className="mt-12"
            icon={MessageSquare}
            title="No reviews yet"
            description="Once buyers complete orders with this seller, their feedback shows up here."
            action={
              <Link
                href={`/seller/${sellerId}/products`}
                className="inline-flex items-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-ink/90"
              >
                Browse their catalogue
              </Link>
            }
          />
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-8">
            <aside>
              <div className="ui-panel lg:sticky lg:top-6">
                <p className="ui-eyebrow mb-7">Overview</p>

                <div className="border-b border-border pb-7 text-center">
                  <p className="ui-figure text-[3.5rem] leading-none text-ink">
                    {average.toFixed(1)}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <Stars value={average} size="lg" />
                  </div>
                  <p className="ui-mono ui-mono-sm mt-4 text-ink-muted">
                    {reviews.length} review{reviews.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="space-y-2.5 pt-7">
                  {distribution.map(({ rating, count, percentage }) => (
                    <div key={rating} className="flex items-center gap-3">
                      <span className="ui-mono ui-mono-sm w-2 text-ink-muted">{rating}</span>
                      <Star
                        className="h-3 w-3 flex-shrink-0 fill-warning text-warning"
                        strokeWidth={0}
                      />
                      <div className="h-[3px] flex-1 overflow-hidden bg-surface">
                        <div
                          className="h-full bg-warning transition-[width] duration-700 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="ui-mono ui-mono-sm w-6 text-right text-ink-muted">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="lg:col-span-2">
              <div className="ui-divide">
                {reviews.map((review) => (
                  <article key={review.id} className="py-7 first:pt-0">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3.5">
                        {review.avatar ? (
                          <img
                            src={review.avatar}
                            alt=""
                            className="h-11 w-11 flex-shrink-0 object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border bg-card">
                            <User className="h-5 w-5 text-ink-muted" strokeWidth={1.5} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">{review.user}</p>
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

                      {review.orderNumber && (
                        <Badge status="neutral">#{review.orderNumber}</Badge>
                      )}
                    </div>

                    {review.comment && (
                      <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-ink-secondary">
                        {review.comment}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </Shell>
    </div>
  )
}
