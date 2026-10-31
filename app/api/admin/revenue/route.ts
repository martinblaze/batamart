// app/api/admin/revenue/route.ts
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import {
  flutterwaveFeePerOrder,
  flutterwaveTransferFee,
  getFlutterwaveFeeConfig,
} from '@/lib/finance/fees'

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!)
    if (typeof decoded === 'string' || decoded.role !== 'ADMIN') return null
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

type RevenueOrder = {
  id: string
  batchId: string | null
  totalAmount: number
  platformCommission: number
  payment: { method: string; transactionId: string | null } | null
  batch: { gatewayFee: number | null; gatewayFeeEstimated: boolean } | null
}

function getCheckoutFees(orders: RevenueOrder[], allCompletedOrders: RevenueOrder[]) {
  const completedByPayment = new Map<string, {
    amount: number
    method: string
    fee: number | null
    estimated: boolean
  }>()
  for (const order of allCompletedOrders) {
    const key = order.batchId
      ? `batch:${order.batchId}`
      : order.payment?.transactionId
        ? `payment:${order.payment.transactionId}`
        : `order:${order.id}`
    const payment = completedByPayment.get(key) ?? {
      amount: 0,
      method: order.payment?.method ?? 'UNKNOWN',
      fee: order.batch?.gatewayFee ?? null,
      estimated: order.batch?.gatewayFeeEstimated ?? false,
    }
    payment.amount += order.totalAmount || 0
    payment.fee ??= order.batch?.gatewayFee ?? null
    payment.estimated ||= order.batch?.gatewayFeeEstimated ?? false
    if (payment.method === 'UNKNOWN' && order.payment?.method) payment.method = order.payment.method
    completedByPayment.set(key, payment)
  }

  const selectedByPayment = new Map<string, {
    amount: number
    method: string
    fee: number | null
    estimated: boolean
  }>()
  for (const order of orders) {
    const key = order.batchId
      ? `batch:${order.batchId}`
      : order.payment?.transactionId
        ? `payment:${order.payment.transactionId}`
        : `order:${order.id}`
    const payment = selectedByPayment.get(key) ?? {
      amount: 0,
      method: order.payment?.method ?? 'UNKNOWN',
      fee: order.batch?.gatewayFee ?? null,
      estimated: order.batch?.gatewayFeeEstimated ?? false,
    }
    payment.amount += order.totalAmount || 0
    payment.fee ??= order.batch?.gatewayFee ?? null
    payment.estimated ||= order.batch?.gatewayFeeEstimated ?? false
    if (payment.method === 'UNKNOWN' && order.payment?.method) payment.method = order.payment.method
    selectedByPayment.set(key, payment)
  }

  let fees = 0
  let estimatedTransactions = 0
  for (const [key, selectedPayment] of Array.from(selectedByPayment.entries())) {
    if (selectedPayment.method === 'WALLET') continue
    const completedPayment = completedByPayment.get(key)
    const completedAmount = completedPayment?.amount ?? selectedPayment.amount
    if (completedAmount <= 0) continue

    const recordedFee = selectedPayment.fee ?? completedPayment?.fee ?? null
    if (recordedFee === null || selectedPayment.estimated || completedPayment?.estimated) {
      estimatedTransactions += 1
    }
    fees += (recordedFee ?? feeForOrder(completedAmount))
      * Math.min(selectedPayment.amount / completedAmount, 1)
  }

  return {
    fees: Math.round(fees * 100) / 100,
    estimatedTransactions,
  }
}

type FinancialLedgerEntry = {
  type: string
  reference: string | null
  amount: number
  gatewayFee: number | null
  gatewayFeeEstimated: boolean
  createdAt: Date
}

function getFinancialLedgerTotals(
  entries: FinancialLedgerEntry[],
  start?: Date | null,
  end?: Date,
  endExclusive = false,
) {
  const relevantEntries = entries.filter(entry =>
    (!start || entry.createdAt >= start) &&
    (!end || (endExclusive ? entry.createdAt < end : entry.createdAt <= end)),
  )

  return relevantEntries.reduce((totals, entry) => {
    if (entry.type === 'CREDIT' && entry.reference?.startsWith('TOPUP-')) {
      totals.walletTopUpFees += entry.gatewayFee ?? flutterwaveFeePerOrder(entry.amount)
      if (entry.gatewayFee == null || entry.gatewayFeeEstimated) totals.estimatedFeeTransactions += 1
    } else if (entry.type === 'WITHDRAWAL') {
      totals.withdrawalFees += entry.gatewayFee ?? flutterwaveTransferFee(entry.amount)
      if (entry.gatewayFee == null || entry.gatewayFeeEstimated) totals.estimatedFeeTransactions += 1
    } else if (
      entry.type === 'DEBIT' &&
      entry.reference?.startsWith('DISPUTE-FEE-SELLER-CONFIRM-')
    ) {
      totals.disputeFeeRecovery += entry.amount
    }

    return totals
  }, {
    walletTopUpFees: 0,
    withdrawalFees: 0,
    disputeFeeRecovery: 0,
    estimatedFeeTransactions: 0,
  })
}

function getNigeriaCalendarStart(now: Date, monthOffset = 0, useCurrentDay = false): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const year = Number(parts.find(part => part.type === 'year')?.value)
  const month = Number(parts.find(part => part.type === 'month')?.value) - 1
  const currentDay = Number(parts.find(part => part.type === 'day')?.value)

  const day = useCurrentDay ? currentDay : 1
  return new Date(Date.UTC(year, month + monthOffset, day, -1))
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const universityId = searchParams.get('universityId')
    const userUniFilter = universityId ? { universityId } : {}
    const orderUniFilter = universityId ? { buyer: { universityId } } : {}
    const referralUniFilter = universityId
      ? { order: { buyer: { universityId } } }
      : {}
    const period = searchParams.get('period') || 'all'
    if (!['today', 'week', 'month', 'year', 'all'].includes(period)) {
      return NextResponse.json({ error: 'Invalid revenue period' }, { status: 400 })
    }

    const now = new Date()
    const thisMonthStart = getNigeriaCalendarStart(now)
    const lastMonthStart = getNigeriaCalendarStart(now, -1)
    const todayStart = getNigeriaCalendarStart(now, 0, true)
    const periodStart = period === 'today'
      ? todayStart
      : period === 'week'
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : period === 'month'
          ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          : period === 'year'
            ? new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
            : null
    const periodOrderWhere = {
      status: 'COMPLETED' as const,
      ...(periodStart ? { completedAt: { gte: periodStart, lte: now } } : {}),
      ...orderUniFilter,
    }

    const [
      allCompletedOrders,
      periodCompletedOrders,
      thisMonthCompletedOrders,
      lastMonthCompletedOrders,
      todayCompletedOrders,
      pendingOrders,
      topSellersRaw,
      totalSellersBalance,
      totalRidersBalance,
      allReferralStats,
      periodReferralStats,
      thisMonthReferralStats,
      lastMonthReferralStats,
      todayReferralStats,
      financialLedgerEntries,
      completedOrdersMissingCompletedAt,
      completedOrdersMissingPayment,
    ] = await Promise.all([
      prisma.order.findMany({
        where: { status: 'COMPLETED', ...orderUniFilter },
        select: {
          id: true,
          batchId: true,
          totalAmount: true,
          platformCommission: true,
          deliveryFee: true,
          deliveryLandmark: true,
          product: { select: { landmark: true } },
          payment: { select: { method: true, transactionId: true } },
          batch: { select: { gatewayFee: true, gatewayFeeEstimated: true } },
        },
      }),
      periodStart
        ? prisma.order.findMany({
            where: periodOrderWhere,
            select: {
              id: true,
              batchId: true,
              totalAmount: true,
              platformCommission: true,
              deliveryFee: true,
              deliveryLandmark: true,
              product: { select: { landmark: true } },
              sellerId: true,
              payment: { select: { method: true, transactionId: true } },
              batch: { select: { gatewayFee: true, gatewayFeeEstimated: true } },
            },
          })
        : Promise.resolve([]),
      prisma.order.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: thisMonthStart, lte: now }, ...orderUniFilter },
        select: {
          id: true,
          batchId: true,
          totalAmount: true,
          platformCommission: true,
          payment: { select: { method: true, transactionId: true } },
          batch: { select: { gatewayFee: true, gatewayFeeEstimated: true } },
        },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: lastMonthStart, lt: thisMonthStart }, ...orderUniFilter },
        select: {
          id: true,
          batchId: true,
          totalAmount: true,
          platformCommission: true,
          payment: { select: { method: true, transactionId: true } },
          batch: { select: { gatewayFee: true, gatewayFeeEstimated: true } },
        },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: todayStart, lte: now }, ...orderUniFilter },
        select: {
          id: true,
          batchId: true,
          totalAmount: true,
          platformCommission: true,
          payment: { select: { method: true, transactionId: true } },
          batch: { select: { gatewayFee: true, gatewayFeeEstimated: true } },
        },
      }),
      prisma.order.findMany({
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] }, isPaid: true, ...orderUniFilter },
        select: { totalAmount: true, platformCommission: true },
      }),
      prisma.order.groupBy({
        by: ['sellerId'],
        where: periodOrderWhere,
        _sum: { totalAmount: true, platformCommission: true },
        _count: true,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
      prisma.user.aggregate({
        where: { role: 'SELLER', ...userUniFilter },
        _sum: { pendingBalance: true, availableBalance: true },
      }),
      prisma.user.aggregate({
        where: { role: 'RIDER', ...userUniFilter },
        _sum: { pendingBalance: true, availableBalance: true },
      }),
      prisma.referralReward.aggregate({
        where: referralUniFilter,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.referralReward.aggregate({
        where: {
          ...referralUniFilter,
          ...(periodStart ? { createdAt: { gte: periodStart, lte: now } } : {}),
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.referralReward.aggregate({
        where: { ...referralUniFilter, createdAt: { gte: thisMonthStart, lte: now } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.referralReward.aggregate({
        where: { ...referralUniFilter, createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.referralReward.aggregate({
        where: { ...referralUniFilter, createdAt: { gte: todayStart, lte: now } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.findMany({
        where: {
          OR: [
            { type: 'CREDIT', reference: { startsWith: 'TOPUP-' } },
            { type: 'WITHDRAWAL' },
            { type: 'DEBIT', reference: { startsWith: 'DISPUTE-FEE-SELLER-CONFIRM-' } },
          ],
          user: userUniFilter,
        },
        select: {
          type: true,
          reference: true,
          amount: true,
          gatewayFee: true,
          gatewayFeeEstimated: true,
          createdAt: true,
        },
      }),
      prisma.order.count({
        where: { status: 'COMPLETED', completedAt: null, ...orderUniFilter },
      }),
      prisma.order.count({
        where: { status: 'COMPLETED', payment: null, ...orderUniFilter },
      }),
    ])

    const sumOrders = (orders: { totalAmount: number; platformCommission: number }[]) => ({
      totalAmount: orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
      platformCommission: orders.reduce((s, o) => s + (o.platformCommission || 0), 0),
      count: orders.length,
    })

    // ── Top delivery routes by volume/revenue ───────────────────────────────
    // Pickup zone = seller's product.landmark, dropoff zone = buyer's
    // order.deliveryLandmark. Unordered pair (A↔B) since routes are
    // bidirectional — see lib/delivery/pricing.ts.
    const routeStats = new Map<string, { zoneA: string; zoneB: string; count: number; totalDeliveryFee: number; riderTotal: number }>()
    const periodOrders = period === 'all' ? allCompletedOrders : periodCompletedOrders
    for (const order of periodOrders) {
      const pickup = order.product?.landmark?.trim()
      const dropoff = order.deliveryLandmark?.trim()
      if (!pickup || !dropoff) continue
      const [zoneA, zoneB] = [pickup, dropoff].sort()
      const key = `${zoneA}|${zoneB}`
      const existing = routeStats.get(key) || { zoneA, zoneB, count: 0, totalDeliveryFee: 0, riderTotal: 0 }
      existing.count += 1
      existing.totalDeliveryFee += order.deliveryFee || 0
      existing.riderTotal += Math.round((order.deliveryFee || 0) * 0.7 * 100) / 100
      routeStats.set(key, existing)
    }
    const topRoutes = Array.from(routeStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const allTime = sumOrders(allCompletedOrders)
    const selectedPeriod = sumOrders(periodOrders)
    const thisMonth = sumOrders(thisMonthCompletedOrders)
    const lastMonth = sumOrders(lastMonthCompletedOrders)
    const today = sumOrders(todayCompletedOrders)
    const pending = sumOrders(pendingOrders)
    const allTimeCheckoutFees = getCheckoutFees(allCompletedOrders, allCompletedOrders)
    const selectedCheckoutFees = getCheckoutFees(periodOrders, allCompletedOrders)
    const thisMonthCheckoutFees = getCheckoutFees(thisMonthCompletedOrders, allCompletedOrders)
    const lastMonthCheckoutFees = getCheckoutFees(lastMonthCompletedOrders, allCompletedOrders)
    const todayCheckoutFees = getCheckoutFees(todayCompletedOrders, allCompletedOrders)
    const allTimeLedger = getFinancialLedgerTotals(financialLedgerEntries, null, now)
    const selectedPeriodLedger = getFinancialLedgerTotals(financialLedgerEntries, periodStart, now)
    const thisMonthLedger = getFinancialLedgerTotals(financialLedgerEntries, thisMonthStart, now)
    const lastMonthLedger = getFinancialLedgerTotals(
      financialLedgerEntries,
      lastMonthStart,
      thisMonthStart,
      true,
    )
    const todayLedger = getFinancialLedgerTotals(financialLedgerEntries, todayStart, now)
    const allTimeFees = allTimeCheckoutFees.fees
      + allTimeLedger.walletTopUpFees
      + allTimeLedger.withdrawalFees
    const selectedPeriodFees = selectedCheckoutFees.fees
      + selectedPeriodLedger.walletTopUpFees
      + selectedPeriodLedger.withdrawalFees
    const thisMonthFees = thisMonthCheckoutFees.fees
      + thisMonthLedger.walletTopUpFees
      + thisMonthLedger.withdrawalFees
    const lastMonthFees = lastMonthCheckoutFees.fees
      + lastMonthLedger.walletTopUpFees
      + lastMonthLedger.withdrawalFees
    const todayFees = todayCheckoutFees.fees
      + todayLedger.walletTopUpFees
      + todayLedger.withdrawalFees

    const allTimeReferralRewards = Number(allReferralStats._sum.amount ?? 0)
    const periodReferralRewards = Number(periodReferralStats._sum.amount ?? 0)
    const thisMonthReferralRewards = Number(thisMonthReferralStats._sum.amount ?? 0)
    const lastMonthReferralRewards = Number(lastMonthReferralStats._sum.amount ?? 0)
    const todayReferralRewards = Number(todayReferralStats._sum.amount ?? 0)

    const netAllTime = allTime.platformCommission - allTimeFees
      - allTimeReferralRewards + allTimeLedger.disputeFeeRecovery
    const netSelectedPeriod = selectedPeriod.platformCommission
      - selectedPeriodFees
      - periodReferralRewards + selectedPeriodLedger.disputeFeeRecovery
    const netThisMonth = thisMonth.platformCommission - thisMonthFees
      - thisMonthReferralRewards + thisMonthLedger.disputeFeeRecovery
    const netLastMonth = lastMonth.platformCommission - lastMonthFees
      - lastMonthReferralRewards + lastMonthLedger.disputeFeeRecovery
    const netToday = today.platformCommission - todayFees
      - todayReferralRewards + todayLedger.disputeFeeRecovery

    const sellersAvailableNow = totalSellersBalance._sum.availableBalance?.toNumber() ?? 0
    const sellersPending = totalSellersBalance._sum.pendingBalance?.toNumber() ?? 0
    const ridersAvailableNow = totalRidersBalance._sum.availableBalance?.toNumber() ?? 0
    const ridersPending = totalRidersBalance._sum.pendingBalance?.toNumber() ?? 0

    const totalOwedToSellers = sellersAvailableNow + sellersPending
    const totalOwedToRiders = ridersAvailableNow + ridersPending

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
        period: {
          key: period,
          revenue: selectedPeriod.totalAmount,
          orders: selectedPeriod.count,
          platformEarned: selectedPeriod.platformCommission,
          flutterwaveFees: selectedPeriodFees,
          checkoutFees: selectedCheckoutFees.fees,
          walletTopUpFees: selectedPeriodLedger.walletTopUpFees,
          withdrawalFees: selectedPeriodLedger.withdrawalFees,
          disputeFeeRecovery: selectedPeriodLedger.disputeFeeRecovery,
          estimatedFeeTransactions:
            selectedCheckoutFees.estimatedTransactions + selectedPeriodLedger.estimatedFeeTransactions,
          referralRewards: periodReferralRewards,
          referralRewardCount: periodReferralStats._count,
          netAfterDeductions: netSelectedPeriod,
        },
        flutterwaveFeeConfig,
        platform: {
          gross: {
            allTime: allTime.platformCommission,
            thisMonth: thisMonth.platformCommission,
            lastMonth: lastMonth.platformCommission,
            today: today.platformCommission,
          },
          net: {
            allTime: netAllTime,
            thisMonth: netThisMonth,
            lastMonth: netLastMonth,
            today: netToday,
          },
          flutterwaveFees: {
            allTime: allTimeFees,
            thisMonth: thisMonthFees,
            lastMonth: lastMonthFees,
            today: todayFees,
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
          totalCredited: Number(periodReferralStats._sum.amount ?? 0),
          totalRewards: periodReferralStats._count,
          allTimeCredited: allTimeReferralRewards,
          allTimeRewards: allReferralStats._count,
        },
        dataQuality: {
          completedOrdersMissingCompletedAt,
          completedOrdersMissingPayment,
        },
        topRoutes,
        topSellers,
      },
    })
  } catch (error) {
    console.error('Revenue fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch revenue' }, { status: 500 })
  }
}
