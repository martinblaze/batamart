import assert from 'node:assert/strict'
import { dropPercentExact, listDropInfo, detectDrop, isLowStock, alertBaseline } from '../lib/wishlist/logic'

// exact percentage
assert.equal(dropPercentExact(1000, 900), 10)
assert.equal(dropPercentExact(1000, 1000), 0)
assert.equal(dropPercentExact(1000, 1200), 0)
assert.equal(dropPercentExact(0, 0), 0)
assert.equal(dropPercentExact(NaN, 10), 0)

// threshold is inclusive at 5%
assert.deepEqual(detectDrop(1000, null, 950), { baseline: 1000, percent: 5 })
assert.equal(detectDrop(1000, null, 951), null)
assert.equal(detectDrop(1000, null, 1000), null)

// baseline moves to last notified price: only a further 5% drop re-alerts
assert.equal(alertBaseline(1000, 800), 800)
assert.equal(alertBaseline(1000, null), 1000)
assert.equal(detectDrop(1000, 800, 780), null)
assert.deepEqual(detectDrop(1000, 800, 760), { baseline: 800, percent: 5 })
// price rose above save price then fell a little: no alert vs saved price when notified baseline is lower
assert.equal(detectDrop(1000, 800, 790), null)

// list badge uses the saved price
assert.deepEqual(listDropInfo(1000, 700), { priceDropped: true, dropPercent: 30 })
assert.deepEqual(listDropInfo(1000, 980), { priceDropped: false, dropPercent: null })
assert.deepEqual(listDropInfo(1000, 1500), { priceDropped: false, dropPercent: null })

// low stock
assert.equal(isLowStock(0), false)
assert.equal(isLowStock(1), true)
assert.equal(isLowStock(3), true)
assert.equal(isLowStock(4), false)

console.log('wishlist logic: all assertions passed')
