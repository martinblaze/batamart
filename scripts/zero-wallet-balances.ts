import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run without --confirm')
    process.exit(1)
  }

  const result = await prisma.user.updateMany({
    data: {
      availableBalance: 0,
      pendingBalance: 0,
    },
  })

  console.log(`Reset wallet balances for ${result.count} user(s).`)
}

main()
  .catch(error => {
    console.error('Wallet reset failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
