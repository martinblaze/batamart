'use client';

import { Star, Shield } from 'lucide-react';

interface RatingBadgeProps {
  rating: number;
  reviewCount: number;
  trustLevel?: string;
  size?: 'sm' | 'md' | 'lg';
  showTrustLevel?: boolean;
}

export default function RatingBadge({
  rating,
  reviewCount,
  trustLevel,
  size = 'md',
  showTrustLevel = true,
}: RatingBadgeProps) {
  const sizeClasses = {
    sm: {
      star: 'w-3 h-3',
      text: 'text-xs',
      badge: 'px-2 py-0.5 text-xs',
    },
    md: {
      star: 'w-4 h-4',
      text: 'text-sm',
      badge: 'px-2 py-1 text-sm',
    },
    lg: {
      star: 'w-5 h-5',
      text: 'text-base',
      badge: 'px-3 py-1 text-base',
    },
  };

  const trustLevelColors = {
    BRONZE: 'bg-surface text-ink-secondary border-border',
    SILVER: 'bg-surface text-ink-secondary border-border',
    GOLD: 'bg-warning/10 text-warning border-warning/30',
    VERIFIED: 'bg-success/10 text-success border-success/30',
  };

  const classes = sizeClasses[size];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Rating */}
      <div className="flex items-center gap-1">
        <Star className={`${classes.star} fill-warning text-warning`} />
        <span className={`font-semibold ${classes.text}`}>
          {rating.toFixed(1)}
        </span>
        <span className={`text-ink-muted ${classes.text}`}>
          ({reviewCount})
        </span>
      </div>

      {/* Trust Level Badge */}
      {showTrustLevel && trustLevel && (
        <div
          className={`inline-flex items-center gap-1 rounded-full border font-medium ${classes.badge} ${
            trustLevelColors[trustLevel as keyof typeof trustLevelColors] ||
            trustLevelColors.BRONZE
          }`}
        >
          {trustLevel === 'VERIFIED' && <Shield className={classes.star} />}
          {trustLevel}
        </div>
      )}
    </div>
  );
}