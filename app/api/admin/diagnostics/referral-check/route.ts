// app/api/admin/diagnostics/referral-check/route.ts
// Purpose: Check referral rewards for a specific user and identify anomalies
// Protected: Admin only

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth-client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminToken(token)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query parameter: ?email=user@example.com
    const email = request.nextUrl.searchParams.get('email')
    if (!email) {
      return NextResponse.json({ error: 'Email parameter required' }, { status: 400 })
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        availableBalance: true,
        referredById: true,
        referrerOf: {
          select: {
            id: true,
            email: true,
          },
        },
        referralReward: {
          select: {
            id: true,
            amount: true,
            createdAt: true,
            orderId: true,
            order: {
              select: {
                orderNumber: true,
                buyerId: true,
                buyer: {
                  select: {
                    email: true,
                    referredById: true,
                  },
                },
                status: true,
                completedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Validation checks
    const anomalies: string[] = []
    const warnings: string[] = []

    // Check 1: Self-referral
    if (user.referredById === user.id) {
      anomalies.push('Self-referral detected - user refers themselves')
    }

    // Check 2: Orphaned rewards (user has rewards but no referredById)
    if (user.referralReward.length > 0 && !user.referredById) {
      anomalies.push(
        `User has ${user.referralReward.length} referral rewards but no referrer (referredById is null)`
      )
    }

    // Check 3: Rewards for non-completed orders
    const nonCompletedRewards = user.referralReward.filter(r => r.order.status !== 'COMPLETED')
    if (nonCompletedRewards.length > 0) {
      anomalies.push(
        `${nonCompletedRewards.length} rewards for non-completed orders (status: ${nonCompletedRewards.map(r => r.order.status).join(', ')})`
      )
    }

    // Check 4: Rewards without buyer referral relationship
    for (const reward of user.referralReward) {
      if (reward.order.buyer.referredById !== user.id) {
        anomalies.push(
          `Reward on order ${reward.order.orderNumber}: Buyer (${reward.order.buyer.email}) referredById doesn't match this user. Buyer referred by: ${reward.order.buyer.referredById || 'nobody'}`
        )
      }
    }

    // Check 5: Daily cap violations
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayRewards = user.referralReward.filter(
      r => new Date(r.createdAt) >= today
    )
    const todayTotal = todayRewards.reduce((sum, r) => sum + r.amount, 0)
    if (todayTotal > 1200) {
      warnings.push(`Daily cap exceeded: ${todayTotal}₦ / 1200₦ (${todayRewards.length} rewards today)`)
    }

    // Calculate totals
    const totalRewards = user.referralReward.reduce((sum, r) => sum + r.amount, 0)
    const rewardsByMonth = user.referralReward.reduce((acc, r) => {
      const month = new Date(r.createdAt).toISOString().slice(0, 7)
      acc[month] = (acc[month] || 0) + r.amount
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      user: {
        email: user.email,
        userId: user.id,
        availableBalance: user.availableBalance,
        referredById: user.referredById,
        referredByCount: user.referrerOf.length,
      },
      referralRewards: {
        totalAmount: totalRewards,
        rewardCount: user.referralReward.length,
        byMonth: rewardsByMonth,
        recentRewards: user.referralReward.slice(0, 10).map(r => ({
          orderId: r.orderId,
          orderNumber: r.order.orderNumber,
          amount: r.amount,
          buyerEmail: r.order.buyer.email,
          completedAt: r.order.completedAt,
          createdAt: r.createdAt,
        })),
      },
      validation: {
        hasAnomalies: anomalies.length > 0,
        hasWarnings: warnings.length > 0,
        anomalies,
        warnings,
      },
    })
  } catch (error) {
    console.error('[REFERRAL-CHECK] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
