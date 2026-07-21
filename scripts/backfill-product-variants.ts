// One-time backfill: turn existing multi-value Category Detail attributes
// (e.g. Storage: 128GB, 256GB, 512GB) into real priced ProductVariant rows.
//
// Before this fix, the sell page could never create ProductVariant records —
// multi-value attributes were only ever saved as flat descriptive text. This
// script finds those products and generates one variant row per combination,
// copying the product's existing price and quantity onto each combination.
// Sellers should review and adjust price/stock per variant afterward.
//
// Usage: npx tsx scripts/backfill-product-variants.ts [--apply]
//   (dry run by default — logs what would change; pass --apply to write)

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MAX_COMBINATIONS = 60 // matches MAX_STOCK sanity cap used on the sell page

function buildCombinations(entries: Array<{ key: string; values: string[] }>): Record<string, string>[] {
  return entries.reduce<Record<string, string>[]>((acc, { key, values }) => {
    if (acc.length === 0) return values.map((v) => ({ [key]: v }))
    const out: Record<string, string>[] = []
    for (const combo of acc) {
      for (const v of values) out.push({ ...combo, [key]: v })
    }
    return out
  }, [])
}

async function main() {
  const apply = process.argv.includes('--apply')
  const products = await prisma.product.findMany({
    where: { isDeleted: false, variantsEnabled: false },
    include: { attributeValues: true, variants: true },
  })

  let backfilled = 0
  let skippedNoMultiValue = 0
  let skippedTooManyCombos = 0
  let skippedAlreadyHasVariants = 0

  for (const p of products) {
    if (p.variants.length > 0) { skippedAlreadyHasVariants++; continue }

    const multiValueAttrs = p.attributeValues
      .filter((av) => Array.isArray(av.value) && (av.value as unknown[]).length >= 2)
      .map((av) => ({ key: av.key, values: (av.value as unknown[]).map((v) => String(v)) }))

    if (multiValueAttrs.length === 0) { skippedNoMultiValue++; continue }

    const combinations = buildCombinations(multiValueAttrs)

    if (combinations.length > MAX_COMBINATIONS) {
      skippedTooManyCombos++
      console.log(`[skip:too-many-combos] ${p.id} "${p.name}" — ${combinations.length} combinations (cap ${MAX_COMBINATIONS})`)
      continue
    }

    backfilled++
    console.log(`[${apply ? 'apply' : 'dry-run'}] ${p.id} "${p.name}" — ${combinations.length} combinations, price=${p.price}, stock/each=${p.quantity}`)

    if (apply) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          variantsEnabled: true,
          basePrice: p.basePrice ?? p.price,
          variants: {
            create: combinations.map((combo) => ({
              combination: combo,
              price: p.price,
              stock: p.quantity,
            })),
          },
        },
      })
    }
  }

  console.log(
    `\n[backfill-product-variants] scanned=${products.length} backfilled=${backfilled} ` +
    `skipped(no-multi-value)=${skippedNoMultiValue} skipped(too-many-combos)=${skippedTooManyCombos} ` +
    `skipped(already-has-variants)=${skippedAlreadyHasVariants} apply=${apply}`
  )
  if (!apply) console.log('Dry run only — re-run with --apply to write these changes.')
}

main()
  .catch((e) => {
    console.error('[backfill-product-variants] failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
