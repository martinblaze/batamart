import { PrismaClient } from '@prisma/client'

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
import { CATEGORY_TREE } from '../lib/variants'

function buildMapFromCategoryTree() {
  const out: Record<string, Record<string, AttrDef[]>> = {}
  for (const [categoryKey, cat] of Object.entries(CATEGORY_TREE)) {
    out[categoryKey] = {}
    for (const [subcategoryKey, sub] of Object.entries(cat.subcategories || {})) {
      const attrs: AttrDef[] = (sub.variants || []).map((v, i) => ({
        key: v.key,
        label: v.label,
        type: v.suggestions && v.suggestions.length > 1 ? 'select' : 'text',
        options: v.suggestions && v.suggestions.length ? v.suggestions : undefined,
        required: false,
        filterable: true,
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
