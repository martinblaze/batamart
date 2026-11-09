// End-to-end test of BataMart ticketing against a THROWAWAY LOCAL PostgreSQL.
//
// Run: (never point this at a real database; the script aborts unless DATABASE_URL is local and the db name has "e2e" or "test")
//   1. Start a local Postgres (embedded binaries, no admin rights needed), leave it running in its own terminal:
//        node scripts/e2e-tickets-pg.mjs "%TEMP%/bt-e2e-pgdata" 54329
//      (creates database "tickets_e2e" on 127.0.0.1:54329, user/password postgres)
//   2. Build the schema on it (set ALL THREE vars so the .env live URLs are never used):
//        DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/tickets_e2e
//        DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54329/tickets_e2e
//        POOLED_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/tickets_e2e
//        npx prisma db push --skip-generate --accept-data-loss
//   3. Run the test with the same variables:
//        npx tsx scripts/e2e-tickets.ts
//
// External services are stubbed: email (sendEmail records messages, sends nothing), Flutterwave
// (flutterwaveRequest returns canned data), push/redis keys are blanked.

export {}

// ── Safety: local database only ───────────────────────────────────────────────
function abort(msg: string): never {
  console.error('ABORT: ' + msg)
  process.exit(2)
}
const dbUrl = process.env.DATABASE_URL ?? ''
let dbHost = ''
let dbName = ''
try {
  const u = new URL(dbUrl)
  dbHost = u.hostname
  dbName = u.pathname.replace(/^\//, '')
} catch {
  abort('DATABASE_URL is missing or not a valid URL.')
}
if (dbHost !== '127.0.0.1' && dbHost !== 'localhost') abort(`DATABASE_URL host is "${dbHost}", not local.`)
if (!/e2e|test/i.test(dbName)) abort(`Database name "${dbName}" must contain "e2e" or "test".`)
for (const k of ['DIRECT_URL', 'POOLED_DATABASE_URL']) {
  const v = process.env[k]
  if (v) {
    try {
      const h = new URL(v).hostname
      if (h !== '127.0.0.1' && h !== 'localhost') abort(`${k} host is "${h}", not local.`)
    } catch { abort(`${k} is not a valid URL.`) }
  }
}
// Pin every URL Prisma might read to the local DB (the repo .env must not win), and blank every external service
// BEFORE any application module is loaded (Prisma loads .env without overriding variables that already exist).
process.env.DIRECT_URL = dbUrl
process.env.POOLED_DATABASE_URL = dbUrl
process.env.JWT_SECRET = 'e2e-test-secret-not-real'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
;(process.env as Record<string, string>).NODE_ENV = 'test'
for (const k of [
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RESEND_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
  'BREVO_API_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_EMAIL', 'FIREBASE_SERVICE_ACCOUNT',
  'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'GEMINI_API_KEY', 'GOOGLE_CLIENT_SECRET',
]) process.env[k] = ''
process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-e2e'

// ── Stubs for external services (installed in require.cache before app code loads) ───────────────
import path from 'path'
const sentEmails: { to: string; subject: string; html: string }[] = []
let fwReply: any = null
function stubModule(rel: string, patch: (real: any) => any) {
  const file = require.resolve(path.resolve(process.cwd(), rel))
  const real = require(file)
  const merged: any = {}
  for (const k of Object.keys(real)) merged[k] = real[k]
  Object.assign(merged, patch(real))
  require.cache[file]!.exports = merged
}
stubModule('lib/email/sendEmail.ts', () => ({
  sendEmail: async (p: any) => { sentEmails.push({ to: p.to, subject: p.subject, html: p.html }); return true },
}))
stubModule('lib/finance/flutterwave.ts', () => ({
  flutterwaveRequest: async () => ({ ok: true, status: 200, data: fwReply }),
}))

// ── tiny test harness ────────────────────────────────────────────────────────
let pass = 0
let fail = 0
const failures: string[] = []
function check(name: string, cond: any, detail?: unknown) {
  if (cond) { pass++; console.log('  PASS ' + name) } else {
    fail++; failures.push(name)
    console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''))
  }
}
const section = (s: string) => console.log('\n== ' + s)
const DAY = 24 * 3600_000

async function main() {
  const { NextRequest } = await import('next/server')
  const { prisma } = await import('@/lib/prisma')
  const { generateToken } = await import('@/lib/auth/auth')
  const P = await import('@/lib/tickets/purchase')
  const { buildQrText } = await import('@/lib/tickets/qr')
  const { runTicketReminders } = await import('@/lib/tickets/reminders')
  const { lagosDayStart } = await import('@/lib/tickets/reminder-window')

  const hostEvents = await import('@/app/api/tickets/host/events/route')
  const hostCheckers = await import('@/app/api/tickets/host/events/[id]/checkers/route')
  const hostChecker = await import('@/app/api/tickets/host/events/[id]/checkers/[checkerId]/route')
  const hostResend = await import('@/app/api/tickets/host/events/[id]/checkers/[checkerId]/resend/route')
  const hostSellers = await import('@/app/api/tickets/host/events/[id]/sellers/route')
  const adminEvent = await import('@/app/api/admin/tickets/events/[id]/route')
  const publicEvent = await import('@/app/api/tickets/events/[id]/route')
  const publicEvents = await import('@/app/api/tickets/events/route')
  const listings = await import('@/app/api/tickets/listings/route')
  const listingId = await import('@/app/api/tickets/listings/[id]/route')
  const checkerLogin = await import('@/app/api/tickets/checker/login/route')
  const checkerScan = await import('@/app/api/tickets/checker/scan/route')
  const transferRoute = await import('@/app/api/tickets/ticket/[id]/transfer/route')
  const mineRoute = await import('@/app/api/tickets/mine/route')
  const verifyRoute = await import('@/app/api/tickets/verify/route')
  const checkoutRoute = await import('@/app/api/tickets/checkout/route')

  // Confirm what we are really connected to.
  const who: any[] = await prisma.$queryRaw`SELECT current_database() AS db, inet_server_addr()::text AS addr`
  if (!/e2e|test/i.test(who[0].db)) abort('Connected database is ' + who[0].db)
  console.log(`Connected to local database ${who[0].db} (${who[0].addr ?? 'unix socket'})`)

  // ── helpers ────────────────────────────────────────────────────────────────
  const RUN = Date.now().toString(36)
  let seq = 0
  async function mkUser(o: { username?: string; role?: string; email?: string | null; bal?: number; name?: string } = {}) {
    seq++
    const username = o.username === undefined ? `u${RUN}${seq}` : o.username
    return prisma.user.create({
      data: {
        phone: `+2348${RUN.padStart(5, '0').slice(-5)}${String(seq).padStart(5, '0')}`,
        email: o.email === undefined ? `user${seq}.${RUN}@gmail.com` : o.email,
        password: 'x', name: o.name ?? `Test User${seq}`, username: username || null,
        role: (o.role ?? 'BUYER') as any, referralCode: `R${RUN}${seq}`, availableBalance: o.bal ?? 0,
      },
    })
  }
  const tok = (u: { id: string; phone: string }, role: string) => generateToken(u.id, u.phone, role)
  const bal = async (id: string) => Number((await prisma.user.findUnique({ where: { id }, select: { availableBalance: true } }))!.availableBalance)

  async function call(handler: (req: any, ctx?: any) => Promise<Response>, o: { method?: string; url?: string; token?: string; body?: unknown; params?: any } = {}) {
    const method = o.method ?? 'GET'
    const headers: Record<string, string> = {}
    if (o.token) headers.authorization = `Bearer ${o.token}`
    if (o.body !== undefined) headers['content-type'] = 'application/json'
    const req = new NextRequest(o.url ?? 'http://localhost:3000/api/x', {
      method, headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    })
    const res = await handler(req, o.params !== undefined ? { params: o.params } : undefined)
    let json: any = null
    try { json = await res.clone().json() } catch { /* redirect or empty */ }
    return { status: res.status, json, res }
  }

  async function mkEvent(hostId: string, o: { tiers: { name: string; price: number; capacity: number; rand?: number; uniq?: number }[]; status?: string; startsAt?: Date; name?: string }) {
    return prisma.ticketEvent.create({
      data: {
        hostId, name: o.name ?? `Event ${RUN}${++seq}`, venue: 'Hall', startsAt: o.startsAt ?? new Date(Date.now() + 10 * DAY),
        flyerUrl: 'https://res.cloudinary.com/x/f.jpg', status: (o.status ?? 'ACTIVE') as any,
        tiers: { create: o.tiers.map((t, i) => ({ name: t.name, price: t.price, capacity: t.capacity, randomCommissionPct: t.rand ?? 0, uniqueCommissionPct: t.uniq ?? 0, sortOrder: i })) },
      },
      include: { tiers: true },
    })
  }
  let gseq = 0
  async function buy(tierId: string, qty: number, o: { email?: string; userId?: string | null; resellerId?: string | null; method?: 'CARD' | 'WALLET' } = {}) {
    const tier = (await prisma.ticketTier.findUnique({ where: { id: tierId } }))!
    const sale = await P.prepareSale({ eventId: tier.eventId, tierId, quantity: qty, resellerId: o.resellerId ?? null, buyerUserId: o.userId ?? null })
    const purchase = await P.createPendingPurchase(sale, { userId: o.userId ?? null, email: o.email ?? `guest${++gseq}.${RUN}@gmail.com` }, o.method ?? 'CARD')
    return { sale, purchase }
  }
  const payCard = (p: { id: string; subtotal: number }, amount?: number) =>
    P.settlePurchase(p.id, { method: 'CARD', gatewayTxId: `g${++gseq}${RUN}`, paidAmount: amount ?? p.subtotal })
  async function buyPaid(tierId: string, qty: number, o: Parameters<typeof buy>[2] = {}) {
    const { purchase } = await buy(tierId, qty, o)
    const r = await payCard(purchase)
    if (!r.ok) throw new Error('settle failed: ' + JSON.stringify(r))
    return purchase
  }
  const tickets = (purchaseId: string) => prisma.ticket.findMany({ where: { purchaseId }, orderBy: { id: 'asc' } })
  const rejects = async (fn: () => Promise<unknown>) => { try { await fn(); return null } catch (e: any) { return e?.code ?? String(e) } }
  const lastEmailTo = (to: string) => [...sentEmails].reverse().find(e => e.to === to)
  const tokenFromEmail = (to: string) => /checkin\/([A-Za-z0-9_-]+)/.exec(lastEmailTo(to)?.html ?? '')?.[1] ?? ''

  // ── actors ─────────────────────────────────────────────────────────────────
  const host = await mkUser({ role: 'SELLER', username: `host${RUN}` })
  const randSeller = await mkUser({ role: 'SELLER' })
  const uniqueA = await mkUser({ role: 'SELLER' })
  const uniqueB = await mkUser({ role: 'SELLER' })
  const buyer = await mkUser({ bal: 0 })
  const friend = await mkUser()
  const admin = await mkUser({ role: 'ADMIN', username: null as any })
  const hostTok = tok(host, 'SELLER')
  const adminTok = tok(admin, 'ADMIN')
  const buyerTok = tok(buyer, 'BUYER')

  // ═══ 1. Host creates event; admin approves ═══════════════════════════════════
  section('1. Event creation and approval')
  const startsAt = new Date(Date.now() + 10 * DAY).toISOString()
  const create = await call(hostEvents.POST, {
    method: 'POST', token: hostTok, url: 'http://localhost:3000/api/tickets/host/events',
    body: {
      name: 'E2E Night', venue: 'Main Hall', startsAt, flyerUrl: 'https://res.cloudinary.com/demo/image/upload/f.jpg', allowResale: true,
      tiers: [
        { name: 'Regular', price: 2000, capacity: 100, randomCommissionPct: 10, uniqueCommissionPct: 20 },
        { name: 'VIP', price: 5000, capacity: 50, randomCommissionPct: 10, uniqueCommissionPct: 20 },
      ],
      checkerEmails: ['door1@gmail.com'], sellerUsernames: [uniqueA.username],
    },
  })
  check('host create returns 200 + PENDING_REVIEW', create.status === 200 && create.json?.status === 'PENDING_REVIEW', create.json)
  const eventId: string = create.json?.id
  const ev = await prisma.ticketEvent.findUnique({ where: { id: eventId }, include: { tiers: true, checkers: true, sellers: true } })
  check('event row PENDING_REVIEW with 2 tiers, 1 checker, 1 unique seller', ev?.status === 'PENDING_REVIEW' && ev.tiers.length === 2 && ev.checkers.length === 1 && ev.sellers.length === 1)
  const regular = ev!.tiers.find(t => t.name === 'Regular')!
  const vip = ev!.tiers.find(t => t.name === 'VIP')!
  check('door1 invite email captured (nothing sent externally)', !!tokenFromEmail('door1@gmail.com'))

  const pubPending = await call(publicEvent.GET, { url: `http://localhost:3000/api/tickets/events/${eventId}`, params: { id: eventId } })
  check('pending event is not public (404)', pubPending.status === 404, pubPending.status)
  const listPending = await call(publicEvents.GET, { url: 'http://localhost:3000/api/tickets/events' })
  check('pending event not in public list', !JSON.stringify(listPending.json).includes(eventId))
  check('pending event is not buyable (EVENT_NOT_ON_SALE)', (await rejects(() => P.prepareSale({ eventId, tierId: regular.id, quantity: 1 }))) === 'EVENT_NOT_ON_SALE')

  const notAdmin = await call(adminEvent.POST, { method: 'POST', token: hostTok, body: { action: 'approve' }, params: { id: eventId } })
  check('non-admin cannot approve (401)', notAdmin.status === 401, notAdmin.status)
  const approve = await call(adminEvent.POST, { method: 'POST', token: adminTok, body: { action: 'approve' }, params: { id: eventId } })
  check('admin approve -> ACTIVE', approve.status === 200 && approve.json?.status === 'ACTIVE', approve.json)
  const again = await call(adminEvent.POST, { method: 'POST', token: adminTok, body: { action: 'approve' }, params: { id: eventId } })
  check('approving twice is an illegal transition (409)', again.status === 409)
  const pubActive = await call(publicEvent.GET, { url: `http://localhost:3000/api/tickets/events/${eventId}`, params: { id: eventId } })
  check('active event is public with 2 tiers', pubActive.status === 200 && pubActive.json?.tiers?.length === 2, pubActive.json)
  check('active event is buyable', (await rejects(() => P.prepareSale({ eventId, tierId: regular.id, quantity: 1 }))) === null)

  // ═══ 2. Guest purchase ═══════════════════════════════════════════════════════
  section('2. Guest purchase, idempotency, wrong amount')
  const hostBal0 = await bal(host.id)
  const { purchase: p2 } = await buy(regular.id, 2, { email: 'guest.one@gmail.com' })
  check('createPendingPurchase is PENDING with split 4000/400/0/3600', p2.status === 'PENDING' && p2.subtotal === 4000 && p2.platformFee === 400 && p2.commission === 0 && p2.hostAmount === 3600, p2)
  const r2 = await payCard(p2)
  check('settle ok, not already', r2.ok && (r2 as any).already === false, r2)
  const t2 = await tickets(p2.id)
  check('2 tickets issued, VALID, owner email set', t2.length === 2 && t2.every(t => t.status === 'VALID' && t.ownerEmail === 'guest.one@gmail.com' && t.ownerUserId === null))
  check('tier.sold incremented by 2', (await prisma.ticketTier.findUnique({ where: { id: regular.id } }))!.sold === 2)
  check('host credited 3600', (await bal(host.id)) - hostBal0 === 3600)
  const tx2 = await prisma.transaction.findMany({ where: { reference: { startsWith: p2.reference } } })
  check('one Transaction CREDIT row for host with correct before/after', tx2.length === 1 && tx2[0].type === 'CREDIT' && Number(tx2[0].amount) === 3600 && Number(tx2[0].balanceAfter) - Number(tx2[0].balanceBefore) === 3600, tx2)
  const balAfter = await bal(host.id)
  const r2b = await payCard(p2)
  check('second settle is idempotent (ok, already)', r2b.ok && (r2b as any).already === true, r2b)
  check('no extra tickets / balance / sold / transactions after re-settle',
    (await tickets(p2.id)).length === 2 && (await bal(host.id)) === balAfter &&
    (await prisma.ticketTier.findUnique({ where: { id: regular.id } }))!.sold === 2 &&
    (await prisma.transaction.count({ where: { reference: { startsWith: p2.reference } } })) === 1)
  const [rA, rB] = await Promise.all([P.settlePurchase(p2.id, { method: 'CARD', paidAmount: 4000 }), P.settlePurchase(p2.id, { method: 'CARD', paidAmount: 4000 })])
  check('parallel re-settle also does nothing', rA.ok && rB.ok && (await tickets(p2.id)).length === 2 && (await bal(host.id)) === balAfter)

  const { purchase: p2w } = await buy(regular.id, 1, { email: 'guest.wrong@gmail.com' })
  const rw = await payCard(p2w, 1999)
  check('wrong amount rejected (AMOUNT_MISMATCH)', !rw.ok && (rw as any).code === 'AMOUNT_MISMATCH', rw)
  const p2wRow = await prisma.ticketPurchase.findUnique({ where: { id: p2w.id } })
  check('wrong-amount purchase stays PENDING, no tickets, no credit, sold unchanged',
    p2wRow!.status === 'PENDING' && (await tickets(p2w.id)).length === 0 && (await bal(host.id)) === balAfter &&
    (await prisma.ticketTier.findUnique({ where: { id: regular.id } }))!.sold === 2)
  const rNaN = await P.settlePurchase(p2w.id, { method: 'CARD' })
  check('missing paidAmount rejected', !rNaN.ok)
  // The correct amount then still works (the failed attempt did not poison the purchase).
  const rOk = await payCard(p2w)
  check('correct amount afterwards settles', rOk.ok && (await tickets(p2w.id)).length === 1)

  // Card verify route with mocked Flutterwave
  const { purchase: pv } = await buy(vip.id, 1, { email: 'guest.verify@gmail.com' })
  const verifyUrl = (id: string) => `http://localhost:3000/api/tickets/verify?tx_ref=${pv.reference}&transaction_id=${id}&status=successful`
  fwReply = { status: 'success', data: { id: 880001, status: 'successful', tx_ref: pv.reference, currency: 'NGN', amount: 4999, meta: { purpose: 'TICKET_PURCHASE', purchaseId: pv.id } } }
  const v1 = await call(verifyRoute.GET, { url: verifyUrl('880001') })
  check('verify: gateway amount mismatch -> failed redirect, still PENDING', (v1.res.headers.get('location') ?? '').includes('payment=failed') && (await prisma.ticketPurchase.findUnique({ where: { id: pv.id } }))!.status === 'PENDING', v1.res.headers.get('location'))
  fwReply = { status: 'success', data: { id: 880001, status: 'successful', tx_ref: pv.reference, currency: 'NGN', amount: 5000, meta: { purpose: 'TICKET_PURCHASE', purchaseId: pv.id } } }
  const v2 = await call(verifyRoute.GET, { url: verifyUrl('880001') })
  const loc = v2.res.headers.get('location') ?? ''
  check('verify: correct amount -> guest success redirect and PAID with 1 ticket', loc.includes('/t/') && loc.includes('paid=1') && (await tickets(pv.id)).length === 1, loc)
  const v3 = await call(verifyRoute.GET, { url: verifyUrl('880001') })
  check('verify replay is harmless (still 1 ticket)', (await tickets(pv.id)).length === 1 && (v3.res.headers.get('location') ?? '').includes('paid=1'))
  fwReply = { status: 'success', data: { id: 880001, status: 'successful', tx_ref: 'x', currency: 'NGN', amount: 5000, meta: {} } }
  const { purchase: pv2 } = await buy(vip.id, 1, { email: 'guest.verify2@gmail.com' })
  const v4 = await call(verifyRoute.GET, { url: `http://localhost:3000/api/tickets/verify?tx_ref=${pv2.reference}&transaction_id=880001&status=successful` })
  check('verify: tx_ref mismatch / reused gateway id cannot settle another purchase', (await tickets(pv2.id)).length === 0 && (v4.res.headers.get('location') ?? '').includes('payment=failed'))

  // ═══ 3. Resale ═════════════════════════════════════════════════════════════════
  section('3. Resale and commissions')
  const addUnique = await call(hostSellers.POST, { method: 'POST', token: hostTok, body: { username: uniqueB.username }, params: { id: eventId } })
  check('host adds unique seller by username', addUnique.status === 200 && addUnique.json?.seller?.kind === 'UNIQUE', addUnique.json)
  const addUnknown = await call(hostSellers.POST, { method: 'POST', token: hostTok, body: { username: 'nobody_here' }, params: { id: eventId } })
  check('unknown unique-seller username rejected (404)', addUnknown.status === 404)

  const randList = await call(listings.POST, { method: 'POST', token: tok(randSeller, 'SELLER'), body: { eventId } })
  check('random seller lists the event', randList.status === 200 && randList.json?.listing?.isActive === true, randList.json)
  const uBList = await call(listings.POST, { method: 'POST', token: tok(uniqueB, 'SELLER'), body: { eventId } })
  check('unique seller lists the event', uBList.status === 200, uBList.json)
  const hostList = await call(listings.POST, { method: 'POST', token: hostTok, body: { eventId } })
  check('host cannot list own event (OWN_EVENT)', hostList.status === 400 && hostList.json?.code === 'OWN_EVENT')

  const checkSums = async (pid: string) => {
    const p = (await prisma.ticketPurchase.findUnique({ where: { id: pid } }))!
    return p.platformFee + p.commission + p.hostAmount === p.subtotal
  }
  const h0 = await bal(host.id), r0 = await bal(randSeller.id)
  const pr = await buyPaid(regular.id, 1, { userId: buyer.id, email: buyer.email!, resellerId: randSeller.id })
  const prRow = (await prisma.ticketPurchase.findUnique({ where: { id: pr.id } }))!
  check('RANDOM resale: kind RANDOM, commission 200 (10%), host 1600, fee 200', prRow.sellerKind === 'RANDOM' && prRow.commission === 200 && prRow.hostAmount === 1600 && prRow.platformFee === 200, prRow)
  check('RANDOM resale: balances moved by exactly commission/host', (await bal(randSeller.id)) - r0 === 200 && (await bal(host.id)) - h0 === 1600)
  check('RANDOM resale: fee+commission+host == subtotal', await checkSums(pr.id))
  check('RANDOM resale: reseller Transaction row', (await prisma.transaction.count({ where: { reference: `${pr.reference}-RESELLER`, userId: randSeller.id } })) === 1)

  const u0 = await bal(uniqueB.id), h1 = await bal(host.id)
  const pu = await buyPaid(vip.id, 2, { userId: buyer.id, email: buyer.email!, resellerId: uniqueB.id })
  const puRow = (await prisma.ticketPurchase.findUnique({ where: { id: pu.id } }))!
  check('UNIQUE resale: kind UNIQUE, commission 2000 (20% of 10000), host 7000, fee 1000', puRow.sellerKind === 'UNIQUE' && puRow.commission === 2000 && puRow.hostAmount === 7000 && puRow.platformFee === 1000, puRow)
  check('UNIQUE resale: balances', (await bal(uniqueB.id)) - u0 === 2000 && (await bal(host.id)) - h1 === 7000 && await checkSums(pu.id))

  // reseller buys through own link (signed in)
  const r1 = await bal(randSeller.id), h2 = await bal(host.id)
  const ps = await buyPaid(regular.id, 1, { userId: randSeller.id, email: randSeller.email!, resellerId: randSeller.id })
  const psRow = (await prisma.ticketPurchase.findUnique({ where: { id: ps.id } }))!
  check('reseller == buyer: DIRECT, no commission, host gets 1800', psRow.sellerKind === 'DIRECT' && psRow.commission === 0 && psRow.hostAmount === 1800 && psRow.resellerId === null, psRow)
  check('reseller == buyer: reseller earned nothing, host +1800', (await bal(randSeller.id)) === r1 && (await bal(host.id)) - h2 === 1800)
  // reseller buys as a guest with their own email (prepareSale cannot tell, settle must)
  const r3 = await bal(randSeller.id), h3 = await bal(host.id)
  const pg = await buyPaid(regular.id, 1, { userId: null, email: randSeller.email!.toUpperCase(), resellerId: randSeller.id })
  const pgRow = (await prisma.ticketPurchase.findUnique({ where: { id: pg.id } }))!
  check('reseller buying as guest with own email (any case): commission removed at settle', pgRow.commission === 0 && pgRow.sellerKind === 'DIRECT' && pgRow.hostAmount === 1800 && (await bal(randSeller.id)) === r3 && (await bal(host.id)) - h3 === 1800, pgRow)
  // host as reseller
  const h4 = await bal(host.id)
  const ph = await buyPaid(regular.id, 1, { userId: buyer.id, email: buyer.email!, resellerId: host.id })
  const phRow = (await prisma.ticketPurchase.findUnique({ where: { id: ph.id } }))!
  check('host == reseller: DIRECT, host gets full 1800 only once', phRow.sellerKind === 'DIRECT' && phRow.commission === 0 && (await bal(host.id)) - h4 === 1800, phRow)
  // not listed / deactivated
  check('seller without a listing cannot sell (BAD_SELLER)', (await rejects(() => P.prepareSale({ eventId, tierId: regular.id, quantity: 1, resellerId: uniqueA.id }))) === 'BAD_SELLER')
  const myListings = await prisma.ticketListing.findUnique({ where: { eventId_sellerId: { eventId, sellerId: randSeller.id } } })
  const del = await call(listingId.DELETE, { method: 'DELETE', token: tok(randSeller, 'SELLER'), params: Promise.resolve({ id: myListings!.id }) })
  check('seller deactivates own listing', del.status === 200)
  const delOther = await call(listingId.DELETE, { method: 'DELETE', token: tok(uniqueB, 'SELLER'), params: Promise.resolve({ id: myListings!.id }) })
  check('another user cannot deactivate it (404)', delOther.status === 404)
  check('deactivated listing cannot sell (BAD_SELLER)', (await rejects(() => P.prepareSale({ eventId, tierId: regular.id, quantity: 1, resellerId: randSeller.id }))) === 'BAD_SELLER')
  const relist = await call(listings.POST, { method: 'POST', token: tok(randSeller, 'SELLER'), body: { eventId } })
  check('re-listing reactivates it', relist.status === 200 && (await rejects(() => P.prepareSale({ eventId, tierId: regular.id, quantity: 1, resellerId: randSeller.id }))) === null)
  // allowResale false
  const noResale = await mkEvent(host.id, { tiers: [{ name: 'T', price: 1000, capacity: 5, rand: 10 }] })
  await prisma.ticketEvent.update({ where: { id: noResale.id }, data: { allowResale: false } })
  await prisma.ticketListing.create({ data: { eventId: noResale.id, sellerId: randSeller.id } })
  check('allowResale=false blocks resale (NO_RESALE)', (await rejects(() => P.prepareSale({ eventId: noResale.id, tierId: noResale.tiers[0].id, quantity: 1, resellerId: randSeller.id }))) === 'NO_RESALE')

  // ═══ 4. Capacity ═════════════════════════════════════════════════════════════
  section('4. Capacity')
  const capEv = await mkEvent(host.id, { tiers: [{ name: 'Cap', price: 1000, capacity: 3 }] })
  const capTier = capEv.tiers[0]
  // 4a. racing checkouts: at most capacity may hold
  const attempts = await Promise.all(Array.from({ length: 8 }, (_, i) => buy(capTier.id, 1, { email: `race${i}.${RUN}@gmail.com` }).then(() => 'ok', (e: any) => e.code ?? String(e))))
  const okCount = attempts.filter(a => a === 'ok').length
  const heldNow = await prisma.ticketPurchase.aggregate({ _sum: { quantity: true }, where: { tierId: capTier.id, status: 'PENDING' } })
  check('8 racing checkouts on capacity 3: held quantity never exceeds 3', (heldNow._sum.quantity ?? 0) <= 3 && okCount <= 3, { attempts, held: heldNow._sum.quantity })
  check('racing losers get SOLD_OUT, not a crash', attempts.every(a => a === 'ok' || a === 'SOLD_OUT'), attempts)
  await prisma.ticketPurchase.deleteMany({ where: { tierId: capTier.id } })
  // 4b. concurrent settlement of more purchases than capacity (rows created directly = parallel checkouts that all passed the soft check)
  const rows = await Promise.all(Array.from({ length: 6 }, async (_, i) => {
    const sale = await P.prepareSale({ eventId: capEv.id, tierId: capTier.id, quantity: 1 })
    return (P as any).createPendingPurchase ? prisma.ticketPurchase.create({
      data: { reference: `TKT-${Date.now()}-${(i + 16).toString(16).padStart(8, '0')}`, eventId: capEv.id, tierId: capTier.id, buyerEmail: `cap${i}.${RUN}@gmail.com`, quantity: 1, unitPrice: 1000, subtotal: 1000, platformFee: sale.split.platformFee, commission: 0, hostAmount: sale.split.hostAmount, accessToken: `cap-${RUN}-${i}-${Math.random().toString(36).slice(2)}` },
    }) : null
  }))
  const hostBeforeCap = await bal(host.id)
  const settled = await Promise.all(rows.map(r => payCard(r!)))
  check('all 6 concurrent settles succeed (paid buyers always get tickets)', settled.every(s => s.ok), settled)
  const capPurchases = await prisma.ticketPurchase.findMany({ where: { tierId: capTier.id } })
  const capTickets = await prisma.ticket.count({ where: { tierId: capTier.id } })
  const normalTickets = capPurchases.filter(p => !p.overbooked).reduce((s, p) => s + p.quantity, 0)
  const capTierNow = (await prisma.ticketTier.findUnique({ where: { id: capTier.id } }))!
  check('tickets issued without overbooked flag never exceed capacity (3)', normalTickets === 3, { normalTickets })
  check('the 3 extra are flagged overbooked and audit-logged', capPurchases.filter(p => p.overbooked).length === 3 && (await prisma.auditLog.count({ where: { action: 'TICKET_OVERBOOKED', entityId: { in: capPurchases.map(p => p.id) } } })) === 3)
  check('tier.sold equals tickets issued (6), host credited for all 6', capTierNow.sold === 6 && capTickets === 6 && (await bal(host.id)) - hostBeforeCap === 5400)
  // 4c. sold-out blocks prepareSale
  check('sold out: prepareSale throws SOLD_OUT', (await rejects(() => P.prepareSale({ eventId: capEv.id, tierId: capTier.id, quantity: 1 }))) === 'SOLD_OUT')
  // 4d. Exact non-overbooked concurrency: capacity 4, 4 racing exact fits -> none flagged
  const fitEv = await mkEvent(host.id, { tiers: [{ name: 'Fit', price: 1000, capacity: 4 }] })
  const fits = []
  for (let i = 0; i < 4; i++) fits.push((await buy(fitEv.tiers[0].id, 1, { email: `fit${i}.${RUN}@gmail.com` })).purchase)
  await Promise.all(fits.map(f => payCard(f)))
  check('4 settles into capacity 4: sold 4, none overbooked', (await prisma.ticketTier.findUnique({ where: { id: fitEv.tiers[0].id } }))!.sold === 4 && (await prisma.ticketPurchase.count({ where: { tierId: fitEv.tiers[0].id, overbooked: true } })) === 0)
  // 4e. pending holds count and expire
  const holdEv = await mkEvent(host.id, { tiers: [{ name: 'Hold', price: 1000, capacity: 2 }] })
  const holdTier = holdEv.tiers[0]
  const { purchase: hold } = await buy(holdTier.id, 2, { email: `hold.${RUN}@gmail.com` })
  check('pending hold counts against availability (0 left)', (await P.availableForTier(holdTier.id)) === 0)
  check('prepareSale blocked by pending hold', (await rejects(() => P.prepareSale({ eventId: holdEv.id, tierId: holdTier.id, quantity: 1 }))) === 'SOLD_OUT')
  check('the holder own purchase excluded from its own count', (await P.availableForTier(holdTier.id, hold.id)) === 2)
  await prisma.ticketPurchase.update({ where: { id: hold.id }, data: { createdAt: new Date(Date.now() - 21 * 60_000) } })
  check('expired hold (21 min) releases the tickets', (await P.availableForTier(holdTier.id)) === 2 && (await rejects(() => P.prepareSale({ eventId: holdEv.id, tierId: holdTier.id, quantity: 2 }))) === null)
  const lateOk = await payCard(hold)
  check('a late payment on an expired hold still issues its tickets (never keep money without a ticket)', lateOk.ok && (await tickets(hold.id)).length === 2)
  check('quantity bounds enforced (0, 11)', (await rejects(() => P.prepareSale({ eventId, tierId: regular.id, quantity: 0 }))) === 'BAD_QUANTITY' && (await rejects(() => P.prepareSale({ eventId, tierId: regular.id, quantity: 11 }))) === 'BAD_QUANTITY')

  // ═══ 5. Wallet ═════════════════════════════════════════════════════════════════
  section('5. Wallet payment')
  const wallet = await mkUser({ bal: 5000 })
  const wEv = await mkEvent(host.id, { tiers: [{ name: 'W', price: 2000, capacity: 50 }] })
  const wTier = wEv.tiers[0]
  const hW = await bal(host.id)
  const { purchase: wp } = await buy(wTier.id, 1, { userId: wallet.id, email: wallet.email!, method: 'WALLET' })
  const ws = await P.settlePurchase(wp.id, { method: 'WALLET', walletUserId: wallet.id })
  check('wallet settle ok', ws.ok, ws)
  check('buyer debited exactly 2000, ticket issued, host +1800', (await bal(wallet.id)) === 3000 && (await tickets(wp.id)).length === 1 && (await bal(host.id)) - hW === 1800)
  const dTx = await prisma.transaction.findFirst({ where: { reference: `${wp.reference}-BUYER` } })
  check('buyer DEBIT Transaction with correct before/after', !!dTx && dTx.type === 'DEBIT' && Number(dTx.balanceBefore) === 5000 && Number(dTx.balanceAfter) === 3000, dTx)
  const wsAgain = await P.settlePurchase(wp.id, { method: 'WALLET', walletUserId: wallet.id })
  check('wallet re-settle: no second debit', wsAgain.ok && (wsAgain as any).already && (await bal(wallet.id)) === 3000)

  const poor = await mkUser({ bal: 500 })
  const { purchase: pp } = await buy(wTier.id, 1, { userId: poor.id, email: poor.email!, method: 'WALLET' })
  const soldBefore = (await prisma.ticketTier.findUnique({ where: { id: wTier.id } }))!.sold
  const hP = await bal(host.id)
  const ps2 = await P.settlePurchase(pp.id, { method: 'WALLET', walletUserId: poor.id })
  check('insufficient balance rejected (INSUFFICIENT_FUNDS)', !ps2.ok && (ps2 as any).code === 'INSUFFICIENT_FUNDS', ps2)
  check('insufficient: no ticket, no debit, no credit, sold unchanged, purchase PENDING',
    (await tickets(pp.id)).length === 0 && (await bal(poor.id)) === 500 && (await bal(host.id)) === hP &&
    (await prisma.ticketTier.findUnique({ where: { id: wTier.id } }))!.sold === soldBefore &&
    (await prisma.ticketPurchase.findUnique({ where: { id: pp.id } }))!.status === 'PENDING')

  const victim = await mkUser({ bal: 9000 })
  const attacker = await mkUser({ bal: 9000 })
  const { purchase: vp } = await buy(wTier.id, 1, { userId: victim.id, email: victim.email!, method: 'WALLET' })
  const bad = await P.settlePurchase(vp.id, { method: 'WALLET', walletUserId: attacker.id })
  check('walletUserId that is not the buyer rejected (BAD_BUYER)', !bad.ok && (bad as any).code === 'BAD_BUYER', bad)
  check('...and nobody was debited / no tickets', (await bal(victim.id)) === 9000 && (await bal(attacker.id)) === 9000 && (await tickets(vp.id)).length === 0)
  const { purchase: gp } = await buy(wTier.id, 1, { email: `gw.${RUN}@gmail.com`, method: 'WALLET' })
  const gbad = await P.settlePurchase(gp.id, { method: 'WALLET', walletUserId: attacker.id })
  check('guest purchase cannot be paid from anybody wallet', !gbad.ok && (await bal(attacker.id)) === 9000)
  const noWallet = await P.settlePurchase(gp.id, { method: 'WALLET' })
  check('wallet settle without walletUserId rejected', !noWallet.ok)

  const twice = await mkUser({ bal: 2000 })
  const tw1 = (await buy(wTier.id, 1, { userId: twice.id, email: twice.email!, method: 'WALLET' })).purchase
  const tw2 = (await buy(wTier.id, 1, { userId: twice.id, email: twice.email!, method: 'WALLET' })).purchase
  const twr = await Promise.all([tw1, tw2].map(p => P.settlePurchase(p.id, { method: 'WALLET', walletUserId: twice.id })))
  check('two concurrent 2000 wallet payments from a 2000 balance: exactly one wins, balance 0 (never negative)', twr.filter(r => r.ok).length === 1 && (await bal(twice.id)) === 0, twr)

  // checkout route: unauthenticated wallet is refused before any purchase is created
  const guestWallet = await call(checkoutRoute.POST, { method: 'POST', body: { eventId: wEv.id, tierId: wTier.id, quantity: 1, method: 'WALLET', email: 'gg@gmail.com' } })
  check('checkout route: guest cannot use WALLET (400 LOGIN_REQUIRED)', guestWallet.status === 400 && guestWallet.json?.code === 'LOGIN_REQUIRED', guestWallet.json)
  const insuffRoute = await call(checkoutRoute.POST, { method: 'POST', token: tok(poor, 'BUYER'), body: { eventId: wEv.id, tierId: wTier.id, quantity: 1, method: 'WALLET' } })
  check('checkout route: low balance gives 402 INSUFFICIENT_BALANCE and creates no purchase', insuffRoute.status === 402 && insuffRoute.json?.code === 'INSUFFICIENT_BALANCE' && (await prisma.ticketPurchase.count({ where: { buyerUserId: poor.id } })) === 1, insuffRoute.json)

  // ═══ 6. QR + check-in ═════════════════════════════════════════════════════════
  section('6. QR and check-in')
  const door1Token = tokenFromEmail('door1@gmail.com')
  const door2Email = 'door2@gmail.com'
  const addChecker = await call(hostCheckers.POST, { method: 'POST', token: hostTok, body: { email: door2Email, name: 'Door Two' }, params: { id: eventId } })
  check('host adds a checker through the API', addChecker.status === 200 && addChecker.json?.checker?.email === door2Email, addChecker.json)
  const door2Token = tokenFromEmail(door2Email)
  check('invite email carries a sign-in token', door2Token.length >= 16)
  const door2Id: string = addChecker.json.checker.id
  const login = async (token: string, email: string) => call(checkerLogin.POST, { method: 'POST', body: { token, email } })
  const wrongEmail = await login(door2Token, 'someone.else@gmail.com')
  check('login with wrong email rejected (401)', wrongEmail.status === 401)
  const wrongTok = await login('x'.repeat(30), door2Email)
  check('login with unknown token rejected (401)', wrongTok.status === 401)
  const okLogin = await login(door2Token, door2Email.toUpperCase())
  check('login with token + email (case-insensitive) returns a session', okLogin.status === 200 && !!okLogin.json?.sessionToken, okLogin.json)
  const sess2: string = okLogin.json.sessionToken
  const info = await call(checkerLogin.GET, { url: `http://localhost:3000/api/tickets/checker/login?token=${door2Token}` })
  check('login GET names the event only', info.status === 200 && info.json?.event?.name === 'E2E Night')

  const scanCounts = new Map<string, number>()
  const scan = async (session: string, checkerId: string | null, qr: string) => {
    const r = await call(checkerScan.POST, { method: 'POST', token: session, body: { qr }, url: 'http://localhost:3000/api/tickets/checker/scan' })
    if (checkerId && r.status === 200) scanCounts.set(checkerId, (scanCounts.get(checkerId) ?? 0) + 1)
    return r
  }
  const qrFor = async (t: { code: string; secret: string }, at = Date.now()) => buildQrText(t.code, t.secret, at)

  const sPurchase = await buyPaid(regular.id, 4, { email: `door.guest.${RUN}@gmail.com` })
  const [s1, s2, s3, s4] = await tickets(sPurchase.id)
  const otherEv = await mkEvent(host.id, { tiers: [{ name: 'O', price: 1000, capacity: 10 }] })
  const otherP = await buyPaid(otherEv.tiers[0].id, 1, { email: `other.${RUN}@gmail.com` })
  const [oT] = await tickets(otherP.id)

  const ok1 = await scan(sess2, door2Id, await qrFor(s1))
  check('valid QR scans OK', ok1.json?.result === 'OK', ok1.json)
  check('ticket now CHECKED_IN by that checker', (await prisma.ticket.findUnique({ where: { id: s1.id } }))!.status === 'CHECKED_IN' && (await prisma.ticket.findUnique({ where: { id: s1.id } }))!.checkedInById === door2Id)
  const ok2 = await scan(sess2, door2Id, await qrFor(s1))
  check('second scan ALREADY_USED', ok2.json?.result === 'ALREADY_USED', ok2.json)
  const stale = await scan(sess2, door2Id, await qrFor(s2, Date.now() - 10 * 60_000))
  check('old QR (10 min) -> STALE', stale.json?.result === 'STALE', stale.json)
  const future = await scan(sess2, door2Id, await qrFor(s2, Date.now() + 10 * 60_000))
  check('far-future QR -> STALE', future.json?.result === 'STALE', future.json)
  const wrongSecret = await scan(sess2, door2Id, await buildQrText(s2.code, 'f'.repeat(64), Date.now()))
  check('QR signed with the wrong secret -> INVALID', wrongSecret.json?.result === 'INVALID', wrongSecret.json)
  const good = await qrFor(s2)
  const forged = good.slice(0, -1) + (good.endsWith('0') ? '1' : '0')
  const forgedR = await scan(sess2, door2Id, forged)
  check('forged MAC -> INVALID', forgedR.json?.result === 'INVALID', forgedR.json)
  const unknown = await scan(sess2, door2Id, await buildQrText('BT-AAAAAAAA', 'a'.repeat(64), Date.now()))
  check('unknown ticket code -> INVALID', unknown.json?.result === 'INVALID', unknown.json)
  const garbage = await scan(sess2, door2Id, 'hello world')
  check('garbage text -> INVALID', garbage.json?.result === 'INVALID', garbage.json)
  const wrongEv = await scan(sess2, door2Id, await qrFor(oT))
  check('ticket of another event -> WRONG_EVENT', wrongEv.json?.result === 'WRONG_EVENT', wrongEv.json)
  check('...and that ticket was NOT checked in, no ticket details leaked', (await prisma.ticket.findUnique({ where: { id: oT.id } }))!.status === 'VALID' && !wrongEv.json?.ticket)
  check('s2 untouched by all the failed attempts', (await prisma.ticket.findUnique({ where: { id: s2.id } }))!.status === 'VALID')
  await prisma.ticket.update({ where: { id: s4.id }, data: { status: 'VOID' } })
  const voidR = await scan(sess2, door2Id, await qrFor(s4))
  check('VOID ticket -> VOID', voidR.json?.result === 'VOID', voidR.json)

  // a checker of the OTHER event cannot check this event's tickets (and vice versa)
  const oCheck = await prisma.eventChecker.create({ data: { eventId: otherEv.id, email: `oc.${RUN}@gmail.com`, tokenHash: `h-${RUN}-oc` } })
  const { issueCheckerSession } = await import('@/lib/tickets/checker-session')
  const oSess = await issueCheckerSession({ id: oCheck.id, eventId: otherEv.id, sessionVersion: oCheck.sessionVersion })
  const crossR = await scan(oSess, oCheck.id, await qrFor(s2))
  check('other-event checker scanning this event ticket -> WRONG_EVENT, ticket stays VALID', crossR.json?.result === 'WRONG_EVENT' && (await prisma.ticket.findUnique({ where: { id: s2.id } }))!.status === 'VALID', crossR.json)
  const noAuth = await scan('garbage.token', null, await qrFor(s2))
  check('invalid session token -> 401', noAuth.status === 401)
  const userTokenAsChecker = await scan(buyerTok, null, await qrFor(s2))
  check('a normal user token is not a checker session (401)', userTokenAsChecker.status === 401)

  // concurrent scans of one QR
  const race = await qrFor(s3)
  const raceRes = await Promise.all([scan(sess2, door2Id, race), scan(sess2, door2Id, race), scan(sess2, door2Id, race)])
  const results = raceRes.map(r => r.json?.result).sort()
  check('3 concurrent scans of one QR: exactly one OK, others ALREADY_USED', results.filter(r => r === 'OK').length === 1 && results.filter(r => r === 'ALREADY_USED').length === 2, results)

  check('TicketScan row exists for every attempt (door2)', (await prisma.ticketScan.count({ where: { checkerId: door2Id } })) === (scanCounts.get(door2Id) ?? -1), { rows: await prisma.ticketScan.count({ where: { checkerId: door2Id } }), counted: scanCounts.get(door2Id) })
  check('TicketScan row exists for every attempt (other-event checker)', (await prisma.ticketScan.count({ where: { checkerId: oCheck.id } })) === (scanCounts.get(oCheck.id) ?? -1))
  const resultsInDb = await prisma.ticketScan.groupBy({ by: ['result'], where: { checkerId: door2Id }, _count: { _all: true } })
  const rs = Object.fromEntries(resultsInDb.map(r => [r.result, r._count._all]))
  check('scan log results are right (OK 2, ALREADY_USED 3, STALE 2, INVALID 4, WRONG_EVENT 1, VOID 1)', rs.OK === 2 && rs.ALREADY_USED === 3 && rs.STALE === 2 && rs.INVALID === 4 && rs.WRONG_EVENT === 1 && rs.VOID === 1, rs)

  // resend invalidates old session + old link
  const resend = await call(hostResend.POST, { method: 'POST', body: {}, token: hostTok, params: { id: eventId, checkerId: door2Id } })
  check('host resend ok', resend.status === 200, resend.json)
  const afterResend = await scan(sess2, door2Id, await qrFor(s2))
  check('after resend the OLD session is rejected (sessionVersion bump)', afterResend.status === 401, afterResend.status)
  const oldLink = await login(door2Token, door2Email)
  check('after resend the OLD link no longer logs in', oldLink.status === 401)
  const newTok = tokenFromEmail(door2Email)
  check('resend produced a different token', !!newTok && newTok !== door2Token)
  const newLogin = await login(newTok, door2Email)
  check('new link logs in', newLogin.status === 200 && !!newLogin.json?.sessionToken, newLogin.json)
  const sess2b: string = newLogin.json.sessionToken
  const resumed = await scan(sess2b, door2Id, await qrFor(s2))
  check('new session scans fine (s2 -> OK)', resumed.json?.result === 'OK', resumed.json)
  // another checker's resend by a different host must fail
  const intruder = await mkUser({ role: 'SELLER' })
  const foreign = await call(hostResend.POST, { method: 'POST', body: {}, token: tok(intruder, 'SELLER'), params: { id: eventId, checkerId: door2Id } })
  check('another host cannot resend/deactivate this event checkers (404)', foreign.status === 404)
  const foreignDel = await call(hostChecker.DELETE, { method: 'DELETE', token: tok(intruder, 'SELLER'), params: { id: eventId, checkerId: door2Id } })
  check('another host cannot deactivate it (404)', foreignDel.status === 404)
  // deactivate
  const deact = await call(hostChecker.DELETE, { method: 'DELETE', token: hostTok, params: { id: eventId, checkerId: door2Id } })
  check('host deactivates the checker', deact.status === 200)
  const deadScan = await scan(sess2b, door2Id, await qrFor(s2))
  check('deactivated checker: existing session rejected (401)', deadScan.status === 401)
  const deadLogin = await login(newTok, door2Email)
  check('deactivated checker: login rejected (401)', deadLogin.status === 401)
  // paused events do not check in
  const door1 = await prisma.eventChecker.findFirst({ where: { eventId, email: 'door1@gmail.com' } })
  const d1Login = await login(door1Token, 'door1@gmail.com')
  check('invite-time checker (created with the event) can log in', d1Login.status === 200, d1Login.json)
  await prisma.ticketEvent.update({ where: { id: eventId }, data: { status: 'PAUSED' } })
  const pausedScan = await scan(d1Login.json.sessionToken, door1!.id, await qrFor(s2))
  const pausedLogin = await login(door1Token, 'door1@gmail.com')
  check('paused event: scan refused (403) and login refused (403)', pausedScan.status === 403 && pausedLogin.status === 403, [pausedScan.status, pausedLogin.status])
  await prisma.ticketEvent.update({ where: { id: eventId }, data: { status: 'ACTIVE' } })

  // ═══ 7. Transfer ═══════════════════════════════════════════════════════════════
  section('7. Transfer')
  const owner = buyer
  const trPurchase = await buyPaid(regular.id, 5, { userId: owner.id, email: owner.email! })
  const [x1, x2, x3, x4, x5] = await tickets(trPurchase.id)
  const doTransfer = (ticketId: string, token: string, toUsername: string) =>
    call(transferRoute.POST, { method: 'POST', token, body: { toUsername }, params: { id: ticketId } })
  const oldQr = await qrFor(x1)
  const tr = await doTransfer(x1.id, buyerTok, `@${friend.username!.toUpperCase()}`)
  check('transfer to an existing username (with @, any case) works', tr.status === 200 && tr.json?.ok, tr.json)
  const x1n = (await prisma.ticket.findUnique({ where: { id: x1.id } }))!
  check('owner changed, new secret, secretVersion bumped', x1n.ownerUserId === friend.id && x1n.ownerEmail === friend.email!.toLowerCase() && x1n.secret !== x1.secret && x1n.secretVersion === x1.secretVersion + 1, x1n)
  check('TicketTransfer row written', (await prisma.ticketTransfer.count({ where: { ticketId: x1.id, fromUserId: owner.id, toUserId: friend.id } })) === 1)
  const sessDoor = d1Login.json.sessionToken as string
  const oldScan = await scan(sessDoor, door1!.id, oldQr)
  check('old QR (old secret) is now INVALID', oldScan.json?.result === 'INVALID', oldScan.json)
  const newScan = await scan(sessDoor, door1!.id, await qrFor(x1n))
  check('new QR is valid at the door', newScan.json?.result === 'OK', newScan.json)

  const tUnknown = await doTransfer(x2.id, buyerTok, 'no_such_person')
  check('unknown username fails (404)', tUnknown.status === 404)
  const tSelf = await doTransfer(x2.id, buyerTok, owner.username!)
  check('transfer to self fails (400)', tSelf.status === 400 && tSelf.json?.code === 'SELF_TRANSFER')
  await prisma.ticket.update({ where: { id: x3.id }, data: { status: 'CHECKED_IN' } })
  const tUsed = await doTransfer(x3.id, buyerTok, friend.username!)
  check('CHECKED_IN ticket cannot be transferred (409)', tUsed.status === 409)
  const tNotMine = await doTransfer(x2.id, tok(friend, 'BUYER'), owner.username!)
  check('ticket you do not own: 404', tNotMine.status === 404)
  const tAfterMoved = await doTransfer(x1.id, buyerTok, friend.username!)
  check('the original owner cannot move it again after transferring (404)', tAfterMoved.status === 404)
  await prisma.user.update({ where: { id: uniqueA.id }, data: { isSuspended: true } })
  const tSusp = await doTransfer(x2.id, buyerTok, uniqueA.username!)
  check('cannot transfer to a suspended user (404)', tSusp.status === 404)
  await prisma.user.update({ where: { id: uniqueA.id }, data: { isSuspended: false } })
  check('x2 untouched by all failed transfers', (await prisma.ticket.findUnique({ where: { id: x2.id } }))!.ownerUserId === owner.id && (await prisma.ticketTransfer.count({ where: { ticketId: x2.id } })) === 0)
  const friend2 = await mkUser()
  const rr = await Promise.all([doTransfer(x4.id, buyerTok, friend.username!), doTransfer(x4.id, buyerTok, friend2.username!), doTransfer(x4.id, buyerTok, friend.username!)])
  check('3 concurrent transfers of one ticket: exactly one wins, one TicketTransfer row', rr.filter(r => r.status === 200).length === 1 && (await prisma.ticketTransfer.count({ where: { ticketId: x4.id } })) === 1, rr.map(r => r.status))
  // transfer vs scan race: after check-in the transfer is refused
  const raceQr = await qrFor(x5)
  const [rs1, rs2] = await Promise.all([scan(sessDoor, door1!.id, raceQr), doTransfer(x5.id, buyerTok, friend.username!)])
  const x5n = (await prisma.ticket.findUnique({ where: { id: x5.id } }))!
  // Either the scan won (ticket CHECKED_IN, transfer refused) or the transfer won (scan sees the old QR as INVALID or, if it
  // read the row first and lost the guarded update, ALREADY_USED/INVALID) -- but never a moved AND checked-in ticket from one OK.
  const scanWon = rs1.json?.result === 'OK'
  check('transfer vs scan race stays consistent',
    scanWon ? (rs2.status === 409 && x5n.status === 'CHECKED_IN' && x5n.ownerUserId === owner.id)
            : (rs2.status === 200 && x5n.status === 'VALID' && x5n.ownerUserId === friend.id), { scan: rs1.json?.result, transfer: rs2.status, status: x5n.status })

  // ═══ 8. Guest claim ═══════════════════════════════════════════════════════════
  section('8. Guest claim')
  const claimer = await mkUser({ email: `ClaimMe.${RUN}@Gmail.com` })
  const stranger = await mkUser()
  const claimEmail = `claimme.${RUN}@gmail.com`
  const gc = await buyPaid(regular.id, 2, { email: claimEmail })
  const gcPending = (await buy(regular.id, 1, { email: claimEmail })).purchase // unpaid: must never be claimed
  const mine = (u: { id: string; phone: string }) => call(mineRoute.GET, { token: tok(u, 'BUYER'), url: 'http://localhost:3000/api/tickets/mine' })
  const mStranger = await mine(stranger)
  check('another user does not see the guest tickets', mStranger.status === 200 && (mStranger.json.tickets as any[]).length === 0, mStranger.json)
  const m1 = await mine(claimer)
  const claimedIds = (m1.json.tickets as any[]).map(t => t.purchaseId)
  check('user with email X (case-insensitive) sees the 2 guest tickets', (m1.json.tickets as any[]).length === 2 && claimedIds.every((p: string) => p === gc.id), m1.json)
  check('...secrets are never returned', !JSON.stringify(m1.json).includes('secret'))
  const m2 = await mine(claimer)
  check('claim is idempotent', (m2.json.tickets as any[]).length === 2)
  check('unpaid purchase not claimed', (await prisma.ticketPurchase.findUnique({ where: { id: gcPending.id } }))!.buyerUserId === null)
  check('claimed tickets/purchase now owned by claimer', (await prisma.ticket.count({ where: { purchaseId: gc.id, ownerUserId: claimer.id } })) === 2 && (await prisma.ticketPurchase.findUnique({ where: { id: gc.id } }))!.buyerUserId === claimer.id)
  const mStranger2 = await mine(stranger)
  check('stranger still sees nothing after the claim', (mStranger2.json.tickets as any[]).length === 0)
  const [c1] = m1.json.tickets
  const tAway = await doTransfer(c1.id, tok(claimer, 'BUYER'), stranger.username!)
  check('claimer transfers one claimed ticket away', tAway.status === 200, tAway.json)
  const m3 = await mine(claimer)
  check('claim does NOT take the transferred ticket back', (m3.json.tickets as any[]).length === 1 && (m3.json.tickets as any[])[0].id !== c1.id, m3.json)
  const mS3 = await mine(stranger)
  check('recipient still has it after the claimer re-queries', (mS3.json.tickets as any[]).some((t: any) => t.id === c1.id))
  const m4 = await mine(claimer)
  check('and again (idempotent after transfer)', (m4.json.tickets as any[]).length === 1 && (await prisma.ticket.findUnique({ where: { id: c1.id } }))!.ownerUserId === stranger.id)
  // a stranger whose ownerEmail matches a transferred-in ticket does not get others
  const mNoEmail = await mkUser({ email: null })
  const mE = await mine(mNoEmail)
  check('user without email: no crash, no tickets', mE.status === 200 && (mE.json.tickets as any[]).length === 0)

  // ═══ 9. Reminders ═══════════════════════════════════════════════════════════════
  section('9. Reminders')
  const now = new Date()
  const d1Start = new Date(lagosDayStart(now).getTime() + DAY + 12 * 3600_000) // tomorrow noon Lagos
  const remEv = await mkEvent(host.id, { tiers: [{ name: 'R', price: 1000, capacity: 20 }], startsAt: d1Start, name: 'Reminder Night' })
  const pausedEv = await mkEvent(host.id, { tiers: [{ name: 'R', price: 1000, capacity: 20 }], startsAt: d1Start, name: 'Paused Reminder Night' })
  const remUser = await mkUser()
  const usedUser = await mkUser()
  const pausedUser = await mkUser()
  const guestEmail = `remind.guest.${RUN}@gmail.com`
  const rp1 = await buyPaid(remEv.tiers[0].id, 2, { userId: remUser.id, email: remUser.email! })
  const rp2 = await buyPaid(remEv.tiers[0].id, 1, { userId: usedUser.id, email: usedUser.email! })
  const rp3 = await buyPaid(remEv.tiers[0].id, 1, { email: guestEmail })
  const rp4 = await buyPaid(pausedEv.tiers[0].id, 1, { userId: pausedUser.id, email: pausedUser.email! })
  const rp5 = await buyPaid(pausedEv.tiers[0].id, 1, { email: `remind.paused.${RUN}@gmail.com` })
  await prisma.ticket.updateMany({ where: { purchaseId: rp2.id }, data: { status: 'CHECKED_IN', checkedInAt: new Date() } })
  await prisma.ticketEvent.update({ where: { id: pausedEv.id }, data: { status: 'PAUSED' } })
  const emailsBefore = sentEmails.length
  const c1r = await runTicketReminders(now)
  const reminderNotes = (uid: string) => prisma.notification.count({ where: { userId: uid, type: 'REMINDER' } })
  check('first run: 1 account + 1 guest reminder sent for the active event', c1r.accountSent === 1 && c1r.guestSent === 1 && c1r.failed === 0, c1r)
  check('holder with 2 tickets gets ONE reminder', (await reminderNotes(remUser.id)) === 1)
  check('CHECKED_IN-only holder gets none', (await reminderNotes(usedUser.id)) === 0)
  check('PAUSED event holders get none (account and guest)', (await reminderNotes(pausedUser.id)) === 0 && !sentEmails.slice(emailsBefore).some(e => e.to.startsWith('remind.paused.')))
  check('guest got exactly one email, with their /t/ link', sentEmails.slice(emailsBefore).filter(e => e.to === guestEmail).length === 1 && sentEmails.slice(emailsBefore).find(e => e.to === guestEmail)!.html.includes('/t/'))
  const emailsMid = sentEmails.length
  const c2r = await runTicketReminders(now)
  check('second run in the same window sends nothing new', c2r.accountSent === 0 && c2r.guestSent === 0 && (await reminderNotes(remUser.id)) === 1 && sentEmails.length === emailsMid, c2r)
  // different window sends again: move the event to 3 days ahead
  await prisma.ticketEvent.update({ where: { id: remEv.id }, data: { startsAt: new Date(lagosDayStart(now).getTime() + 3 * DAY + 12 * 3600_000) } })
  const c3r = await runTicketReminders(now)
  check('a different window (d3) sends once more', c3r.accountSent === 1 && c3r.guestSent === 1, c3r)
  await prisma.ticketEvent.update({ where: { id: remEv.id }, data: { status: 'CANCELLED' } })
  const c4r = await runTicketReminders(new Date(now.getTime() + 1000))
  check('CANCELLED event: nothing sent', c4r.accountSent === 0 && c4r.guestSent === 0, c4r)
  void rp4; void rp5; void rp3

  // ═══ 10. Host dashboard totals ═══════════════════════════════════════════════
  section('10. Host dashboard')
  const dash = await call(hostEvents.GET, { token: hostTok, url: 'http://localhost:3000/api/tickets/host/events' })
  const dEv = (dash.json.events as any[]).find(e => e.id === eventId)
  const paid = await prisma.ticketPurchase.findMany({ where: { eventId, status: 'PAID' } })
  const sumSub = paid.reduce((s, p) => s + p.subtotal, 0)
  const sumHost = paid.reduce((s, p) => s + p.hostAmount, 0)
  const tiersNow = await prisma.ticketTier.findMany({ where: { eventId } })
  const credits = await prisma.transaction.findMany({ where: { userId: host.id, type: 'CREDIT', reference: { in: paid.map(p => `${p.reference}-HOST`) } } })
  check('dashboard revenue == sum of PAID purchase subtotals', dEv?.revenue === sumSub && sumSub > 0, { dash: dEv?.revenue, sumSub })
  check('dashboard earnings == sum of host amounts == sum of host CREDIT transactions', dEv?.earnings === sumHost && credits.reduce((s, t) => s + Number(t.amount), 0) === sumHost, { dash: dEv?.earnings, sumHost })
  check('dashboard ticketsSold == tier.sold == tickets issued', dEv?.ticketsSold === tiersNow.reduce((s, t) => s + t.sold, 0) && dEv?.ticketsSold === paid.reduce((s, p) => s + p.quantity, 0) && dEv?.ticketsSold === (await prisma.ticket.count({ where: { eventId } })), dEv)
  check('PENDING purchases excluded from totals', (await prisma.ticketPurchase.count({ where: { eventId, status: 'PENDING' } })) >= 1 && dEv?.revenue === sumSub)
  check('money conservation: fee + commission + host == subtotal for every PAID purchase', paid.every(p => p.platformFee + p.commission + p.hostAmount === p.subtotal))
  const otherHost = await call(hostEvents.GET, { token: tok(randSeller, 'SELLER'), url: 'http://localhost:3000/api/tickets/host/events' })
  check('another host does not see this event in their dashboard', !(otherHost.json.events as any[]).some(e => e.id === eventId))

  // ═══ 11. Extras: admin lifecycle, access links, cancel ═════════════════════════
  section('11. Admin lifecycle, ticket access, cancel')
  const lifeEv = await mkEvent(host.id, { tiers: [{ name: 'L', price: 1000, capacity: 20 }], status: 'PENDING_REVIEW' })
  const act = (id: string, action: string, note?: string) => call(adminEvent.POST, { method: 'POST', token: adminTok, body: { action, note }, params: { id } })
  check('reject without a note -> 400', (await act(lifeEv.id, 'reject')).status === 400)
  check('pause a PENDING_REVIEW event -> 409', (await act(lifeEv.id, 'pause', 'x')).status === 409)
  check('approve', (await act(lifeEv.id, 'approve')).json?.status === 'ACTIVE')
  check('pause', (await act(lifeEv.id, 'pause', 'check')).json?.status === 'PAUSED')
  check('paused event not buyable', (await rejects(() => P.prepareSale({ eventId: lifeEv.id, tierId: lifeEv.tiers[0].id, quantity: 1 }))) === 'EVENT_NOT_ON_SALE')
  check('paused event not public', (await call(publicEvent.GET, { url: 'http://localhost:3000/x', params: { id: lifeEv.id } })).status === 404)
  check('resume', (await act(lifeEv.id, 'resume')).json?.status === 'ACTIVE')
  const lifeP = await buyPaid(lifeEv.tiers[0].id, 1, { userId: buyer.id, email: buyer.email! })
  const [lt] = await tickets(lifeP.id)

  const ticketRoute = await import('@/app/api/tickets/ticket/[id]/route')
  const guestRoute = await import('@/app/api/tickets/t/[token]/route')
  const cancelRoute = await import('@/app/api/tickets/host/events/[id]/cancel/route')
  const asOwner = await call(ticketRoute.GET, { token: buyerTok, url: `http://localhost:3000/api/tickets/ticket/${lt.id}`, params: { id: lt.id } })
  check('owner can open own ticket (secret included)', asOwner.status === 200 && asOwner.json?.secret === lt.secret)
  const asOther = await call(ticketRoute.GET, { token: tok(friend, 'BUYER'), url: `http://localhost:3000/api/tickets/ticket/${lt.id}`, params: { id: lt.id } })
  check('another user cannot open it (404)', asOther.status === 404)
  const asAnon = await call(ticketRoute.GET, { url: `http://localhost:3000/api/tickets/ticket/${lt.id}`, params: { id: lt.id } })
  check('anonymous without token cannot open it (404)', asAnon.status === 404)
  const gT = await buyPaid(lifeEv.tiers[0].id, 2, { email: `link.${RUN}@gmail.com` })
  const [g1t, g2t] = await tickets(gT.id)
  const viaLink = await call(ticketRoute.GET, { url: `http://localhost:3000/api/tickets/ticket/${g1t.id}?token=${gT.accessToken}`, params: { id: g1t.id } })
  check('guest link token opens the ticket', viaLink.status === 200)
  const wrongTokOpen = await call(ticketRoute.GET, { url: `http://localhost:3000/api/tickets/ticket/${g1t.id}?token=${'a'.repeat(30)}`, params: { id: g1t.id } })
  check('wrong token -> 404', wrongTokOpen.status === 404)
  const gl = await call(guestRoute.GET, { url: 'http://localhost:3000/x', params: { token: gT.accessToken } })
  check('guest purchase page lists 2 tickets', gl.status === 200 && gl.json?.tickets?.length === 2)
  // guest claims via signup then sends one away -> old link must not expose it
  const gClaimer = await mkUser({ email: `link.${RUN}@gmail.com` })
  await mine(gClaimer)
  const sendAway = await doTransfer(g1t.id, tok(gClaimer, 'BUYER'), friend.username!)
  check('claimed guest ticket transferred away', sendAway.status === 200)
  const gl2 = await call(guestRoute.GET, { url: 'http://localhost:3000/x', params: { token: gT.accessToken } })
  check('old guest link no longer shows the transferred ticket', gl2.json?.tickets?.length === 1 && gl2.json.tickets[0].id === g2t.id, gl2.json)
  const viaLink2 = await call(ticketRoute.GET, { url: `http://localhost:3000/api/tickets/ticket/${g1t.id}?token=${gT.accessToken}`, params: { id: g1t.id } })
  check('old guest link cannot open the transferred ticket (404)', viaLink2.status === 404)

  const cUser = await mkUser()
  const [cT] = await tickets((await buyPaid(lifeEv.tiers[0].id, 1, { userId: cUser.id, email: cUser.email! })).id)
  const cancelNoConfirm =await call(cancelRoute.POST, { method: 'POST', token: hostTok, body: {}, params: { id: lifeEv.id } })
  check('cancel needs confirm:true', cancelNoConfirm.status === 400)
  const cancelOther = await call(cancelRoute.POST, { method: 'POST', token: tok(intruder, 'SELLER'), body: { confirm: true }, params: { id: lifeEv.id } })
  check('another host cannot cancel (404)', cancelOther.status === 404)
  const cancelled = await call(cancelRoute.POST, { method: 'POST', token: hostTok, body: { confirm: true }, params: { id: lifeEv.id } })
  check('host cancels event', cancelled.status === 200)
  const trC = await doTransfer(cT.id, tok(cUser, 'BUYER'), friend.username!)
  check('cancelled: transfer refused (409 EVENT_CANCELLED)', trC.status === 409 && trC.json?.code === 'EVENT_CANCELLED', trC.json)
  check('cancelled: not buyable', (await rejects(() => P.prepareSale({ eventId: lifeEv.id, tierId: lifeEv.tiers[0].id, quantity: 1 }))) === 'EVENT_NOT_ON_SALE')
  check('cancelled: admin cannot resume it (409)', (await act(lifeEv.id, 'resume')).status === 409)

  // ── summary ───────────────────────────────────────────────────────────────
  console.log(`\n==== ${pass} passed, ${fail} failed ====`)
  if (fail) { console.log('FAILED:\n - ' + failures.join('\n - ')) }
  await prisma.$disconnect()
  process.exit(fail ? 1 : 0)
}

main().catch(e => { console.error('E2E crashed:', e); process.exit(1) })
