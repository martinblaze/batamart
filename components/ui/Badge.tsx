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
  | 'neutral'
  | 'ink'
  | 'campaign';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  icon?: LucideIcon;
  pill?: boolean;
}

/* Badges are mono, uppercase and tightly tracked — the "instrument panel"
   voice. Solid tinted fills at 10% read washy at this size, so each status
   gets a legible tint plus a hairline of its own colour, which holds up over
   both card white and a product photograph. */
const statusStyles: Record<BadgeStatus, string> = {
  'in-stock': 'bg-success/12 text-success ring-success/25',
  'low-stock': 'bg-warning/14 text-warning ring-warning/30',
  'out-of-stock': 'bg-danger/12 text-danger ring-danger/25',
  verified: 'bg-primary/12 text-primary ring-primary/25',
  new: 'bg-primary/12 text-primary ring-primary/25',
  success: 'bg-success/12 text-success ring-success/25',
  danger: 'bg-danger/12 text-danger ring-danger/25',
  warning: 'bg-warning/14 text-warning ring-warning/30',
  neutral: 'bg-surface text-ink-secondary ring-border',
  // On photography: solid ink reads at any brightness where a tint would not.
  ink: 'bg-ink text-background ring-transparent',
  // Seasonal campaign badges carry a fixed brand colour, not a semantic status.
  campaign: 'bg-rose-500/14 text-rose-600 ring-rose-500/30',
};

export function Badge({ status = 'neutral', icon: Icon, pill = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 py-1 px-2',
        'font-mono text-[10px] uppercase tracking-[0.1em] font-medium leading-none',
        'ring-1 ring-inset',
        pill ? 'rounded-full' : 'rounded-sm',
        statusStyles[status],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-3 h-3" strokeWidth={2} />}
      {children}
    </span>
  );
}
