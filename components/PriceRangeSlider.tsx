'use client'

import { useMemo } from 'react'

type RangeValue = [number, number]

export default function PriceRangeSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number
  max: number
  value: RangeValue
  onChange: (next: RangeValue) => void
}) {
  const [currentMin, currentMax] = value
  const minClamp = Math.max(min, Math.min(currentMin, currentMax))
  const maxClamp = Math.min(max, Math.max(currentMax, currentMin))
  const progressLeft = useMemo(() => ((minClamp - min) / Math.max(1, max - min)) * 100, [min, max, minClamp])
  const progressRight = useMemo(() => ((maxClamp - min) / Math.max(1, max - min)) * 100, [min, max, maxClamp])

  const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">Price range</span>
        <span className="text-xs font-medium text-ink-secondary">
          {fmt(minClamp)} - {fmt(maxClamp)}
        </span>
      </div>

      <div className="relative mb-4 h-9">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-primary"
          style={{ left: `${progressLeft}%`, right: `${100 - progressRight}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={minClamp}
          onChange={(e) => onChange([Math.min(Number(e.target.value), maxClamp), maxClamp])}
          className="pointer-events-auto absolute inset-0 h-9 w-full appearance-none bg-transparent"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={maxClamp}
          onChange={(e) => onChange([minClamp, Math.max(Number(e.target.value), minClamp)])}
          className="pointer-events-auto absolute inset-0 h-9 w-full appearance-none bg-transparent"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-ink-muted">Min</span>
          <input
            type="number"
            min={min}
            max={max}
            value={minClamp}
            onChange={(e) => onChange([Math.min(Number(e.target.value || min), maxClamp), maxClamp])}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink outline-none focus:border-primary"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-ink-muted">Max</span>
          <input
            type="number"
            min={min}
            max={max}
            value={maxClamp}
            onChange={(e) => onChange([minClamp, Math.max(Number(e.target.value || max), minClamp)])}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink outline-none focus:border-primary"
          />
        </label>
      </div>
    </div>
  )
}
