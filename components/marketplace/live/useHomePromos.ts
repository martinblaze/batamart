'use client'

import { useCallback, useEffect, useState } from 'react'
import type { JustOrdered, Popup } from '@/lib/promos/logic'

export interface PromoCard {
  id: string; name: string; price: number; originalPrice: number | null
  discountPercent: number | null; image: string; category: string; sellerName: string | null
}
export interface HomePromos {
  popups: Popup[]
  live: {
    delivery: { label: string; nextDeliveryDate: string; cutoffAt: string; msLeft: number } | null
    trending: PromoCard[]; newToday: PromoCard[]; priceDrops: PromoCard[]
    justOrdered: JustOrdered[]
    stats: { ordersThisWeek: number | null; activeShoppersToday: number | null }
  }
  fetchedAt: number
}

// One in-flight request and a short cache shared by the strips and the popup,
// so the home page makes a single call.
let cached: HomePromos | null = null
let inflight: Promise<HomePromos | null> | null = null
const FRESH_MS = 20_000

function readCategoryHints(): string {
  try {
    const raw = localStorage.getItem('BATAMART-recently-viewed')
    const list = raw ? JSON.parse(raw) : []
    const cats = Array.from(new Set((Array.isArray(list) ? list : []).map((p: any) => p?.category).filter(Boolean))).slice(0, 6)
    return cats.length ? `?categories=${encodeURIComponent(cats.join(','))}` : ''
  } catch { return '' }
}

export function loadHomePromos(force = false): Promise<HomePromos | null> {
  if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) return Promise.resolve(cached)
  if (inflight) return inflight
  inflight = (async () => {
    try {
      let token: string | null = null
      try { token = localStorage.getItem('token') } catch { /* ignore */ }
      const res = await fetch(`/api/promos/home${readCategoryHints()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: 'no-store',
      })
      if (!res.ok) return cached
      const data = await res.json()
      cached = { popups: data.popups ?? [], live: data.live, fetchedAt: Date.now() }
      return cached
    } catch {
      return cached
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** Fetches once on mount and again when the tab regains focus (if stale). */
export function useHomePromos() {
  const [data, setData] = useState<HomePromos | null>(cached)
  const [loading, setLoading] = useState(!cached)

  const refresh = useCallback(async (force = false) => {
    const d = await loadHomePromos(force)
    if (d) setData(d)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
    const onFocus = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { data, loading, refresh }
}
