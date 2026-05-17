import assert from 'node:assert/strict'
import { getSuspensionWindow } from '@/lib/oversized-protection'

function run() {
  const first = getSuspensionWindow(1)
  assert.equal(first.days, 0)

  const second = getSuspensionWindow(2)
  assert.equal(second.days, 3)

  const third = getSuspensionWindow(3)
  assert.equal(third.days, 14)

  const fourth = getSuspensionWindow(4)
  assert.equal(fourth.days, null)

  console.log('oversized-protection tests passed')
}

run()
