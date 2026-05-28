export const dynamic = 'force-dynamic'
// app/api/admin/products/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    if (decoded.role !== 'ADMIN') return null
    return decoded
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const universityId = searchParams.get('universityId') || 'all'
    const search       = searchParams.get('search') || ''
    const flagged      = searchParams.get('flagged') === 'true'
    const page         = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit        = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const skip         = (page - 1) * limit

    const where: any = { isDeleted: false }

    if (flagged) {
      where.isFlagged = true
    }

    if (universityId !== 'all') {
      where.universityId = universityId
    }

    if (search.trim()) {
      where.OR = [
        { name:     { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          seller: {
            select: {
              id:   true,
              name: true,
              university: { select: { shortName: true } },
            },
          },
          _count: {
            select: { productReports: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({ products, total, page, limit })
  } catch (error) {
    console.error('Admin products error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
