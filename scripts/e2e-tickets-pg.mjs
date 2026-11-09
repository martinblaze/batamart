// Throwaway local Postgres for scripts/e2e-tickets.ts (never touches a remote DB).
// Usage:  node scripts/e2e-tickets-pg.mjs <dataDir> [port]     (stays in the foreground; Ctrl+C or kill to stop)
// First run initialises <dataDir>. Creates database "tickets_e2e" and schema "public".
import EmbeddedPostgres from 'embedded-postgres'
import fs from 'node:fs'

const dataDir = process.argv[2]
const port = Number(process.argv[3] || 54329)
if (!dataDir) { console.error('usage: node scripts/e2e-tickets-pg.mjs <dataDir> [port]'); process.exit(2) }

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'postgres', port, persistent: true, initdbFlags: ['--encoding=UTF8', '--locale=C'] })
if (!fs.existsSync(dataDir + '/PG_VERSION')) await pg.initialise()
await pg.start()
try { await pg.createDatabase('tickets_e2e') } catch (e) { console.log('createDatabase:', e.message) }
console.log(`READY postgresql://postgres:postgres@127.0.0.1:${port}/tickets_e2e`)

const stop = async () => { try { await pg.stop() } catch {} process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
