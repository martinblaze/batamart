import { PrismaClient } from '@prisma/client'
import { getCategoryQueryValues } from '../lib/variants'

const prisma = new PrismaClient()

async function test(requestedCategoryKey: string) {
  // Simulate what backend does:
  // resolveCategoryKey
  const CATEGORY_TREE: any = {
    electronics: { label: 'Electronics' },
    computing: { label: 'Computing' },
    fashion: { label: 'Fashion' },
    home_kitchen: { label: 'Home & Kitchen' },
    groceries: { label: 'Food & Groceries' },
    beauty: { label: 'Beauty & Health' },
    sports: { label: 'Sports & Fitness' },
    vehicles: { label: 'Vehicles & Transport' },
    books: { label: 'Books & Stationery' },
    tickets: { label: 'Tickets & Events' },
    kids: { label: 'Kids & Baby' },
    arts_crafts: { label: 'Arts & Crafts' },
  }

  function resolveCategoryKeyLocal(input: string) {
    const value = input?.trim()
    if (!value) return ''
    if (CATEGORY_TREE[value]) return value
    const normalized = value.toLowerCase()
    const match = Object.entries(CATEGORY_TREE).find(([key, category]: any) => {
      return key.toLowerCase() === normalized || category.label.toLowerCase() === normalized
    })
    return match?.[0] || ''
  }

  const categoryKey = resolveCategoryKeyLocal(requestedCategoryKey)
  console.log(`\nSimulating for input: "${requestedCategoryKey}" -> resolved categoryKey: "${categoryKey}"`)

  const categoryValues = getCategoryQueryValues(requestedCategoryKey || CATEGORY_TREE[categoryKey]?.label || '')
  console.log('categoryValues for query:', categoryValues)

  const where: any = {
    isActive: true,
    isDeleted: false,
    moderationStatus: 'APPROVED',
  }

  if (categoryKey && categoryKey !== 'all') {
    where.AND = [
      {
        OR: [
          { categoryKey: categoryKey },
          ...(categoryValues.length > 0 ? categoryValues.map((value) => ({ category: { equals: value } })) : []),
        ],
      },
    ]
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      category: true,
      categoryKey: true,
    },
  })

  console.log(`Matched ${products.length} products.`)
  if (products.length > 0) {
    console.log('Sample matches (up to 5):')
    console.log(products.slice(0, 5))
  }
}

async function main() {
  await test('beauty')
  await test('Beauty & Health')
  await test('Beauty & Personal Care')
  await test('Food & Groceries')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
