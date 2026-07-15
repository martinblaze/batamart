// app/api/riders/update-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { OrderStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId, status } = await request.json()
    const allowedStatuses: OrderStatus[] = ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED']
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id:          true,
        riderId:     true,
        buyerId:     true,
        sellerId:    true,
        orderNumber: true,
        batchId:     true,
        isDisputed:  true,
        dispute: {
          select: { id: true, resolution: true },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.riderId !== user.id) {
      return NextResponse.json({ error: 'Not your delivery' }, { status: 403 })
    }

    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      PENDING: [],
      PROCESSING: [],
      SHIPPED: [],
      RIDER_ASSIGNED: ['PICKED_UP'],
      PICKED_UP: ['ON_THE_WAY'],
      ON_THE_WAY: ['DELIVERED'],
      DELIVERED: [],
      COMPLETED: [],
      DISPUTED: [],
      CANCELLED: [],
    }

    const currentStatus = order.status as OrderStatus
    const nextStatus = status as OrderStatus
    const allowedNext = validTransitions[currentStatus] ?? []
    if (!allowedNext.includes(nextStatus)) {
      return NextResponse.json({ error: `Cannot transition from ${currentStatus} to ${nextStatus}` }, { status: 400 })
    }

    const updateData: any = { status: nextStatus }
    if (status === 'PICKED_UP') updateData.pickedUpAt  = new Date()
    if (status === 'DELIVERED') updateData.deliveredAt = new Date()

    // ── Database transaction ──────────────────────────────────────────────
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data:  updateData,
      })

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'RIDER_STATUS_CHECKPOINT',
          entityType: 'ORDER_TRACKING',
          entityId: orderId,
          newValue: {
            status,
            batchId: order.batchId,
            orderNumber: order.orderNumber,
            isDisputeReturn: order.isDisputed,
          },
        },
      })

      // Dispute return tracking states
      if (order.isDisputed && order.dispute) {
        if (status === 'ON_THE_WAY') {
          await tx.dispute.update({
            where: { id: order.dispute.id },
            data: { resolution: '__RETURN_ON_THE_WAY__' },
          })
        } else if (status === 'DELIVERED') {
          await tx.dispute.update({
            where: { id: order.dispute.id },
            data: { resolution: '__RETURN_DELIVERED_TO_SELLER__' },
          })
        }
      }

      // Increment rider completed count when an order is delivered
      if (status === 'DELIVERED') {
        await tx.user.update({
          where: { id: user.id },
          data:  { completedOrders: { increment: 1 } },
        })
      }

      // ── Update batch status based on all orders ───────────────────────
      if (order.batchId) {
        if (status === 'DELIVERED') {
          // Check if every other order in the batch is also DELIVERED
          const batchOrders = await tx.order.findMany({
            where:  { batchId: order.batchId },
            select: { id: true, status: true },
          })

          const allDelivered = batchOrders.every(o =>
            o.id === orderId
              ? true               // this is the one we just set to DELIVERED
              : o.status === 'DELIVERED'
          )

          await tx.deliveryBatch.update({
            where: { id: order.batchId },
            data:  { status: allDelivered ? 'COMPLETED' : 'IN_PROGRESS' },
          })
        } else if (status === 'PICKED_UP' || status === 'ON_THE_WAY') {
          // At least one order is moving — batch is IN_PROGRESS
          await tx.deliveryBatch.update({
            where: { id: order.batchId },
            data:  { status: 'IN_PROGRESS' },
          })
        }
      }

      return updated
    }, {
      timeout: 15000,
      maxWait:  20000,
    })

    // ── Fire notifications after transaction (non-blocking) ───────────────
    // Buyer gets notified per individual order — intentional behaviour.
    const riderName   = user.name || 'Your rider'
    const orderNumber = order.orderNumber

    Promise.allSettled([
      (async () => {
        const {
          notifyOrderPickedUp,
          notifyOrderOnTheWay,
          notifyOrderDelivered,
        } = await import('@/lib/notification')

        const {
          notifyOrderOnTheWay:  pushOnTheWay,
          notifyOrderDelivered: pushDelivered,
        } = await import('@/lib/push/sendPushNotification')

        if (status === 'PICKED_UP') {
          // In-app bell only (no push template for picked up)
          await notifyOrderPickedUp(orderId, order.buyerId, orderNumber, riderName)

        } else if (status === 'ON_THE_WAY') {
          await Promise.allSettled([
            notifyOrderOnTheWay(orderId, order.buyerId, orderNumber, riderName),
            pushOnTheWay(order.buyerId, orderNumber),
          ])

        } else if (status === 'DELIVERED') {
          await Promise.allSettled([
            notifyOrderDelivered(orderId, order.buyerId, orderNumber),
            pushDelivered(order.buyerId, orderNumber),
          ])

          // Notify seller to confirm dispute return receipt
          if (order.isDisputed && order.dispute) {
            const sellerName = (await prisma.user.findUnique({
              where: { id: order.sellerId },
              select: { name: true },
            }))?.name || 'Seller'

            await prisma.notification.create({
              data: {
                userId: order.sellerId,
                type: 'ORDER_DISPUTED',
                title: 'Dispute Return Delivered',
                message: `Rider has delivered returned item for Order #${orderNumber}. Confirm receipt to release buyer refund.`,
                orderId,
                disputeId: order.dispute.id,
                metadata: { action: 'SELLER_CONFIRM_RETURN', sellerName },
              },
            })
          }
        }
      })(),
    ]).then(results => {
      results.forEach((r) => {
        if (r.status === 'rejected') {
          console.error('Status notification failed:', r.reason)
        }
      })
    })

    return NextResponse.json({ success: true, order: updatedOrder })
  } catch (error) {
    console.error('Update status error:', error)
    return NextResponse.json({
      error:   'Failed to update status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
