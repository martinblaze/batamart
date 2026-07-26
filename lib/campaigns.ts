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
  /** Badge and landing page stop showing the product after this date. */
  endsAt: string
}

export const CAMPAIGNS: Record<CampaignKey, CampaignDefinition> = {
  GIRLFRIENDS_DAY: {
    key: 'GIRLFRIENDS_DAY',
    label: "Girlfriend's Day",
    tagline: 'Thoughtful gifts for the one who makes campus life better.',
    startsAt: '2026-07-20T00:00:00.000Z',
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
