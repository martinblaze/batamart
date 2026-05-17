// app/api/products/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { buildAttributeFiltersFromQuery, normalizeAttributeValue } from '@/lib/category-attributes'

const DEFAULT_PAGE_SIZE = 40
const MAX_PAGE_SIZE     = 100
const AUTO_PROMOTE_THRESHOLD = 10

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

    if (!user.universityId) {
      return NextResponse.json(
        { error: 'No university associated with your account. Please contact support.' },
        { status: 403 }
      )
    }

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
      isActive:     true,
      quantity:     { gt: 0 },
      isDeleted:    false,
      universityId: user.universityId,
    }

    if (category && category !== 'All') {
      where.category = category
    }
    if (user.isSuspended) {
      return NextResponse.json({ error: 'Your seller account is suspended and cannot create listings right now.' }, { status: 403 })
    }
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
    if (productDeliveryAgreement !== true) {
      return NextResponse.json({ error: 'You must confirm motorcycle delivery suitability before listing.' }, { status: 400 })
    }

    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
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
          .filter((v: any) => v.combination && Number.isFinite(v.price) && v.price > 0 && Number.isFinite(v.stock) && v.stock >= 0)
      : []

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
