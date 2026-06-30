import { PrismaClient } from '@prisma/client'
import { pathToFileURL } from 'node:url'

type AttrType = 'text' | 'select' | 'multi_select' | 'number' | 'boolean'

type AttrDef = {
  key: string
  label: string
  type: AttrType
  options?: string[]
  required?: boolean
  filterable?: boolean
  searchable?: boolean
  sortOrder?: number
}
import { CATEGORY_TREE } from '../lib/variants.js'

const MULTI_SELECT_KEYS = new Set(['color', 'features', 'includes'])

function buildMapFromCategoryTree() {
  const out: Record<string, Record<string, AttrDef[]>> = {}
  for (const [categoryKey, cat] of Object.entries(CATEGORY_TREE)) {
    out[categoryKey] = {}
    for (const [subcategoryKey, sub] of Object.entries(cat.subcategories || {})) {
      const attrs: AttrDef[] = (sub.variants || []).map((v, i) => ({
        key: v.key,
        label: v.label,
        type: !v.suggestions || v.suggestions.length === 0
          ? 'text'
          : MULTI_SELECT_KEYS.has(v.key) || /color/i.test(v.key) || /color/i.test(v.label)
            ? 'multi_select'
            : 'select',
        options: v.suggestions && v.suggestions.length ? v.suggestions : undefined,
        required: false,
        filterable: v.suggestions && v.suggestions.length > 0,
        searchable: true,
        sortOrder: i,
      }))
      out[categoryKey][subcategoryKey] = attrs
    }
  }
  return out
}

const CATEGORY_ATTRIBUTE_MAP = buildMapFromCategoryTree()

export async function seedCategoryAttributes(prisma: PrismaClient) {
  for (const [categoryKey, subMap] of Object.entries(CATEGORY_ATTRIBUTE_MAP)) {
    for (const [subcategoryKey, attrs] of Object.entries(subMap)) {
      for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i]
        await prisma.categoryAttribute.upsert({
          where: {
            categoryKey_subcategoryKey_key: {
              categoryKey,
              subcategoryKey,
              key: attr.key,
            },
          },
          create: {
            categoryKey,
            subcategoryKey,
            key: attr.key,
            label: attr.label,
            type: attr.type,
            options: attr.options || null,
            required: attr.required ?? false,
            filterable: attr.filterable ?? true,
            searchable: attr.searchable ?? true,
            sortOrder: attr.sortOrder ?? i,
          },
          update: {
            label: attr.label,
            type: attr.type,
            options: attr.options || null,
            required: attr.required ?? false,
            filterable: attr.filterable ?? true,
            searchable: attr.searchable ?? true,
            sortOrder: attr.sortOrder ?? i,
          },
        })
      }
    }
  }
}

async function runStandalone() {
  const prisma = new PrismaClient()
  console.log('🌱 Seeding category attributes...')
  try {
    await seedCategoryAttributes(prisma)
    console.log('✅ Category attributes seeded successfully!')
  } catch (error) {
    console.error('❌ Category attribute seeding failed:', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runStandalone()
}
