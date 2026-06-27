'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock3, Search, Sparkles } from 'lucide-react'

type Suggestion = {
  text: string
  category?: string
  type: 'product' | 'category' | 'popular'
}

function highlightMatch(text: string, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return text
  const index = text.toLowerCase().indexOf(q)
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}
      <strong>{text.slice(index, index + q.length)}</strong>
      {text.slice(index + q.length)}
    </>
  )
}

export default function SearchAutocomplete({
  value,
  onChange,
  onSubmit,
  onSelect,
  placeholder = 'Search products, sellers, categories...',
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onSelect?: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [popular, setPopular] = useState<Suggestion[]>([])
  const [live, setLive] = useState<Suggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const trimmed = value.trim()

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('batamart_recent_searches') || '[]')
      if (Array.isArray(saved)) setRecent(saved.filter((item) => typeof item === 'string').slice(0, 5))
    } catch {
      setRecent([])
    }
  }, [])

  useEffect(() => {
    const loadPopular = async () => {
      try {
        const res = await fetch('/api/search/suggestions?type=popular&limit=6')
        const data = await res.json()
        setPopular(Array.isArray(data?.suggestions) ? data.suggestions : [])
      } catch {
        setPopular([])
      }
    }
    loadPopular()
  }, [])

  useEffect(() => {
    if (!open) return
    if (!trimmed) {
      setLive([])
      setLoading(false)
      return
    }

    setLoading(true)
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(trimmed)}&limit=8`)
        const data = await res.json()
        setLive(Array.isArray(data?.suggestions) ? data.suggestions : [])
      } catch {
        setLive([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => window.clearTimeout(id)
  }, [trimmed, open])

  const suggestions = useMemo(() => (trimmed ? live : [...recent.map((text) => ({ text, type: 'popular' as const })), ...popular]), [trimmed, recent, popular, live])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (inputRef.current && !inputRef.current.parentElement?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const saveRecent = (query: string) => {
    const next = [query, ...recent.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 10)
    setRecent(next)
    localStorage.setItem('batamart_recent_searches', JSON.stringify(next))
  }

  const choose = (text: string) => {
    onChange(text)
    onSelect?.(text)
    saveRecent(text)
    setOpen(false)
    setActiveIndex(-1)
    window.setTimeout(onSubmit, 0)
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 dark:border-[#272b33] dark:bg-[#0f1115] dark:focus-within:ring-indigo-900/30">
        <Search className="h-4 w-4 text-gray-400 dark:text-[#72819a]" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false)
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((curr) => Math.min(curr + 1, suggestions.length - 1))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((curr) => Math.max(curr - 1, 0))
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              const chosen = suggestions[activeIndex]?.text || value
              if (chosen) choose(chosen)
              else onSubmit()
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-[#e5e7eb] dark:placeholder:text-[#72819a]"
        />
        {trimmed ? (
          <button type="button" onClick={() => { onChange(''); setLive([]) }} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5">
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>
        ) : null}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-[#272b33] dark:bg-[#0f1115]">
          {!trimmed && (
            <div className="border-b border-gray-100 px-4 py-3 dark:border-[#272b33]">
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-[#72819a]">Recent searches</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {recent.length > 0 ? recent.map((item) => (
                  <button key={item} type="button" onClick={() => choose(item)} className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 dark:bg-[#141821] dark:text-[#d1d5db]">
                    <Clock3 className="h-3 w-3" /> {item}
                  </button>
                )) : <span className="text-xs text-gray-400 dark:text-[#72819a]">No recent searches yet.</span>}
              </div>
            </div>
          )}

          <div className="px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-[#72819a]">{trimmed ? 'Suggestions' : 'Popular searches'}</p>
            {loading && <p className="mt-2 text-xs text-gray-400 dark:text-[#72819a]">Searching...</p>}
            <div className="mt-2 space-y-1">
              {(trimmed ? live : popular).length > 0 ? (trimmed ? live : popular).map((item, index) => (
                <button
                  type="button"
                  key={`${item.type}-${item.text}-${index}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(item.text)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition ${activeIndex === index ? 'bg-indigo-50 dark:bg-white/8' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-[#e5e7eb]">
                    {trimmed ? highlightMatch(item.text, trimmed) : item.text}
                  </span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-500 dark:bg-[#1a1f2a] dark:text-[#94a3b8]">
                    {item.category || (item.type === 'popular' ? 'Popular' : item.type)}
                  </span>
                </button>
              )) : (
                <div className="py-4 text-sm text-gray-500 dark:text-[#94a3b8]">No suggestions found.</div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 px-4 py-3 dark:border-[#272b33]">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#94a3b8]">
              <Sparkles className="h-3.5 w-3.5" />
              Tip: press Enter to search, Esc to close.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
