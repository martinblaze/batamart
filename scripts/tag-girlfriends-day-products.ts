import { PrismaClient } from '@prisma/client'
import { CAMPAIGNS } from '../lib/campaigns'

const prisma = new PrismaClient()

const PRODUCT_IDS = [
  'cms3czdpl0000126ts75ae4sb',
  'cms31o1y6000h6ov9guq5vyds',
  'cmqxhmjal000fx34io3a8t2u4',
  'cmqxh0ycc000bx34i0y2wxvf3',
  'cmqxds0id000tj0hus0qcdwh4',
  'cmqp54hqx000aomvfxtj18auf',
  'cmqp4kp1x000w7dsdmxc32b5g',
  'cmqxg9sw70000ioc3vdmy14r9',
  'cmqxdun9i000zj0huqfbhl7ml',
  'cmqxgt3ic0009x34ip83dqob0',
]

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run without --confirm')
    process.exit(1)
  }

  const campaign = CAMPAIGNS.GIRLFRIENDS_DAY

  const result = await prisma.product.updateMany({
    where: { id: { in: PRODUCT_IDS } },
    data: {
      campaignTag: campaign.key,
      campaignExpiresAt: new Date(campaign.endsAt),
    },
  })

  console.log(`Tagged ${result.count} of ${PRODUCT_IDS.length} product(s) as ${campaign.key}.`)

  if (result.count < PRODUCT_IDS.length) {
    const found = await prisma.product.findMany({
      where: { id: { in: PRODUCT_IDS } },
      select: { id: true },
    })
    const foundIds = new Set(found.map(p => p.id))
    const missing = PRODUCT_IDS.filter(id => !foundIds.has(id))
    console.warn('Missing product IDs (not found in DB):', missing)
  }
}

main()
  .catch(error => {
    console.error('Tagging failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
