export const dynamic = 'force-dynamic'
// app/api/products/[id]/edit/route.ts
// The seller's own view of a listing for the edit screen. Unlike the public
// GET, this works while the listing is paused, pending review or rejected.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const product = await prisma.product.findFirst({
    where: { id: params.id, sellerId: user.id, isDeleted: false },
    select: {
      id: true, name: true, description: true, price: true, quantity: true, images: true,
      category: true, subcategory: true, deliveryEstimate: true, variantsEnabled: true,
      isActive: true, moderationStatus: true, rejectionReason: true,
    },
  })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  return NextResponse.json({ product })
}
