import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PRESERVE_TABLES = new Set([
  'University',
  'User',
  'Product',
  'ProductVariant',
  'ProductAttributeValue',
  'CategoryAttribute',
  'AttributeSuggestion',
  'AttributeValueStats',
])

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.error('Refusing to run without --confirm')
    process.exit(1)
  }

  const preserveList = Array.from(PRESERVE_TABLES)
    .map(name => `'${name.replace(/'/g, "''")}'`)
    .join(', ')

  const tables = await prisma.$queryRawUnsafe<Array<{ schemaname: string; tablename: string }>>(
    `SELECT schemaname, tablename
     FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename NOT IN (${preserveList})
     ORDER BY tablename`
  )

  const tableNames = tables.map(t => `${t.schemaname}.${t.tablename}`)

  if (tableNames.length === 0) {
    console.log('Nothing to purge.')
    return
  }

  console.log('Purging tables:')
  for (const name of tableNames) {
    console.log(`- ${name}`)
  }

  const quotedTables = tables
    .map(t => `"${t.schemaname}"."${t.tablename.replace(/"/g, '""')}"`)
    .join(', ')

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`)

  console.log('Cleanup complete. Core product and user tables were preserved.')
}

main()
  .catch(error => {
    console.error('Database purge failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
