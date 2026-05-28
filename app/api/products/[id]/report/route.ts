export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const reason =
      typeof body?.reason === 'string' && body.reason.trim()
        ? body.reason.trim().substring(0, 500)
        : null

    const product = await prisma.product.findUnique({
      where: { id: params.id },
      select: { id: true, sellerId: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.sellerId === user.id) {
      return NextResponse.json({ error: 'You cannot report your own listing.' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.productReport.create({
        data: {
          userId: user.id,
          productId: product.id,
          reason,
        },
      })

      await tx.product.update({
        where: { id: product.id },
        data: {
          isFlagged: true,
          ...(reason ? { flagReason: reason } : {}),
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'You have already reported this listing.' }, { status: 409 })
    }

    console.error('Product report error:', error)
    return NextResponse.json({ error: 'Failed to report listing' }, { status: 500 })
  }
}
