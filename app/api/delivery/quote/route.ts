// app/api/delivery/quote/route.ts
// Lightweight pre-payment delivery fee estimate for the cart/checkout pages.
// Mirrors the exact per-seller grouping + zone lookup that
// app/api/payments/initialize/route.ts (and verify/route.ts) use when
// actually charging, so the number shown here always matches what gets
// charged.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { getDeliveryFee } from '@/lib/delivery/pricing'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  cartItems: z.array(z.object({
    productId: z.string().min(1),
  })).min(1).max(50),
}).strict()

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const productIds = Array.from(new Set(parsed.data.cartItems.map(i => i.productId)))
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, sellerId: true, landmark: true },
    })
    const productById = new Map(products.map(p => [p.id, p]))

    // Group by seller (first item's landmark = that seller's pickup zone),
    // same rule createOrders uses.
    const sellerGroups: Record<string, string> = {}
    for (const item of parsed.data.cartItems) {
      const product = productById.get(item.productId)
      if (!product) continue
      if (!(product.sellerId in sellerGroups)) {
        sellerGroups[product.sellerId] = product.landmark
      }
    }

    let totalDelivery = 0
    for (const pickupLandmark of Object.values(sellerGroups)) {
      totalDelivery += await getDeliveryFee(user.universityId, pickupLandmark, user.landmark)
    }

    return NextResponse.json({ deliveryFee: totalDelivery, sellerCount: Object.keys(sellerGroups).length })
  } catch (error) {
    console.error('Delivery quote error:', error)
    return NextResponse.json({ error: 'Failed to compute delivery quote' }, { status: 500 })
  }
}
