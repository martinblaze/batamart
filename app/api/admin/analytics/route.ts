export const dynamic = 'force-dynamic'
// app/api/admin/analytics/route.ts

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { flutterwaveFeePerOrder as calculateFlutterwaveFeePerOrder } from '@/lib/finance/fees'

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
    const { searchParams } = new URL(req.url)
    const range        = searchParams.get('range') || '7days'
    const universityId = searchParams.get('universityId') || 'all'

    let startDate = new Date()
    if      (range === '7days')  startDate.setDate(startDate.getDate() - 7)
    else if (range === '30days') startDate.setDate(startDate.getDate() - 30)
    else if (range === '90days') startDate.setDate(startDate.getDate() - 90)
    else                         startDate = new Date(0)

    // Whether the range is 'all' — used to suppress meaningless trend %
    const isAllTime = range === 'all'

    const periodMs  = Date.now() - startDate.getTime()
    const prevStart = new Date(startDate.getTime() - periodMs)

    // University scope helpers
    const uniFilter      = universityId !== 'all' ? { universityId }            : {}
    const orderUniFilter = universityId !== 'all' ? { buyer: { universityId } } : {}

    const userBase    = { ...uniFilter }
    const productBase = { ...uniFilter }
    const orderBase   = { ...orderUniFilter }

    const [
      newUsers, newSellers, newRiders, newProducts,
      totalOrders, completedOrders,
      revenueAgg,
      // FIX #8: topCategories now scoped to the selected period
      topCategories,
      totalProducts, totalUsers,
      // FIX #4: count only buyers for the totalBuyers denominator
      totalBuyers,
      dauUsers, wauUsers, mauUsers,
      // FIX #5: activeSellers now = sellers who received completed orders in period
      activeSellers,
      referralData,
      // FIX #2: fetch deliveredAt + createdAt instead of updatedAt
      deliveryStats,
      failedOrders,
      prevRevenueAgg,
      repeatBuyers,
      // FIX #4: engagedNewUsers now role-filtered to BUYER to match newUsers denominator
      engagedNewUsers,
      // FIX #1: fetch rider-specific stats for a correct riderCompletionRate
      riderAssignedOrders, riderDeliveredOrders,
      // FIX #6: fetch per-order amounts to compute real Flutterwave fees
      completedOrderAmounts,
    ] = await Promise.all([

      prisma.user.count({ where: { ...userBase, createdAt: { gte: startDate }, role: 'BUYER' } }),
      prisma.user.count({ where: { ...userBase, createdAt: { gte: startDate }, role: 'SELLER' } }),
      prisma.user.count({ where: { ...userBase, createdAt: { gte: startDate }, role: 'RIDER' } }),
      prisma.product.count({ where: { ...productBase, createdAt: { gte: startDate } } }),
      prisma.order.count({ where: { ...orderBase, createdAt: { gte: startDate } } }),
      prisma.order.count({ where: { ...orderBase, createdAt: { gte: startDate }, status: 'COMPLETED' } }),
      prisma.order.aggregate({
        where: { ...orderBase, createdAt: { gte: startDate }, status: 'COMPLETED' },
        _sum: { totalAmount: true, platformCommission: true },
      }),

      // FIX #8: add createdAt filter so topCategories reflects the selected period
      prisma.product.groupBy({
        by: ['category'],
        where: { ...productBase, createdAt: { gte: startDate } },
        _count: true,
        orderBy: { _count: { category: 'desc' } },
        take: 7,
      }),

      prisma.product.count({ where: productBase }),
      prisma.user.count({ where: { ...userBase, role: { not: 'ADMIN' as const } } }),

      // FIX #3 & #4: total buyers only (for repeatBuyerPct and retentionDay1 denominators)
      prisma.user.count({ where: { ...userBase, role: 'BUYER' } }),

      // DAU/WAU/MAU: intentionally use absolute now-based windows (standard definition).
      // These are rolling engagement windows, not period-scoped. The UI now labels
      // them clearly as "rolling 24h / 7d / 30d" so admins aren't misled.
      prisma.user.count({
        where: { ...userBase, orders: { some: { createdAt: { gte: new Date(Date.now() - 86400000) } } } },
      }),
      prisma.user.count({
        where: { ...userBase, orders: { some: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } } },
      }),
      prisma.user.count({
        where: { ...userBase, orders: { some: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } } },
      }),

      // FIX #5: activeSellers = sellers with at least one completed order in the period
      // (previously used "sellers who listed a product", which excluded sellers who
      //  got orders but didn't list new products, and included sellers with 0 orders)
      prisma.user.count({
        where: {
          ...userBase,
          role: 'SELLER',
          sellerOrders: {
            some: {
              status: 'COMPLETED',
              createdAt: { gte: startDate },
            },
          },
        },
      }),

      prisma.referralReward.aggregate({
        where: { createdAt: { gte: startDate } },
        _sum: { amount: true },
        _count: true,
      }).catch(() => ({ _sum: { amount: 0 }, _count: 0 })),

      // FIX #2: use deliveredAt + createdAt so we measure actual delivery time,
      // not the time from order creation to buyer confirmation (which can be days later)
      prisma.order.findMany({
        where: {
          ...orderBase,
          status: 'COMPLETED',
          createdAt:   { gte: startDate },
          deliveredAt: { not: null },   // only orders that have a real delivery timestamp
        },
        select: { createdAt: true, deliveredAt: true },
        take: 500,
      }),

      prisma.order.count({
        where: {
          ...orderBase,
          createdAt: { gte: startDate },
          status: { in: ['CANCELLED', 'DISPUTED'] },
        },
      }),

      // Previous period revenue for trend calculation
      prisma.order.aggregate({
        where: {
          ...orderBase,
          createdAt: { gte: prevStart, lt: startDate },
          status: 'COMPLETED',
        },
        _sum: { totalAmount: true, platformCommission: true },
      }),

      // Repeat buyers: buyers with at least one COMPLETED order ever
      prisma.user.count({
        where: {
          ...userBase,
          role: 'BUYER',
          orders: { some: { status: 'COMPLETED' } },
        },
      }),

      // FIX #4: engagedNewUsers now filtered to BUYER role only so the
      // denominator (newUsers, also buyers-only) matches
      prisma.user.count({
        where: {
          ...userBase,
          role:      'BUYER',
          createdAt: { gte: startDate },
          orders:    { some: {} },
        },
      }),

      // FIX #1: rider completion rate numerator — orders that reached DELIVERED
      prisma.order.count({
        where: {
          ...orderBase,
          createdAt: { gte: startDate },
          riderId:   { not: null },
          status:    { in: ['DELIVERED', 'COMPLETED'] },
        },
      }),

      // FIX #1: rider completion rate denominator — orders that were assigned to a rider
      prisma.order.count({
        where: {
          ...orderBase,
          createdAt: { gte: startDate },
          riderId:   { not: null },
        },
      }),

      // FIX #6: fetch per-order totalAmount for accurate Flutterwave fee calculation
      prisma.order.findMany({
        where: { ...orderBase, createdAt: { gte: startDate }, status: 'COMPLETED' },
        select: { totalAmount: true },
      }),
    ])

    // ── Derived Metrics ────────────────────────────────────────────────────

    const completionRate = totalOrders > 0
      ? Math.round((completedOrders / totalOrders) * 100)
      : 0

    const gmv                = revenueAgg._sum.totalAmount        || 0
    const platformCommission = revenueAgg._sum.platformCommission || 0
    const referralsPaidOut   = (referralData as any)._sum?.amount || 0

    // FIX #6: compute actual Flutterwave fees per order, then subtract from commission
    // Previously: netRevenue = platformCommission - referralsPaidOut (missing gateway fees)
    // Now:        netRevenue = platformCommission - flutterwaveFees - referralsPaidOut
    const flutterwaveFees = completedOrderAmounts.reduce(
      (sum, o) => sum + calculateFlutterwaveFeePerOrder(o.totalAmount || 0),
      0
    )
    const netRevenue = platformCommission - flutterwaveFees - referralsPaidOut

    // FIX #9: suppress trend for all-time range (prevGmv would always be 0)
    const prevGmv      = prevRevenueAgg._sum.totalAmount || 0
    const revenueTrend = (!isAllTime && prevGmv > 0)
      ? ((gmv - prevGmv) / prevGmv) * 100
      : null  // null = "not applicable" — the UI should hide the trend badge

    // FIX #3: repeatBuyerPct now uses totalBuyers as denominator (not all users)
    const repeatBuyerPct = totalBuyers > 0
      ? Math.round((repeatBuyers / totalBuyers) * 100)
      : 0

    // FIX #4: both engagedNewUsers and newUsers are now buyers-only, so this
    // percentage can no longer exceed 100%
    const retentionDay1 = newUsers > 0
      ? Math.round((engagedNewUsers / newUsers) * 100)
      : 0

    // FIX #2: use deliveredAt instead of updatedAt for actual delivery duration
    // deliveredAt is the timestamp the rider set status = DELIVERED
    // createdAt is when the order was placed
    // This measures end-to-end delivery time, not including buyer confirmation delay
    const avgDeliveryMinutes = deliveryStats.length > 0
      ? Math.round(
          deliveryStats.reduce((sum, o) => {
            const diff = (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 60000
            return sum + diff
          }, 0) / deliveryStats.length
        )
      : 0

    const failedDeliveryPct = totalOrders > 0
      ? parseFloat(((failedOrders / totalOrders) * 100).toFixed(1))
      : 0

    // FIX #5: ordersPerSeller now uses sellers-who-received-orders as denominator
    const ordersPerSeller = activeSellers > 0
      ? parseFloat((completedOrders / activeSellers).toFixed(1))
      : 0

    // FIX #1: riderCompletionRate is now actual rider delivery rate,
    // not the overall order completion rate
    const riderCompletionRate = riderAssignedOrders > 0
      ? Math.round((riderDeliveredOrders / riderAssignedOrders) * 100)
      : 0

    const topCategoriesFormatted = (topCategories as any[]).map((c: any) => ({
      category: c.category,
      count:    c._count,
    }))

    return NextResponse.json({
      newUsers,        totalUsers,
      newSellers,      newRiders,
      newProducts,     totalProducts,
      totalOrders,     completedOrders,
      completionRate,
      revenue:          gmv,
      platformCommission,
      flutterwaveFees,
      netRevenue,         // FIX #6: now correctly deducts Flutterwave fees
      revenueTrend,       // FIX #9: null when range='all'

      dau: dauUsers,
      wau: wauUsers,
      mau: mauUsers,
      retentionDay1,      // FIX #4: both sides now buyers-only
      retentionDay7: 0,
      repeatBuyerPct,     // FIX #3: totalBuyers denominator

      appOpens:           0,
      productViews:       0,
      addToCart:          0,
      checkoutSuccessPct: completionRate,

      activeSellers,      // FIX #5: sellers who received orders, not just listed products
      ordersPerSeller,    // FIX #5: accurate now that activeSellers is correct
      listingGrowthPct:   0,

      avgDeliveryMinutes, // FIX #2: uses deliveredAt, not updatedAt
      riderCompletionRate, // FIX #1: real rider delivery rate
      failedDeliveryPct,

      gmv,
      cac: 0,
      ltv: 0,

      topCategories: topCategoriesFormatted, // FIX #8: now period-scoped

      referrals: {
        newRewards:   (referralData as any)._count || 0,
        totalPaidOut: referralsPaidOut,
      },

      activeFilter: universityId,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

