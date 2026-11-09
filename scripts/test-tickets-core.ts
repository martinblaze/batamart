// Run: npx tsx scripts/test-tickets-core.ts
// Pure-logic checks for the ticketing core (no database needed).
import { buildQrText, parseQrText, verifyQr, qrStepOf } from '../lib/tickets/qr'
import { splitTicketMoney, clampCommissionPct } from '../lib/tickets/money'
import { checkEmailAllowed } from '../lib/tickets/email-guard'
import { generateTicketCode, generateTicketSecret } from '../lib/tickets/codes'
import { QR_STEP_SECONDS } from '../lib/tickets/config'

let failed = 0
const t = (name: string, ok: boolean) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failed++ }

async function main() {
  const code = generateTicketCode()
  const secret = generateTicketSecret()
  t('ticket code format', /^BT-[A-HJ-NP-Z2-9]{8}$/.test(code))
  t('secret is 64 hex chars', /^[0-9a-f]{64}$/.test(secret))

  const now = Date.now()
  const text = await buildQrText(code, secret, now)
  const parsed = parseQrText(text)!
  t('qr text parses', !!parsed && parsed.code === code && parsed.step === qrStepOf(now))
  t('valid QR accepted', (await verifyQr(secret, parsed, now)) === 'OK')
  t('QR still valid 40s later (within window)', (await verifyQr(secret, parsed, now + 40_000)) === 'OK')
  t('QR stale after 2 minutes', (await verifyQr(secret, parsed, now + 120_000)) === 'STALE')
  t('wrong secret rejected (old holder after transfer)', (await verifyQr(generateTicketSecret(), parsed, now)) === 'INVALID')
  t('tampered code rejected', (await verifyQr(secret, { ...parsed, code: 'BT-AAAAAAAA' }, now)) === 'INVALID')
  t('tampered mac rejected', (await verifyQr(secret, { ...parsed, mac: '0000000000000000' }, now)) === 'INVALID')
  t('forged future step with old mac is INVALID', (await verifyQr(secret, { ...parsed, step: parsed.step + 100 }, now)) === 'INVALID')
  const future = await buildQrText(code, secret, now + 10 * QR_STEP_SECONDS * 1000)
  t('genuinely future QR is STALE', (await verifyQr(secret, parseQrText(future)!, now)) === 'STALE')
  t('garbage is not parsed', parseQrText('hello') === null && parseQrText('BT1.x.1.2') === null)
  t('changes every 30s', (await buildQrText(code, secret, now)) !== (await buildQrText(code, secret, now + 31_000)))

  // Known-answer vector so the Flutter app can be checked against it
  const kv = await buildQrText('BT-ABCDEFGH', 'secret', 1_700_000_000_000)
  console.log('KNOWN-ANSWER (code BT-ABCDEFGH, secret "secret", t=1700000000000):', kv)

  const s = splitTicketMoney(5000, 2, 10)
  t('split sums to price', s.unit.fee + s.unit.commission + s.unit.host === 5000)
  t('10% fee, 10% commission, 80% host', s.unit.fee === 500 && s.unit.commission === 500 && s.unit.host === 4000)
  t('totals scale by quantity', s.subtotal === 10000 && s.platformFee === 1000 && s.commission === 1000 && s.hostAmount === 8000)
  const odd = splitTicketMoney(1234, 3, 7)
  t('odd amounts still sum exactly', odd.unit.fee + odd.unit.commission + odd.unit.host === 1234 && odd.subtotal === 3702)
  t('commission clamped to the cap', clampCommissionPct(99) === 30 && clampCommissionPct(-5) === 0 && clampCommissionPct('x') === 0)
  let threw = false
  try { splitTicketMoney(0, 1, 0) } catch { threw = true }
  t('zero price rejected', threw)

  t('mailinator blocked', !(await checkEmailAllowed('a@mailinator.com')).ok)
  t('subdomain of a temp provider blocked', !(await checkEmailAllowed('a@x.yopmail.com')).ok)
  t('bad syntax rejected', !(await checkEmailAllowed('not-an-email')).ok)
  const g = await checkEmailAllowed('  Someone@Gmail.com ')
  t('gmail accepted and lowercased', g.ok && (g as any).email === 'someone@gmail.com')
  // Needs working DNS; where the resolver is unreachable the guard deliberately lets mail through.
  const dnsWorks = await require('dns').promises.resolveMx('gmail.com').then(() => true, () => false)
  if (dnsWorks) t('nonexistent domain rejected', !(await checkEmailAllowed('a@this-domain-should-not-exist-batamart-xyz.com')).ok)
  else console.log('SKIP  nonexistent domain (DNS not reachable from this machine)')

  console.log(failed === 0 ? '\nALL PASSED' : `\n${failed} FAILED`)
  process.exit(failed === 0 ? 0 : 1)
}
main()
