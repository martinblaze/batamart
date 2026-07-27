'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'

export interface SpotlightStep {
  /** Tried in order; the first one present + visible in the DOM wins. */
  selectors: string[]
  title: string
  body: string
  /** Only the last step shows a "Got it" button in addition to click-to-advance. */
  isFinalStep?: boolean
}

const BUBBLE_WIDTH = 300
const GAP = 14
const RING_PADDING = 8
const MISSING_TIMEOUT_MS = 7000

function findVisible(selectors: string[]): { el: HTMLElement; selector: string } | null {
  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector)
    if (el && el.offsetParent !== null) return { el, selector }
  }
  return null
}

/**
 * Generic spotlight/coachmark overlay: dims + softly blurs the whole screen
 * except a cutout around the current step's target element, with an arrow
 * and message bubble pointing at it. Purely presentational — the caller owns
 * step sequencing and reacts to onTargetClick to decide what happens next.
 */
export default function SpotlightTour({
  step,
  onTargetClick,
  onSkip,
  onGotIt,
}: {
  step: SpotlightStep | null
  onTargetClick: (matchedSelector: string) => void
  onSkip: () => void
  onGotIt: () => void
}) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [matchedSelector, setMatchedSelector] = useState<string | null>(null)
  const scrolledRef = useRef(false)
  const missingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setRect(null)
    setMatchedSelector(null)
    scrolledRef.current = false
    if (!step) return

    if (missingTimerRef.current) clearTimeout(missingTimerRef.current)
    missingTimerRef.current = setTimeout(() => {
      if (!document.querySelector(step.selectors[0])) onSkip()
    }, MISSING_TIMEOUT_MS)

    const measure = () => {
      const found = findVisible(step.selectors)
      if (!found) return
      setMatchedSelector(found.selector)
      setRect(found.el.getBoundingClientRect())
      if (!scrolledRef.current) {
        scrolledRef.current = true
        found.el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    measure()
    const pollId = setInterval(measure, 250)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    return () => {
      clearInterval(pollId)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      if (missingTimerRef.current) clearTimeout(missingTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => {
    if (!rect || !matchedSelector) return
    const onClick = (e: MouseEvent) => {
      const target = document.querySelector<HTMLElement>(matchedSelector)
      if (target && (target === e.target || target.contains(e.target as Node))) {
        onTargetClick(matchedSelector)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [rect, matchedSelector, onTargetClick])

  if (!step || !rect) return null

  const top = rect.top - RING_PADDING
  const left = rect.left - RING_PADDING
  const width = rect.width + RING_PADDING * 2
  const height = rect.height + RING_PADDING * 2
  const bottomEdge = top + height
  const centerX = left + width / 2

  const placeBelow = top < window.innerHeight / 2
  const bubbleLeft = Math.min(Math.max(centerX - BUBBLE_WIDTH / 2, 12), window.innerWidth - BUBBLE_WIDTH - 12)

  return (
    <div className="fixed inset-0 z-[9700]">
      {/* Dim + soft-blur panels around the cutout */}
      <div className="absolute backdrop-blur-sm bg-ink/40" style={{ top: 0, left: 0, right: 0, height: Math.max(top, 0) }} />
      <div className="absolute backdrop-blur-sm bg-ink/40" style={{ top: bottomEdge, left: 0, right: 0, bottom: 0 }} />
      <div className="absolute backdrop-blur-sm bg-ink/40" style={{ top, left: 0, width: Math.max(left, 0), height }} />
      <div className="absolute backdrop-blur-sm bg-ink/40" style={{ top, left: left + width, right: 0, height }} />

      {/* Highlight ring — no pointer-events, so the real element underneath stays clickable */}
      <div
        className="absolute rounded-2xl ring-2 ring-rose-400 shadow-[0_0_0_6px_rgba(244,63,94,0.25)] pointer-events-none animate-pulse-slow"
        style={{ top, left, width, height }}
      />

      {/* Arrow */}
      <div
        className="absolute flex justify-center pointer-events-none"
        style={{ left, width, top: placeBelow ? bottomEdge : undefined, bottom: placeBelow ? undefined : window.innerHeight - top }}
      >
        {placeBelow
          ? <ChevronUp className="w-7 h-7 text-rose-500 animate-bounce-subtle" strokeWidth={2.5} />
          : <ChevronDown className="w-7 h-7 text-rose-500 animate-bounce-subtle" strokeWidth={2.5} />}
      </div>

      {/* Message bubble */}
      <div
        className="absolute rounded-2xl bg-white shadow-2xl ring-1 ring-rose-100 p-4"
        style={{
          width: BUBBLE_WIDTH,
          left: bubbleLeft,
          top: placeBelow ? bottomEdge + GAP + 28 : undefined,
          bottom: placeBelow ? undefined : window.innerHeight - top + GAP + 28,
        }}
      >
        <button
          onClick={onSkip}
          aria-label="Skip tutorial"
          className="absolute right-3 top-3 text-ink-muted hover:text-ink-secondary"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <h3 className="pr-6 text-sm font-semibold text-ink">{step.title}</h3>
        <p className="mt-1 text-xs text-ink-secondary leading-relaxed">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={onSkip} className="text-xs font-semibold text-ink-muted hover:text-ink-secondary">
            Skip tutorial
          </button>
          {step.isFinalStep && (
            <button
              onClick={onGotIt}
              className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
            >
              Got it!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
