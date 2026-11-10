// Pure-logic checks for the notification campaign (no database, no network).
// Run: npx tsx scripts/test-campaign-logic.ts
import {
  activityTier, dailyCapFor, nonCampaignLimit, buildAffinity, chooseCategory, pickCandidate,
  realPercentOff, cutoffMessage, firstOrderStage, parseSlot, normalizeFrequency, type Candidate,
} from '../lib/notify/campaigns/logic'
import { pushImageUrl } from '../lib/notify/image'
import { renderEmail } from '../lib/notify/email'

let failed = 0
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`)
}

const now = new Date('2026-11-09T10:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000)

// Throttle by recency
ok('active within 7 days', activityTier(daysAgo(3), now) === 'active')
ok('cooling 8-21 days', activityTier(daysAgo(10), now) === 'cooling' && activityTier(daysAgo(21), now) === 'cooling')
ok('dormant over 21 days / never', activityTier(daysAgo(30), now) === 'dormant' && activityTier(null, now) === 'dormant')

// Caps
ok('cap active=6, cooling=3, dormant=1', dailyCapFor('active', 'NORMAL') === 6 && dailyCapFor('cooling', 'NORMAL') === 3 && dailyCapFor('dormant', 'NORMAL') === 1)
ok('FEWER caps at 2 but never raises a lower cap', dailyCapFor('active', 'FEWER') === 2 && dailyCapFor('dormant', 'FEWER') === 1)
ok('ORDERS_ONLY = 0 promos', dailyCapFor('active', 'ORDERS_ONLY') === 0)
ok('older jobs leave room for slots', nonCampaignLimit(6) === 4 && nonCampaignLimit(3) === 2 && nonCampaignLimit(2) === 1 && nonCampaignLimit(1) === 0)
ok('unknown frequency falls back to NORMAL', normalizeFrequency('x') === 'NORMAL' && normalizeFrequency('FEWER') === 'FEWER')

// Real discount maths
ok('percent off is computed from real prices', realPercentOff({ price: 820, marketPrice: 1000, discountPercent: 99 }) === 18)
ok('no market price -> no percent (never invented)', realPercentOff({ price: 820, marketPrice: null, discountPercent: 30 }) === null)
ok('tiny difference is not advertised', realPercentOff({ price: 980, marketPrice: 1000, discountPercent: 2 }) === null)

// Pool and rotation
const mk = (id: string, cat: string, extra: Partial<Candidate> = {}): Candidate => ({ id, name: id, price: 1000, categoryKey: cat, quantity: 5, image: 'https://x/y.jpg', ...extra })
const pool: Candidate[] = [
  mk('p1', 'phones'), mk('p2', 'phones', { marketPrice: 1500, price: 1000 }), mk('p3', 'phones'),
  mk('f1', 'fashion'), mk('f2', 'fashion'), mk('h1', 'home'), mk('h2', 'home', { image: undefined }),
]
const cats = ['phones', 'fashion', 'home']
const affinity = buildAffinity({ orders: ['phones'], views: ['phones', 'fashion'], cart: ['phones'] })
ok('affinity ranks ordered category first', Array.from(affinity.entries()).sort((a, b) => b[1] - a[1])[0][0] === 'phones')

let own = 0
let explore = 0
for (let i = 0; i < 1000; i++) {
  const r = chooseCategory({ affinity, available: cats, seed: `user${i}:2026-11-09:1`, sentTodayCats: [] })
  if (r.category === 'phones' || r.category === 'fashion') own++
  if (r.category === 'home') explore++
}
ok(`roughly 70% own interests / 30% explore (own=${own}, explore=${explore})`, own > 640 && own < 760 && explore > 240 && explore < 360)

let repeat = 0
for (let i = 0; i < 200; i++) {
  const r = chooseCategory({ affinity: buildAffinity({ views: ['phones', 'fashion'] }), available: cats, seed: `u${i}`, sentTodayCats: ['phones'] })
  if (r.category === 'phones') repeat++
}
ok('never repeats the category of the previous slot when an alternative exists', repeat === 0, `repeat=${repeat}`)

// Candidate selection: 14 day no-repeat, image required
const seen = new Set(['p2'])
const picked = pickCandidate(pool, { category: 'phones', excludeIds: seen, seed: 's' })
ok('skips products pushed in last 14 days', !!picked && picked.id !== 'p2' && picked.categoryKey === 'phones')
const sequence: string[] = []
const excl = new Set<string>()
for (let slot = 1; slot <= 6; slot++) {
  const p = pickCandidate(pool, { category: null, excludeIds: excl, seed: `slot${slot}` })
  if (p) { sequence.push(p.id); excl.add(p.id) }
}
ok('six slots in a day never repeat a product', new Set(sequence).size === sequence.length, sequence.join(','))
ok('products without an https image are never chosen', !sequence.includes('h2'))
const bestDeal = pickCandidate(pool, { category: 'phones', excludeIds: new Set(), seed: 'z', require: p => realPercentOff(p) !== null })
ok('deal slot only picks products with a real discount', bestDeal?.id === 'p2')
ok('nothing left -> null', pickCandidate(pool, { category: null, excludeIds: new Set(pool.map(p => p.id)), seed: 'q' }) === null)

// Delivery cutoff, from the real schedule (Lagos time = UTC+1)
const tue = cutoffMessage(new Date('2026-11-10T19:00:00Z')) // Tue 20:00 Lagos
ok('Tuesday night is the real cutoff for Wednesday', tue.isCutoffNight && /Wednesday/.test(tue.deliveryDay), JSON.stringify(tue))
const fri = cutoffMessage(new Date('2026-11-13T19:30:00Z')) // Fri
ok('Friday night is the cutoff for Saturday', fri.isCutoffNight && /Saturday/.test(fri.deliveryDay), JSON.stringify(fri))
const sun = cutoffMessage(new Date('2026-11-08T19:30:00Z')) // Sun
ok('Sunday is not a cutoff night and goes to Wednesday', !sun.isCutoffNight && /Wednesday/.test(sun.deliveryDay), JSON.stringify(sun))

// First-order series
const signup = (d: number) => daysAgo(d)
ok('first-order email on day 1, 3 and 7 only', [0, 1, 2, 3, 4, 7, 8].map(d => String(firstOrderStage(signup(d), now))).join(',') === 'null,1,null,3,null,7,null')
ok('slot parsing', parseSlot('3') === 3 && parseSlot('7') === null && parseSlot('x') === null)

// Image helper
ok('cloudinary image is resized', pushImageUrl('https://res.cloudinary.com/demo/image/upload/v1/a/b.png')?.includes('/upload/w_720,c_fill,f_jpg,q_auto/v1/a/b.png') === true)
ok('non-https image is dropped', pushImageUrl('http://res.cloudinary.com/demo/image/upload/v1/a.png') === undefined && pushImageUrl(null) === undefined)

// Email rendering
const html = renderEmail({
  heading: 'Test', lines: ['x'], showPreferences: true, unsubscribeUrl: 'https://batamart.com/api/notifications/unsubscribe?u=1&t=2',
  products: [{ image: 'https://img/1.jpg', name: 'Phone <b>', price: '₦1,000', badge: '18% off', url: '/product/p1' }],
})
ok('email has product card, badge and unsubscribe link', html.includes('18% off') && html.includes('https://img/1.jpg') && html.includes('Unsubscribe') && html.includes('/product/p1') && !html.includes('<b>'))
ok('existing emails unchanged (no product block)', !renderEmail({ heading: 'A', lines: ['b'] }).includes('<img'))

console.log(failed ? `\n${failed} FAILED` : '\nAll passed')
process.exit(failed ? 1 : 0)
