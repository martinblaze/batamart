// lib/delivery/schedule.ts
// All deliveries run on two fixed days (Africa/Lagos time):
//
//   ordered Sat, Sun, Mon, Tue  ->  delivered the coming Wednesday
//   ordered Wed, Thu, Fri       ->  delivered the coming Saturday
//
// The delivery day is always *after* the order day, so a Saturday order goes
// to Wednesday, not to that same Saturday, and a Wednesday order goes to
// Saturday. It is derived from the order's creation time rather than stored,
// so it needs no migration and the same function works on server and client.

const LAGOS_OFFSET_HOURS = 1 // WAT has no daylight saving
const DAY_MS = 24 * 60 * 60 * 1000

// Days from the order's weekday (0 = Sunday) to its delivery day.
const DAYS_UNTIL_DELIVERY: Record<number, number> = {
  0: 3, // Sun -> Wed
  1: 2, // Mon -> Wed
  2: 1, // Tue -> Wed
  3: 3, // Wed -> Sat
  4: 2, // Thu -> Sat
  5: 1, // Fri -> Sat
  6: 4, // Sat -> Wed
}

/** Midnight (Lagos) at the start of the given instant's Lagos calendar day, as a UTC Date. */
function startOfLagosDay(date: Date): Date {
  const shifted = new Date(date.getTime() + LAGOS_OFFSET_HOURS * 60 * 60 * 1000)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - LAGOS_OFFSET_HOURS * 60 * 60 * 1000)
}

function lagosWeekday(date: Date): number {
  return new Date(date.getTime() + LAGOS_OFFSET_HOURS * 60 * 60 * 1000).getUTCDay()
}

/** The delivery day (Lagos midnight, as a UTC Date) for something ordered at `orderedAt`. */
export function getScheduledDeliveryDate(orderedAt: Date | string | number): Date {
  const ordered = new Date(orderedAt)
  const days = DAYS_UNTIL_DELIVERY[lagosWeekday(ordered)]
  return new Date(startOfLagosDay(ordered).getTime() + days * DAY_MS)
}

/** True once the scheduled delivery day has started (Lagos time). */
export function isDeliveryDayReached(orderedAt: Date | string | number, now: Date = new Date()): boolean {
  return now.getTime() >= getScheduledDeliveryDate(orderedAt).getTime()
}

/** "Wednesday, 5 Nov" in Lagos time. */
export function formatDeliveryDate(date: Date): string {
  return date.toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Lagos',
  })
}

/**
 * Parses a product's "N day(s)" ready-time estimate (entered by the seller as
 * a whole number of days). Anything unparseable counts as ready now.
 */
export function parseReadyDays(estimate: string | null | undefined): number {
  const match = /(\d+)/.exec(estimate ?? '')
  const days = match ? parseInt(match[1], 10) : 0
  return Number.isFinite(days) ? Math.min(Math.max(days, 0), 30) : 0
}

/**
 * Delivery day for an order whose slowest item is ready `readyInDays` after
 * it was placed: the delivery rule is applied to the *ready* day, so an item
 * that lands on a Monday goes out Wednesday, on a Friday goes out Saturday,
 * and one that lands on a delivery day itself goes to the next one.
 */
export function getOrderDeliveryDate(orderedAt: Date | string | number, readyInDays = 0): Date {
  const readyAt = new Date(new Date(orderedAt).getTime() + Math.max(0, readyInDays) * DAY_MS)
  return getScheduledDeliveryDate(readyAt)
}

/**
 * The delivery day an order is actually on for: its ready-aware day, pushed
 * later if a rider found the product not ready and rolled it over.
 */
export function getEffectiveDeliveryDate(
  order: { createdAt: Date | string | number; deferredUntil?: Date | string | null },
  readyInDays = 0,
): Date {
  const base = getOrderDeliveryDate(order.createdAt, readyInDays)
  if (!order.deferredUntil) return base
  const deferred = new Date(order.deferredUntil)
  return deferred.getTime() > base.getTime() ? deferred : base
}

/** Today's Lagos midnight, as a UTC Date. */
export function getLagosToday(now: Date = new Date()): Date {
  return startOfLagosDay(now)
}

/** "Wed" / "Sat" style key (yyyy-mm-dd, Lagos) used to group a day's work. */
export function lagosDayKey(date: Date | string): string {
  return new Date(new Date(date).getTime() + LAGOS_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 10)
}
