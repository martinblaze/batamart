// app/api/riders/pickups/not-ready/route.ts
// A rider arrives and the product isn't ready. The order goes back to the
// pool and rolls over to the next delivery day (Wed -> Sat, Sat -> Wed).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { createNotification } from '@/lib/notification'
import { formatDeliveryDate, getScheduledDeliveryDate } from '@/lib/delivery/schedule'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { orderId } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'Order ID required' }, { status: 400 })

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, riderId: true, status: true, buyerId: true, sellerId: true, batchId: true },
    })
    if (!order || order.riderId !== user.id) {
      return NextResponse.json({ error: 'Not your pickup' }, { status: 403 })
    }
    if (order.status !== 'RIDER_ASSIGNED') {
      return NextResponse.json({ error: 'This order has already been handed over' }, { status: 400 })
    }

    const nextDay = getScheduledDeliveryDate(new Date())
    await prisma.$transaction(async tx => {
      await tx.order.update({
        where: { id: order.id },
        data: { riderId: null, riderAssignedAt: null, status: 'PROCESSING', deferredUntil: nextDay },
      })
      if (order.batchId) {
        await tx.deliveryBatch.updateMany({
          where: { id: order.batchId },
          data: { riderId: null, status: 'PENDING' },
        })
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'RIDER_STATUS_CHECKPOINT',
          entityType: 'ORDER_TRACKING',
          entityId: order.id,
          newValue: { status: 'NOT_READY', orderNumber: order.orderNumber, rolledTo: nextDay.toISOString() },
        },
      })
    })

    const when = formatDeliveryDate(nextDay)
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    await Promise.allSettled([
      createNotification({
        userId: order.buyerId,
        type: 'ORDER_PLACED',
        title: 'Delivery moved',
        message: `Your order #${order.orderNumber} wasn't ready for pickup. It is now scheduled for ${when}.`,
        orderId: order.id,
      }),
      createNotification({
        userId: order.sellerId,
        type: 'ORDER_PLACED',
        title: 'Rider found your product not ready',
        message: `Order #${order.orderNumber} wasn't ready when the rider came. It rolls over to ${when}. Please have it ready.`,
        orderId: order.id,
      }),
      ...admins.map(a =>
        createNotification({
          userId: a.id,
          type: 'ORDER_PLACED',
          title: 'Product not ready at pickup',
          message: `Order #${order.orderNumber} was not ready. Rolled over to ${when}.`,
          orderId: order.id,
          metadata: { orderUrl: '/admin/order-intake' },
        }),
      ),
    ])

    return NextResponse.json({ success: true, rolledTo: nextDay.toISOString() })
  } catch (error) {
    console.error('not-ready error:', error)
    return NextResponse.json({ error: 'Failed to update pickup' }, { status: 500 })
  }
}
