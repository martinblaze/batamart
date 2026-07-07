export const dynamic = 'force-dynamic'
// app/api/admin/revenue/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { credoFeePerOrder } from '@/lib/finance/fees'

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

// Credo charges 1.5% + 100 per transaction, capped at 2100.
// The 100 flat fee is waived for transactions under 2000.
// This must be called PER ORDER, not on the aggregate sum.
const feeForOrder = credoFeePerOrder

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
        select: { totalAmount: true, platformCommission: true, deliveryFee: true },
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

    // ── Helper: sum fields from order arrays ──────────────────────────
    const sumOrders = (orders: { totalAmount: number; platformCommission: number }[]) => ({
      totalAmount: orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
      platformCommission: orders.reduce((s, o) => s + (o.platformCommission || 0), 0),
      count: orders.length,
      credoFees: orders.reduce((s, o) => s + feeForOrder(o.totalAmount || 0), 0),
    })

    const allTime   = sumOrders(allCompletedOrders)
    const thisMonth = sumOrders(thisMonthCompletedOrders)
    const lastMonth = sumOrders(lastMonthCompletedOrders)
    const today     = sumOrders(todayCompletedOrders)
    const pending   = sumOrders(pendingOrders)

    const referralPaidOut = Number(referralStats._sum.amount ?? 0)

    const netAllTime   = allTime.platformCommission   - allTime.credoFees   - referralPaidOut
    const netThisMonth = thisMonth.platformCommission - thisMonth.credoFees
    const netLastMonth = lastMonth.platformCommission - lastMonth.credoFees
    const netToday     = today.platformCommission     - today.credoFees
    const netPending   = pending.platformCommission   - pending.credoFees

    // ── FIX: Use .toNumber() to safely convert Prisma Decimal fields ──
    const sellersAvailableNow = totalSellersBalance._sum.availableBalance?.toNumber() ?? 0
    const sellersPending      = totalSellersBalance._sum.pendingBalance?.toNumber()   ?? 0
    const ridersAvailableNow  = totalRidersBalance._sum.availableBalance?.toNumber()  ?? 0
    const ridersPending       = totalRidersBalance._sum.pendingBalance?.toNumber()    ?? 0

    const totalOwedToSellers = sellersAvailableNow + sellersPending
    const totalOwedToRiders  = ridersAvailableNow  + ridersPending

    // ── Safe withdrawal calculation ───────────────────────────────────
    const safeToWithdraw = Math.max(
      0,
      netAllTime - sellersAvailableNow - ridersAvailableNow,
    )

    const paystackHoldsApprox = allTime.totalAmount

    // ── Enrich top sellers ────────────────────────────────────────────
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

        platform: {
          gross: {
            allTime:   allTime.platformCommission,
            thisMonth: thisMonth.platformCommission,
            lastMonth: lastMonth.platformCommission,
            today:     today.platformCommission,
            pending:   pending.platformCommission,
          },
          net: {
            allTime:   netAllTime,
            thisMonth: netThisMonth,
            lastMonth: netLastMonth,
            today:     netToday,
            pending:   netPending,
          },
          credoFees: {
            allTime:   allTime.credoFees,
            thisMonth: thisMonth.credoFees,
            lastMonth: lastMonth.credoFees,
            today:     today.credoFees,
            pending:   pending.credoFees,
          },
        },

        thisMonth: {
          revenue:        thisMonth.totalAmount,
          orders:         thisMonth.count,
          platformEarned: thisMonth.platformCommission,
        },
        lastMonth: {
          revenue:        lastMonth.totalAmount,
          orders:         lastMonth.count,
          platformEarned: lastMonth.platformCommission,
        },
        today: {
          revenue:        today.totalAmount,
          orders:         today.count,
          platformEarned: today.platformCommission,
        },

        escrow: {
          pendingOrders:  pending.count,
          totalInEscrow:  pending.totalAmount,
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
          totalPaidOut:  referralPaidOut,
          totalRewards:  referralStats._count,
        },

        withdrawal: {
          safeToWithdraw,
          paystackHoldsApprox,
          breakdown: {
            grossCommission:       allTime.platformCommission,
            minusCredoFees:        allTime.credoFees,
            minusReferralPayouts:  referralPaidOut,
            minusSellersAvailable: sellersAvailableNow,
            minusRidersAvailable:  ridersAvailableNow,
            result:                safeToWithdraw,
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