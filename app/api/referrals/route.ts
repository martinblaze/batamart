// app/api/referrals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch referralCode separately since getUserFromRequest doesn't select it
    const fullUser = await prisma.user.findUnique({
      where:  { id: authUser.id },
      select: { id: true, referralCode: true },
    })

    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [directReferrals, marketerReferrals, rewards] = await Promise.all([
      prisma.user.findMany({
        where: { referredById: fullUser.id },
        select: {
          id:        true,
          name:      true,
          createdAt: true,
          orders: {
            where:  { status: 'COMPLETED' },
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      prisma.fieldMarketerSignup.findMany({
        where: { marketer: { userId: fullUser.id } },
        select: {
          referredUser: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              orders: {
                where: { status: 'COMPLETED' },
                select: { id: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      prisma.referralReward.findMany({
        where:   { referrerId: fullUser.id },
        orderBy: { createdAt: 'desc' },
        include: {
          order: { select: { orderNumber: true, totalAmount: true, completedAt: true } },
        },
      }),
    ])

    const referralsById = new Map<string, {
      id: string
      name: string
      joinedAt: Date
      completedOrders: number
      source: 'REFERRAL_CODE' | 'FIELD_MARKETER'
    }>()
    for (const referral of directReferrals) {
      referralsById.set(referral.id, {
        id: referral.id,
        name: referral.name,
        joinedAt: referral.createdAt,
        completedOrders: referral.orders.length,
        source: 'REFERRAL_CODE',
      })
    }
    for (const signup of marketerReferrals) {
      const referral = signup.referredUser
      referralsById.set(referral.id, {
        id: referral.id,
        name: referral.name,
        joinedAt: referral.createdAt,
        completedOrders: referral.orders.length,
        source: 'FIELD_MARKETER' as const,
      })
    }

    const referrals = Array.from(referralsById.values())
      .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
    const totalEarnings       = rewards.reduce((sum, r) => sum + r.amount, 0)
    const totalReferrals      = referrals.length
    const totalReferralOrders = referrals.reduce((sum, referral) => sum + referral.completedOrders, 0)

    // Use NEXT_PUBLIC_APP_URL so the link works on any domain (custom domain,
    // preview deployments, etc.) — never hardcode bata-mart.vercel.app here.
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://batamart.com').replace(/\/$/, '')
    const referralLink = `${APP_URL}/signup?ref=${fullUser.referralCode}`

    return NextResponse.json({
      referralCode:        fullUser.referralCode,
      referralLink,
      totalReferrals,
      totalEarnings,
      totalReferralOrders,
      referrals: referrals.map(r => ({
        id:              r.id,
        name:            r.name,
        joinedAt:        r.joinedAt,
        completedOrders: r.completedOrders,
        source:          r.source,
      })),
      recentRewards: rewards.slice(0, 20).map(r => ({
        id:          r.id,
        amount:      r.amount,
        orderNumber: r.order.orderNumber,
        orderAmount: r.order.totalAmount,
        earnedAt:    r.createdAt,
      })),
    })
  } catch (error) {
    console.error('Referral stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch referral data' }, { status: 500 })
  }
}