import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md';
}

// Design bible section 8 — Cards (generic container). White bg, 1px border,
// 12px radius, no shadow needed when a border is present.
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, padding = 'md', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-white border border-border rounded-xl',
          padding === 'md' && 'p-4 md:p-6',
          padding === 'sm' && 'p-4',
          hoverable &&
            'transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:border-border',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between gap-4 mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-[16px] font-medium text-ink', className)} {...props}>
      {children}
    </h3>
  );
}
