// app/api/riders/my-deliveries/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Return all active batches this rider has accepted,
    // with their orders nested inside (ordered oldest first so
    // the rider naturally works through them in order).
    const batches = await prisma.deliveryBatch.findMany({
      where: {
        riderId: user.id,
        status:  { in: ['RIDER_ASSIGNED', 'IN_PROGRESS'] },
      },
      include: {
        buyer: {
          select: {
            name:       true,
            phone:      true,
            hostelName: true,
            roomNumber: true,
            landmark:   true,
          },
        },
        orders: {
          include: {
            product: {
              select: { name: true, images: true, hostelName: true, estimatedWeightKg: true, dimensionsCm: true, campaignTag: true },
            },
            seller: {
              select: { name: true, phone: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ batches })
  } catch (error) {
    console.error('my-deliveries error:', error)
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 })
  }
}
