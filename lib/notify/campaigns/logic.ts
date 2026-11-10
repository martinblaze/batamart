// lib/notify/campaigns/logic.ts
// Pure decision logic for the daily campaign (no database, no network), so it
// can be tested with fake data: throttle by recency, daily cap, category
// rotation (70% strongest interest / 30% explore), candidate choice, real
// discount maths and the delivery cutoff wording.

import { getLagosToday, getScheduledDeliveryDate, lagosDayKey, formatDeliveryDate } from '@/lib/delivery/schedule'

export type Frequency = 'NORMAL' | 'FEWER' | 'ORDERS_ONLY'
export type Tier = 'active' | 'cooling' | 'dormant'

const DAY = 24 * 60 * 60 * 1000

export const MAX_DAILY = 6
export const FEWER_DAILY = 2

export function normalizeFrequency(v: unknown): Frequency {
  return v === 'FEWER' || v === 'ORDERS_ONLY' ? v : 'NORMAL'
}

/** Active in last 7 days -> active; 8 to 21 days -> cooling; older -> dormant. */
export function activityTier(lastActivity: Date | null | undefined, now = new Date()): Tier {
  if (!lastActivity) return 'dormant'
  const days = (now.getTime() - lastActivity.getTime()) / DAY
  if (days <= 7) return 'active'
  if (days <= 21) return 'cooling'
  return 'dormant'
}

/** The one unified daily cap on promotional pushes for this person. */
export function dailyCapFor(tier: Tier, frequency: Frequency): number {
  if (frequency === 'ORDERS_ONLY') return 0
  const byTier = tier === 'active' ? MAX_DAILY : tier === 'cooling' ? 3 : 1
  return frequency === 'FEWER' ? Math.min(byTier, FEWER_DAILY) : byTier
}

/**
 * Older promotional jobs (deal alerts, win-back, digests...) may only use what
 * the campaign slots leave free, so slots always have room.
 */
export function nonCampaignLimit(cap: number): number {
  if (cap >= 4) return cap - 2
  if (cap >= 2) return cap - 1
  return 0
}

export function hash32(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface AffinityInput {
  views?: string[] // category keys, one per view
  cart?: string[]
  orders?: string[]
  searches?: string[]
}

const WEIGHT = { orders: 5, cart: 3, searches: 2, views: 1 }

/** Category -> score from everything we know the person did. */
export function buildAffinity(input: AffinityInput): Map<string, number> {
  const out = new Map<string, number>()
  for (const [kind, list] of Object.entries(input) as [keyof AffinityInput, string[] | undefined][]) {
    for (const c of list ?? []) if (c) out.set(c, (out.get(c) ?? 0) + WEIGHT[kind])
  }
  return out
}

/**
 * Pick the category to push from. 70% of the time one of the person's top 3
 * interests (rotating through them), 30% a category they have not shown
 * interest in, so we learn. Categories already pushed earlier today are
 * avoided when anything else is available.
 */
export function chooseCategory(opts: {
  affinity: Map<string, number>
  available: string[]
  seed: string
  sentTodayCats: string[]
}): { category: string | null; explore: boolean } {
  const { affinity, available, seed, sentTodayCats } = opts
  if (available.length === 0) return { category: null, explore: false }
  const ranked = Array.from(affinity.entries()).filter(([c]) => available.includes(c)).sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const unseen = available.filter(c => !affinity.has(c))
  const roll = hash32(seed) % 100
  const exploreWanted = roll >= 70 || ranked.length === 0
  const avoid = new Set(sentTodayCats)

  const pickFrom = (list: string[]) => {
    if (list.length === 0) return null
    const fresh = list.filter(c => !avoid.has(c))
    const pool = fresh.length ? fresh : list
    return pool[hash32(seed + ':pick') % pool.length]
  }

  if (!exploreWanted) {
    const c = pickFrom(ranked.slice(0, 3))
    if (c) return { category: c, explore: false }
  }
  const e = pickFrom(unseen) ?? pickFrom(ranked)
  return { category: e, explore: !!e && unseen.includes(e) }
}

export interface Candidate {
  id: string
  name: string
  price: number
  categoryKey: string | null
  quantity: number
  image?: string
  marketPrice?: number | null
  discountPercent?: number | null
  isDeal?: boolean
  isHot?: boolean
  hotScore?: number
  createdAt?: Date
  /** 0..1 popularity used only as a tie-breaker. */
  popularity?: number
}

/** The real percentage off, or null. Never invented: needs a higher confirmed campus price. */
export function realPercentOff(p: Pick<Candidate, 'price' | 'marketPrice' | 'discountPercent'>): number | null {
  if (p.marketPrice && p.marketPrice > p.price && p.price > 0) {
    const pct = Math.round((1 - p.price / p.marketPrice) * 100)
    return pct >= 5 ? pct : null
  }
  return null
}

/**
 * The best product for this person: not pushed in the last 14 days, not
 * already bought, preferring the chosen category, then deals, then hot items.
 */
export function pickCandidate<T extends Candidate>(
  pool: T[],
  opts: { category: string | null; excludeIds: Set<string>; seed: string; require?: (p: T) => boolean; score?: (p: T) => number },
): T | null {
  const eligible = pool.filter(p => !opts.excludeIds.has(p.id) && p.image && (!opts.require || opts.require(p)))
  if (eligible.length === 0) return null
  const inCategory = opts.category ? eligible.filter(p => p.categoryKey === opts.category) : []
  const list = inCategory.length ? inCategory : eligible
  const scored = list.map(p => ({
    p,
    s:
      (opts.score ? opts.score(p) : 0) +
      (realPercentOff(p) ?? 0) / 10 +
      (p.isHot ? 1 : 0) +
      (p.popularity ?? 0) * 2 +
      // A stable per-person jitter so two people with the same interests do not get identical pushes.
      (hash32(opts.seed + p.id) % 100) / 100,
  }))
  scored.sort((a, b) => b.s - a.s)
  return scored[0].p
}

// ── Slots ───────────────────────────────────────────────────────────────────

export type SlotNo = 1 | 2 | 3 | 4 | 5 | 6

export const SLOT_TIMES: Record<SlotNo, string> = { 1: '07:45', 2: '10:30', 3: '13:00', 4: '16:00', 5: '19:00', 6: '21:00' }

export function parseSlot(v: unknown): SlotNo | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 6 ? (n as SlotNo) : null
}

export function pastCartAge(addedAt: Date, now = new Date()) {
  return now.getTime() - addedAt.getTime()
}

/**
 * Wording for the 21:00 push, from the real delivery rule. Orders placed
 * Sat-Tue go out Wednesday and Wed-Fri go out Saturday, so on Tuesday and
 * Friday night the cutoff is genuinely midnight.
 */
export function cutoffMessage(now = new Date()): { title: string; message: string; deliveryDay: string; isCutoffNight: boolean } {
  const today = getScheduledDeliveryDate(now)
  const afterMidnight = new Date(getLagosToday(now).getTime() + DAY + 60 * 1000)
  const later = getScheduledDeliveryDate(afterMidnight)
  const isCutoffNight = lagosDayKey(today) !== lagosDayKey(later)
  const day = formatDeliveryDate(today)
  if (isCutoffNight) {
    return {
      title: `Last call for ${day.split(',')[0]} delivery`,
      message: `Order before midnight and it arrives ${day}. After that it waits for ${formatDeliveryDate(later).split(',')[0]}.`,
      deliveryDay: day,
      isCutoffNight,
    }
  }
  return {
    title: `Order tonight, delivered ${day.split(',')[0]}`,
    message: `Anything you order now is on the ${day} delivery run. Your money is held safely until you confirm.`,
    deliveryDay: day,
    isCutoffNight,
  }
}

/** Rotating subject lines so emails do not all look the same. */
export function emailSubject(variant: number, topName: string, pct: number | null): string {
  const subjects = [
    pct ? `${pct}% off ${topName} and more picked for you` : `Picked for you: ${topName} and more`,
    `What students near you are buying today`,
    pct ? `Today on BataMart: ${topName}, ${pct}% off` : `Today on BataMart: ${topName}`,
    `${topName} and other finds from campus`,
  ]
  return subjects[variant % subjects.length]
}

/** First-order series: day 1, 3 and 7 after signup, for users with no order. */
export function firstOrderStage(createdAt: Date, now = new Date()): 1 | 3 | 7 | null {
  const days = Math.floor((now.getTime() - createdAt.getTime()) / DAY)
  return days === 1 || days === 3 || days === 7 ? (days as 1 | 3 | 7) : null
}
