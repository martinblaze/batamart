// Pure wishlist rules (no database, no imports) so they can be unit tested.

/** A drop smaller than this is noise, not worth a notification. */
export const DROP_THRESHOLD_PERCENT = 5
/** "Nearly out of stock" means this many or fewer left (and at least one). */
export const LOW_STOCK_MAX = 3
export const MAX_WISHLIST_ITEMS = 200

/** Real percentage drop from baseline to current (0 when not lower or invalid). */
export function dropPercentExact(baseline: number, current: number): number {
  if (!Number.isFinite(baseline) || !Number.isFinite(current)) return 0
  if (baseline <= 0 || current < 0 || current >= baseline) return 0
  return ((baseline - current) / baseline) * 100
}

/** What the buyer sees on the list: has the price dropped since they saved it? */
export function listDropInfo(priceWhenSaved: number, current: number): { priceDropped: boolean; dropPercent: number | null } {
  const pct = dropPercentExact(priceWhenSaved, current)
  if (pct < DROP_THRESHOLD_PERCENT) return { priceDropped: false, dropPercent: null }
  return { priceDropped: true, dropPercent: Math.round(pct) }
}

/**
 * Should we alert? Compares against the price at save time, or the price we
 * last alerted about, so each further drop is announced once and a price that
 * merely stays low is not repeated.
 */
export function alertBaseline(priceWhenSaved: number, lastNotifiedPrice: number | null | undefined): number {
  return lastNotifiedPrice != null && Number.isFinite(lastNotifiedPrice) ? lastNotifiedPrice : priceWhenSaved
}

export function detectDrop(
  priceWhenSaved: number,
  lastNotifiedPrice: number | null | undefined,
  current: number,
): { baseline: number; percent: number } | null {
  const baseline = alertBaseline(priceWhenSaved, lastNotifiedPrice)
  const exact = dropPercentExact(baseline, current)
  if (exact < DROP_THRESHOLD_PERCENT) return null
  return { baseline, percent: Math.round(exact) }
}

export function isLowStock(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity >= 1 && quantity <= LOW_STOCK_MAX
}
