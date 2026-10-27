import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

function toNumberOrNull(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        buyerId: true,
        sellerId: true,
        riderId: true,
        deliveryRiderId: true,
        packedAt: true,
        rider: {
          select: {
            id: true,
            name: true,
            phone: true,
            profilePhoto: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const isOwner =
      order.buyerId === user.id ||
      order.sellerId === user.id ||
      order.riderId === user.id ||
      order.deliveryRiderId === user.id ||
      user.role === 'ADMIN'

    if (!isOwner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'ORDER_TRACKING',
        entityId: params.id,
        action: {
          in: ['RIDER_TRACKING_STARTED', 'RIDER_STATUS_CHECKPOINT', 'RIDER_LOCATION_UPDATE'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
      select: {
        id: true,
        action: true,
        createdAt: true,
        newValue: true,
      },
    })

    const orderedLogs = logs.reverse()

    // The buyer's map is for the last leg only (hub to their door). Pings from
    // the vendor-pickup trip are older than packing and are never shown.
    const deliveryLeg = order.status === 'ON_THE_WAY'
    const legStart = order.packedAt ? order.packedAt.getTime() : 0

    const points = orderedLogs
      .filter(log => log.action === 'RIDER_LOCATION_UPDATE')
      .filter(log => deliveryLeg && log.createdAt.getTime() >= legStart)
      .map(log => {
        const payload = (log.newValue || {}) as any
        return {
          id: log.id,
          at: log.createdAt,
          lat: toNumberOrNull(payload.lat),
          lng: toNumberOrNull(payload.lng),
          accuracy: toNumberOrNull(payload.accuracy),
          heading: toNumberOrNull(payload.heading),
          speed: toNumberOrNull(payload.speed),
        }
      })
      .filter(point => point.lat != null && point.lng != null)

    const checkpoints = orderedLogs
      .filter(log => log.action !== 'RIDER_LOCATION_UPDATE')
      .map(log => {
        const payload = (log.newValue || {}) as any
        const status = typeof payload.status === 'string' ? payload.status : null
        return {
          id: log.id,
          action: log.action,
          status,
          note: typeof payload.note === 'string' ? payload.note : null,
          at: log.createdAt,
        }
      })

    const latestPoint = points.length > 0 ? points[points.length - 1] : null

    const deliveryRider = order.deliveryRiderId && order.deliveryRiderId !== order.riderId
      ? await prisma.user.findUnique({
          where: { id: order.deliveryRiderId },
          select: { id: true, name: true, phone: true, profilePhoto: true },
        })
      : order.rider

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderStatus: order.status,
      rider: deliveryLeg ? deliveryRider : order.rider,
      latestPoint,
      points: points.slice(-80),
      checkpoints: checkpoints.slice(-20),
      updatedAt: latestPoint?.at || null,
    })
  } catch (error) {
    console.error('order live-location error:', error)
    return NextResponse.json({ error: 'Failed to fetch live tracking' }, { status: 500 })
  }
}
