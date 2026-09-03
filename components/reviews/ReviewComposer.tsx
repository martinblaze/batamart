'use client'

import { useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle, Star, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Shell, PageHeader } from '@/components/ui/Shell'
import { cn } from '@/lib/utils'

/**
 * The shared body of the "rate this thing" screens.
 *
 * Reviewing a product and reviewing a seller were two 300-line files that
 * differed only in their copy, their subject strip and where they redirect
 * afterwards — so the form itself lives here once.
 */

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

/** Large interactive star row. Keyboard-operable, unlike the hand-rolled copies. */
export function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (next: number) => void
  disabled?: boolean
}) {
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <div>
      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label="Rating"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onFocus={() => setHover(star)}
            onBlur={() => setHover(0)}
            className="p-1.5 transition-transform duration-200 ease-out hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:pointer-events-none"
          >
            <Star
              className={cn(
                'h-10 w-10 transition-colors duration-200 sm:h-11 sm:w-11',
                star <= shown ? 'fill-warning text-warning' : 'fill-border/60 text-border'
              )}
              strokeWidth={0}
            />
          </button>
        ))}
      </div>

      <p className="ui-mono ui-mono-sm mt-4 text-ink-muted">
        {shown === 0 ? 'Select a rating' : `${shown} — ${RATING_WORDS[shown]}`}
      </p>
    </div>
  )
}

/** The subject being reviewed: square art for a product, round for a person. */
export function ReviewSubject({
  image,
  name,
  meta,
  round = false,
}: {
  image?: string | null
  name: string
  meta?: ReactNode
  round?: boolean
}) {
  return (
    <div className="flex items-center gap-4 border border-border bg-surface p-4 sm:p-5">
      {image ? (
        <img
          src={image}
          alt=""
          className={cn('h-16 w-16 flex-shrink-0 object-cover', round && 'rounded-full')}
        />
      ) : (
        <div
          className={cn(
            'flex h-16 w-16 flex-shrink-0 items-center justify-center border border-border bg-card',
            round && 'rounded-full'
          )}
        >
          <User className="h-7 w-7 text-ink-muted" strokeWidth={1.5} />
        </div>
      )}
      <div className="min-w-0">
        <h2 className="truncate text-base font-medium text-ink">{name}</h2>
        {meta && <div className="mt-1 space-y-0.5 text-[13px] text-ink-secondary">{meta}</div>}
      </div>
    </div>
  )
}

export function ReviewComposer({
  eyebrow,
  title,
  standfirst,
  backHref,
  backLabel = 'Back to order',
  subject,
  ratingQuestion,
  commentPlaceholder,
  rating,
  onRatingChange,
  comment,
  onCommentChange,
  error,
  submitting,
  submitLabel,
  onSubmit,
  onSkip,
  benefitsTitle,
  benefits,
}: {
  eyebrow: string
  title: ReactNode
  standfirst: ReactNode
  backHref: string
  backLabel?: string
  subject: ReactNode
  ratingQuestion: string
  commentPlaceholder: string
  rating: number
  onRatingChange: (next: number) => void
  comment: string
  onCommentChange: (next: string) => void
  error?: string
  submitting?: boolean
  submitLabel: string
  onSubmit: () => void
  onSkip: () => void
  benefitsTitle: string
  benefits: string[]
}) {
  return (
    <div className="min-h-screen bg-surface pb-20">
      <Shell width="reading" className="pt-8 sm:pt-12">
        <PageHeader
          eyebrow={eyebrow}
          back={{ href: backHref, label: backLabel }}
          title={title}
          description={standfirst}
        />

        <div className="mt-10 space-y-10">
          {error && (
            <div className="flex items-start gap-3 border border-danger/25 bg-danger/5 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" strokeWidth={1.75} />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {subject}

          <section>
            <h3 className="text-base text-ink">{ratingQuestion}</h3>
            <div className="mt-5">
              <StarPicker value={rating} onChange={onRatingChange} disabled={submitting} />
            </div>
          </section>

          <section>
            <label htmlFor="review-comment" className="block text-base text-ink">
              Tell us more{' '}
              <span className="text-sm text-ink-muted">(optional)</span>
            </label>
            <textarea
              id="review-comment"
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
              placeholder={commentPlaceholder}
              maxLength={300}
              disabled={submitting}
              className="mt-4 h-32 w-full resize-none border border-border bg-card p-4 text-[15px] leading-relaxed text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
            />
            <p className="ui-mono ui-mono-sm mt-2 text-right text-ink-muted">
              {comment.length}/300
            </p>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" size="lg" onClick={onSkip} disabled={submitting} className="sm:flex-1">
              Skip
            </Button>
            <Button
              variant="ink"
              size="lg"
              onClick={onSubmit}
              disabled={rating === 0}
              isLoading={submitting}
              loadingText="Submitting…"
              className="sm:flex-[2]"
            >
              {submitLabel}
            </Button>
          </div>

          <section className="border-t border-border pt-8">
            <p className="ui-eyebrow mb-5">{benefitsTitle}</p>
            <ul className="space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-ink-secondary">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted"
                    strokeWidth={1.75}
                  />
                  {benefit}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Shell>
    </div>
  )
}
