export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth'
import { getReferralLeaderboard, syncReferralLeaderboardNotifications } from '@/lib/referral/leaderboard'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const leaderboard = await getReferralLeaderboard()
    await syncReferralLeaderboardNotifications(leaderboard.entries)

    const currentUser = leaderboard.entries.find(entry => entry.userId === user.id)
    return NextResponse.json({
      topTen: leaderboard.topTen.map(entry => ({
        rank: entry.rank,
        name: entry.name,
        referrals: entry.referrals,
        orderedReferrals: entry.orderedReferrals,
        conversionPercent: entry.conversionPercent,
        isMegaTop: entry.isMegaTop,
        isYou: entry.userId === user.id,
      })),
      megaTop: leaderboard.megaTop.map(entry => ({
        rank: entry.megaRank,
        overallRank: entry.rank,
        name: entry.name,
        referrals: entry.referrals,
        orderedReferrals: entry.orderedReferrals,
        conversionPercent: entry.conversionPercent,
        isMegaTop: true,
        isYou: entry.userId === user.id,
      })),
      myPosition: currentUser
        ? {
            rank: currentUser.rank,
            referrals: currentUser.referrals,
            orderedReferrals: currentUser.orderedReferrals,
            conversionPercent: currentUser.conversionPercent,
            isMegaTop: currentUser.isMegaTop,
          }
        : null,
    })
  } catch (error) {
    console.error('Referral leaderboard error:', error)
    return NextResponse.json({ error: 'Failed to load referral leaderboard' }, { status: 500 })
  }
}
