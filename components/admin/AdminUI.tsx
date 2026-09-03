'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Shared furniture for the admin panel.
 *
 * The sixteen admin screens each invented their own card, heading, stat tile
 * and empty state, which is why the panel read as sixteen different tools. The
 * vocabulary lives here: hairline surfaces, mono labels, display figures, and
 * colour reserved for genuine status.
 */

/** Page heading — mono eyebrow, display title, optional actions on the right. */
export function AdminHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('border-b border-border pb-6', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          {eyebrow && <p className="ui-eyebrow mb-3 max-w-[16rem]">{eyebrow}</p>}
          <h1 className="text-[clamp(1.5rem,3vw,2.1rem)] leading-[1.05] text-ink">{title}</h1>
          {description && (
            <p className="mt-2.5 max-w-[62ch] text-sm leading-relaxed text-ink-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  )
}

export interface AdminStat {
  label: string
  value: ReactNode
  note?: string
  /** Only for genuine status — a figure that needs attention. */
  tone?: 'default' | 'warning' | 'danger' | 'success'
}

/**
 * The stat rail. A hairline grid rather than a row of tinted icon tiles —
 * every figure carries the same weight, so the numbers do the talking.
 */
export function StatGrid({
  stats,
  columns = 3,
  loading = false,
  className,
}: {
  stats: AdminStat[]
  columns?: 2 | 3 | 4
  loading?: boolean
  className?: string
}) {
  const cols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[columns]

  if (loading) {
    return (
      <div className={cn('grid gap-px border border-border bg-border', cols, className)}>
        {Array.from({ length: stats.length || columns }).map((_, i) => (
          <div key={i} className="bg-card p-5">
            <div className="ui-skeleton h-8 w-20" />
            <div className="ui-skeleton mt-3 h-2.5 w-24" />
          </div>
        ))}
      </div>
    )
  }

  const tones = {
    default: 'text-ink',
    warning: 'text-warning',
    danger: 'text-danger',
    success: 'text-success',
  }

  return (
    <div className={cn('grid gap-px border border-border bg-border', cols, className)}>
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card p-5">
          <p
            className={cn(
              'ui-figure text-[clamp(1.5rem,3vw,2.1rem)] leading-none',
              tones[stat.tone || 'default']
            )}
          >
            {stat.value}
          </p>
          <p className="ui-mono ui-mono-sm mt-3 text-ink">{stat.label}</p>
          {stat.note && <p className="mt-1 text-xs text-ink-muted">{stat.note}</p>}
        </div>
      ))}
    </div>
  )
}

/** A bordered section with a mono eyebrow. */
export function AdminPanel({
  title,
  description,
  actions,
  children,
  padded = true,
  className,
}: {
  title?: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  /** Set false when the body is a full-bleed table or divided list. */
  padded?: boolean
  className?: string
}) {
  return (
    <section className={cn('border border-border bg-card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <p className="ui-eyebrow">{title}</p>}
            {description && (
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'p-5' : undefined}>{children}</div>
    </section>
  )
}

export function AdminEmpty({
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
        'flex flex-col items-center justify-center border border-dashed border-border bg-card px-6 py-16 text-center',
        className
      )}
    >
      {Icon && <Icon className="mb-5 h-7 w-7 text-ink-muted" strokeWidth={1.5} />}
      <p className="text-base text-ink">{title}</p>
      {description && (
        <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-ink-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/** Segmented filter rail — the admin equivalent of the storefront chip row. */
export function FilterTabs({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: string; count?: number }[]
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  return (
    <div className={cn('ui-rail', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          data-active={value === option.value}
          className="ui-chip"
        >
          {option.label}
          {option.count != null && (
            <span className="ui-mono ui-mono-sm opacity-60">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Table primitives ──────────────────────────────────────────────────────
   Admin lists are genuinely tabular, so they get a real table with a mono
   header rather than a stack of cards pretending to be rows. */

export function AdminTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[40rem] border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Th({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  return (
    <th
      className={cn(
        'ui-mono ui-mono-sm whitespace-nowrap border-b border-border px-4 py-3 font-medium text-ink-muted',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = 'left',
  className,
}: {
  children?: ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
}) {
  return (
    <td
      className={cn(
        'border-b border-border px-4 py-3.5 align-middle text-ink',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className
      )}
    >
      {children}
    </td>
  )
}

/** Row wrapper with the standard hover. */
export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn('transition-colors duration-200 hover:bg-surface', className)}>{children}</tr>
  )
}

/** Neutral admin button — the panel's default control. */
export function AdminButton({
  children,
  icon: Icon,
  tone = 'default',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon
  tone?: 'default' | 'ink' | 'danger' | 'success' | 'warning'
}) {
  const tones = {
    default: 'border border-border bg-card text-ink-secondary hover:border-ink/25 hover:text-ink',
    ink: 'bg-ink text-white hover:bg-ink/90',
    danger: 'bg-danger text-white hover:brightness-[1.06]',
    success: 'bg-success text-white hover:brightness-[1.06]',
    warning: 'bg-warning text-white hover:brightness-[1.06]',
  }
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 px-3.5',
        'font-mono text-[10px] uppercase tracking-[0.14em]',
        'transition-colors duration-300',
        'disabled:pointer-events-none disabled:opacity-50',
        tones[tone],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2} />}
      {children}
    </button>
  )
}

/** Full-width loading placeholder for a list or table body. */
export function AdminLoading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="ui-divide border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <div className="ui-skeleton h-10 w-10 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="ui-skeleton h-3 w-1/3" />
            <div className="ui-skeleton mt-2 h-2.5 w-1/4" />
          </div>
          <div className="ui-skeleton h-6 w-16 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}
