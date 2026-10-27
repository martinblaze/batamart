// lib/feed-signals.ts
// Client-side: turns what this browser has looked at and searched for into the
// query the personalised feed expects. Same localStorage keys the marketplace
// page writes, so every screen that recommends things agrees on what "for you"
// means.

type Timed = { value: string; timestamp: number }

const FEED_ACTIVITY_KEY = 'BATAMART-feed-activity-v1'
const RECENTLY_VIEWED_KEY = 'BATAMART-recently-viewed'
const RECENT_SEARCHES_KEY = 'BATAMART-recent-searches'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function buildFeedQuery(limit = 100): string {
  const activity = read<{ categories?: Timed[]; keywords?: Timed[] }>(FEED_ACTIVITY_KEY, {})
  let categories = (Array.isArray(activity.categories) ? activity.categories : []).filter(x => x?.value)
  let keywords = (Array.isArray(activity.keywords) ? activity.keywords : []).filter(x => x?.value)

  if (!categories.length) {
    const seen = new Set<string>()
    categories = read<any[]>(RECENTLY_VIEWED_KEY, [])
      .map(p => ({ value: p?.category as string, timestamp: typeof p?.createdAt === 'string' ? Date.parse(p.createdAt) : Date.now() }))
      .filter(e => e.value && !seen.has(e.value) && seen.add(e.value))
      .slice(0, 12)
  }
  if (!keywords.length) {
    keywords = read<any[]>(RECENT_SEARCHES_KEY, [])
      .map(entry => (typeof entry === 'string' ? entry : entry?.keyword ?? entry?.value ?? ''))
      .filter(Boolean)
      .slice(0, 12)
      .map((value: string) => ({ value, timestamp: Date.now() }))
  }

  const params = new URLSearchParams()
  if (categories.length) {
    params.set('categories', categories.map(c => c.value).join(','))
    params.set('categorySignals', JSON.stringify(categories))
  }
  if (keywords.length) {
    params.set('keywords', keywords.map(k => k.value).join(','))
    params.set('keywordSignals', JSON.stringify(keywords))
  }
  params.set('limit', String(limit))
  return params.toString()
}
