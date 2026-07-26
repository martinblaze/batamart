// app/api/admin/revenue/route.ts
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { flutterwaveFeePerOrder, getFlutterwaveFeeConfig } from '@/lib/finance/fees'

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

// Flutterwave's published Nigeria rate: 2% per transaction, capped at ₦2,000
// (see lib/finance/fees.ts). Env overrides are available if your Flutterwave
// account is on a custom/negotiated plan.
const feeForOrder = flutterwaveFeePerOrder
const flutterwaveFeeConfig = getFlutterwaveFeeConfig()

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const universityId = searchParams.get('universityId')
    const uniFilter = universityId ? { universityId } : {}

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)

    const [
      allCompletedOrders,
      thisMonthCompletedOrders,
      lastMonthCompletedOrders,
      todayCompletedOrders,
      pendingOrders,
      topSellersRaw,
      totalSellersBalance,
      totalRidersBalance,
      referralStats,
    ] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'COMPLETED', ...uniFilter },
        select: {
          totalAmount: true,
          platformCommission: true,
          deliveryFee: true,
          deliveryLandmark: true,
          product: { select: { landmark: true } },
        },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: thisMonthStart }, ...uniFilter },
        select: { totalAmount: true, platformCommission: true },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, ...uniFilter },
        select: { totalAmount: true, platformCommission: true },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: todayStart }, ...uniFilter },
        select: { totalAmount: true, platformCommission: true },
      }),
      prisma.order.findMany({
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] }, isPaid: true, ...uniFilter },
        select: { totalAmount: true, platformCommission: true },
      }),
      prisma.order.groupBy({
        by: ['sellerId'],
        where: { status: 'COMPLETED', ...uniFilter },
        _sum: { totalAmount: true, platformCommission: true },
        _count: true,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
      prisma.user.aggregate({
        where: { role: 'SELLER', ...(universityId ? { universityId } : {}) },
        _sum: { pendingBalance: true, availableBalance: true },
      }),
      prisma.user.aggregate({
        where: { role: 'RIDER', ...(universityId ? { universityId } : {}) },
        _sum: { pendingBalance: true, availableBalance: true },
      }),
      prisma.referralReward.aggregate({
        _sum: { amount: true },
        _count: true,
      }).catch(() => ({ _sum: { amount: 0 }, _count: 0 })),
    ])

    const sumOrders = (orders: { totalAmount: number; platformCommission: number }[]) => ({
      totalAmount: orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
      platformCommission: orders.reduce((s, o) => s + (o.platformCommission || 0), 0),
      count: orders.length,
      flutterwaveFees: orders.reduce((s, o) => s + feeForOrder(o.totalAmount || 0), 0),
    })

    // ── Top delivery routes by volume/revenue ───────────────────────────────
    // Pickup zone = seller's product.landmark, dropoff zone = buyer's
    // order.deliveryLandmark. Unordered pair (A↔B) since routes are
    // bidirectional — see lib/delivery/pricing.ts.
    const routeStats = new Map<string, { zoneA: string; zoneB: string; count: number; totalDeliveryFee: number; riderTotal: number }>()
    for (const order of allCompletedOrders as any[]) {
      const pickup = order.product?.landmark?.trim()
      const dropoff = order.deliveryLandmark?.trim()
      if (!pickup || !dropoff) continue
      const [zoneA, zoneB] = [pickup, dropoff].sort()
      const key = `${zoneA}|${zoneB}`
      const existing = routeStats.get(key) || { zoneA, zoneB, count: 0, totalDeliveryFee: 0, riderTotal: 0 }
      existing.count += 1
      existing.totalDeliveryFee += order.deliveryFee || 0
      existing.riderTotal += Math.round((order.deliveryFee || 0) * 0.7)
      routeStats.set(key, existing)
    }
    const topRoutes = Array.from(routeStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const allTime = sumOrders(allCompletedOrders)
    const thisMonth = sumOrders(thisMonthCompletedOrders)
    const lastMonth = sumOrders(lastMonthCompletedOrders)
    const today = sumOrders(todayCompletedOrders)
    const pending = sumOrders(pendingOrders)

    const referralPaidOut = Number(referralStats._sum.amount ?? 0)

    const netAllTime = allTime.platformCommission - allTime.flutterwaveFees - referralPaidOut
    const netThisMonth = thisMonth.platformCommission - thisMonth.flutterwaveFees
    const netLastMonth = lastMonth.platformCommission - lastMonth.flutterwaveFees
    const netToday = today.platformCommission - today.flutterwaveFees
    const netPending = pending.platformCommission - pending.flutterwaveFees

    const sellersAvailableNow = totalSellersBalance._sum.availableBalance?.toNumber() ?? 0
    const sellersPending = totalSellersBalance._sum.pendingBalance?.toNumber() ?? 0
    const ridersAvailableNow = totalRidersBalance._sum.availableBalance?.toNumber() ?? 0
    const ridersPending = totalRidersBalance._sum.pendingBalance?.toNumber() ?? 0

    const totalOwedToSellers = sellersAvailableNow + sellersPending
    const totalOwedToRiders = ridersAvailableNow + ridersPending

    const safeToWithdraw = Math.max(
      0,
      netAllTime - sellersAvailableNow - ridersAvailableNow,
    )

    const flutterwaveHeldApprox = allTime.totalAmount

    const topSellers = await Promise.all(
      topSellersRaw.map(async (s) => {
        const seller = await prisma.user.findUnique({
          where: { id: s.sellerId },
          select: { name: true, email: true },
        })
        return {
          name: seller?.name || 'Unknown',
          email: seller?.email || '',
          totalRevenue: s._sum.totalAmount || 0,
          platformEarned: s._sum.platformCommission || 0,
          totalOrders: s._count,
        }
      })
    )

    return NextResponse.json({
      revenue: {
        totalRevenue: allTime.totalAmount,
        totalOrders: allTime.count,
        flutterwaveFeeConfig,
        platform: {
          gross: {
            allTime: allTime.platformCommission,
            thisMonth: thisMonth.platformCommission,
            lastMonth: lastMonth.platformCommission,
            today: today.platformCommission,
            pending: pending.platformCommission,
          },
          net: {
            allTime: netAllTime,
            thisMonth: netThisMonth,
            lastMonth: netLastMonth,
            today: netToday,
            pending: netPending,
          },
          flutterwaveFees: {
            allTime: allTime.flutterwaveFees,
            thisMonth: thisMonth.flutterwaveFees,
            lastMonth: lastMonth.flutterwaveFees,
            today: today.flutterwaveFees,
            pending: pending.flutterwaveFees,
          },
        },
        thisMonth: {
          revenue: thisMonth.totalAmount,
          orders: thisMonth.count,
          platformEarned: thisMonth.platformCommission,
        },
        lastMonth: {
          revenue: lastMonth.totalAmount,
          orders: lastMonth.count,
          platformEarned: lastMonth.platformCommission,
        },
        today: {
          revenue: today.totalAmount,
          orders: today.count,
          platformEarned: today.platformCommission,
        },
        escrow: {
          pendingOrders: pending.count,
          totalInEscrow: pending.totalAmount,
          yourCutInEscrow: pending.platformCommission,
        },
        obligations: {
          totalOwedToSellers,
          totalOwedToRiders,
          sellersAvailableNow,
          sellersPending,
          ridersAvailableNow,
          ridersPending,
        },
        referrals: {
          totalPaidOut: referralPaidOut,
          totalRewards: referralStats._count,
        },
        topRoutes,
        withdrawal: {
          safeToWithdraw,
          flutterwaveHeldApprox,
          breakdown: {
            grossCommission: allTime.platformCommission,
            minusFlutterwaveFees: allTime.flutterwaveFees,
            minusReferralPayouts: referralPaidOut,
            minusSellersAvailable: sellersAvailableNow,
            minusRidersAvailable: ridersAvailableNow,
            result: safeToWithdraw,
          },
        },
        topSellers,
      },
    })
  } catch (error) {
    console.error('Revenue fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch revenue' }, { status: 500 })
  }
}
