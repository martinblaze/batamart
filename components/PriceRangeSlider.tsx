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
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-[#272b33] dark:bg-[#0f1115]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-black text-gray-900 dark:text-[#e5e7eb]">Price range</span>
        <span className="text-xs font-bold text-gray-500 dark:text-[#94a3b8]">
          {fmt(minClamp)} - {fmt(maxClamp)}
        </span>
      </div>

      <div className="relative mb-4 h-9">
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-[#272b33]" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-indigo-600"
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
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Min</span>
          <input
            type="number"
            min={min}
            max={max}
            value={minClamp}
            onChange={(e) => onChange([Math.min(Number(e.target.value || min), maxClamp), maxClamp])}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-indigo-400 dark:border-[#272b33] dark:bg-[#0b0d12] dark:text-[#e5e7eb]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Max</span>
          <input
            type="number"
            min={min}
            max={max}
            value={maxClamp}
            onChange={(e) => onChange([minClamp, Math.max(Number(e.target.value || max), minClamp)])}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-indigo-400 dark:border-[#272b33] dark:bg-[#0b0d12] dark:text-[#e5e7eb]"
          />
        </label>
      </div>
    </div>
  )
}
