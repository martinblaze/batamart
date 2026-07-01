import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const counts = await prisma.product.groupBy({
    by: ['category', 'categoryKey', 'isActive', 'moderationStatus', 'universityId'],
    _count: {
      _all: true,
    },
  })

  console.log('--- Database Product Status Groups ---')
  for (const group of counts) {
    console.log(JSON.stringify(group))
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
