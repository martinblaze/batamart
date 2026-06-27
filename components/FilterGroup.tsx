'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'

type Option = { value: string; count: number }

export default function FilterGroup({
  title,
  options,
  selectedValues = [],
  onChange,
  type = 'multi_select',
  defaultOpen = true,
}: {
  title: string
  options: Option[]
  selectedValues?: string[]
  onChange: (value: string) => void
  type?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [expanded, setExpanded] = useState(false)

  const normalizedSelected = selectedValues.map((value) => value.toLowerCase())
  const visibleOptions = useMemo(() => {
    if (expanded || options.length <= 8) return options
    return options.filter((option, index) => index < 6 || normalizedSelected.includes(option.value.toLowerCase()))
  }, [expanded, options, normalizedSelected])

  if (!options || options.length === 0) return null

  const selectedCount = selectedValues.length
  const hiddenCount = Math.max(0, options.length - visibleOptions.length)

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-[#272b33] dark:bg-[#0f1115]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-black text-gray-900 dark:text-[#e5e7eb]">
          {title}
          {selectedCount > 0 && (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white">
              {selectedCount}
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="space-y-2">
            {visibleOptions.map((option) => {
              const checked = selectedValues.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 dark:text-[#cbd5e1] dark:hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onChange(option.value)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium">{option.value}</span>
                  </span>
                  <span className="text-xs font-semibold text-gray-400">{option.count}</span>
                </label>
              )
            })}
          </div>

          {options.length > 8 && !expanded && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-3 text-xs font-black text-indigo-600 hover:underline"
            >
              Show {hiddenCount} more
            </button>
          )}
          {options.length > 8 && expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-3 text-xs font-black text-indigo-600 hover:underline"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}
