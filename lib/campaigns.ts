// Seasonal promo tags sellers can attach to a listing (app/(marketplace)/sell/page.tsx),
// surfaced as a badge on ProductCard and collected on a dedicated campaign landing page.
// Add a new entry here to run the next campaign — no other file needs a new concept.

export type CampaignKey = 'GIRLFRIENDS_DAY'

export interface CampaignDefinition {
  key: CampaignKey
  label: string
  tagline: string
  /** Listing must be created/edited on or before this date to be taggable. */
  startsAt: string
  /**
   * Riders can't claim a delivery batch containing this item until this date —
   * checkout and seller acceptance proceed normally either way. See
   * app/api/riders/accept-order/route.ts.
   */
  deliverableFrom: string
  /** Badge and landing page stop showing the product after this date. */
  endsAt: string
}

export const CAMPAIGNS: Record<CampaignKey, CampaignDefinition> = {
  GIRLFRIENDS_DAY: {
    key: 'GIRLFRIENDS_DAY',
    label: "Girlfriend's Day",
    tagline: 'Thoughtful gifts for the one who makes campus life better.',
    startsAt: '2026-07-20T00:00:00.000Z',
    deliverableFrom: '2026-08-01T00:00:00+01:00',
    endsAt: '2026-08-03T23:59:59.000Z',
  },
}

export function isValidCampaignKey(key: unknown): key is CampaignKey {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(CAMPAIGNS, key)
}

export function getCampaignExpiry(key: CampaignKey): Date {
  return new Date(CAMPAIGNS[key].endsAt)
}

export function isCampaignActive(tag?: string | null, expiresAt?: Date | string | null): boolean {
  if (!tag || !expiresAt || !isValidCampaignKey(tag)) return false
  return new Date(expiresAt).getTime() > Date.now()
}

/** Whether sellers can currently opt into tagging a listing for this campaign. */
export function isCampaignWindowOpen(key: CampaignKey): boolean {
  const c = CAMPAIGNS[key]
  const now = Date.now()
  return now >= new Date(c.startsAt).getTime() && now <= new Date(c.endsAt).getTime()
}

/**
 * Whether a rider can pick up an order containing this campaign's items yet.
 * Checkout, payment, and seller acceptance are unaffected by this — it only
 * gates the rider's claim step (app/api/riders/accept-order/route.ts), so a
 * gift bought on July 26 still can't reach the buyer before the campaign day.
 */
export function isCampaignDeliverable(key: unknown): boolean {
  if (!isValidCampaignKey(key)) return true
  return Date.now() >= new Date(CAMPAIGNS[key].deliverableFrom).getTime()
}

export function getCampaignDeliverableFrom(key: CampaignKey): Date {
  return new Date(CAMPAIGNS[key].deliverableFrom)
}
