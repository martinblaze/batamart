'use client';

import { Star } from 'lucide-react';

interface ReviewStatsProps {
  avgRating: number;
  totalReviews: number;
  distribution?: Array<{ rating: number; count: number }>;
}

export default function ReviewStats({ 
  avgRating, 
  totalReviews, 
  distribution = [] 
}: ReviewStatsProps) {
  // Ensure distribution has all 5 ratings
  const fullDistribution = Array.from({ length: 5 }, (_, i) => {
    const rating = i + 1;
    const existing = distribution.find(d => d.rating === rating);
    return {
      rating,
      count: existing?.count || 0,
      percentage: totalReviews > 0 ? ((existing?.count || 0) / totalReviews) * 100 : 0,
    };
  }).reverse(); // Show 5 stars first

  return (
    <div className="bg-white rounded-lg border border-border p-6">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Average Rating */}
        <div className="text-center">
          <div className="text-5xl font-semibold text-ink mb-2">
            {avgRating.toFixed(1)}
          </div>
          <div className="flex justify-center mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-6 h-6 ${
                  star <= Math.round(avgRating)
                    ? 'fill-warning text-warning'
                    : 'text-border'
                }`}
              />
            ))}
          </div>
          <div className="text-ink-secondary">
            Based on {totalReviews} review{totalReviews !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Rating Distribution */}
        <div className="md:col-span-2">
          <h3 className="font-semibold mb-4 text-ink">Rating Distribution</h3>
          <div className="space-y-2">
            {fullDistribution.map(({ rating, count, percentage }) => (
              <div key={rating} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-20">
                  <span className="text-sm w-6 text-ink">{rating}</span>
                  <Star className="w-4 h-4 fill-warning text-warning" />
                </div>
                <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-warning rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-sm text-ink-secondary w-12">
                  {count} ({percentage.toFixed(0)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
        <div className="text-center">
          <div className="text-2xl font-semibold text-primary">
            {Math.round((avgRating / 5) * 100)}%
          </div>
          <div className="text-sm text-ink-secondary">Satisfaction</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-primary">
            {Math.round((fullDistribution[4]?.percentage || 0))}%
          </div>
          <div className="text-sm text-ink-secondary">5-Star Ratings</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-primary">
            {Math.round((fullDistribution[3]?.percentage || 0) + (fullDistribution[4]?.percentage || 0))}%
          </div>
          <div className="text-sm text-ink-secondary">4+ Stars</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-semibold text-primary">
            {totalReviews}
          </div>
          <div className="text-sm text-ink-secondary">Total Reviews</div>
        </div>
      </div>
    </div>
  );
}