// Run: npx tsx scripts/test-ticket-reminders-logic.ts
import { reminderWindow, lagosDayStart } from '../lib/tickets/reminder-window'

let failed = 0
function eq(name: string, got: unknown, want: unknown) {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: got ${String(got)} want ${String(want)}`)
}

// Lagos = UTC+1. Helper: build a UTC instant from a Lagos wall clock time.
const lagos = (y: number, m: number, d: number, h = 0, min = 0) => new Date(Date.UTC(y, m - 1, d, h - 1, min))

const cron = lagos(2026, 11, 10, 7, 0) // 07:00 Lagos on 10 Nov

eq('3 days ahead, evening', reminderWindow(cron, lagos(2026, 11, 13, 19, 0)), 'd3')
eq('3 days ahead, 23:59', reminderWindow(cron, lagos(2026, 11, 13, 23, 59)), 'd3')
eq('3 days ahead, 00:30', reminderWindow(cron, lagos(2026, 11, 13, 0, 30)), 'd3')
eq('4 days ahead is none', reminderWindow(cron, lagos(2026, 11, 14, 0, 30)), null)
eq('2 days ahead is none', reminderWindow(cron, lagos(2026, 11, 12, 20, 0)), null)
eq('tomorrow 00:30', reminderWindow(cron, lagos(2026, 11, 11, 0, 30)), 'd1')
eq('tomorrow 23:59', reminderWindow(cron, lagos(2026, 11, 11, 23, 59)), 'd1')
eq('today evening', reminderWindow(cron, lagos(2026, 11, 10, 20, 0)), 'd0')
eq('today 00:30 already started', reminderWindow(cron, lagos(2026, 11, 10, 0, 30)), null)
eq('yesterday', reminderWindow(cron, lagos(2026, 11, 9, 20, 0)), null)

// Around midnight Lagos: 23:30 UTC is already 00:30 the next Lagos day.
const lateUtc = new Date(Date.UTC(2026, 10, 9, 23, 30)) // = 00:30 Lagos on 10 Nov
eq('00:30 Lagos counts as the new day (tomorrow is 11 Nov)', reminderWindow(lateUtc, lagos(2026, 11, 11, 18, 0)), 'd1')
eq('00:30 Lagos: 10 Nov evening is d0', reminderWindow(lateUtc, lagos(2026, 11, 10, 18, 0)), 'd0')
const justBefore = new Date(Date.UTC(2026, 10, 9, 22, 59)) // 23:59 Lagos on 9 Nov
eq('23:59 Lagos 9 Nov: 10 Nov evening is d1', reminderWindow(justBefore, lagos(2026, 11, 10, 18, 0)), 'd1')

// Month and year boundaries.
eq('month boundary d3', reminderWindow(lagos(2026, 11, 28, 7), lagos(2026, 12, 1, 18)), 'd3')
eq('year boundary d1', reminderWindow(lagos(2026, 12, 31, 7), lagos(2027, 1, 1, 0, 30)), 'd1')

// Day start.
eq('lagosDayStart of 07:00 Lagos', lagosDayStart(cron).toISOString(), '2026-11-09T23:00:00.000Z')
eq('lagosDayStart of 00:30 Lagos', lagosDayStart(lateUtc).toISOString(), '2026-11-09T23:00:00.000Z')

if (failed) {
  console.error(`${failed} FAILED`)
  process.exit(1)
}
console.log('All good')
