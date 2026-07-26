export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { CATEGORY_TREE } from '@/lib/variants'
import { getCategoryAttributes, buildAttributeFiltersFromQuery } from '@/lib/category-attributes'

type FilterOption = { value: string; count: number }

type FilterDef = {
  key: string
  label: string
  type: 'select' | 'multi_select' | 'boolean' | 'range'
  source: 'attribute' | 'variant' | 'merged'
  options: FilterOption[]
  selectedValues: string[]
}

function toValues(value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  const text = String(value).trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean)
    if (parsed && typeof parsed === 'object') return Object.values(parsed).flatMap((item) => toValues(item))
  } catch {}
  return text.split(',').map((item) => item.trim()).filter(Boolean)
}

function getQueryFilters(searchParams: URLSearchParams): Record<string, string[]> {
  const filters: Record<string, string[]> = {}

  const rawAttributes = searchParams.get('attributes')
  if (rawAttributes) {
    try {
      const parsed = JSON.parse(rawAttributes)
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed)) {
          const values = toValues(value)
          if (values.length > 0) filters[key] = values
        }
      }
    } catch {}
  }

  for (const [key, value] of searchParams.entries()) {
    if ([
      'categoryKey',
      'subcategoryKey',
      'category',
      'sub',
      'q',
      'search',
      'page',
      'limit',
      'sort',
      'sortBy',
      'minPrice',
      'maxPrice',
      'minRating',
      'inStock',
      'sellerId',
      'attributes',
      'hostel',
      'zone',
      'delivery',
    ].includes(key)) continue

    const cleanKey = key.endsWith('[]') ? key.slice(0, -2) : key
    const values = toValues(value)
    if (!values.length) continue
    filters[cleanKey] = [...new Set([...(filters[cleanKey] || []), ...values])]
  }

  return filters
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.universityId) return NextResponse.json({ error: 'No university on user' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const categoryKey = searchParams.get('categoryKey') || searchParams.get('category') || ''
    const subcategoryKey = searchParams.get('subcategoryKey') || searchParams.get('sub') || ''
    const queryText = (searchParams.get('q') || searchParams.get('search') || '').trim()
    const selectedFilters = getQueryFilters(searchParams)

    const baseWhere: any = {
      isActive: true,
      isDeleted: false,
      quantity: { gt: 0 },
      moderationStatus: 'APPROVED',
      universityId: user.universityId,
    }
    if (categoryKey && categoryKey !== 'all') baseWhere.categoryKey = categoryKey
    if (subcategoryKey) baseWhere.subcategoryKey = subcategoryKey
    if (queryText) {
      const tokens = queryText.substring(0, 120).split(/\s+/).filter(Boolean)
      baseWhere.AND = tokens.map((token) => ({
        OR: [
          { name: { contains: token, mode: 'insensitive' } },
          { category: { contains: token, mode: 'insensitive' } },
          { subcategory: { contains: token, mode: 'insensitive' } },
          { description: { contains: token, mode: 'insensitive' } },
          { seller: { name: { contains: token, mode: 'insensitive' } } },
        ],
      }))
    }

    const [products, dbAttributes] = await Promise.all([
      prisma.product.findMany({
        where: baseWhere,
        select: {
          id: true,
          price: true,
          category: true,
          categoryKey: true,
          subcategory: true,
          subcategoryKey: true,
          attributeValues: {
            where: { filterable: true },
            select: { key: true, label: true, value: true },
          },
          variants: {
            select: { combination: true },
          },
        },
      }),
      getCategoryAttributes(categoryKey || null, subcategoryKey || null),
    ])

    const min = products.length ? Math.min(...products.map((product) => product.price).filter((price) => Number.isFinite(price))) : 0
    const max = products.length ? Math.max(...products.map((product) => product.price).filter((price) => Number.isFinite(price))) : 0

    const valueCounts = new Map<string, Map<string, number>>()
    const sourceMap = new Map<string, 'attribute' | 'variant' | 'merged'>()

    for (const product of products) {
      const seen = new Map<string, Set<string>>()

      for (const attr of product.attributeValues) {
        const key = attr.key
        const values = toValues(attr.value)
        if (!seen.has(key)) seen.set(key, new Set())
        for (const value of values) seen.get(key)!.add(value)
        const current = sourceMap.get(key)
        if (!current) sourceMap.set(key, 'attribute')
        else if (current !== 'attribute') sourceMap.set(key, 'merged')
      }

      for (const variant of product.variants) {
        const combo = (variant.combination || {}) as Record<string, unknown>
        for (const [rawKey, rawValue] of Object.entries(combo)) {
          const key = String(rawKey || '').trim()
          const values = toValues(rawValue)
          if (!key || values.length === 0) continue
          if (!seen.has(key)) seen.set(key, new Set())
          for (const value of values) seen.get(key)!.add(value)
          const current = sourceMap.get(key)
          if (!current) sourceMap.set(key, 'variant')
          else if (current !== 'variant') sourceMap.set(key, 'merged')
        }
      }

      for (const [key, values] of seen.entries()) {
        if (!valueCounts.has(key)) valueCounts.set(key, new Map())
        const counts = valueCounts.get(key)!
        for (const value of values) {
          counts.set(value, (counts.get(value) || 0) + 1)
        }
      }
    }

    const categoryVariantDefs = categoryKey && subcategoryKey && CATEGORY_TREE[categoryKey]?.subcategories?.[subcategoryKey]
      ? CATEGORY_TREE[categoryKey].subcategories[subcategoryKey].variants
      : []

    const defsMap = new Map<string, FilterDef>()

    for (const attr of dbAttributes) {
      const counts = valueCounts.get(attr.key) || new Map<string, number>()
      defsMap.set(attr.key, {
        key: attr.key,
        label: attr.label,
        type: attr.type === 'range' ? 'range' : attr.type === 'boolean' ? 'boolean' : 'multi_select',
        source: sourceMap.get(attr.key) || 'attribute',
        options: Array.from(counts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
        selectedValues: selectedFilters[attr.key] || [],
      })
    }

    for (const variant of categoryVariantDefs) {
      const counts = valueCounts.get(variant.key) || new Map<string, number>()
      const existing = defsMap.get(variant.key)
      const source = existing ? (existing.source === 'attribute' ? 'merged' : existing.source === 'variant' ? 'merged' : existing.source) : 'variant'
      defsMap.set(variant.key, {
        key: variant.key,
        label: variant.label,
        type: 'multi_select',
        source,
        options: Array.from(counts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
        selectedValues: selectedFilters[variant.key] || [],
      })
    }

    const filters = Array.from(defsMap.values())

    return NextResponse.json({
      success: true,
      filters,
      price: { min, max },
      selectedValues: selectedFilters,
    })
  } catch (error) {
    console.error('GET /api/product-filters error:', error)
    return NextResponse.json({ error: 'Failed to load product filters' }, { status: 500 })
  }
}
