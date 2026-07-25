// prisma/seed-delivery-zones.ts
// Run: npx tsx prisma/seed-delivery-zones.ts
// Seeds the 7 UNIZIK delivery zones and their 21 bidirectional priced routes.
// Idempotent — safe to re-run; existing rows are upserted, not duplicated.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const UNIVERSITY_SLUG = 'unizik'

const ZONES = [
  'Aroma',
  'Tempsite',
  'Express Gate',
  'Ifite',
  'Amansea',
  'Bus Stand',
  'School Hostel',
]

// Each pair listed once — lookups are bidirectional at query time.
const ROUTES: [string, string, number][] = [
  ['Aroma', 'Tempsite', 1500],
  ['Aroma', 'Express Gate', 2000],
  ['Aroma', 'Ifite', 1500],
  ['Aroma', 'Amansea', 3000],
  ['Aroma', 'Bus Stand', 2000],
  ['Aroma', 'School Hostel', 2000],

  ['Tempsite', 'Express Gate', 2000],
  ['Tempsite', 'Ifite', 2500],
  ['Tempsite', 'Amansea', 3000],
  ['Tempsite', 'Bus Stand', 2000],
  ['Tempsite', 'School Hostel', 2000],

  ['Express Gate', 'Ifite', 1500],
  ['Express Gate', 'Amansea', 2000],
  ['Express Gate', 'Bus Stand', 1500],
  ['Express Gate', 'School Hostel', 1500],

  ['Ifite', 'Amansea', 2500],
  ['Ifite', 'Bus Stand', 1500],
  ['Ifite', 'School Hostel', 1500],

  ['Amansea', 'Bus Stand', 2000],
  ['Amansea', 'School Hostel', 2000],

  ['Bus Stand', 'School Hostel', 1500],
]

async function main() {
  console.log('🌱 Seeding delivery zones & routes...')

  const university = await prisma.university.findUnique({ where: { slug: UNIVERSITY_SLUG } })
  if (!university) {
    throw new Error(`University with slug "${UNIVERSITY_SLUG}" not found — run seed-universities.ts first.`)
  }

  const zoneByName = new Map<string, string>()

  for (const name of ZONES) {
    const zone = await prisma.deliveryZone.upsert({
      where: { universityId_name: { universityId: university.id, name } },
      update: { isActive: true },
      create: { universityId: university.id, name },
    })
    zoneByName.set(name, zone.id)
    console.log(`✅ Zone: ${name} (${zone.id})`)
  }

  for (const [a, b, price] of ROUTES) {
    const zoneAId = zoneByName.get(a)!
    const zoneBId = zoneByName.get(b)!

    // Routes aren't stored with a canonical order, so check both directions
    // before deciding whether to create or update.
    const existing = await prisma.deliveryRoute.findFirst({
      where: {
        OR: [
          { zoneAId, zoneBId },
          { zoneAId: zoneBId, zoneBId: zoneAId },
        ],
      },
    })

    if (existing) {
      await prisma.deliveryRoute.update({
        where: { id: existing.id },
        data: { price, isActive: true },
      })
    } else {
      await prisma.deliveryRoute.create({
        data: { zoneAId, zoneBId, price },
      })
    }
    console.log(`✅ Route: ${a} <-> ${b} = ₦${price}`)
  }

  console.log('🎉 Done.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
