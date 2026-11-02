import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { publicName } from '@/lib/field-marketer/stats'
import { notifyUser } from '@/lib/notify/dispatch'

export interface ReferralLeaderboardEntry {
  userId: string
  name: string
  referrals: number
  orderedReferrals: number
  conversionPercent: number
  rank: number
  isMegaTop: boolean
}

export interface ReferralLeaderboardCandidate {
  userId: string
  name: string
  referrals: number
  orderedReferrals: number
}

const LEADERBOARD_STATE_ID = 'global'

export function rankReferralCandidates(candidates: ReferralLeaderboardCandidate[]) {
  const entries = candidates
    .map(candidate => ({
      ...candidate,
      conversionPercent: candidate.referrals > 0
        ? Math.round((candidate.orderedReferrals / candidate.referrals) * 1000) / 10
        : 0,
    }))
    .sort((a, b) =>
      b.referrals - a.referrals ||
      b.orderedReferrals - a.orderedReferrals ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

  const megaTop = entries
    .slice(0, 10)
    .filter(entry =>
      entry.referrals >= 2 &&
      entry.orderedReferrals * 100 >= entry.referrals * 20,
    )
    .slice(0, 3)
    .map((entry, index) => ({ ...entry, megaRank: index + 1 }))

  const megaTopIds = new Set(megaTop.map(entry => entry.userId))
  const rankedEntries = entries.map(entry => ({
    ...entry,
    isMegaTop: megaTopIds.has(entry.userId),
  }))

  return {
    entries: rankedEntries,
    topTen: rankedEntries.slice(0, 10),
    megaTop: megaTop.map(entry => ({
      ...entry,
      isMegaTop: true,
    })),
  }
}

export async function getReferralLeaderboard() {
  const referredUsers = await prisma.user.findMany({
    where: {
      OR: [
        { referredById: { not: null } },
        { fieldMarketerSignup: { isNot: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      referredById: true,
      fieldMarketerSignup: {
        select: { marketer: { select: { userId: true } } },
      },
      orders: {
        where: { isPaid: true },
        select: { id: true },
        take: 1,
      },
    },
  })

  const totals = new Map<string, {
    referrals: number
    orderedReferrals: number
  }>()

  for (const referredUser of referredUsers) {
    const referrerId =
      referredUser.fieldMarketerSignup?.marketer.userId ?? referredUser.referredById
    if (!referrerId || referrerId === referredUser.id) continue

    const total = totals.get(referrerId) ?? {
      referrals: 0,
      orderedReferrals: 0,
    }
    total.referrals += 1
    if (referredUser.orders.length > 0) total.orderedReferrals += 1
    totals.set(referrerId, total)
  }

  const referrers = await prisma.user.findMany({
    where: { id: { in: Array.from(totals.keys()) } },
    select: { id: true, name: true },
  })
  const names = new Map(referrers.map(user => [user.id, publicName(user.name)]))

  const candidates = Array.from(totals.entries())
    .map(([userId, total]) => ({
      userId,
      name: names.get(userId) ?? 'BataMart user',
      referrals: total.referrals,
      orderedReferrals: total.orderedReferrals,
    }))
  return rankReferralCandidates(candidates)
}

function isPrismaRace(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2002' || error.code === 'P2034')
}

async function seedLeaderboardSnapshot(entries: ReferralLeaderboardEntry[]) {
  try {
    await prisma.$transaction(async tx => {
      const state = await tx.referralLeaderboardState.findUnique({
        where: { id: LEADERBOARD_STATE_ID },
        select: { id: true },
      })
      if (state) return

      const topTen = entries.filter(entry => entry.rank <= 10)
      if (topTen.length > 0) {
        await tx.referralLeaderboardPosition.createMany({
          data: topTen.map(entry => ({
            userId: entry.userId,
            rank: entry.rank,
            isMegaTop: entry.isMegaTop,
          })),
          skipDuplicates: true,
        })
      }
      await tx.referralLeaderboardState.create({ data: { id: LEADERBOARD_STATE_ID } })
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (!isPrismaRace(error)) throw error
  }
}

function rankNotification(entry: ReferralLeaderboardEntry, previousRank: number | null, version: number) {
  const title = previousRank === null
    ? `You're now #${entry.rank} on the referral leaderboard`
    : entry.rank <= 10
      ? `Your referral leaderboard position changed to #${entry.rank}`
      : `You've moved to #${entry.rank} on the referral leaderboard`
  const message = `You referred ${entry.referrals} people, and ${entry.conversionPercent}% have placed a paid order.`
  const subject = previousRank === null
    ? `You made BataMart's referral top 10`
    : `Your BataMart referral rank is now #${entry.rank}`

  return notifyUser(entry.userId, {
    category: 'transactional',
    type: 'REFERRAL_REWARD',
    title,
    message,
    url: '/referrals/leaderboard',
    dedupeKey: `referral-leaderboard:rank:${version}`,
    email: {
      subject,
      eyebrow: 'Referral leaderboard',
      heading: title,
      lines: [
        `Your position is now #${entry.rank}${entry.rank <= 10 ? ' in the top 10' : ', outside the top 10'}.`,
        message,
      ],
      ctaLabel: 'View leaderboard',
      ctaUrl: '/referrals/leaderboard',
    },
  })
}

function megaTopNotification(entry: ReferralLeaderboardEntry, version: number) {
  return notifyUser(entry.userId, {
    category: 'transactional',
    type: 'REFERRAL_REWARD',
    title: `You're a Mega Top Ambassador — #${entry.rank}`,
    message: `${entry.conversionPercent}% of your ${entry.referrals} referrals have placed a paid order. You're in the Mega Top 3.`,
    url: '/referrals/leaderboard',
    dedupeKey: `referral-leaderboard:mega:${version}`,
  })
}

export async function syncReferralLeaderboardNotifications(
  entries: ReferralLeaderboardEntry[],
) {
  const state = await prisma.referralLeaderboardState.findUnique({
    where: { id: LEADERBOARD_STATE_ID },
    select: { id: true },
  })
  if (!state) {
    await seedLeaderboardSnapshot(entries)
    return
  }

  const trackedPositions = await prisma.referralLeaderboardPosition.findMany()
  const trackedByUser = new Map(trackedPositions.map(position => [position.userId, position]))
  const currentByUser = new Map(entries.map(entry => [entry.userId, entry]))

  for (const entry of entries) {
    const previous = trackedByUser.get(entry.userId)
    if (!previous) {
      if (entry.rank > 10) continue

      const created = await prisma.referralLeaderboardPosition.createMany({
        data: [{
          userId: entry.userId,
          rank: entry.rank,
          isMegaTop: entry.isMegaTop,
        }],
        skipDuplicates: true,
      })
      if (created.count === 0) continue

      await rankNotification(entry, null, 0)
      if (entry.isMegaTop) await megaTopNotification(entry, 0)
      continue
    }

    if (entry.rank > 10 && previous.rank > 10) {
      if (previous.rank !== 11 || previous.isMegaTop) {
        await prisma.referralLeaderboardPosition.updateMany({
          where: {
            userId: entry.userId,
            rank: previous.rank,
            isMegaTop: previous.isMegaTop,
            version: previous.version,
          },
          data: { rank: 11, isMegaTop: false },
        })
      }
      continue
    }

    if (previous.rank === entry.rank && previous.isMegaTop === entry.isMegaTop) continue

    const nextVersion = previous.version + 1
    const changed = await prisma.referralLeaderboardPosition.updateMany({
      where: {
        userId: entry.userId,
        rank: previous.rank,
        isMegaTop: previous.isMegaTop,
        version: previous.version,
      },
      data: {
        rank: entry.rank,
        isMegaTop: entry.isMegaTop,
        version: { increment: 1 },
      },
    })
    if (changed.count === 0) continue

    if (previous.rank !== entry.rank && (previous.rank <= 10 || entry.rank <= 10)) {
      await rankNotification(entry, previous.rank, nextVersion)
    }
    if (!previous.isMegaTop && entry.isMegaTop) {
      await megaTopNotification(entry, nextVersion)
    }
  }

  for (const previous of trackedPositions) {
    if (currentByUser.has(previous.userId)) continue
    const removed = await prisma.referralLeaderboardPosition.deleteMany({
      where: {
        userId: previous.userId,
        version: previous.version,
      },
    })
    if (removed.count > 0 && previous.rank <= 10) {
      console.warn(`[REFERRAL-LEADERBOARD] Removed missing referrer ${previous.userId} from the rank snapshot`)
    }
  }
}
