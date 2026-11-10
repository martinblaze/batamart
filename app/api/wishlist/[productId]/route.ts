import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guard } from '@/lib/wishlist/server'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: { productId: string } }) {
  try {
    const g = await guard(request, 60)
    if (g.error) return g.error
    const productId = String(params.productId || '').trim()
    if (!productId) return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    await prisma.wishlistItem.deleteMany({ where: { userId: g.user.id, productId } })
    return NextResponse.json({ saved: false })
  } catch (error) {
    console.error('[wishlist] remove failed', error)
    return NextResponse.json({ error: 'Could not remove this item' }, { status: 500 })
  }
}
