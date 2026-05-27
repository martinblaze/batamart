import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }
const pooledDatabaseUrl = process.env.POOLED_DATABASE_URL || process.env.DATABASE_URL

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    ...(pooledDatabaseUrl
      ? {
          datasources: {
            db: { url: pooledDatabaseUrl },
          },
        }
      : {}),
  })

// ✅ Cache in ALL environments, not just development
globalForPrisma.prisma = prisma

export default prisma
