'use client'

import Link from 'next/link'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * Shared page furniture for the product screens.
 *
 * Every page in the app was previously inventing its own header, empty state
 * and loading treatment, which is the main reason the product read as a
 * different site from screen to screen. These are the four pieces that repeat
 * everywhere, so they live in one place.
 */

/** Centred, max-width page container. */
export function Shell({
  children,
  className,
  width = 'default',
}: {
  children: ReactNode
  className?: string
  width?: 'default' | 'wide' | 'narrow' | 'reading'
}) {
  const widths = {
    narrow: 'max-w-[560px]',
    reading: 'max-w-[840px]',
    default: 'max-w-[1200px]',
    wide: 'max-w-[1440px]',
  }
  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', widths[width], className)}>
      {children}
    </div>
  )
}

/**
 * Page header — mono eyebrow, display title, optional standfirst and actions.
 * The hairline underneath is what ties consecutive screens together.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** `{ href, label }` renders a quiet back link above the title. */
  back?: { href: string; label: string }
  className?: string
}) {
  return (
    <header className={cn('border-b border-border pb-6 sm:pb-8', className)}>
      {back && (
        <Link
          href={back.href}
          className="group mb-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-secondary transition-colors hover:text-ink"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
            strokeWidth={2}
          />
          {back.label}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          {eyebrow && <p className="ui-eyebrow mb-3 max-w-[18rem]">{eyebrow}</p>}
          <h1 className="text-[clamp(1.65rem,3.6vw,2.6rem)] leading-[1.02] text-ink">
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-ink-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  )
}

/**
 * Empty state. Always says what the space is for and offers the action that
 * fills it — an empty screen with only an icon on it tells the user nothing.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center border border-dashed border-border bg-card px-6 py-16 text-center sm:py-24',
        className
      )}
    >
      {Icon && (
        <span className="mb-6 flex h-14 w-14 items-center justify-center border border-border bg-surface">
          <Icon className="h-6 w-6 text-ink-muted" strokeWidth={1.5} />
        </span>
      )}
      <h2 className="text-lg text-ink">{title}</h2>
      {description && (
        <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-7">{action}</div>}
    </div>
  )
}

/** Shimmer block. Compose these into the shape of the content being awaited. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('ui-skeleton rounded-lg', className)} aria-hidden />
}

/** Loading placeholder shaped like the product grid. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[4/5] w-full" />
          <Skeleton className="mt-4 h-3.5 w-4/5" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <Skeleton className="mt-3 h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}

/** Key/value pair used in summaries — order totals, wallet figures, specs. */
export function DataRow({
  label,
  value,
  emphasis = false,
  className,
}: {
  label: ReactNode
  value: ReactNode
  emphasis?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2.5', className)}>
      <span
        className={cn(
          'font-mono text-[10px] uppercase tracking-[0.14em]',
          emphasis ? 'text-ink' : 'text-ink-secondary'
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'text-right',
          emphasis ? 'ui-figure text-lg text-ink' : 'text-sm font-medium text-ink'
        )}
      >
        {value}
      </span>
    </div>
  )
}
