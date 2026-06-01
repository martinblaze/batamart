// app/api/admin/diagnostics/referral-cleanup/route.ts
// Purpose: Remove anomalous referral rewards and reverse their balance impacts
// Protected: Admin only
// WARNING: This performs destructive operations - logs all changes for audit trail

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth-client'

export const dynamic = 'force-dynamic'

interface CleanupResult {
  removedRewards: {
    id: string
    amount: number
    userId: string
    userEmail: string
    orderId: string
    orderNumber: string
    reason: string
  }[]
  reversedBalances: {
    userId: string
    userEmail: string
    amountReversed: number
    newBalance: number
  }[]
  deletedTransactions: number
  totalAmountRemoved: number
  summary: string
}

export async function POST(request: NextRequest) {
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

    // Get query params for selective cleanup
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'
    const cleanupType = request.nextUrl.searchParams.get('type') || 'all' // 'all', 'orphaned', 'self-referral', 'non-completed'

    console.log(`[REFERRAL-CLEANUP] Starting ${dryRun ? 'DRY RUN' : 'ACTUAL'} cleanup (type: ${cleanupType})`)

    const result: CleanupResult = {
      removedRewards: [],
      reversedBalances: {},
      deletedTransactions: 0,
      totalAmountRemoved: 0,
      summary: '',
    }

    // Find all anomalous rewards
    const allRewards = await prisma.referralReward.findMany({
      include: {
        order: {
          select: {
            buyerId: true,
            orderNumber: true,
            status: true,
            buyer: {
              select: {
                id: true,
                email: true,
                referredById: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            availableBalance: true,
          },
        },
      },
    })

    // Categorize anomalies
    const anomaliesToRemove = allRewards.filter(reward => {
      const isOrphaned = !reward.order.buyer.referredById
      const isSelfReferral = reward.order.buyer.referredById === reward.userId
      const isNonCompleted = reward.order.status !== 'COMPLETED'
      const isMismatch = reward.order.buyer.referredById !== reward.userId

      if (cleanupType === 'orphaned') return isOrphaned
      if (cleanupType === 'self-referral') return isSelfReferral
      if (cleanupType === 'non-completed') return isNonCompleted
      if (cleanupType === 'all') return isOrphaned || isSelfReferral || isNonCompleted || isMismatch

      return false
    })

    console.log(`[REFERRAL-CLEANUP] Found ${anomaliesToRemove.length} anomalous rewards to process`)

    // Process each anomaly
    const balanceAdjustments = new Map<string, { email: string; totalAmount: number }>()

    for (const reward of anomaliesToRemove) {
      let reason = 'Unknown'
      const isOrphaned = !reward.order.buyer.referredById
      const isSelfReferral = reward.order.buyer.referredById === reward.userId
      const isNonCompleted = reward.order.status !== 'COMPLETED'
      const isMismatch = reward.order.buyer.referredById !== reward.userId

      if (isOrphaned) reason = 'Orphaned (buyer has no referrer)'
      else if (isSelfReferral) reason = 'Self-referral fraud'
      else if (isNonCompleted) reason = `Non-completed order (status: ${reward.order.status})`
      else if (isMismatch) reason = 'Referral mismatch (buyer not referred by reward recipient)'

      result.removedRewards.push({
        id: reward.id,
        amount: reward.amount,
        userId: reward.userId,
        userEmail: reward.user.email,
        orderId: reward.orderId,
        orderNumber: reward.order.orderNumber,
        reason,
      })

      result.totalAmountRemoved += reward.amount

      // Track balance adjustments
      if (!balanceAdjustments.has(reward.userId)) {
        balanceAdjustments.set(reward.userId, {
          email: reward.user.email,
          totalAmount: 0,
        })
      }
      const adjustment = balanceAdjustments.get(reward.userId)!
      adjustment.totalAmount += reward.amount

      console.log(`[REFERRAL-CLEANUP] Flagged reward ₦${reward.amount} to user ${reward.user.email}: ${reason}`)
    }

    // If not dry run, actually remove the rewards
    if (!dryRun && anomaliesToRemove.length > 0) {
      const rewardIds = anomaliesToRemove.map(r => r.id)

      // Start transaction to remove rewards and adjust balances
      await prisma.$transaction(async tx => {
        // Remove the reward records
        await tx.referralReward.deleteMany({
          where: { id: { in: rewardIds } },
        })

        // Also remove related transactions
        const removedOrders = anomaliesToRemove.map(r => r.orderId)
        const deletedTx = await tx.transaction.deleteMany({
          where: {
            reference: {
              in: removedOrders.map(id => `${id}-REFERRAL`),
            },
          },
        })
        result.deletedTransactions = deletedTx.count

        // Adjust user balances
        for (const [userId, adjustment] of balanceAdjustments.entries()) {
          const user = await tx.user.findUnique({ where: { id: userId } })
          if (user) {
            const newBalance = Math.max(0, Number(user.availableBalance) - adjustment.totalAmount)
            await tx.user.update({
              where: { id: userId },
              data: { availableBalance: newBalance },
            })

            result.reversedBalances[userId] = {
              userId,
              userEmail: adjustment.email,
              amountReversed: adjustment.totalAmount,
              newBalance,
            }

            console.log(
              `[REFERRAL-CLEANUP] Reversed ₦${adjustment.totalAmount} from ${adjustment.email}. New balance: ₦${newBalance}`
            )
          }
        }
      })

      result.summary = `✅ Cleanup complete. Removed ${anomaliesToRemove.length} anomalous rewards (total ₦${result.totalAmountRemoved}). Affected ${Object.keys(result.reversedBalances).length} users.`
    } else if (dryRun) {
      result.summary = `📊 DRY RUN: Would remove ${anomaliesToRemove.length} rewards (total ₦${result.totalAmountRemoved}) and affect ${balanceAdjustments.size} users.`
    } else {
      result.summary = 'No anomalies found. Database is clean.'
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[REFERRAL-CLEANUP] Error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}
