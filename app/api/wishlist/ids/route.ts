import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guard } from '@/lib/wishlist/server'
import { MAX_WISHLIST_ITEMS } from '@/lib/wishlist/logic'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const g = await guard(request, 240)
    if (g.error) return g.error
    const rows = await prisma.wishlistItem.findMany({
      where: { userId: g.user.id },
      select: { productId: true },
      take: MAX_WISHLIST_ITEMS,
    })
    return NextResponse.json({ ids: rows.map(r => r.productId) })
  } catch (error) {
    console.error('[wishlist] ids failed', error)
    return NextResponse.json({ error: 'Could not load your wishlist' }, { status: 500 })
  }
}
