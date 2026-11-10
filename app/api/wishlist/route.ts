import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guard, SAVEABLE_PRODUCT } from '@/lib/wishlist/server'
import { listDropInfo, MAX_WISHLIST_ITEMS } from '@/lib/wishlist/logic'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const g = await guard(request)
    if (g.error) return g.error

    const rows = await prisma.wishlistItem.findMany({
      where: { userId: g.user.id },
      orderBy: { createdAt: 'desc' },
      take: MAX_WISHLIST_ITEMS,
      select: {
        productId: true,
        createdAt: true,
        priceWhenSaved: true,
        product: {
          select: {
            id: true, name: true, price: true, marketPrice: true, discountPercent: true, isDeal: true,
            images: true, category: true, quantity: true, isActive: true, isDeleted: true,
            moderationStatus: true, seller: { select: { name: true } },
          },
        },
      },
    })

    const items = rows.map(r => {
      const p = r.product
      const live = p.isActive && !p.isDeleted && p.moderationStatus !== 'UNDER_REVIEW' && p.moderationStatus !== 'REMOVED'
      const drop = listDropInfo(r.priceWhenSaved, p.price)
      const realOff = p.marketPrice && p.marketPrice > p.price && p.price > 0 ? Math.round((1 - p.price / p.marketPrice) * 100) : 0
      const onDeal = p.isDeal && realOff >= 5
      return {
        productId: r.productId,
        savedAt: r.createdAt.toISOString(),
        priceWhenSaved: r.priceWhenSaved,
        product: {
          id: p.id,
          name: p.name,
          price: p.price,
          originalPrice: onDeal ? p.marketPrice : null,
          discountPercent: onDeal ? realOff : null,
          image: p.images?.[0] || null,
          category: p.category,
          sellerName: p.seller?.name ?? null,
          inStock: live && p.quantity > 0,
          isActive: live,
          quantity: p.quantity,
        },
        priceDropped: drop.priceDropped,
        dropPercent: drop.dropPercent,
      }
    })
    return NextResponse.json({ items })
  } catch (error) {
    console.error('[wishlist] list failed', error)
    return NextResponse.json({ error: 'Could not load your wishlist' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const g = await guard(request, 60)
    if (g.error) return g.error

    const body = await request.json().catch(() => ({}))
    const productId = String(body?.productId || '').trim()
    if (!productId) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })

    const existing = await prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId: g.user.id, productId } },
      select: { id: true },
    })
    if (existing) return NextResponse.json({ saved: true })

    const product = await prisma.product.findFirst({
      where: { id: productId, ...SAVEABLE_PRODUCT },
      select: { id: true, price: true },
    })
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    const count = await prisma.wishlistItem.count({ where: { userId: g.user.id } })
    if (count >= MAX_WISHLIST_ITEMS) {
      return NextResponse.json({ error: `Your wishlist is full (${MAX_WISHLIST_ITEMS} items). Remove something first.` }, { status: 400 })
    }

    try {
      await prisma.wishlistItem.create({
        data: { userId: g.user.id, productId: product.id, priceWhenSaved: product.price },
      })
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e // concurrent duplicate add is fine
    }
    return NextResponse.json({ saved: true })
  } catch (error) {
    console.error('[wishlist] add failed', error)
    return NextResponse.json({ error: 'Could not save this item' }, { status: 500 })
  }
}
