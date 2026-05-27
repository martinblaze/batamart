import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [dbSizeRows, notificationCount, productCount, userCount, orderCount] = await Promise.all([
      prisma.$queryRaw<Array<{ size: string }>>`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`,
      prisma.notification.count(),
      prisma.product.count(),
      prisma.user.count(),
      prisma.order.count(),
    ])

    return NextResponse.json({
      dbSize: dbSizeRows[0]?.size ?? null,
      notificationCount,
      productCount,
      userCount,
      orderCount,
    })
  } catch (error) {
    console.error('Usage endpoint error:', error)
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 })
  }
}
