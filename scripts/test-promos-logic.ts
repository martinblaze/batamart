// Run: npx tsx scripts/test-promos-logic.ts
import assert from 'node:assert/strict'
import {
  anonymiseOrders, canShowSheet, cleanState, emptyState, filterDismissed, formatMsLeft, hideLowStat,
  isBlockedPath, markDismissed, markShown, selectPopups, HOUR, type Popup,
} from '../lib/promos/logic'
import { getScheduledDeliveryDate } from '../lib/delivery/schedule'

let n = 0
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok  ' + name) }
const pop = (kind: Popup['kind']): Popup => ({ id: kind, kind, title: kind, body: '', imageUrl: null, ctaLabel: 'Go', ctaUrl: '/', badge: null })

t('selectPopups orders by priority and caps at 5', () => {
  const all = (['NEW_ARRIVALS', 'EVENTS', 'REFERRAL', 'CART', 'FOR_YOU', 'HOT_DEAL', 'FIRST_ORDER'] as const).map(pop)
  const out = selectPopups(all).map(p => p.kind)
  assert.deepEqual(out, ['FIRST_ORDER', 'HOT_DEAL', 'FOR_YOU', 'CART', 'REFERRAL'])
})
t('selectPopups dedupes kinds and ignores unknown', () => {
  const out = selectPopups([pop('CART'), pop('CART'), { ...pop('CART'), kind: 'BOGUS' as any }])
  assert.equal(out.length, 1)
})

const NOW = Date.UTC(2026, 10, 9, 12)
t('anonymise drops buyer data, dedupes products, computes minutes', () => {
  const rows = [
    { productId: 'a', productName: 'Kettle', imageUrl: 'x', at: NOW - 5 * 60000, buyer: 'SECRET', hostel: 'H1' },
    { productId: 'a', productName: 'Kettle', imageUrl: 'x', at: NOW - 9 * 60000 },
    { productId: 'b', productName: 'Fan', imageUrl: null, at: NOW - 90 * 60000 },
    { productId: 'c', productName: 'Rice', at: NOW - 600 * 60000 },
  ] as any[]
  const out = anonymiseOrders(rows, NOW)
  assert.deepEqual(out.map(o => o.minutesAgo), [5, 90, 600])
  assert.deepEqual(Object.keys(out[0]).sort(), ['imageUrl', 'minutesAgo', 'productName'])
  assert.ok(!JSON.stringify(out).includes('SECRET'))
})
t('anonymise returns [] when too few items or too old/future', () => {
  assert.deepEqual(anonymiseOrders([{ productId: 'a', productName: 'A', at: NOW - 60000 }], NOW), [])
  const rows = ['a', 'b', 'c'].map(id => ({ productId: id, productName: id, at: NOW + 60000 }))
  assert.deepEqual(anonymiseOrders(rows, NOW), [])
})
t('hideLowStat', () => {
  assert.equal(hideLowStat(3, 10), null)
  assert.equal(hideLowStat(10, 10), 10)
  assert.equal(hideLowStat(null, 10), null)
  assert.equal(hideLowStat(NaN, 10), null)
})
t('formatMsLeft', () => {
  assert.equal(formatMsLeft((5 * 60 + 20) * 60000), '5h 20m')
  assert.equal(formatMsLeft(42 * 60000), '42m')
  assert.equal(formatMsLeft(27 * HOUR), '1d 3h')
  assert.equal(formatMsLeft(-5), '0m')
})
t('frequency: 6h gap and 2/day', () => {
  let s = emptyState()
  assert.equal(canShowSheet(s, NOW), true)
  s = markShown(s, NOW)
  assert.equal(canShowSheet(s, NOW + 5 * HOUR), false)
  assert.equal(canShowSheet(s, NOW + 6 * HOUR), true)
  s = markShown(s, NOW + 6 * HOUR)
  assert.equal(canShowSheet(s, NOW + 13 * HOUR), false) // 2 within 24h
  assert.equal(canShowSheet(s, NOW + 25 * HOUR), true)  // first has aged out
})
t('dismissed kinds hidden for 24h only', () => {
  const s = markDismissed(emptyState(), ['CART'], NOW)
  const slides = [pop('CART'), pop('HOT_DEAL')]
  assert.deepEqual(filterDismissed(slides, s, NOW + HOUR).map(p => p.kind), ['HOT_DEAL'])
  assert.equal(filterDismissed(slides, s, NOW + 25 * HOUR).length, 2)
})
t('cleanState survives garbage and expires old entries', () => {
  assert.deepEqual(cleanState('junk', NOW), emptyState())
  const c = cleanState({ shownAt: [NOW - 100 * HOUR, NOW - HOUR, 'x'], dismissed: { A: NOW - 30 * HOUR, B: NOW - HOUR } }, NOW)
  assert.deepEqual(c.shownAt, [NOW - HOUR])
  assert.deepEqual(Object.keys(c.dismissed), ['B'])
})
t('blocked paths', () => {
  for (const p of ['/login', '/signup', '/checkout', '/checkout/pay', '/payment/verify']) assert.equal(isBlockedPath(p), true, p)
  assert.equal(isBlockedPath('/marketplace'), false)
  assert.equal(isBlockedPath('/loginfoo'), false)
})
t('delivery cutoff = next delivery day start (Wed/Sat, Lagos)', () => {
  // Mon 9 Nov 2026 12:00 UTC -> Wed 11 Nov 00:00 Lagos = 10 Nov 23:00 UTC
  assert.equal(getScheduledDeliveryDate(new Date(NOW)).toISOString(), '2026-11-10T23:00:00.000Z')
  // Thu 12 Nov -> Sat 14 Nov
  assert.equal(getScheduledDeliveryDate(new Date(Date.UTC(2026, 10, 12, 12))).toISOString(), '2026-11-13T23:00:00.000Z')
})

console.log(`\n${n} tests passed`)
