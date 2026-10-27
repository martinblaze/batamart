// app/api/wallet/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { releaseMaturedSellerEscrowForUser } from '@/lib/escrow'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        availableBalance: true,
        pendingBalance: true,
        role: true,
      },
    })

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Auto-release matured seller escrow (72h after delivered, if no dispute).
    if (userData.role === 'SELLER') {
      await releaseMaturedSellerEscrowForUser(user.id)
    }

    const marketer = await prisma.fieldMarketer.findUnique({
      where: { userId: user.id },
      select: { balance: true, totalSignups: true, totalEarned: true },
    })

    // Count completed orders directly from orders table — accurate regardless
    // of whether the completedOrders counter was incremented correctly
    let completedOrders = 0

    if (userData.role === 'SELLER') {
      completedOrders = await prisma.order.count({
        where: {
          sellerId: user.id,
          status: { in: ['COMPLETED', 'DELIVERED'] },
        },
      })
    } else if (userData.role === 'RIDER') {
      completedOrders = await prisma.order.count({
        where: {
          riderId: user.id,
          status: { in: ['COMPLETED', 'DELIVERED'] },
        },
      })
    } else {
      // BUYER
      completedOrders = await prisma.order.count({
        where: {
          buyerId: user.id,
          status: { in: ['COMPLETED', 'DELIVERED'] },
        },
      })
    }

    return NextResponse.json({
      wallet: {
        availableBalance: Math.max(0, Number(userData.availableBalance)),
        pendingBalance: Math.max(0, Number(userData.pendingBalance)),
        completedOrders,
        role: userData.role,
        marketing: marketer
          ? { balance: marketer.balance, totalSignups: marketer.totalSignups, totalEarned: marketer.totalEarned }
          : null,
      },
    })
  } catch (error) {
    console.error('Fetch wallet error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallet data' },
      { status: 500 }
    )
  }
}

