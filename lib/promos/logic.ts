// lib/promos/logic.ts
// Pure helpers shared by /api/promos/home and the home-page promo UI. No I/O,
// no Date.now() unless injected, so scripts/test-promos-logic.ts can cover them.

export type PopupKind =
  | 'FIRST_ORDER' | 'HOT_DEAL' | 'FOR_YOU' | 'CART'
  | 'REFERRAL' | 'EVENTS' | 'WISHLIST_DROP' | 'NEW_ARRIVALS'

export interface Popup {
  id: string
  kind: PopupKind
  title: string
  body: string
  imageUrl: string | null
  ctaLabel: string
  ctaUrl: string
  badge: string | null
}

/** Display priority, highest first. */
export const POPUP_PRIORITY: PopupKind[] = [
  'FIRST_ORDER', 'HOT_DEAL', 'FOR_YOU', 'CART',
  'WISHLIST_DROP', 'REFERRAL', 'EVENTS', 'NEW_ARRIVALS',
]
export const MAX_SLIDES = 5

/** Orders candidates by priority, keeps one per kind, caps at `max`. */
export function selectPopups(candidates: Popup[], max = MAX_SLIDES): Popup[] {
  const byKind = new Map<PopupKind, Popup>()
  for (const c of candidates) {
    if (!c || !POPUP_PRIORITY.includes(c.kind)) continue
    if (!byKind.has(c.kind)) byKind.set(c.kind, c)
  }
  const out: Popup[] = []
  for (const kind of POPUP_PRIORITY) {
    const p = byKind.get(kind)
    if (p) out.push(p)
    if (out.length >= max) break
  }
  return out
}

// ── Anonymising "just ordered" ───────────────────────────────────────────

export interface JustOrdered { productName: string; imageUrl: string | null; minutesAgo: number }

/**
 * Turns raw recent order lines into the public ticker. Only product name,
 * image and age leave this function; one entry per product; cancelled lines
 * are dropped by the caller. Needs `minItems` distinct products to be shown.
 */
export function anonymiseOrders(
  rows: Array<{ productId: string; productName: string; imageUrl?: string | null; at: Date | string | number }>,
  now: number,
  opts: { max?: number; minItems?: number; maxAgeMinutes?: number } = {},
): JustOrdered[] {
  const { max = 8, minItems = 3, maxAgeMinutes = 48 * 60 } = opts
  const seen = new Set<string>()
  const out: JustOrdered[] = []
  const sorted = [...rows].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  for (const r of sorted) {
    if (!r.productName || seen.has(r.productId)) continue
    const minutesAgo = Math.floor((now - new Date(r.at).getTime()) / 60000)
    if (!Number.isFinite(minutesAgo) || minutesAgo < 0 || minutesAgo > maxAgeMinutes) continue
    seen.add(r.productId)
    out.push({ productName: r.productName, imageUrl: r.imageUrl ?? null, minutesAgo })
    if (out.length >= max) break
  }
  return out.length >= minItems ? out : []
}

/** Stats are only shown when the number is big enough to be convincing. */
export function hideLowStat(value: number | null | undefined, min: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min ? Math.round(value) : null
}

export const MIN_ORDERS_THIS_WEEK = 10
export const MIN_ACTIVE_SHOPPERS = 5

export function minutesAgoLabel(m: number): string {
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hr${h === 1 ? '' : 's'} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

// ── Delivery countdown ───────────────────────────────────────────────────

/** "5h 20m", "42m", "1d 3h" */
export function formatMsLeft(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMin = Math.floor(ms / 60000)
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${Math.max(m, 1)}m`
}

// ── Frequency rules (client, localStorage) ──────────────────────────────

export interface PromoState {
  shownAt: number[]                    // epoch ms of each time the sheet opened
  dismissed: Record<string, number>    // kind -> epoch ms dismissed
}

export const HOUR = 3600_000
export const MIN_GAP_MS = 6 * HOUR
export const MAX_PER_DAY = 2
export const DISMISS_TTL_MS = 24 * HOUR

export function emptyState(): PromoState { return { shownAt: [], dismissed: {} } }

export function cleanState(raw: unknown, now: number): PromoState {
  const s = emptyState()
  if (!raw || typeof raw !== 'object') return s
  const r = raw as any
  if (Array.isArray(r.shownAt)) s.shownAt = r.shownAt.filter((t: any) => typeof t === 'number' && now - t < 48 * HOUR && t <= now + 60000)
  if (r.dismissed && typeof r.dismissed === 'object') {
    for (const [k, t] of Object.entries(r.dismissed)) {
      if (typeof t === 'number' && now - t < DISMISS_TTL_MS) s.dismissed[k] = t
    }
  }
  return s
}

/** May the sheet open right now? At most once per 6h, twice per rolling 24h. */
export function canShowSheet(state: PromoState, now: number): boolean {
  const last = state.shownAt.length ? Math.max(...state.shownAt) : 0
  if (last && now - last < MIN_GAP_MS) return false
  const inDay = state.shownAt.filter(t => now - t < 24 * HOUR).length
  return inDay < MAX_PER_DAY
}

export function filterDismissed(slides: Popup[], state: PromoState, now: number): Popup[] {
  return slides.filter(s => {
    const t = state.dismissed[s.kind]
    return !(typeof t === 'number' && now - t < DISMISS_TTL_MS)
  })
}

export function markShown(state: PromoState, now: number): PromoState {
  return { ...state, shownAt: [...state.shownAt, now].slice(-10) }
}

export function markDismissed(state: PromoState, kinds: string[], now: number): PromoState {
  const dismissed = { ...state.dismissed }
  for (const k of kinds) dismissed[k] = now
  return { ...state, dismissed }
}

/** Pages that must never get a promo sheet. */
const BLOCKED_PREFIXES = ['/login', '/signup', '/register', '/checkout', '/payment', '/forgot', '/reset', '/verify', '/onboarding']
export function isBlockedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return true
  return BLOCKED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}
