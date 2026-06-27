import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CATEGORY_TREE } from '@/lib/variants'

export const dynamic = 'force-dynamic'

const FALLBACK_POPULAR = [
  'iPhone',
  'Samsung',
  'Laptop',
  'Sneakers',
  'Hair cream',
  'Fridge',
  'Backpack',
  'Headphones',
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const type = searchParams.get('type') || ''
  const limit = Math.min(10, Math.max(1, parseInt(searchParams.get('limit') || '8', 10) || 8))

  try {
    if (type === 'popular') {
      try {
        const rows = await prisma.searchLog.groupBy({
          by: ['query'],
          _count: { query: true },
          orderBy: { _count: { query: 'desc' } },
          take: limit,
        })
        return NextResponse.json({
          suggestions: rows.map((row) => ({ text: row.query, type: 'popular' as const })),
        })
      } catch {
        return NextResponse.json({
          suggestions: FALLBACK_POPULAR.slice(0, limit).map((text) => ({ text, type: 'popular' as const })),
        })
      }
    }

    if (!q) {
      return NextResponse.json({ suggestions: [] })
    }

    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: {
          isDeleted: false,
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
            { subcategory: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          name: true,
          category: true,
        },
        take: limit,
      }),
      Promise.resolve(
        Object.values(CATEGORY_TREE)
          .flatMap((cat) => [cat.label, ...Object.values(cat.subcategories).map((sub) => sub.label)])
          .filter((label) => label.toLowerCase().includes(q.toLowerCase()))
          .slice(0, limit)
      ),
    ])

    const seen = new Set<string>()
    const suggestions = [
      ...products.map((product) => ({ text: product.name, category: product.category, type: 'product' as const })),
      ...categories.map((category) => ({ text: category, type: 'category' as const })),
    ].filter((item) => {
      const key = item.text.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, limit)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Search suggestions error:', error)
    return NextResponse.json({ suggestions: [] }, { status: 500 })
  }
}
