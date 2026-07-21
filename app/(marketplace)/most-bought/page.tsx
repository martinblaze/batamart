'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, TrendingUp, Users } from 'lucide-react'

interface DailyBoughtItem {
  key: string
  dateKey: string
  soldCount: number
  uniqueBuyers: number
  product: {
    id: string
    name: string
    price: number
    images: string[]
    category: string
    seller: {
      id: string
      name: string
      avgRating: number
      trustLevel: string
    }
  }
}

const PAGE_SIZE = 20

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)

export default function MostBoughtPage() {
  const router = useRouter()
  const [items, setItems] = useState<DailyBoughtItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [navigatingProductId, setNavigatingProductId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(async (targetPage: number, append: boolean) => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    append ? setLoadingMore(true) : setLoading(true)
    setError('')

    try {
      const res = await fetch(
        `/api/products/people-like-you?mode=daily&page=${targetPage}&pageSize=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load most bought feed')
        return
      }
      const nextItems = (data.items || []) as DailyBoughtItem[]
      setItems(prev => append ? [...prev, ...nextItems] : nextItems)
      setHasMore(!!data.hasMore)
      setPage(targetPage)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      append ? setLoadingMore(false) : setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchPage(1, false)
  }, [])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchPage(page + 1, true)
      }
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [fetchPage, hasMore, loading, loadingMore, page])

  const list = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10)
    return items.map((it) => ({
      ...it,
      isToday: it.dateKey === todayKey,
      dateLabel: new Date(it.dateKey).toLocaleDateString('en-NG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    }))
  }, [items])

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-secondary hover:text-primary mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        <div className="bg-white rounded-2xl border border-border shadow-soft p-4 sm:p-5 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-primary" strokeWidth={1.75} />
            <h1 className="text-xl sm:text-2xl font-semibold text-ink">Most bought daily</h1>
          </div>
          <p className="text-sm text-ink-secondary">
            Updated every day and stacked over time. Keep scrolling.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-border overflow-hidden animate-pulse">
                <div className="aspect-square bg-surface" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-surface rounded" />
                  <div className="h-3 bg-surface rounded w-2/3" />
                  <div className="h-4 bg-surface rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-danger/30 p-10 text-center">
            <p className="text-danger font-semibold">{error}</p>
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-10 text-center">
            <p className="text-ink-secondary font-semibold">No trending purchases yet.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {list.map((item) => (
                <div
                  key={item.key}
                  onClick={() => {
                    setNavigatingProductId(item.product.id)
                    router.push(`/product/${item.product.id}`)
                  }}
                  className="bg-white rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-soft transition-shadow"
                >
                  <div className="relative aspect-square bg-surface overflow-hidden">
                    <img
                      src={item.product.images?.[0] || '/placeholder.png'}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                    {item.isToday && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-success text-white text-[10px] font-medium">
                        NEW TODAY
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">{item.dateLabel}</p>
                      {item.isToday && (
                        <span className="text-[9px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-full">
                          HOT NOW
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-ink line-clamp-2 mt-1">{item.product.name}</p>
                    <p className="text-xs font-semibold text-primary mt-1">{fmt(item.product.price)}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-secondary">
                      <span>{item.soldCount} bought</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {item.uniqueBuyers}
                      </span>
                    </div>
                    {navigatingProductId === item.product.id && (
                      <div className="mt-1.5 text-[10px] text-primary font-semibold inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Opening...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div ref={sentinelRef} className="h-8 w-full mt-2" />

            {loadingMore && (
              <div className="flex justify-center py-4 text-ink-secondary text-sm font-semibold">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading more...
              </div>
            )}

            {!hasMore && (
              <p className="text-center text-xs text-ink-muted py-5">You have reached the end for now.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}