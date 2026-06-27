import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const productId = String(body?.productId || '').trim()
    const quantity = Math.max(1, parseInt(String(body?.quantity || '1'), 10) || 1)
    const variantId = body?.variantId ? String(body.variantId) : null

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        isDeleted: false,
        isActive: true,
        quantity: { gt: 0 },
        ...(user.universityId ? { universityId: user.universityId } : {}),
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            trustLevel: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      item: {
        productId: product.id,
        variantId,
        quantity,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || '',
        sellerId: product.sellerId,
        sellerName: product.seller.name,
        maxQuantity: product.quantity,
      },
    })
  } catch (error) {
    console.error('Add to cart error:', error)
    return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500 })
  }
}
