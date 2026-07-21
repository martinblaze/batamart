// app/api/products/route.ts
export const revalidate = 30

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { buildAttributeFiltersFromQuery, normalizeAttributeValue } from '@/lib/category-attributes'
import { CATEGORY_TREE, getCategoryDisplayInfo, getCategoryQueryValues } from '@/lib/variants'
import { normalizeText } from '@/lib/search-utils'

const DEFAULT_PAGE_SIZE = 40
const MAX_PAGE_SIZE     = 100
const MAX_LISTING_PRICE = 10000000
const MAX_LISTING_STOCK = 100
const AUTO_PROMOTE_THRESHOLD = 10
const PROHIBITED_LISTING_MESSAGE = 'Your listing was rejected. It contains prohibited content.'

const BANNED_KEYWORD_PATTERNS: Array<{ term: string; pattern: RegExp }> = [
  // Illegal drugs and controlled substances. Keep common campus OTC medicines out of this list.
  { term: 'cocaine', pattern: /\bcocaine\b/i },
  { term: 'crack cocaine', pattern: /\bcrack\s+cocaine\b/i },
  { term: 'heroin', pattern: /\bheroin\b/i },
  { term: 'weed', pattern: /\bweed\b/i },
  { term: 'marijuana', pattern: /\bmarijuana\b/i },
  { term: 'cannabis', pattern: /\bcannabis\b/i },
  { term: 'meth', pattern: /\bmeth(?:amphetamine)?\b/i },
  { term: 'crystal meth', pattern: /\bcrystal\s+meth\b/i },
  { term: 'mdma', pattern: /\bmdma\b/i },
  { term: 'molly', pattern: /\bmolly\b/i },
  { term: 'ecstasy', pattern: /\becstasy\b/i },
  { term: 'tramadol', pattern: /\btramadol\b/i },
  { term: 'codeine', pattern: /\bcodeine\b/i },
  { term: 'fentanyl', pattern: /\bfentanyl\b/i },
  { term: 'ketamine', pattern: /\bketamine\b/i },
  { term: 'lsd', pattern: /\blsd\b/i },
  { term: 'xanax', pattern: /\bxanax\b/i },
  { term: 'oxycontin', pattern: /\boxycontin\b/i },
  { term: 'percocet', pattern: /\bpercocet\b/i },
  { term: 'rohypnol', pattern: /\brohypnol\b/i },
  { term: 'rivotril', pattern: /\brivotril\b/i },
  { term: 'valium', pattern: /\bvalium\b/i },
  { term: 'diazepam', pattern: /\bdiazepam\b/i },
  { term: 'morphine', pattern: /\bmorphine\b/i },
  { term: 'oxycodone', pattern: /\boxycodone\b/i },
  { term: 'hydrocodone', pattern: /\bhydrocodone\b/i },
  { term: 'crystal meth', pattern: /\bcrystal\s+(?:meth|ice)\b/i },
  { term: 'shrooms', pattern: /\b(?:shrooms|magic\s+mushrooms)\b/i },
  { term: 'ganja', pattern: /\bganja\b/i },
  { term: 'gbana', pattern: /\bgbana\b/i },
  { term: 'mkpuru mmiri', pattern: /\bmkpuru\s+mmiri\b/i },
  { term: 'igbo weed', pattern: /\bigbo\s+(?:weed|smoke|drug|for\s+sale|loud|kush)\b/i },
  { term: 'smoke igbo', pattern: /\b(?:smoke|smoking|selling|sell|buy|buying)\s+igbo\b/i },
  { term: 'skushi', pattern: /\bskushi\b/i },
  { term: 'monkey tail', pattern: /\bmonkey\s+tail\b/i },
  { term: 'kush', pattern: /\bkush\b/i },
  { term: 'skunk', pattern: /\bskunk\b/i },
  { term: 'colorado', pattern: /\bcolorado\b/i },
  { term: 'loud', pattern: /\bloud\b/i },
  { term: 'lean', pattern: /\blean\b/i },
  { term: 'purple drank', pattern: /\bpurple\s+drank\b/i },
  { term: 'narcotic', pattern: /\bnarcotic(?:s)?\b/i },
  { term: 'drug plug', pattern: /\b(?:drug\s+plug|plug\s+for\s+(?:weed|coke|cocaine|loud|kush|tramadol|codeine))\b/i },
  { term: 'hard drugs', pattern: /\bhard\s+drugs?\b/i },
  { term: 'illegal pills', pattern: /\b(?:illegal|party|street)\s+(?:pills|tabs|tablets)\b/i },
  { term: 'sex pills', pattern: /\b(?:sex|performance)\s+(?:pills|drug|enhancer)\b/i },
  { term: 'abortion pills', pattern: /\b(?:abortion\s+pills?|cytotec|misoprostol)\b/i },
  // Explicit sexual content and services.
  { term: 'nude', pattern: /\bnude(?:s)?\b/i },
  { term: 'naked', pattern: /\bnaked\b/i },
  { term: 'nsfw', pattern: /\bnsfw\b/i },
  { term: 'xxx', pattern: /\bxxx\b/i },
  { term: 'porn', pattern: /\bporn(?:ography)?\b/i },
  { term: 'escort', pattern: /\bescort(?:s|ing)?\b/i },
  { term: 'prostitut', pattern: /\bprostitut\w*\b/i },
  { term: 'olosho', pattern: /\bolosho\b/i },
  { term: 'ashawo', pattern: /\bashawo\b/i },
  { term: 'ashewo', pattern: /\bashewo\b/i },
  { term: 'asewo', pattern: /\basewo\b/i },
  { term: 'akuna', pattern: /\bakuna\b/i },
  { term: 'call girl', pattern: /\bcall\s+girls?\b/i },
  { term: 'runs girl', pattern: /\bruns\s+(?:girl|girls|babe|babes)\b/i },
  { term: 'runs service', pattern: /\bruns\s+(?:service|services|plug|package|connect)\b/i },
  { term: 'hookup babe', pattern: /\bhook\s*up\s+(?:babe|babes|girl|girls|service|services|plug|connect)\b/i },
  { term: 'pay and knack', pattern: /\b(?:pay\s+(?:and|to)\s+knack|knack\s+for\s+(?:pay|money|cash))\b/i },
  { term: 'short time sex', pattern: /\bshort\s+time\s+(?:girl|babe|sex|service|services|runs)\b/i },
  { term: 'blue film', pattern: /\bblue\s*film(?:s)?\b/i },
  { term: 'onlyfans', pattern: /\bonly\s*fans\b/i },
  { term: 'sex tape', pattern: /\bsex\s+tape\b/i },
  { term: 'hookup service', pattern: /\bhook\s*up\s+service\b/i },
  { term: 'pay for sex', pattern: /\b(?:pay|paid)\s+(?:for\s+)?sex\b/i },
  { term: 'adult content', pattern: /\badult\s+(?:content|video|videos|pics|pictures|photos)\b/i },
  { term: 'explicit content', pattern: /\bexplicit\s+(?:content|video|videos|pics|pictures|photos)\b/i },
  // Weapons and explosives. "knife" is intentionally excluded to avoid cooking-knife false positives.
  { term: 'gun', pattern: /\bguns?\b/i },
  { term: 'pistol', pattern: /\bpistol(?:s)?\b/i },
  { term: 'rifle', pattern: /\brifle(?:s)?\b/i },
  { term: 'firearm', pattern: /\bfirearm(?:s)?\b/i },
  { term: 'shotgun', pattern: /\bshotgun(?:s)?\b/i },
  { term: 'ak47', pattern: /\bak\s*-?\s*47\b/i },
  { term: 'revolver', pattern: /\brevolver(?:s)?\b/i },
  { term: 'air gun', pattern: /\bair\s*(?:gun|rifle|pistol)\b/i },
  { term: 'taser', pattern: /\btaser(?:s)?\b/i },
  { term: 'ammo', pattern: /\bammo\b/i },
  { term: 'ammunition', pattern: /\bammunition\b/i },
  { term: 'bullets', pattern: /\bbullets?\b/i },
  { term: 'explosive', pattern: /\bexplosive(?:s)?\b/i },
  { term: 'bomb', pattern: /\bbombs?\b/i },
  { term: 'grenade', pattern: /\bgrenade(?:s)?\b/i },
  { term: 'weapon for sale', pattern: /\b(?:weapon|weapons|cutlass|machete|dagger|sword)\s+(?:for\s+sale|on\s+sale)\b/i },
  // Trafficking, fraud, and clearly illegal goods.
  { term: 'trafficking', pattern: /\btraffick\w*\b/i },
  { term: 'smuggl', pattern: /\bsmuggl\w*\b/i },
  { term: 'kidnap', pattern: /\bkidnap\w*\b/i },
  { term: 'ransom', pattern: /\bransom\b/i },
  { term: 'slave', pattern: /\bslave(?:s|ry)?\b/i },
  { term: 'baby for sale', pattern: /\b(?:baby|newborn|infant|child|kid|toddler|person|human)\s+(?:for\s+sale|on\s+sale)\b/i },
  { term: 'sell baby', pattern: /\b(?:sell|selling|sold)\s+(?:my\s+|a\s+|the\s+)?(?:baby|newborn|infant|child|kid|toddler|person|human)\b/i },
  { term: 'buy baby', pattern: /\bbuy(?:ing)?\s+(?:a\s+|the\s+)?(?:baby|newborn|infant|child|kid|toddler|person|human)\b/i },
  { term: 'adoption for sale', pattern: /\badoption\s+(?:for\s+sale|on\s+sale)\b/i },
  { term: 'human sale', pattern: /\b(?:human|person|child|baby)\s+(?:sale|trade|traffick\w*)\b/i },
  { term: 'domestic worker sale', pattern: /\b(?:house\s*help|house\s*girl|maid|servant)\s+(?:for\s+sale|on\s+sale|sale)\b/i },
  { term: 'sell domestic worker', pattern: /\b(?:sell|selling|buy|buying)\s+(?:a\s+|the\s+)?(?:house\s*help|house\s*girl|maid|servant)\b/i },
  { term: 'organ sale', pattern: /\b(?:kidney|liver|heart|organ|blood)\s+(?:for\s+sale|sale|donor\s+for\s+cash)\b/i },
  { term: 'sell organ', pattern: /\b(?:sell|selling|buy|buying)\s+(?:my\s+|a\s+|the\s+)?(?:kidney|liver|heart|organ|blood)\b/i },
  { term: 'fake id', pattern: /\bfake\s+id\b/i },
  { term: 'fake document', pattern: /\bfake\s+(?:passport|certificate|cert|license|licence|transcript|result|waec|neco|jamb|matric|nin|bvn|document|receipt)\b/i },
  { term: 'counterfeit', pattern: /\bcounterfeit\b/i },
  { term: 'fake money', pattern: /\bfake\s+(?:money|cash|naira|dollars?|currency|notes?)\b/i },
  { term: 'counterfeit money', pattern: /\bcounterfeit\s+(?:money|cash|naira|dollars?|currency|notes?)\b/i },
  { term: 'forged document', pattern: /\bforg(?:ed|ery)\s+(?:document|certificate|id|passport)\b/i },
  { term: 'stolen card', pattern: /\bstolen\s+(?:card|atm|credit\s+card|debit\s+card)\b/i },
  { term: 'stolen device', pattern: /\bstolen\s+(?:phone|iphone|laptop|ipad|device|goods|item)\b/i },
  { term: 'hacked account', pattern: /\bhacked\s+(?:account|wallet|bank)\b/i },
  { term: 'bank account sale', pattern: /\b(?:bank|opay|palmpay|kuda)\s+account\s+(?:for\s+sale|sale)\b/i },
  { term: 'social account sale', pattern: /\b(?:instagram|facebook|tiktok|twitter|x|snapchat|whatsapp|telegram)\s+account\s+(?:for\s+sale|sale)\b/i },
  { term: 'sim card sale', pattern: /\b(?:registered\s+)?sim\s+card\s+(?:for\s+sale|sale)\b/i },
  { term: 'otp sale', pattern: /\b(?:otp|verification\s+code)\s+(?:for\s+sale|sale)\b/i },
  { term: 'hacking tool', pattern: /\b(?:hacking|phishing|carding|cracking)\s+(?:tool|tools|software|service|tutorial)\b/i },
  { term: 'yahoo plus', pattern: /\byahoo\s+(?:plus|format|formats|client|clients|update|updates)\b/i },
  { term: 'wire wire', pattern: /\bwire\s+wire\b/i },
  { term: 'bank log', pattern: /\bbank\s+log(?:s|in|ins)?\b/i },
  { term: 'card details sale', pattern: /\b(?:cvv|fullz|dumps|credit\s+card\s+details|debit\s+card\s+details)\s+(?:for\s+sale|sale|available)\b/i },
  { term: 'exam malpractice', pattern: /\b(?:waec|neco|jamb|post\s*utme|exam)\s+(?:expo|runs|answers?|questions?)\s+(?:for\s+sale|available|plug)?\b/i },
  { term: 'scam format', pattern: /\b(?:scam|yahoo)\s+(?:format|formats|tutorial|client|clients)\b/i },
  { term: 'bet slip sale', pattern: /\bfixed\s+(?:match|matches|game|games|bet|bets)\b/i },
]

const NORMALIZED_BANNED_TERMS = [
  'cocaine',
  'crackcocaine',
  'heroin',
  'marijuana',
  'cannabis',
  'weed',
  'methamphetamine',
  'crystalmeth',
  'mdma',
  'ecstasy',
  'tramadol',
  'codeine',
  'fentanyl',
  'ketamine',
  'xanax',
  'oxycontin',
  'percocet',
  'rohypnol',
  'rivotril',
  'valium',
  'diazepam',
  'morphine',
  'oxycodone',
  'hydrocodone',
  'ganja',
  'gbana',
  'skushi',
  'monkeytail',
  'kush',
  'skunk',
  'colorado',
  'purpledrank',
  'narcotic',
]

const NORMALIZED_BANNED_PATTERNS: Array<{ term: string; pattern: RegExp }> = [
  // Catches evasions like "ko-kayn", "co kayn", "co-kayne", "c0caine".
  { term: 'cocaine', pattern: /(?:c|k)(?:o|0)(?:c|k)(?:a|@)?(?:i|1|y)?(?:n|m)e?/ },
  { term: 'cocaine', pattern: /(?:c|k)(?:o|0)(?:k)(?:a|@)(?:y|i|1)(?:n|m)e?/ },
  { term: 'crack cocaine', pattern: /cr(?:a|@)ck(?:c|k)(?:o|0)(?:c|k)/ },
  { term: 'marijuana', pattern: /m(?:a|@)riju(?:a|@)n(?:a|@)/ },
  { term: 'cannabis', pattern: /c(?:a|@)nn(?:a|@)bis/ },
  { term: 'meth', pattern: /cryst(?:a|@)lmeth|meth(?:a|@)mphet(?:a|@)mine/ },
  { term: 'tramadol', pattern: /tr(?:a|@)m(?:a|@)dol/ },
  { term: 'codeine', pattern: /c(?:o|0)de(?:i|1)ne/ },
  { term: 'fentanyl', pattern: /fent(?:a|@)nyl/ },
]

function normalizeModerationText(value: unknown) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[áàâäãå]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[$]/g, 's')
    .replace(/[!|]/g, 'i')
    .replace(/[@]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[5]/g, 's')
    .replace(/[7]/g, 't')
}

function collectModerationParts(...values: unknown[]): string[] {
  const parts: string[] = []
  const visit = (value: unknown) => {
    if (value === undefined || value === null) return
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(String(value))
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(visit)
    }
  }
  values.forEach(visit)
  return parts
}

function findBannedKeyword(...values: unknown[]) {
  const combined = collectModerationParts(...values).join(' ')
  const rawMatch = BANNED_KEYWORD_PATTERNS.find(({ pattern }) => pattern.test(combined))?.term
  if (rawMatch) return rawMatch

  const normalized = normalizeModerationText(combined)
  const compact = normalized.replace(/[^a-z0-9]/g, '')
  const collapsed = compact.replace(/(.)\1{2,}/g, '$1')

  const normalizedTerm = NORMALIZED_BANNED_TERMS.find((term) => compact.includes(term) || collapsed.includes(term))
  if (normalizedTerm) return normalizedTerm

  return NORMALIZED_BANNED_PATTERNS.find(({ pattern }) => pattern.test(compact) || pattern.test(collapsed))?.term || null
}

function normalizeLearnedKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function resolveCategoryKey(input: string) {
  const value = input?.trim()
  if (!value) return ''

  if (CATEGORY_TREE[value]) return value
  const normalized = value.toLowerCase()
  const match = Object.entries(CATEGORY_TREE).find(([key, category]) => {
    return key.toLowerCase() === normalized || category.label.toLowerCase() === normalized
  })
  return match?.[0] || ''
}

function resolveSubcategoryKey(categoryKey: string, input: string) {
  const value = input?.trim()
  if (!categoryKey || !value) return ''

  const category = CATEGORY_TREE[categoryKey]
  if (!category?.subcategories) return ''

  if (category.subcategories[value]) return value
  const normalized = value.toLowerCase()
  const match = Object.entries(category.subcategories).find(([key, subcategory]) => {
    return key.toLowerCase() === normalized || subcategory.label.toLowerCase() === normalized
  })
  return match?.[0] || ''
}

function isSafePromotableKey(key: string) {
  if (!key || key.length > 30) return false
  if (!/^[a-z][a-z0-9_]*$/.test(key)) return false
  const blocked = ['description', 'note', 'details', 'comment', 'message']
  return !blocked.includes(key)
}

function parseMultiValueParams(searchParams: URLSearchParams): Record<string, string[]> {
  const filters: Record<string, string[]> = {}

  const rawAttributes = searchParams.get('attributes')
  if (rawAttributes) {
    try {
      const parsed = JSON.parse(rawAttributes)
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed)) {
          const normalized = normalizeAttributeValue(value)
          if (normalized === null) continue
          const arr = Array.isArray(normalized) ? normalized : [String(normalized)]
          filters[key] = [...new Set(arr.map((item) => String(item).trim()).filter(Boolean))]
        }
      }
    } catch {
      // ignore malformed JSON
    }
  }

  for (const [key, value] of searchParams.entries()) {
    const cleanKey = key.endsWith('[]') ? key.slice(0, -2) : key
    if ([
      'category', 'categoryKey', 'subcategory', 'subcategoryKey', 'hostel', 'search', 'q',
      'minPrice', 'maxPrice', 'minRating', 'sort', 'sortBy', 'page', 'limit', 'attributes',
      'sellerId', 'inStock', 'delivery', 'fastDelivery', 'priceDisplay'
    ].includes(cleanKey)) continue
    if (!value?.trim()) continue
    filters[cleanKey] = [...new Set([...(filters[cleanKey] || []), ...value.split(',').map((item) => item.trim()).filter(Boolean)])]
  }

  return filters
}

function buildSearchTextCondition(queryText: string) {
  const normalized = queryText.trim()
  if (!normalized) return []
  const tokens = normalized.substring(0, 120).split(/\s+/).filter(Boolean)
  return tokens.map((token) => ({
    OR: [
      { name: { contains: token, mode: 'insensitive' } },
      { description: { contains: token, mode: 'insensitive' } },
      { category: { contains: token, mode: 'insensitive' } },
      { subcategory: { contains: token, mode: 'insensitive' } },
      { seller: { name: { contains: token, mode: 'insensitive' } } },
    ],
  }))
}

function buildAttributeKeyClause(key: string, values: string[]) {
  const orClauses = values.flatMap((value) => ([
    {
      attributeValues: {
        some: {
          key,
          OR: [
            { value: { equals: value } },
            { value: { array_contains: [value] } },
          ],
        },
      },
    },
    {
      variants: {
        some: {
          combination: {
            path: [key],
            equals: value,
          },
        },
      },
    },
  ]))

  return { OR: orClauses }
}

// Delivery estimates are free text ("3 days", "48 hours after orders are made", "1 week", …) —
// matching against fixed substrings like "fast"/"today"/"24" almost never hits real data.
// Parse the actual duration instead: <=2 days (or <=48 hours) counts as fast.
function isFastDelivery(estimate: string | null | undefined): boolean {
  if (!estimate) return false
  const text = estimate.toLowerCase()
  if (/\b(week|month)/.test(text)) return false
  if (/\b(today|same[\s-]?day|instant|immediately)\b/.test(text)) return true
  const hourMatch = text.match(/(\d+)\s*hour/)
  if (hourMatch) return parseInt(hourMatch[1], 10) <= 48
  const dayMatch = text.match(/(\d+)\s*day/)
  if (dayMatch) return parseInt(dayMatch[1], 10) <= 2
  const bareNumber = text.match(/^(\d+)$/)
  if (bareNumber) return parseInt(bareNumber[1], 10) <= 2
  return false
}

function enrichProductCategoryMeta(product: any) {
  const { category, subcategory } = getCategoryDisplayInfo(
    product?.categoryKey,
    product?.subcategoryKey,
    product?.category,
    product?.subcategory,
  )

  return {
    ...product,
    category: category || product?.category || '',
    subcategory: subcategory || product?.subcategory || null,
  }
}

function scoreProduct(product: any, query: string): number {
  const q = normalizeText(query)
  if (!q) return 0

  let score = 0
  const name = normalizeText(product.name || '')
  const desc = normalizeText(product.description || '')
  const cat = normalizeText(product.category || '')
  const seller = normalizeText(product.seller?.name || '')

  if (name === q) score += 100
  else if (name.startsWith(q)) score += 80
  else if (name.includes(q)) score += 60

  const qTokens = q.split(' ').filter(Boolean)
  const nameTokens = new Set(name.split(' ').filter(Boolean))
  const overlap = qTokens.filter((token) => nameTokens.has(token)).length
  if (qTokens.length > 0) score += (overlap / qTokens.length) * 40

  if (desc.includes(q)) score += 20
  if (cat.includes(q)) score += 15
  if (seller.includes(q)) score += 12

  score += Math.min(product._count?.orders || 0, 50) * 0.5
  score += Math.min(product.viewCount || 0, 1000) * 0.05

  const ageDays = (Date.now() - new Date(product.createdAt).getTime()) / 86400000
  score += Math.max(0, 10 - ageDays * 0.1)

  if (product.isHot) score += 12
  if (product.isDeal) score += 8
  if (product.isNew) score += 6

  return score
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.universityId) {
      return NextResponse.json({ error: 'No university associated with your account.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const requestedCategoryKey = searchParams.get('categoryKey') || searchParams.get('category') || ''
    const requestedSubcategoryKey = searchParams.get('subcategoryKey') || searchParams.get('sub') || ''
    const categoryKey = resolveCategoryKey(requestedCategoryKey)
    const subcategoryKey = resolveSubcategoryKey(categoryKey, requestedSubcategoryKey)
    const sellerId = searchParams.get('sellerId') || ''
    const hostel = searchParams.get('hostel') || ''
    const q = (searchParams.get('q') || searchParams.get('search') || '').trim()
    const sortBy = (searchParams.get('sortBy') || searchParams.get('sort') || 'relevance').toLowerCase()
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const minRating = parseFloat(searchParams.get('minRating') || searchParams.get('rating') || '0') || 0
    const inStock = (searchParams.get('inStock') || '').toLowerCase() === 'true'
    const deliveryFast = (searchParams.get('delivery') || '').toLowerCase() === 'fast'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE))
    const skip = (page - 1) * limit

    const selectedFilters = parseMultiValueParams(searchParams)
    const attributeFilters = buildAttributeFiltersFromQuery(searchParams)
    const queryText = q

    const where: any = {
      isActive: true,
      isDeleted: false,
      moderationStatus: 'APPROVED',
      universityId: user.universityId,
    }

    if (inStock) where.quantity = { gt: 0 }
    if (sellerId) where.sellerId = sellerId
    if (categoryKey && categoryKey !== 'all') {
      const categoryValues = getCategoryQueryValues(requestedCategoryKey || CATEGORY_TREE[categoryKey]?.label || '')
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { categoryKey: categoryKey },
            ...(categoryValues.length > 0 ? categoryValues.map((value) => ({ category: { equals: value } })) : []),
          ],
        },
      ]
    }
    if (subcategoryKey) {
      const subcategoryLabel = requestedSubcategoryKey || CATEGORY_TREE[categoryKey]?.subcategories?.[subcategoryKey]?.label || ''
      const subcategoryValues = [subcategoryKey, subcategoryLabel].filter(Boolean)
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { subcategoryKey: subcategoryKey },
            ...(subcategoryValues.length > 0 ? subcategoryValues.map((value) => ({ subcategory: { equals: value } })) : []),
          ],
        },
      ]
    }
    if (hostel && hostel !== 'All') where.hostelName = { contains: hostel, mode: 'insensitive' }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    if (minRating > 0) {
      where.OR = [
        { avgRating: { gte: minRating } },
        { seller: { avgRating: { gte: minRating } } },
      ]
    }

    const searchClauses = buildSearchTextCondition(queryText)
    if (searchClauses.length > 0) {
      where.AND = [...(where.AND || []), ...searchClauses]
    }

    const allFilters = { ...attributeFilters, ...selectedFilters }
    for (const [key, rawValue] of Object.entries(allFilters)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue].filter(Boolean)
      if (values.length === 0) continue
      where.AND = where.AND || []
      where.AND.push(buildAttributeKeyClause(key, values.map((value) => String(value))))
    }

    let orderBy: any = { createdAt: 'desc' }
    if (sortBy === 'newest') orderBy = { createdAt: 'desc' }
    else if (sortBy === 'price_asc' || sortBy === 'priceLow') orderBy = { price: 'asc' }
    else if (sortBy === 'price_desc' || sortBy === 'priceHigh') orderBy = { price: 'desc' }
    else if (sortBy === 'rating') orderBy = [{ avgRating: 'desc' }, { totalReviews: 'desc' }, { createdAt: 'desc' }]
    else if (sortBy === 'popular') orderBy = [{ viewCount: 'desc' }, { createdAt: 'desc' }]

    const productInclude = {
      seller: {
        select: {
          id: true,
          name: true,
          avgRating: true,
          trustLevel: true,
          completedOrders: true,
        },
      },
      variants: true,
      attributeValues: true,
      _count: {
        select: { orders: true },
      },
    }

    let products: any[]
    let total: number

    if (deliveryFast) {
      // "Fast" depends on parsing free-text delivery estimates ("3 days", "48 hours…"),
      // which Prisma can't filter at the DB level — fetch all matches and paginate in JS.
      const allMatches = await prisma.product.findMany({ where, include: productInclude, orderBy, take: 1000 })
      const filtered = allMatches.filter((p) => isFastDelivery(p.deliveryEstimate))
      total = filtered.length
      products = filtered.slice(skip, skip + limit)
    } else {
      const [pageProducts, count] = await Promise.all([
        prisma.product.findMany({
          where,
          include: productInclude,
          orderBy,
          take: limit,
          skip,
        }),
        prisma.product.count({ where }),
      ])
      products = pageProducts
      total = count
    }

    const enrichedProducts = products.map(enrichProductCategoryMeta)
    const ranked = [...enrichedProducts]
    if (sortBy === 'relevance' && queryText) {
      ranked.sort((a, b) => scoreProduct(b, queryText) - scoreProduct(a, queryText))
    } else if (sortBy === 'popular') {
      ranked.sort((a, b) => (b._count?.orders || 0) - (a._count?.orders || 0) || (b.viewCount || 0) - (a.viewCount || 0))
    } else if (sortBy === 'rating') {
      ranked.sort((a, b) => (b.avgRating || b.seller?.avgRating || 0) - (a.avgRating || a.seller?.avgRating || 0))
    }

    if (queryText) {
      const searchLogClient = (prisma as any).searchLog
      if (searchLogClient?.create) {
        searchLogClient.create({
          data: {
            userId: user.id,
            universityId: user.universityId,
            query: queryText,
            category: categoryKey || subcategoryKey || null,
            resultCount: ranked.length,
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      products: ranked,
      count: ranked.length,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasMore: skip + ranked.length < total,
    })
  } catch (error) {
    console.error('Fetch products error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!user.universityId) {
      return NextResponse.json(
        { error: 'No university associated with your account.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      description,
      price,
      category,
      categoryKey,
      subcategory,
      subcategoryKey,
      quantity,
      images,
      variants,
      attributes,
      hostelName,
      roomNumber,
      landmark,
      productDeliveryAgreement,
      estimatedWeightKg,
      dimensionsCm,
      deliveryEstimate,
    } = body

    if (!name || !price || !category || !quantity) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const matchedBannedTerm = findBannedKeyword(
      name,
      description,
      category,
      subcategory,
      categoryKey,
      subcategoryKey,
      attributes,
      variants,
      deliveryEstimate
    )
    if (matchedBannedTerm) {
      console.warn('Prohibited listing keyword rejected', {
        userId: user.id,
        matchedTerm: matchedBannedTerm,
      })
      return NextResponse.json({ error: PROHIBITED_LISTING_MESSAGE }, { status: 422 })
    }

    if (productDeliveryAgreement !== true) {
      return NextResponse.json({ error: 'You must confirm motorcycle delivery suitability before listing.' }, { status: 400 })
    }

    if (typeof price !== 'number' || price <= 0 || price > MAX_LISTING_PRICE) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LISTING_STOCK) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
    }

    const normalizedVariants = Array.isArray(variants)
      ? variants
          .map((v: any) => ({
            combination: v?.combination && typeof v.combination === 'object' ? v.combination : null,
            price: Number(v?.price),
            stock: Number(v?.stock),
            sku: v?.sku ? String(v.sku) : null,
            imageUrl: v?.imageUrl ? String(v.imageUrl) : null,
          }))
          .filter((v: any) => (
            v.combination &&
            Number.isFinite(v.price) &&
            v.price > 0 &&
            v.price <= MAX_LISTING_PRICE &&
            Number.isInteger(v.stock) &&
            v.stock >= 0 &&
            v.stock <= MAX_LISTING_STOCK
          ))
      : []
    if (Array.isArray(variants) && variants.length > 0 && normalizedVariants.length !== variants.length) {
      return NextResponse.json({ error: `Each variant needs a valid price and stock up to ${MAX_LISTING_STOCK}` }, { status: 400 })
    }

    const hasStructuredVariants = normalizedVariants.length > 0
    const normalizedAttributes = Array.isArray(attributes)
      ? attributes
          .map((a: any) => {
            const key = String(a?.key || '').trim()
            const label = String(a?.label || key).trim()
            const value = normalizeAttributeValue(a?.value)
            if (!key || !label || value === null) return null
            return {
              key,
              label,
              value,
              searchable: a?.searchable !== false,
              filterable: a?.filterable !== false,
            }
          })
          .filter(Boolean) as Array<{
            key: string
            label: string
            value: string | number | boolean | string[]
            searchable: boolean
            filterable: boolean
          }>
      : []
    const basePrice = Number(price)
    const minVariantPrice = hasStructuredVariants
      ? Math.min(...normalizedVariants.map((v: any) => v.price))
      : basePrice
    const totalVariantStock = hasStructuredVariants
      ? normalizedVariants.reduce((sum: number, v: any) => sum + v.stock, 0)
      : Number(quantity)
    if (!Number.isInteger(totalVariantStock) || totalVariantStock < 1 || totalVariantStock > MAX_LISTING_STOCK) {
      return NextResponse.json({ error: `Stock cannot exceed ${MAX_LISTING_STOCK}` }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name:        String(name).trim().substring(0, 200),
        description: description ? String(description).trim().substring(0, 5000) : '',
        price:       minVariantPrice,
        basePrice,
        category:    String(category),
        ...(categoryKey ? { categoryKey: String(categoryKey) } : {}),
        ...(subcategory ? { subcategory: String(subcategory) } : {}),
        ...(subcategoryKey ? { subcategoryKey: String(subcategoryKey) } : {}),
        productDeliveryAgreement: true,
        ...(typeof estimatedWeightKg === 'number' && estimatedWeightKg > 0 ? { estimatedWeightKg } : {}),
        ...(dimensionsCm && typeof dimensionsCm === 'object' ? { dimensionsCm } : {}),
        ...(deliveryEstimate ? { deliveryEstimate: String(deliveryEstimate).trim().substring(0, 80) } : {}),
        variantsEnabled: hasStructuredVariants,
        quantity:    totalVariantStock,
        images:      Array.isArray(images) ? images : [],
        // â”€â”€ Product review system: start in PENDING status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        moderationStatus: 'PENDING',
        isActive:     false, // Not visible in marketplace until approved
        seller:      { connect: { id: user.id } },
        hostelName:  hostelName ? String(hostelName).trim() : (user.hostelName || ''),
        roomNumber:  roomNumber  ? String(roomNumber).trim()  : (user.roomNumber  || ''),
        landmark:    landmark    ? String(landmark).trim()    : (user.landmark    || ''),
        university:  { connect: { id: user.universityId } },
        ...(hasStructuredVariants
          ? {
              variants: {
                create: normalizedVariants.map((v: any) => ({
                  combination: v.combination,
                  price: v.price,
                  stock: v.stock,
                  ...(v.sku ? { sku: v.sku } : {}),
                  ...(v.imageUrl ? { imageUrl: v.imageUrl } : {}),
                })),
              },
            }
          : {}),
        ...(normalizedAttributes.length > 0
          ? {
              attributeValues: {
                create: normalizedAttributes.map((a) => ({
                  key: a.key,
                  label: a.label,
                  value: a.value as any,
                  searchable: a.searchable,
                  filterable: a.filterable,
                })),
              },
            }
          : {}),
      },
      include: { variants: true, attributeValues: true },
    })

    const learnCategoryKey = categoryKey ? String(categoryKey) : null
    const learnSubcategoryKey = subcategoryKey ? String(subcategoryKey) : null

    if (normalizedAttributes.length > 0 && learnCategoryKey) {
      for (const attr of normalizedAttributes) {
        const normalizedKey = normalizeLearnedKey(attr.key)
        if (!normalizedKey) continue

        const existingCategoryAttribute = await prisma.categoryAttribute.findFirst({
          where: {
            categoryKey: learnCategoryKey,
            key: normalizedKey,
            OR: [{ subcategoryKey: learnSubcategoryKey }, { subcategoryKey: null }],
          },
          select: { id: true },
        })

        if (!existingCategoryAttribute) {
          const suggestion = await prisma.attributeSuggestion.upsert({
            where: {
              categoryKey_subcategoryKey_key: {
                categoryKey: learnCategoryKey,
                subcategoryKey: learnSubcategoryKey,
                key: normalizedKey,
              },
            },
            update: {
              occurrences: { increment: 1 },
              label: attr.label || normalizedKey,
            },
            create: {
              categoryKey: learnCategoryKey,
              subcategoryKey: learnSubcategoryKey,
              key: normalizedKey,
              label: attr.label || normalizedKey,
              occurrences: 1,
            },
          })

          if (suggestion.occurrences >= AUTO_PROMOTE_THRESHOLD && isSafePromotableKey(normalizedKey)) {
            const alreadyPromoted = await prisma.categoryAttribute.findFirst({
              where: {
                categoryKey: learnCategoryKey,
                subcategoryKey: learnSubcategoryKey,
                key: normalizedKey,
              },
              select: { id: true },
            })

            if (!alreadyPromoted) {
              await prisma.categoryAttribute.create({
                data: {
                  categoryKey: learnCategoryKey,
                  subcategoryKey: learnSubcategoryKey,
                  key: normalizedKey,
                  label: suggestion.label || attr.label || normalizedKey,
                  type: typeof attr.value === 'number' ? 'number' : typeof attr.value === 'boolean' ? 'boolean' : Array.isArray(attr.value) ? 'multi_select' : 'text',
                  required: false,
                  filterable: true,
                  searchable: true,
                  sortOrder: 999,
                },
              })
              await prisma.attributeSuggestion.update({
                where: { id: suggestion.id },
                data: { autoPromoted: true, approved: true },
              })
            }
          }
        }

        const values = Array.isArray(attr.value) ? attr.value : [attr.value]
        for (const rawValue of values) {
          const value = String(rawValue).trim()
          if (!value || value.length > 100) continue
          await prisma.attributeValueStats.upsert({
            where: {
                categoryKey_key_value: {
                categoryKey: learnCategoryKey,
                key: normalizedKey,
                value,
              },
            },
            update: { count: { increment: 1 } },
            create: {
              categoryKey: learnCategoryKey,
              key: normalizedKey,
              value,
              count: 1,
            },
          })
        }
      }
    }

    return NextResponse.json({ success: true, product }, { status: 201 })
  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}



