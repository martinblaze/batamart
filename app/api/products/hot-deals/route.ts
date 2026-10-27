export const dynamic = 'force-dynamic'
// app/api/products/hot-deals/route.ts
// Every live listing flagged hot (a real deal, or lots of views). The feed only
// carries the newest 100 listings, so a hot item that isn't new never reached
// the deals page. This asks for hot items directly.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!user.universityId) return NextResponse.json({ error: 'No university on account' }, { status: 403 })

    const products = await prisma.product.findMany({
      where: {
        isHot: true,
        isActive: true,
        isDeleted: false,
        quantity: { gt: 0 },
        moderationStatus: 'APPROVED',
        universityId: user.universityId,
      },
      select: {
        id: true, name: true, price: true, basePrice: true, category: true, subcategory: true,
        categoryKey: true, sellerId: true, quantity: true, images: true, landmark: true,
        viewCount: true, createdAt: true, isHot: true, hotReason: true, hotScore: true,
        isDeal: true, discountPercent: true, marketPrice: true, deliveryEstimate: true,
        variantsEnabled: true,
        seller: { select: { id: true, name: true, profilePhoto: true, avgRating: true, trustLevel: true, completedOrders: true } },
      },
      orderBy: [{ hotScore: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    })

    return NextResponse.json({ success: true, products })
  } catch (error) {
    console.error('hot-deals error:', error)
    return NextResponse.json({ error: 'Failed to load deals' }, { status: 500 })
  }
}
