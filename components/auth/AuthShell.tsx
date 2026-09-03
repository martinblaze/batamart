'use client'

import Link from 'next/link'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/layout/Logo'

/**
 * Shared furniture for the authentication screens.
 *
 * Login, signup, verify, password reset, rider login and the admin portal were
 * each inventing their own card, label and button treatment, so the five
 * screens a new user meets first were the least consistent in the product.
 * The vocabulary lives here once: centred column, logo, mono eyebrow, display
 * title, hairline card.
 */

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  back,
  icon: Icon,
  wide = false,
}: {
  eyebrow: string
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  back?: { href: string; label: string }
  /** Replaces the logo — used by the admin portal, which is not the storefront. */
  icon?: LucideIcon
  wide?: boolean
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className={cn('w-full', wide ? 'max-w-[34rem]' : 'max-w-md')}>
        <div className="mb-8 text-center">
          <div className="mb-6 inline-flex items-center justify-center">
            {Icon ? (
              <span className="flex h-14 w-14 items-center justify-center border border-border bg-card">
                <Icon className="h-6 w-6 text-ink" strokeWidth={1.5} />
              </span>
            ) : (
              <Logo size={34} />
            )}
          </div>
          <p className="ui-eyebrow mb-3 justify-center before:hidden after:hidden">{eyebrow}</p>
          <h1 className="text-[clamp(1.9rem,5vw,2.6rem)] leading-[1.02] text-ink">{title}</h1>
          {subtitle && (
            <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">{subtitle}</p>
          )}
        </div>

        <div className="border border-border bg-card p-6 sm:p-8">{children}</div>

        {footer && <div className="mt-6 text-center text-sm text-ink-secondary">{footer}</div>}

        {back && (
          <div className="mt-6 text-center">
            <Link
              href={back.href}
              className="group ui-mono ui-mono-sm inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft
                className="h-3 w-3 transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
                strokeWidth={2}
              />
              {back.label}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

/** Mono label over a tall bordered input. */
export function AuthField({
  label,
  hint,
  icon: Icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div>
      <label className="mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            strokeWidth={1.75}
          />
        )}
        <input
          className={cn(
            'h-12 w-full border border-border bg-card text-[15px] text-ink',
            'transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15',
            Icon ? 'pl-11 pr-4' : 'px-4',
            className
          )}
          {...props}
        />
      </div>
      {hint && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

/** The one primary action on an auth screen. */
export function AuthSubmit({
  loading = false,
  loadingText,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  loadingText?: string
}) {
  return (
    <button
      disabled={loading || props.disabled}
      className={cn(
        'h-12 w-full bg-ink font-mono text-[11px] uppercase tracking-[0.16em] text-background',
        'transition-colors duration-300 hover:bg-primary',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      {loading && loadingText ? loadingText : children}
    </button>
  )
}

/** Inline notice — errors, warnings, and the occasional hint. */
export function AuthNotice({
  tone = 'danger',
  icon: Icon,
  title,
  children,
  className,
}: {
  tone?: 'danger' | 'warning' | 'info'
  icon?: LucideIcon
  title?: string
  children: ReactNode
  className?: string
}) {
  const tones = {
    danger: 'border-danger/25 bg-danger/5 text-danger',
    warning: 'border-warning/25 bg-warning/5 text-warning',
    info: 'border-primary/25 bg-primary/5 text-ink-secondary',
  }
  return (
    <div className={cn('flex items-start gap-3 border p-4 text-sm', tones[tone], className)}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />}
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        <div className={cn('whitespace-pre-line', title && 'mt-1')}>{children}</div>
      </div>
    </div>
  )
}

/**
 * Six-digit code entry. Handles auto-advance, backspace-to-previous and — the
 * part hand-rolled copies always miss — pasting the whole code at once, which
 * is how most people actually enter it from an email.
 */
export function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const setDigit = (index: number, digit: string) => {
    const next = [...value]
    next[index] = digit
    onChange(next)
  }

  return (
    <div className="flex justify-center gap-2">
      {value.map((digit, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digit}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '')
            if (!raw) {
              setDigit(i, '')
              return
            }
            // A paste lands as several digits in one field — spread it.
            if (raw.length > 1) {
              const next = [...value]
              for (let k = 0; k < raw.length && i + k < next.length; k++) {
                next[i + k] = raw[k]
              }
              onChange(next)
              document.getElementById(`otp-${Math.min(i + raw.length, 5)}`)?.focus()
              return
            }
            setDigit(i, raw)
            if (i < 5) document.getElementById(`otp-${i + 1}`)?.focus()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              document.getElementById(`otp-${i - 1}`)?.focus()
            }
          }}
          className="ui-figure h-14 w-12 border border-border bg-card text-center text-2xl text-ink transition-[border-color,box-shadow] duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
        />
      ))}
    </div>
  )
}

/** Hairline rule with a mono caption through the middle. */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        {children}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

/** Step counter for multi-step flows — reads as an instrument, not a wizard. */
export function AuthSteps({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-7 flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-[3px] flex-1 transition-colors duration-500',
            i < current ? 'bg-ink' : 'bg-border'
          )}
        />
      ))}
      <span className="ui-mono ui-mono-sm ml-2 flex-shrink-0 text-ink-muted">
        {String(current).padStart(2, '0')}/{String(total).padStart(2, '0')}
      </span>
    </div>
  )
}
