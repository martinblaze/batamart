export const dynamic = 'force-dynamic'
// app/api/admin/dashboard/activity/route.ts
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
    console.error('Admin verification failed for request to /api/admin/dashboard/activity')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch recent marketplace activity
    const [recentOrders, recentDisputes, recentReports] = await Promise.all([
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          buyer: { select: { name: true, email: true } },
          seller: { select: { name: true } },
        },
      }),
      prisma.dispute.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          buyer: { select: { name: true } },
          seller: { select: { name: true } },
          reason: true,
        },
      }),
      prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          reportedBy: { select: { name: true } },
          reason: true,
        },
      }),
    ])

    // Combine and sort by date
    const activity = [
      ...recentOrders.map(o => ({
        type: 'order',
        title: `Order #${o.id.slice(0, 8)}`,
        description: `${o.buyer.name} → ${o.seller.name} (₦${o.totalAmount})`,
        status: o.status,
        timestamp: o.createdAt,
      })),
      ...recentDisputes.map(d => ({
        type: 'dispute',
        title: `Dispute #${d.id.slice(0, 8)}`,
        description: `${d.reason} - ${d.buyer.name} vs ${d.seller.name}`,
        status: d.status,
        timestamp: d.createdAt,
      })),
      ...recentReports.map(r => ({
        type: 'report',
        title: `Report #${r.id.slice(0, 8)}`,
        description: `${r.type}: ${r.reason}`,
        status: r.status,
        timestamp: r.createdAt,
      })),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10)

    return NextResponse.json({ activity })
  } catch (error) {
    console.error('Dashboard activity error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
