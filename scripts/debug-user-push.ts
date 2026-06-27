import { prisma } from '../lib/prisma'

async function main() {
  const email = 'jenniferezeh485@gmail.com'
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  })

  if (!user) {
    console.log(JSON.stringify({ user: null, count: 0 }, null, 2))
    return
  }

  const count = await prisma.pushSubscription.count({ where: { userId: user.id } })
  console.log(JSON.stringify({ user, count }, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
