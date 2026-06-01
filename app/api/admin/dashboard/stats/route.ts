export const dynamic = 'force-dynamic'
// app/api/admin/dashboard/stats/route.ts
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
    console.error('Admin verification failed for request to /api/admin/dashboard/stats')
    console.error('Authorization header:', req.headers.get('authorization')?.slice(0, 20) + '...')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log(`Admin dashboard access: ${admin.userId}`)

  try {
    const { searchParams } = new URL(req.url)
    // universityId='all' means global stats, any specific ID scopes to that uni
    const universityId = searchParams.get('universityId') || 'all'

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Build university-scoped where clauses
    const uniFilter = universityId !== 'all' ? { universityId } : {}
    const userWhere    = { ...uniFilter, role: { not: 'ADMIN' as const } }
    const productWhere = { ...uniFilter, isActive: true }

    // For orders we scope through buyer's university
    const orderUniFilter = universityId !== 'all'
      ? { buyer: { universityId } }
      : {}

    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingDisputes,
      activeReports,
      newUsersToday,
      ordersToday,
      // Per-university breakdown for the university switcher
      universities,
    ] = await Promise.all([
      prisma.user.count({ where: userWhere }),
      prisma.product.count({ where: productWhere }),
      prisma.order.count({ where: orderUniFilter }),
      prisma.order.aggregate({
        where: { ...orderUniFilter, status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
      prisma.dispute.count({
        where: {
          status: { in: ['OPEN', 'UNDER_REVIEW'] },
          ...(universityId !== 'all' ? { buyer: { universityId } } : {}),
        },
      }),
      prisma.report.count({
        where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } },
      }),
      prisma.user.count({
        where: { ...uniFilter, createdAt: { gte: today } },
      }),
      prisma.order.count({
        where: { ...orderUniFilter, createdAt: { gte: today } },
      }),
      // Always fetch all universities for the switcher dropdown
      prisma.university.findMany({
        select: { id: true, name: true, shortName: true, isActive: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        pendingDisputes,
        activeReports,
        newUsersToday,
        ordersToday,
      },
      universities,
      activeFilter: universityId,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}