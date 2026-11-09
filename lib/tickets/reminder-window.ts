// lib/tickets/reminder-window.ts
// Pure date logic for ticket reminders (no database, safe to unit test).
// Lagos is UTC+1 all year (no daylight saving), so a Lagos calendar day is
// floor((utcMs + 1h) / 24h).

export type ReminderWindow = 'd3' | 'd1' | 'd0'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** Whole days since the epoch, counted on the Lagos calendar. */
export const lagosDayNumber = (d: Date) => Math.floor((d.getTime() + HOUR) / DAY)

/** UTC instant of Lagos midnight for the Lagos day that contains `d`. */
export const lagosDayStart = (d: Date) => new Date(lagosDayNumber(d) * DAY - HOUR)

/**
 * Which reminder is due when the cron runs at `now` for an event starting at
 * `startsAt`: d3 (three Lagos calendar days ahead), d1 (tomorrow), d0 (today,
 * and the event has not started yet). null otherwise.
 */
export function reminderWindow(now: Date, startsAt: Date): ReminderWindow | null {
  const diff = lagosDayNumber(startsAt) - lagosDayNumber(now)
  if (diff === 3) return 'd3'
  if (diff === 1) return 'd1'
  if (diff === 0 && startsAt.getTime() > now.getTime()) return 'd0'
  return null
}
