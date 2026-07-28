import { prisma } from '@/lib/prisma'
import { CATEGORY_TREE } from './variants'

export type AttributeQueryFilters = Record<string, string | string[]>

const RESERVED_QUERY_KEYS = new Set([
  'page',
  'limit',
  'category',
  'categoryKey',
  'subcategory',
  'subcategoryKey',
  'hostel',
  'search',
  'q',
  'minPrice',
  'maxPrice',
  'attributes',
  'sort',
  'sortBy',
  'campaignTag',
])

export async function getCategoryAttributes(categoryKey?: string | null, subcategoryKey?: string | null) {
  if (!categoryKey) return []

  const rows = await prisma.categoryAttribute.findMany({
    where: {
      categoryKey,
      OR: [{ subcategoryKey: null }, ...(subcategoryKey ? [{ subcategoryKey }] : [])],
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  // subcategory-specific overrides category-level for same key
  const map = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    const existing = map.get(row.key)
    if (!existing) {
      map.set(row.key, row)
      continue
    }
    const existingSpecific = !!existing.subcategoryKey
    const currentSpecific = !!row.subcategoryKey
    if (!existingSpecific && currentSpecific) map.set(row.key, row)
  }
  return Array.from(map.values()).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function normalizeAttributeValue(value: unknown): string | number | boolean | string[] | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const t = value.trim()
    if (!t) return null
    if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true'
    const asNum = Number(t)
    if (!Number.isNaN(asNum) && /^\d+(\.\d+)?$/.test(t)) return asNum
    return t
  }
  return String(value)
}

export function attributeValueMatches(value: unknown, filterValue: unknown): boolean {
  const normalizedValue = normalizeAttributeValue(value)
  const normalizedFilter = normalizeAttributeValue(filterValue)
  if (normalizedValue === null || normalizedFilter === null) return false

  if (Array.isArray(normalizedValue)) {
    if (Array.isArray(normalizedFilter)) {
      return normalizedFilter.every((f) =>
        normalizedValue.some((v) => v.toLowerCase() === f.toLowerCase()),
      )
    }
    return normalizedValue.some((v) => v.toLowerCase() === String(normalizedFilter).toLowerCase())
  }

  if (typeof normalizedValue === 'number' && typeof normalizedFilter === 'number') {
    return normalizedValue === normalizedFilter
  }
  if (typeof normalizedValue === 'boolean' && typeof normalizedFilter === 'boolean') {
    return normalizedValue === normalizedFilter
  }
  return String(normalizedValue).toLowerCase() === String(normalizedFilter).toLowerCase()
}

export function buildAttributeFiltersFromQuery(searchParams: URLSearchParams): AttributeQueryFilters {
  const out: AttributeQueryFilters = {}

  const rawAttributes = searchParams.get('attributes')
  if (rawAttributes) {
    try {
      const parsed = JSON.parse(rawAttributes)
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const normalized = normalizeAttributeValue(v)
          if (normalized !== null) out[k] = normalized as string | string[]
        }
      }
    } catch {
      // ignore invalid JSON; fall through to simple query parsing
    }
  }

  for (const [key, value] of searchParams.entries()) {
    if (RESERVED_QUERY_KEYS.has(key)) continue
    if (!value?.trim()) continue
    if (key.startsWith('attributes[') && key.endsWith(']')) {
      const cleanKey = key.slice('attributes['.length, -1).trim()
      if (!cleanKey) continue
      out[cleanKey] = value
      continue
    }
    // simple query mode: brand=Apple&storage=128GB
    out[key] = value
  }

  return out
}

export function getSubcategoryOrCategoryFallback(categoryKey?: string | null, subcategoryKey?: string | null) {
  if (!categoryKey) return null
  if (!subcategoryKey) return categoryKey
  try {
    const cat = CATEGORY_TREE[categoryKey]
    if (!cat) return categoryKey
    if (Object.prototype.hasOwnProperty.call(cat.subcategories || {}, subcategoryKey)) return subcategoryKey
    return categoryKey
  } catch {
    return categoryKey
  }
}
