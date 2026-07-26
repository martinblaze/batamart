export const revalidate = 60
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { checkRateLimitDistributed, getIpKey, incrementRateLimit } from '@/lib/security/rate-limit'
import {
  computeFeedScore,
  decayWeight,
  popularityScore,
  recencyScore,
  sellerTierScore,
} from '@/lib/feed-ranking'
import { keywordMatchScore, normalizeText } from '@/lib/search-utils'
import { resolveCategoryKey } from '@/lib/variants'

type ActivitySignal = { value: string; timestamp?: number }

function parseList(searchParams: URLSearchParams, primaryKey: string, fallbackKey: string): string[] {
  const raw = searchParams.get(primaryKey) || searchParams.get(fallbackKey) || ''
  return raw.split(',').map((v) => v.trim()).filter(Boolean)
}

function parseActivitySignals(searchParams: URLSearchParams, key: string, fallbackValues: string[]): ActivitySignal[] {
  const raw = searchParams.get(key)
  if (!raw) return fallbackValues.map((value) => ({ value }))
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return fallbackValues.map((value) => ({ value }))
    return parsed
      .map((entry) => {
        if (typeof entry === 'string') return { value: entry }
        if (!entry || typeof entry !== 'object') return null
        const value = typeof entry.value === 'string' ? entry.value : ''
        const timestamp = typeof entry.timestamp === 'number' ? entry.timestamp : undefined
        if (!value) return null
        return { value, timestamp }
      })
      .filter((entry): entry is ActivitySignal => Boolean(entry))
  } catch {
    return fallbackValues.map((value) => ({ value }))
  }
}

function formatNaira(value: number): string {
  return `₦${Math.round(value).toLocaleString('en-NG')}`
}

function addVariantPriceDisplay<T extends { variantsEnabled?: boolean | null; variants?: Array<{ price: number }>; price: number }>(
  product: T,
): T & { minPrice: number; maxPrice: number; priceDisplay: string } {
  if (product.variantsEnabled && Array.isArray(product.variants) && product.variants.length > 0) {
    const prices = product.variants.map((v) => Number(v.price)).filter((p) => Number.isFinite(p) && p > 0)
    if (prices.length) {
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)
      return {
        ...product,
        minPrice,
        maxPrice,
        priceDisplay: minPrice === maxPrice ? formatNaira(minPrice) : `${formatNaira(minPrice)} - ${formatNaira(maxPrice)}`,
      }
    }
  }
  const basePrice = Number(product.price || 0)
  return { ...product, minPrice: basePrice, maxPrice: basePrice, priceDisplay: formatNaira(basePrice) }
}

function applyDiversity<T extends { sellerId: string; categoryKey?: string | null; category: string }>(items: T[]): T[] {
  const seenSellers = new Map<string, number>()
  const seenCategories = new Map<string, number>()
  const filtered: T[] = []

  for (const item of items) {
    const sellerCount = seenSellers.get(item.sellerId) || 0
    const categoryBucket = item.categoryKey || normalizeText(item.category)
    const categoryCount = seenCategories.get(categoryBucket) || 0
    if (sellerCount >= 3) continue
    if (categoryCount >= 10) continue
    filtered.push(item)
    seenSellers.set(item.sellerId, sellerCount + 1)
    seenCategories.set(categoryBucket, categoryCount + 1)
  }

  return filtered
}

export async function GET(request: NextRequest) {
  try {
    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
    const rate = await checkRateLimitDistributed(
      `products:feed:${ip}`,
      60,
      60 * 1000,
      { requireDistributedInProduction: true },
    )
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many feed requests. Please wait.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSecs) } },
      )
    }
    await incrementRateLimit(`products:feed:${ip}`, 60 * 1000)

    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.universityId) return NextResponse.json({ error: 'No university on account' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const limit = Math.max(50, Math.min(100, Number(searchParams.get('limit') || 100)))
    const zone = (searchParams.get('zone') || '').trim()

    const categoriesFallback = parseList(searchParams, 'categories', 'viewed')
    const keywordsFallback = parseList(searchParams, 'keywords', 'searched')
    const categorySignals = parseActivitySignals(searchParams, 'categorySignals', categoriesFallback)
    const keywordSignals = parseActivitySignals(searchParams, 'keywordSignals', keywordsFallback)

    const hasCategorySignals = categorySignals.length > 0
    const hasKeywordSignals = keywordSignals.length > 0
    const usedFallback = !hasCategorySignals && !hasKeywordSignals

    const allProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        quantity: { gt: 0 },
        isDeleted: false,
        universityId: user.universityId,
        ...(zone ? { landmark: { equals: zone, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
        price: true,
        basePrice: true,
        category: true,
        subcategory: true,
        categoryKey: true,
        sellerId: true,
        quantity: true,
        images: true,
        landmark: true,
        viewCount: true,
        createdAt: true,
        isHot: true,
        isDeal: true,
        discountPercent: true,
        marketPrice: true,
        variantsEnabled: true,
        variants: { select: { price: true } },
        seller: {
          select: {
            id: true,
            name: true,
            profilePhoto: true,
            avgRating: true,
            trustLevel: true,
            completedOrders: true,
          },
        },
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    if (!allProducts.length) {
      return NextResponse.json({
        success: true,
        products: [],
        hotProducts: [],
        forYouProducts: [],
        newListings: [],
        discoverProducts: [],
        meta: { usedFallback },
      })
    }

    const maxPopularityLog = Math.max(
      ...allProducts.map((p) => Math.log1p((p.viewCount || 0) + (p._count?.orders || 0))),
      1,
    )
    const now = Date.now()

    const scored = allProducts.map((rawProduct) => {
      const product = addVariantPriceDisplay(rawProduct)
      const recency = recencyScore(product.createdAt, now)
      const popularity = popularityScore(product.viewCount || 0, product._count?.orders || 0, maxPopularityLog)
      const tier = sellerTierScore(product.seller?.trustLevel)
      const categoryToken = normalizeText(resolveCategoryKey(product.categoryKey || product.category || '') || product.categoryKey || product.category || '')
      const haystack = normalizeText(
        [product.name, product.category, product.subcategory || ''].join(' '),
      )

      let categoryMatch = 0
      if (hasCategorySignals) {
        const score = categorySignals.reduce((best, signal) => {
          const matchValue = normalizeText(resolveCategoryKey(signal.value) || signal.value)
          if (!matchValue) return best
          const isMatch = categoryToken === matchValue || haystack.includes(matchValue)
          if (!isMatch) return best
          return Math.max(best, decayWeight(signal.timestamp, now))
        }, 0)
        categoryMatch = Math.min(1, score)
      }

      let keywordMatch = 0
      if (hasKeywordSignals) {
        keywordMatch = keywordSignals.reduce((best, signal) => {
          const kw = signal.value
          if (!kw) return best
          const base = keywordMatchScore(haystack, kw)
          if (base <= 0) return best
          const weighted = base * (signal.timestamp ? decayWeight(signal.timestamp, now) : 1)
          return Math.max(best, weighted)
        }, 0)
        keywordMatch = Math.min(1, keywordMatch)
      }

      const score = usedFallback
        ? 0.6 * popularity + 0.4 * recency
        : computeFeedScore({
            categoryMatch,
            keywordMatch,
            recencyScore: recency,
            popularityScore: popularity,
            sellerTierScore: tier,
          })

      return {
        ...product,
        score,
        popularityScore: popularity,
        recencyScore: recency,
        isPersonalised: !usedFallback && score >= 0.45,
        isNew: (now - new Date(product.createdAt).getTime()) / 86400000 <= 7,
        isHot: product.isHot ?? false,
        isDeal: product.isDeal ?? false,
        discountPercent: product.discountPercent ?? null,
        marketPrice: product.marketPrice ?? null,
      }
    })

    const uniqueById = <T extends { id: string }>(items: T[]) => {
      const seen = new Set<string>()
      return items.filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
    }

    const hotProducts = uniqueById(
      applyDiversity(
        [...scored]
          .sort((a, b) => b.popularityScore - a.popularityScore || b.score - a.score)
          .slice(0, 40),
      ),
    ).slice(0, 20)

    const forYouSource = usedFallback
      ? [...scored].sort((a, b) => b.popularityScore - a.popularityScore || b.recencyScore - a.recencyScore)
      : [...scored].sort((a, b) => b.score - a.score)

    const forYouProducts = uniqueById(applyDiversity(forYouSource)).slice(0, 12)

    const newListings = uniqueById(
      applyDiversity(
        [...scored].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      ),
    ).slice(0, 12)

    const shownIds = new Set([...hotProducts, ...forYouProducts, ...newListings].map((p) => p.id))
    const discoverPool = scored.filter((p) => !shownIds.has(p.id))
    const topDiscover = discoverPool.sort((a, b) => b.score - a.score).slice(0, 60)
    const shuffledTail = [...topDiscover.slice(20)].sort(() => Math.random() - 0.5)
    const discoverProducts = uniqueById(applyDiversity([...topDiscover.slice(0, 20), ...shuffledTail])).slice(0, 40)

    return NextResponse.json({
      success: true,
      products: scored, // kept for backward compatibility
      hotProducts,
      forYouProducts,
      newListings,
      discoverProducts,
      meta: { usedFallback },
    })
  } catch (error) {
    console.error('Feed error:', error)
    return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 })
  }
}
