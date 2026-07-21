import { HTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BadgeStatus =
  | 'in-stock'
  | 'low-stock'
  | 'out-of-stock'
  | 'verified'
  | 'new'
  | 'success'
  | 'danger'
  | 'warning'
  | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  icon?: LucideIcon;
  pill?: boolean;
}

// Design bible section 8 — Badges. Status-based only: background = status
// color at 10% opacity, text = status color at full value. One implementation
// consolidates every ad-hoc badge chip in the app.
const statusStyles: Record<BadgeStatus, string> = {
  'in-stock': 'bg-success/10 text-success',
  'low-stock': 'bg-warning/10 text-warning',
  'out-of-stock': 'bg-danger/10 text-danger',
  verified: 'bg-primary/10 text-primary',
  new: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  neutral: 'bg-surface text-ink-secondary',
};

export function Badge({ status = 'neutral', icon: Icon, pill = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 py-1 px-2.5 text-xs font-medium',
        pill ? 'rounded-full' : 'rounded-md',
        statusStyles[status],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />}
      {children}
    </span>
  );
}
