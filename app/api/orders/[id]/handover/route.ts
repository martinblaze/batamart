// app/api/orders/[id]/handover/route.ts
// The vendor confirms they gave the parcel to the rider. Riders can't mark
// this themselves.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { createNotification } from '@/lib/notification'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: { id: true, orderNumber: true, sellerId: true, riderId: true, buyerId: true, status: true, batchId: true, isDisputed: true },
    })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.sellerId !== user.id) return NextResponse.json({ error: 'Only the vendor can confirm a handover' }, { status: 403 })
    if (order.isDisputed) return NextResponse.json({ error: 'This order is in dispute' }, { status: 400 })
    if (order.status !== 'RIDER_ASSIGNED' || !order.riderId) {
      return NextResponse.json({ error: 'A rider has not claimed this order yet' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async tx => {
      const res = await tx.order.updateMany({
        where: { id: order.id, status: 'RIDER_ASSIGNED' },
        data: { status: 'PICKED_UP', pickedUpAt: new Date() },
      })
      if (res.count !== 1) throw new Error('ALREADY_HANDED_OVER')
      if (order.batchId) {
        await tx.deliveryBatch.updateMany({ where: { id: order.batchId }, data: { status: 'IN_PROGRESS' } })
      }
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'RIDER_STATUS_CHECKPOINT',
          entityType: 'ORDER_TRACKING',
          entityId: order.id,
          newValue: { status: 'PICKED_UP', orderNumber: order.orderNumber, markedBy: 'SELLER' },
        },
      })
      return tx.order.findUnique({ where: { id: order.id }, select: { id: true, status: true, pickedUpAt: true } })
    })

    createNotification({
      userId: order.buyerId,
      type: 'ORDER_PICKED_UP',
      title: 'Picked up from the vendor',
      message: `Your order #${order.orderNumber} has been collected and is heading to our sorting hub.`,
      orderId: order.id,
    }).catch(() => {})

    return NextResponse.json({ success: true, order: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_HANDED_OVER') {
      return NextResponse.json({ error: 'Already marked as handed over' }, { status: 409 })
    }
    console.error('handover error:', error)
    return NextResponse.json({ error: 'Failed to mark handover' }, { status: 500 })
  }
}
