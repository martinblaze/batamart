// app/api/products/route.ts
export const revalidate = 30

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { buildAttributeFiltersFromQuery, normalizeAttributeValue } from '@/lib/category-attributes'
import { moderateListing } from '@/lib/moderation/moderateListing'

const DEFAULT_PAGE_SIZE = 40
const MAX_PAGE_SIZE     = 100
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

function findBannedKeyword(name: unknown, description: unknown) {
  const combined = `${String(name || '')} ${String(description || '')}`
  return BANNED_KEYWORD_PATTERNS.find(({ pattern }) => pattern.test(combined))?.term || null
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

function isSafePromotableKey(key: string) {
  if (!key || key.length > 30) return false
  if (!/^[a-z][a-z0-9_]*$/.test(key)) return false
  const blocked = ['description', 'note', 'details', 'comment', 'message']
  return !blocked.includes(key)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // It's valid for some users to not have a university set.
    // Do not block GET browsing for users without a university.

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const categoryKey = searchParams.get('categoryKey')
    const subcategoryKey = searchParams.get('subcategoryKey')
    const hostel   = searchParams.get('hostel')
    const minPrice = searchParams.get('minPrice')
    const maxPrice = searchParams.get('maxPrice')
    const search   = searchParams.get('search')
    const q        = searchParams.get('q')
    const queryText = q || search
    const sortBy = searchParams.get('sortBy') || 'relevance'

    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE)))
    )
    const skip = (page - 1) * limit

    const where: any = {
      isActive:  true,
      quantity:  { gt: 0 },
      isDeleted: false,
      // Only filter by university when the user actually has one
      ...(user.universityId ? { universityId: user.universityId } : {}),
    }

    if (category && category !== 'All') {
      where.category = category
    }
    // Removed suspended-seller check from GET: suspension should block listing (POST), not browsing (GET).
    if (categoryKey) where.categoryKey = categoryKey
    if (subcategoryKey) where.subcategoryKey = subcategoryKey

    if (hostel && hostel !== 'All') {
      where.hostelName = { contains: hostel, mode: 'insensitive' }
    }

    if (minPrice || maxPrice) {
      where.price = {}
      if (minPrice) where.price.gte = parseFloat(minPrice)
      if (maxPrice) where.price.lte = parseFloat(maxPrice)
    }

    if (queryText && queryText.trim()) {
      const tokens = queryText.trim().substring(0, 100).split(/\s+/).filter(Boolean)
      where.AND = tokens.map((token: string) => ({
        OR: [
          { name:        { contains: token, mode: 'insensitive' } },
          { category:    { contains: token, mode: 'insensitive' } },
          { categoryKey: { contains: token, mode: 'insensitive' } },
          { subcategory: { contains: token, mode: 'insensitive' } },
          { subcategoryKey: { contains: token, mode: 'insensitive' } },
          { description: { contains: token, mode: 'insensitive' } },
          {
            attributeValues: {
              some: {
                OR: [
                  { key: { contains: token, mode: 'insensitive' } },
                  { label: { contains: token, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      }))
    }

    const attributeFilters = buildAttributeFiltersFromQuery(searchParams)
    const attributeFilterEntries = Object.entries(attributeFilters)
    if (attributeFilterEntries.length > 0) {
      where.AND = where.AND || []
      for (const [key, rawFilter] of attributeFilterEntries) {
        const filterValue = normalizeAttributeValue(rawFilter)
        if (filterValue === null) continue
        if (Array.isArray(filterValue)) {
          for (const f of filterValue) {
            where.AND.push({
              attributeValues: {
                some: {
                  key,
                  OR: [
                    { value: { array_contains: [f] } },
                    { value: { equals: f } },
                  ],
                },
              },
            })
          }
          continue
        }
        where.AND.push({
          OR: [
            {
              attributeValues: {
                some: {
                  key,
                  OR: [
                    { value: { equals: filterValue } },
                    { value: { array_contains: [filterValue] } },
                  ],
                },
              },
            },
            {
              variants: {
                some: {
                  combination: {
                    path: [key],
                    equals: filterValue,
                  },
                },
              },
            },
          ],
        })
      }
    }

    let orderBy: any = { createdAt: 'desc' }
    if (sortBy === 'newest') orderBy = { createdAt: 'desc' }
    else if (sortBy === 'priceLow') orderBy = { price: 'asc' }
    else if (sortBy === 'priceHigh') orderBy = { price: 'desc' }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          seller: {
            select: {
              id:              true,
              name:            true,
              avgRating:       true,
              trustLevel:      true,
              completedOrders: true,
            },
          },
          variants: true,
          attributeValues: true,
        },
        orderBy,
        take:    limit,
        skip,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      products,
      count:   products.length,
      total,
      page,
      pages:   Math.ceil(total / limit),
      hasMore: skip + products.length < total,
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

    const matchedBannedTerm = findBannedKeyword(name, description)
    if (matchedBannedTerm) {
      console.warn('Prohibited listing keyword rejected', {
        userId: user.id,
        matchedTerm: matchedBannedTerm,
      })
      return NextResponse.json({ error: PROHIBITED_LISTING_MESSAGE }, { status: 422 })
    }

    const textModeration = await moderateListing(String(name || ''), String(description || ''))
    if (!textModeration.allowed) {
      console.warn('AI listing moderation rejected', {
        userId: user.id,
        reason: textModeration.reason,
      })
      return NextResponse.json(
        { error: textModeration.reason || PROHIBITED_LISTING_MESSAGE },
        { status: 422 }
      )
    }

    if (productDeliveryAgreement !== true) {
      return NextResponse.json({ error: 'You must confirm motorcycle delivery suitability before listing.' }, { status: 400 })
    }

    const MAX_PRICE = 10_000_000 // ₦10,000,000 limit

    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    if (price > MAX_PRICE) {
      return NextResponse.json(
        { error: `Price exceeds maximum limit of ₦${MAX_PRICE.toLocaleString()}` },
        { status: 400 }
      )
    }

    if (typeof quantity !== 'number' || quantity < 1) {
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
          .filter((v: any) => v.combination && Number.isFinite(v.price) && v.price > 0 && v.price <= MAX_PRICE && Number.isFinite(v.stock) && v.stock >= 0)
      : []

    // Validate that no variants exceed price limit
    if (Array.isArray(variants) && variants.length > 0) {
      const variantsExceedingLimit = variants.filter((v: any) => Number(v?.price) > MAX_PRICE)
      if (variantsExceedingLimit.length > 0) {
        return NextResponse.json(
          { error: `Some variants exceed maximum price limit of ₦${MAX_PRICE.toLocaleString()}` },
          { status: 400 }
        )
      }
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
