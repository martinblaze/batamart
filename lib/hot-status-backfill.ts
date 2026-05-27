import { prisma } from '@/lib/prisma'
import { updateHotStatus } from '@/lib/marketPrice/engine'

const HOT_BACKFILL_BATCH = 120

export async function backfillExistingHotStatuses(universityId: string): Promise<number> {
  const candidates = await prisma.product.findMany({
    where: {
      universityId,
      isActive: true,
      isDeleted: false,
      quantity: { gt: 0 },
    },
    select: { id: true },
    orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
    take: HOT_BACKFILL_BATCH,
  })

  let updated = 0
  for (const product of candidates) {
    try {
      await updateHotStatus(product.id)
      updated += 1
    } catch {}
  }

  return updated
}

export async function backfillHotStatusesForActiveUniversities(): Promise<{
  updated: number
  universityIds: string[]
}> {
  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  let updated = 0
  for (const university of universities) {
    updated += await backfillExistingHotStatuses(university.id)
  }

  return {
    updated,
    universityIds: universities.map((university) => university.id),
  }
}
