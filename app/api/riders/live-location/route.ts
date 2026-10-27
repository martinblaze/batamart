import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

const TRACKABLE_STATUSES = ['RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY']

function isValidCoordinate(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const orderIds = Array.isArray(body?.orderIds) ? body.orderIds.filter(Boolean) : []
    const batchId = typeof body?.batchId === 'string' ? body.batchId : null
    const lat = Number(body?.lat)
    const lng = Number(body?.lng)
    const accuracy = body?.accuracy != null ? Number(body.accuracy) : null
    const heading = body?.heading != null ? Number(body.heading) : null
    const speed = body?.speed != null ? Number(body.speed) : null

    if (!isValidCoordinate(lat, lng)) {
      return NextResponse.json({ error: 'Invalid location coordinates' }, { status: 400 })
    }

    const where: any = {
      OR: [
        { riderId: user.id, status: { in: TRACKABLE_STATUSES } },
        { deliveryRiderId: user.id, status: 'ON_THE_WAY' },
      ],
    }

    if (orderIds.length > 0) {
      where.id = { in: orderIds }
    } else if (batchId) {
      where.batchId = batchId
    } else {
      return NextResponse.json({ error: 'orderIds or batchId is required' }, { status: 400 })
    }

    const activeOrders = await prisma.order.findMany({
      where,
      select: { id: true, batchId: true },
      take: 30,
    })

    if (activeOrders.length === 0) {
      return NextResponse.json({ success: true, written: 0 })
    }

    const nowIso = new Date().toISOString()
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null
    const userAgent = request.headers.get('user-agent') || null

    await prisma.auditLog.createMany({
      data: activeOrders.map(order => ({
        userId: user.id,
        action: 'RIDER_LOCATION_UPDATE',
        entityType: 'ORDER_TRACKING',
        entityId: order.id,
        ipAddress,
        userAgent,
        newValue: {
          event: 'LOCATION_PING',
          at: nowIso,
          riderId: user.id,
          orderId: order.id,
          batchId: order.batchId,
          lat,
          lng,
          accuracy,
          heading,
          speed,
          source: 'rider-dashboard',
        },
      })),
    })

    return NextResponse.json({ success: true, written: activeOrders.length })
  } catch (error) {
    console.error('rider live-location error:', error)
    return NextResponse.json(
      { error: 'Failed to update live location' },
      { status: 500 }
    )
  }
}
