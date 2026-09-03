'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
};

/* Waiting states are the most-seen screens in any app, so they get the same
   restraint as everything else: an ink spinner rather than a blue one, and a
   mono caption instead of pulsing body text. The pulse is gone deliberately —
   two things animating to convey one "please wait" is one too many. */
export function LoadingSpinner({
  size = 'md',
  text,
  fullScreen = false,
  className,
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <Loader2 className={cn('animate-spin text-ink', sizeClasses[size])} strokeWidth={2} />
      {text && (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return spinner;
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="h-1.5 w-1.5 rounded-full bg-ink animate-bounce [animation-delay:-0.3s]" />
      <div className="h-1.5 w-1.5 rounded-full bg-ink animate-bounce [animation-delay:-0.15s]" />
      <div className="h-1.5 w-1.5 rounded-full bg-ink animate-bounce" />
    </div>
  );
}

export function LoadingBar({ className }: { className?: string }) {
  return (
    <div className={cn('ui-skeleton h-0.5 w-full overflow-hidden', className)} />
  );
}

/** Sweeping placeholder block — shares the app-wide `.ui-skeleton` treatment. */
export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn('ui-skeleton rounded-lg', className)} aria-hidden />;
}

export function LoadingCard() {
  return (
    <div className="space-y-3 border border-border bg-card p-4">
      <LoadingSkeleton className="h-3.5 w-3/4" />
      <LoadingSkeleton className="h-3.5 w-1/2" />
      <LoadingSkeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <LoadingSkeleton className="h-8 w-20" />
        <LoadingSkeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function LoadingTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <LoadingSkeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
