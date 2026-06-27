import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sellerId: string }> }
) {
  try {
    const { sellerId } = await params

    const reviews = await prisma.review.findMany({
      where: {
        revieweeId: sellerId,
        type: 'SELLER',
      },
      include: {
        reviewer: {
          select: {
            name: true,
            profilePhoto: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    return NextResponse.json(
      reviews.map((review) => ({
        id: review.id,
        user: review.reviewer?.name || 'Buyer',
        avatar: review.reviewer?.profilePhoto || null,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        orderNumber: review.order?.orderNumber || null,
      }))
    )
  } catch (error) {
    console.error('Seller reviews fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}
