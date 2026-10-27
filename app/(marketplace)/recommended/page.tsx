'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Shell, PageHeader } from '@/components/ui/Shell'
import ProductCard from '@/components/ProductCard'
import { authFetch } from '@/lib/auth-client'
import { buildFeedQuery } from '@/lib/feed-signals'

const PAGE = 24

export default function RecommendedPage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [personalised, setPersonalised] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(PAGE)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login?redirect=/recommended')
      return
    }
    authFetch(`/api/products/feed?${buildFeedQuery(100)}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not load your picks')
        // Picks first, then the rest of the feed in order of how well it fits you.
        const seen = new Set<string>()
        const ordered = [...(data.forYouProducts ?? []), ...(data.discoverProducts ?? []), ...(data.products ?? [])]
          .filter((p: any) => !seen.has(p.id) && seen.add(p.id))
        setProducts(ordered)
        setPersonalised(!data.meta?.usedFallback)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [router])

  const hasMore = visible < products.length
  useEffect(() => {
    const el = loaderRef.current
    if (!el || !hasMore) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisible(v => v + PAGE)
    }, { rootMargin: '400px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, products.length])

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Shell width="wide" className="space-y-6 pt-8">
        <button onClick={() => router.back()} className="ui-mono ui-mono-sm inline-flex items-center gap-2 text-ink-secondary hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> Back
        </button>
        <PageHeader
          eyebrow="For you"
          title="Recommended for you"
          description={
            personalised
              ? 'Picked from what you have looked at and searched for.'
              : 'Popular on campus right now. Browse and search a little and these will start to fit you.'
          }
        />

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ink-muted" /></div>
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : products.length === 0 ? (
          <div className="border border-dashed border-border bg-card p-12 text-center">
            <p className="text-sm font-medium text-ink">Nothing to recommend yet</p>
            <p className="mt-1 text-xs text-ink-secondary">Listings will show up here as soon as sellers post them.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {products.slice(0, visible).map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product as never}
                  layout="grid"
                  priority={i < 4}
                  onOpen={() => router.push(`/product/${product.id}`)}
                />
              ))}
            </div>
            {hasMore && <div ref={loaderRef} className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>}
          </>
        )}
      </Shell>
    </div>
  )
}
