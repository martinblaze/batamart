export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { publicName } from '@/lib/field-marketer/stats'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only people inside the programme can see the board.
    const me = await prisma.fieldMarketer.findUnique({ where: { userId: user.id }, select: { id: true } })
    if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const top = await prisma.fieldMarketer.findMany({
      orderBy: [{ totalSignups: 'desc' }, { joinedAt: 'asc' }],
      take: 20,
      select: { id: true, totalSignups: true, user: { select: { name: true, profilePhoto: true } } },
    })

    return NextResponse.json({
      entries: top.map((m, i) => ({
        rank: i + 1,
        name: publicName(m.user.name),
        signups: m.totalSignups,
        isYou: m.id === me.id,
      })),
    })
  } catch (error) {
    console.error('Field marketer leaderboard error:', error)
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 })
  }
}
