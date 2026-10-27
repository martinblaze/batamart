import { prisma } from '@/lib/prisma'

export function publicName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return parts[0] || 'Marketer'
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

export async function getMarketerRank(marketer: { totalSignups: number; joinedAt: Date }) {
  const ahead = await prisma.fieldMarketer.count({
    where: {
      OR: [
        { totalSignups: { gt: marketer.totalSignups } },
        { totalSignups: marketer.totalSignups, joinedAt: { lt: marketer.joinedAt } },
      ],
    },
  })
  return ahead + 1
}
