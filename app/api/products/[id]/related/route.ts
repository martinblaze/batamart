export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { computeHybridRecommendationScore, jaccardSimilarity, logNormalize, priceSimilarityScore, recencyNormalize } from '@/lib/recommendation-ranking'

const SECTION_LIMITS = {
  coView: 8,
  similar: 8,
  deals: 6,
  seller: 6,
  subcategory: 8,
} as const

const JSON_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
}

type AttributeValue = {
  key: string
  label: string
  value: unknown
}

type RelatedProduct = {
  id: string
  name: string
  price: number
  priceDisplay: string
  images: string[]
  avgRating: number
  totalReviews: number
  isHot: boolean
  isDeal: boolean
  discountPercent: number | null
  seller: { id: string; name: string; trustLevel: string; avgRating: number }
  deliveryEstimate: string | null
  matchReason?: string
}

type RelatedSection = {
  title: string
  reason: string
  products: RelatedProduct[]
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(price || 0))
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function toValueList(value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value.flatMap((item) => toValueList(item))
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).flatMap((item) => toValueList(item))
  const text = String(value).trim()
  if (!text) return []
  return text
    .split(/[,|]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toAttrTokens(values: AttributeValue[]) {
  return values.flatMap((attr) => toValueList(attr.value).map((value) => `${attr.key}:${normalizeText(value)}`))
}

function overlaps(source: AttributeValue[], candidate: AttributeValue[], key: string) {
  const sourceValues = source.filter((attr) => normalizeText(attr.key) === key).flatMap((attr) => toValueList(attr.value))
  const candidateValues = candidate.filter((attr) => normalizeText(attr.key) === key).flatMap((attr) => toValueList(attr.value))
  const sourceNorm = sourceValues.map(normalizeText)
  const candidateNorm = candidateValues.map(normalizeText)
  return sourceNorm.length > 0 && candidateNorm.some((value) => sourceNorm.includes(value))
}

function modelFamilyMatch(source: AttributeValue[], candidate: AttributeValue[]) {
  const sourceModels = source.filter((attr) => normalizeText(attr.key) === 'model').flatMap((attr) => toValueList(attr.value).map(normalizeText))
  const candidateModels = candidate.filter((attr) => normalizeText(attr.key) === 'model').flatMap((attr) => toValueList(attr.value).map(normalizeText))
  if (sourceModels.length === 0 || candidateModels.length === 0) return false
  return sourceModels.some((src) => candidateModels.some((cand) => cand.includes(src) || src.includes(cand)))
}

function matchReason(source: AttributeValue[], candidate: AttributeValue[]) {
  const parts: string[] = []
  if (overlaps(source, candidate, 'brand')) parts.push('Same brand')
  if (modelFamilyMatch(source, candidate)) parts.push('Same model family')
  for (const key of ['storage', 'ram', 'size', 'type']) {
    if (overlaps(source, candidate, key)) parts.push(`Same ${key}`)
  }
  return parts.slice(0, 3).join(' · ')
}

function uniqueProducts(products: RelatedProduct[], seen: Set<string>) {
  const out: RelatedProduct[] = []
  for (const product of products) {
    if (seen.has(product.id)) continue
    seen.add(product.id)
    out.push(product)
  }
  return out
}

function toRelatedProduct(product: any, match?: string): RelatedProduct {
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price || 0),
    priceDisplay: formatPrice(Number(product.price || 0)),
    images: Array.isArray(product.images) ? product.images.filter(Boolean) : [],
    avgRating: Number(product.avgRating ?? product.seller?.avgRating ?? 0),
    totalReviews: Number(product.totalReviews ?? 0),
    isHot: Boolean(product.isHot),
    isDeal: Boolean(product.isDeal),
    discountPercent: product.discountPercent ?? null,
    seller: {
      id: product.seller?.id || product.sellerId || '',
      name: product.seller?.name || '',
      trustLevel: product.seller?.trustLevel || 'BRONZE',
      avgRating: Number(product.seller?.avgRating ?? 0),
    },
    deliveryEstimate: product.deliveryEstimate || null,
    ...(match ? { matchReason: match } : {}),
  }
}

function pickTop(products: RelatedProduct[], limit: number) {
  return products.slice(0, limit)
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: JSON_HEADERS })
    if (!user.universityId) return NextResponse.json({ error: 'No university on account' }, { status: 403, headers: JSON_HEADERS })

    const source = await prisma.product.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        price: true,
        categoryKey: true,
        subcategoryKey: true,
        sellerId: true,
        universityId: true,
        attributeValues: {
          select: { key: true, label: true, value: true },
        },
        seller: {
          select: { id: true, name: true, avgRating: true, trustLevel: true },
        },
      },
    })

    if (!source) return NextResponse.json({ error: 'Product not found' }, { status: 404, headers: JSON_HEADERS })
    if (source.universityId !== user.universityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: JSON_HEADERS })
    }

    const sourceTokens = toAttrTokens(source.attributeValues)
    const usedIds = new Set<string>([source.id])

    const coViewRowsPromise = prisma.productCoView.findMany({
      where: { productId: source.id },
      select: { relatedProductId: true, count: true },
      orderBy: { count: 'desc' },
      take: 20,
    })

    const scopeWhere = {
      id: { not: source.id },
      isActive: true,
      isDeleted: false,
      quantity: { gt: 0 },
      moderationStatus: 'APPROVED',
      universityId: source.universityId,
    } as const

    const similarCandidatesPromise = source.subcategoryKey
      ? prisma.product.findMany({
          where: { ...scopeWhere, subcategoryKey: source.subcategoryKey },
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            categoryKey: true,
            subcategoryKey: true,
            avgRating: true,
            totalReviews: true,
            isHot: true,
            isDeal: true,
            discountPercent: true,
            deliveryEstimate: true,
            sellerId: true,
            seller: { select: { id: true, name: true, avgRating: true, trustLevel: true } },
            attributeValues: { select: { key: true, label: true, value: true } },
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 40,
        })
      : Promise.resolve([])

    const dealsCandidatesPromise = source.subcategoryKey
      ? prisma.product.findMany({
          where: {
            ...scopeWhere,
            subcategoryKey: source.subcategoryKey,
            OR: [{ isDeal: true }, { discountPercent: { gte: 10 } }],
          },
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            categoryKey: true,
            subcategoryKey: true,
            avgRating: true,
            totalReviews: true,
            isHot: true,
            isDeal: true,
            discountPercent: true,
            deliveryEstimate: true,
            sellerId: true,
            seller: { select: { id: true, name: true, avgRating: true, trustLevel: true } },
          },
          orderBy: [{ discountPercent: 'desc' }, { createdAt: 'desc' }],
          take: 12,
        })
      : Promise.resolve([])

    const sellerCandidatesPromise = prisma.product.findMany({
      where: {
        ...scopeWhere,
        sellerId: source.sellerId,
      },
      select: {
        id: true,
        name: true,
        price: true,
        images: true,
        categoryKey: true,
        subcategoryKey: true,
        avgRating: true,
        totalReviews: true,
        isHot: true,
        isDeal: true,
        discountPercent: true,
        deliveryEstimate: true,
        sellerId: true,
        seller: { select: { id: true, name: true, avgRating: true, trustLevel: true } },
      },
      orderBy: [{ isHot: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    })

    const subcategoryCandidatesPromise = source.subcategoryKey
      ? prisma.product.findMany({
          where: {
            ...scopeWhere,
            subcategoryKey: source.subcategoryKey,
            price: { gte: source.price * 0.4, lte: source.price * 2.5 },
          },
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            categoryKey: true,
            subcategoryKey: true,
            avgRating: true,
            totalReviews: true,
            isHot: true,
            isDeal: true,
            discountPercent: true,
            deliveryEstimate: true,
            sellerId: true,
            seller: { select: { id: true, name: true, avgRating: true, trustLevel: true } },
          },
          orderBy: [{ isHot: 'desc' }, { avgRating: 'desc' }, { viewCount: 'desc' }],
          take: 20,
        })
      : Promise.resolve([])

    const [coViewRows, similarCandidates, dealsCandidates, sellerCandidates, subcategoryCandidates] = await Promise.all([
      coViewRowsPromise,
      similarCandidatesPromise,
      dealsCandidatesPromise,
      sellerCandidatesPromise,
      subcategoryCandidatesPromise,
    ])

    const coViewIds = coViewRows.map((row) => row.relatedProductId)
    const coViewProducts = coViewIds.length
      ? await prisma.product.findMany({
          where: {
            ...scopeWhere,
            id: { in: coViewIds },
          },
          select: {
            id: true,
            name: true,
            price: true,
            images: true,
            categoryKey: true,
            subcategoryKey: true,
            avgRating: true,
            totalReviews: true,
            isHot: true,
            isDeal: true,
            discountPercent: true,
            deliveryEstimate: true,
            sellerId: true,
            viewCount: true,
            createdAt: true,
            seller: { select: { id: true, name: true, avgRating: true, trustLevel: true } },
            _count: { select: { orders: true } },
            attributeValues: { select: { key: true, label: true, value: true } },
          },
        })
      : []

    const maxCoView = Math.max(...coViewRows.map((row) => row.count), 1)
    const maxPopularity = Math.max(
      ...coViewProducts.map((product) => Number(product.viewCount || 0) + Number(product._count?.orders || 0)),
      1,
    )
    const coViewMap = new Map(coViewRows.map((row) => [row.relatedProductId, row.count]))

    // ── Customers also bought (order-based co-purchase signal) ──────────────
    let coBought: RelatedProduct[] = []
    try {
      const ordersWithSource = await prisma.order.findMany({
        where: { universityId: source.universityId, items: { some: { productId: source.id } } },
        select: { id: true },
        take: 500,
      })
      const orderIds = ordersWithSource.map((o) => o.id)
      if (orderIds.length > 0) {
        const coPurchaseGroups = await prisma.orderItem.groupBy({
          by: ['productId'],
          where: { orderId: { in: orderIds }, productId: { not: source.id } },
          _count: { _all: true },
          orderBy: { _count: { _all: 'desc' } },
          take: 20,
        })
        const coPurchaseIds = coPurchaseGroups.map((g) => g.productId)
        if (coPurchaseIds.length) {
          const coPurchaseProducts = await prisma.product.findMany({
            where: { ...scopeWhere, id: { in: coPurchaseIds } },
            select: {
              id: true,
              name: true,
              price: true,
              images: true,
              categoryKey: true,
              subcategoryKey: true,
              avgRating: true,
              totalReviews: true,
              isHot: true,
              isDeal: true,
              discountPercent: true,
              deliveryEstimate: true,
              sellerId: true,
              viewCount: true,
              createdAt: true,
              seller: { select: { id: true, name: true, avgRating: true, trustLevel: true } },
              _count: { select: { orders: true } },
              attributeValues: { select: { key: true, label: true, value: true } },
            },
          })
          const maxCo = Math.max(...coPurchaseGroups.map((g) => g._count._all), 1)
          const maxPopularity2 = Math.max(
            ...coPurchaseProducts.map((p) => Number(p.viewCount || 0) + Number(p._count?.orders || 0)),
            1,
          )
          const groupMap = new Map(coPurchaseGroups.map((g) => [g.productId, g._count._all]))
          coBought = pickTop(
            coPurchaseProducts
              .map((product) => {
                const count = groupMap.get(product.id) || 0
                const coPurchaseScore = logNormalize(count, maxCo)
                const attributeSimilarity = jaccardSimilarity(sourceTokens, toAttrTokens(product.attributeValues || []))
                const popularity = logNormalize(Number(product.viewCount || 0) + Number(product._count?.orders || 0), maxPopularity2)
                const score = computeHybridRecommendationScore({
                  coViewScore: coPurchaseScore,
                  attributeSimilarity,
                  sessionMatch: 0,
                  popularity,
                  priceSimilarity: priceSimilarityScore(source.price, Number(product.price || 0)),
                  recency: recencyNormalize(product.createdAt),
                })
                return { product, score }
              })
              .filter(({ score }) => score >= 0.1)
              .sort((a, b) => b.score - a.score)
              .map(({ product }) => toRelatedProduct(product)),
            8,
          )
        }
      }
    } catch (err) {
      console.error('Co-purchase signal error:', err)
    }

    const coViewed = pickTop(
      coViewProducts
        .map((product) => {
          const coViewScore = logNormalize(coViewMap.get(product.id) || 0, maxCoView)
          const attributeSimilarity = jaccardSimilarity(sourceTokens, toAttrTokens(product.attributeValues || []))
          const popularity = logNormalize(Number(product.viewCount || 0) + Number(product._count?.orders || 0), maxPopularity)
          const score = computeHybridRecommendationScore({
            coViewScore,
            attributeSimilarity,
            sessionMatch: 0,
            popularity,
            priceSimilarity: priceSimilarityScore(source.price, Number(product.price || 0)),
            recency: recencyNormalize(product.createdAt),
          })
          return { product, score }
        })
        .filter(({ score }) => score >= 0.1)
        .sort((a, b) => b.score - a.score)
        .map(({ product }) => toRelatedProduct(product)),
      SECTION_LIMITS.coView,
    )

    usedIds.add(source.id)
    const sections: RelatedSection[] = []

    if (coBought.length >= 2) {
      sections.push({
        title: 'Customers also bought',
        reason: 'Based on campus purchase history',
        products: uniqueProducts(coBought, usedIds),
      })
    }

    if (coViewed.length >= 2) {
      sections.push({
        title: 'Customers also viewed',
        reason: 'Based on campus browsing patterns',
        products: uniqueProducts(coViewed, usedIds),
      })
    }

    const similar = similarCandidates
      .map((product) => {
        const similarity = jaccardSimilarity(sourceTokens, toAttrTokens(product.attributeValues || []))
        return {
          product,
          score: similarity,
          reason: matchReason(source.attributeValues, product.attributeValues || []),
        }
      })
      .filter(({ score, product }) => score >= 0.2 && !usedIds.has(product.id))
      .sort((a, b) => b.score - a.score)
      .map(({ product, reason }) => toRelatedProduct(product, reason))

    const similarPicked = uniqueProducts(pickTop(similar, SECTION_LIMITS.similar), usedIds)
    if (similarPicked.length >= 2) {
      sections.push({
        title: 'Similar products',
        reason: 'Same subcategory and attribute overlaps',
        products: similarPicked,
      })
    }

    const deals = uniqueProducts(
      dealsCandidates
        .map((product) => toRelatedProduct(product))
        .filter((product) => !usedIds.has(product.id))
        .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0) || b.price - a.price)
        .slice(0, SECTION_LIMITS.deals),
      usedIds,
    )
    if (deals.length >= 2) {
      sections.push({
        title: 'Deals on related products',
        reason: 'Discounted items in the same subcategory',
        products: deals,
      })
    }

    const sellerProducts = uniqueProducts(
      sellerCandidates
        .map((product) => toRelatedProduct(product))
        .filter((product) => !usedIds.has(product.id))
        .slice(0, SECTION_LIMITS.seller),
      usedIds,
    )
    if (sellerProducts.length >= 2) {
      sections.push({
        title: `More from ${source.seller?.name || 'this seller'}`,
        reason: 'Listings from the same shop',
        products: sellerProducts,
      })
    }

    const moreInSubcategory = uniqueProducts(
      subcategoryCandidates
        .map((product) => toRelatedProduct(product))
        .filter((product) => !usedIds.has(product.id))
        .sort((a, b) => (b.isHot ? 1 : 0) - (a.isHot ? 1 : 0) || b.avgRating - a.avgRating || b.price - a.price)
        .slice(0, SECTION_LIMITS.subcategory),
      usedIds,
    )
    if (moreInSubcategory.length >= 2) {
      sections.push({
        title: source.subcategoryKey ? `More in this subcategory` : 'More from this category',
        reason: 'Similar price range and listing activity',
        products: moreInSubcategory,
      })
    }

    const firstSectionProducts = sections[0]?.products || []
    const response = NextResponse.json(
      {
        success: true,
        sections,
        sourceProduct: {
          id: source.id,
          name: source.name,
          categoryKey: source.categoryKey,
          subcategoryKey: source.subcategoryKey,
          seller: source.seller,
        },
        related: {
          nameRelated: sections[0]?.products || [],
          others: sections.slice(1).flatMap((section) => section.products),
          grid: sections.flatMap((section) => section.products),
        },
      },
      { headers: JSON_HEADERS },
    )

    if (firstSectionProducts.length === 0) {
      response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=300')
    }

    return response
  } catch (error) {
    console.error('Related products error:', error)
    return NextResponse.json({ error: 'Failed to fetch related products' }, { status: 500, headers: JSON_HEADERS })
  }
}