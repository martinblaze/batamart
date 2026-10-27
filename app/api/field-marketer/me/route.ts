export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import {
  FIELD_MARKETER_PAY_PER_SIGNUP,
  buildEncouragement,
  getMilestoneTier,
  milestoneMessage,
} from '@/lib/field-marketer/config'
import { getMarketerRank, publicName } from '@/lib/field-marketer/stats'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const marketer = await prisma.fieldMarketer.findUnique({ where: { userId: user.id } })
    if (!marketer) return NextResponse.json({ joined: false })

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [rank, today, week, recent] = await Promise.all([
      getMarketerRank(marketer),
      prisma.fieldMarketerSignup.count({ where: { marketerId: marketer.id, createdAt: { gte: startOfToday } } }),
      prisma.fieldMarketerSignup.count({ where: { marketerId: marketer.id, createdAt: { gte: weekAgo } } }),
      prisma.fieldMarketerSignup.findMany({
        where: { marketerId: marketer.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, amount: true, createdAt: true, referredUser: { select: { name: true } } },
      }),
    ])

    const available = marketer.balance
    const tier = getMilestoneTier(marketer.totalSignups)
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://batamart.com').replace(/\/$/, '')

    return NextResponse.json({
      joined: true,
      link: `${appUrl}/signup?fm=${marketer.code}`,
      code: marketer.code,
      payPerSignup: FIELD_MARKETER_PAY_PER_SIGNUP,
      totalSignups: marketer.totalSignups,
      totalEarned: marketer.totalEarned,
      availableBalance: available,
      signupsToday: today,
      signupsThisWeek: week,
      rank,
      tier,
      milestone: milestoneMessage(tier),
      encouragement: buildEncouragement(marketer.totalSignups, available),
      recent: recent.map(r => ({
        id: r.id,
        name: publicName(r.referredUser.name),
        amount: r.amount,
        at: r.createdAt,
      })),
    })
  } catch (error) {
    console.error('Field marketer me error:', error)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }
}
