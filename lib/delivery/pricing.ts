// lib/delivery/pricing.ts
// Zone-based delivery fee lookup. Zones/routes are seeded per-university via
// prisma/seed-delivery-zones.ts and editable at /admin/delivery-zones.

import { prisma } from '@/lib/prisma'

// Buyer and seller both pick their zone from the same
// University.deliveryAreas list, so a same-zone trip is a real, common case
// even though it has no dedicated route row. Priced below the cheapest
// cross-zone tier (₦1,500) since it's a shorter trip.
export const SAME_ZONE_FEE = 1000

// Used only when a landmark doesn't match any known zone for the
// university (e.g. stale/free-text data predating this feature). Picked as
// the midpoint of the ₦1,500–₦3,000 route range so it under- or
// over-charges by roughly the same margin either way.
export const FALLBACK_DELIVERY_FEE = 2000

function normalise(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

/**
 * Looks up the delivery fee between two zone names for a university.
 * Falls back to FALLBACK_DELIVERY_FEE (with a console warning) if either
 * zone name doesn't match a seeded zone, or no route exists between them.
 */
export async function getDeliveryFee(
  universityId: string | null | undefined,
  pickupZoneName: string | null | undefined,
  dropoffZoneName: string | null | undefined,
): Promise<number> {
  const pickup = normalise(pickupZoneName)
  const dropoff = normalise(dropoffZoneName)

  if (!universityId || !pickup || !dropoff) {
    console.warn('[delivery/pricing] missing universityId/zone — using fallback fee', {
      universityId, pickupZoneName, dropoffZoneName,
    })
    return FALLBACK_DELIVERY_FEE
  }

  if (pickup === dropoff) {
    return SAME_ZONE_FEE
  }

  const zones = await prisma.deliveryZone.findMany({
    where: { universityId, isActive: true },
    select: { id: true, name: true },
  })

  const zoneA = zones.find(z => normalise(z.name) === pickup)
  const zoneB = zones.find(z => normalise(z.name) === dropoff)

  if (!zoneA || !zoneB) {
    console.warn('[delivery/pricing] zone not found for university — using fallback fee', {
      universityId, pickupZoneName, dropoffZoneName,
    })
    return FALLBACK_DELIVERY_FEE
  }

  const route = await prisma.deliveryRoute.findFirst({
    where: {
      isActive: true,
      OR: [
        { zoneAId: zoneA.id, zoneBId: zoneB.id },
        { zoneAId: zoneB.id, zoneBId: zoneA.id },
      ],
    },
    select: { price: true },
  })

  if (!route) {
    console.warn('[delivery/pricing] no route between zones — using fallback fee', {
      universityId, pickupZoneName, dropoffZoneName,
    })
    return FALLBACK_DELIVERY_FEE
  }

  return route.price
}
