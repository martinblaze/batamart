export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'
import { RIDER_SHARE_PERCENT } from '@/lib/delivery/commission'

async function getAdminFromToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    if (decoded.role !== 'ADMIN') return null
    return decoded
  } catch {
    return null
  }
}

// POST actions: send_rider | release_rider_pay
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdminFromToken(req)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: disputeId } = params
    const { action } = await req.json()

    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { order: { include: { rider: true } } },
    })
    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })

    if (action === 'send_rider') {
      const rider = dispute.order.rider
      if (!rider) {
        return NextResponse.json({
          error: 'No rider found on this order. Assign a rider manually first.',
        }, { status: 400 })
      }

      const returnPay = Math.round(dispute.order.deliveryFee * RIDER_SHARE_PERCENT * 100) / 100

      await prisma.$transaction(async (tx) => {
        await tx.notification.create({
          data: {
            userId: rider.id,
            type: 'ORDER_DISPUTED',
            title: 'Dispute Return Pickup Required',
            message: `Please collect disputed item for Order #${dispute.order.orderNumber} and return to seller.`,
            orderId: dispute.orderId,
            disputeId,
            metadata: { action: 'DISPUTE_PICKUP', riderPay: returnPay },
          },
        })

        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: 'UNDER_REVIEW',
            resolution: '__SELLER_FAULT_AWAITING_PICKUP__',
          },
        })

        await tx.order.update({
          where: { id: dispute.orderId },
          data: {
            status: 'RIDER_ASSIGNED',
            isDisputed: true,
            riderId: rider.id,
            riderAssignedAt: new Date(),
          },
        })
      })

      return NextResponse.json({
        success: true,
        message: `Rider ${rider.name} has been notified for return pickup.`,
      })
    }

    // Refund is now released by seller confirmation endpoint.
    if (action === 'confirm_received' || action === 'release_refund') {
      return NextResponse.json({
        error: 'Seller must confirm return receipt from order page to release buyer refund.',
      }, { status: 400 })
    }

    if (action === 'release_rider_pay') {
      if (!['__RETURN_DELIVERED_TO_SELLER__', '__SELLER_CONFIRMED_RETURN__'].includes(dispute.resolution || '')) {
        return NextResponse.json({
          error: 'Cannot release rider pay yet. Return must be delivered first.',
        }, { status: 400 })
      }

      const rider = dispute.order.rider
      if (!rider) return NextResponse.json({ error: 'No rider on this order' }, { status: 400 })

      const riderPay = Math.round(dispute.order.deliveryFee * RIDER_SHARE_PERCENT * 100) / 100

      await prisma.$transaction(async (tx) => {
        const riderRecord = await tx.user.findUnique({
          where: { id: rider.id },
          select: { pendingBalance: true, availableBalance: true },
        })

        await tx.user.update({
          where: { id: rider.id },
          data: {
            pendingBalance: { decrement: riderPay },
            availableBalance: { increment: riderPay },
          },
        })

        await tx.transaction.create({
          data: {
            userId: rider.id,
            type: 'CREDIT',
            amount: riderPay,
            description: `Dispute pickup payment — Order #${dispute.order.orderNumber}`,
            reference: `DISPUTE-RIDER-${disputeId}`,
            balanceBefore: Number(riderRecord?.availableBalance ?? 0),
            balanceAfter: Number(riderRecord?.availableBalance ?? 0) + riderPay,
          },
        })

        const buyerRefundReleased = dispute.status === 'RESOLVED_BUYER_FAVOR'
        await tx.dispute.update({
          where: { id: disputeId },
          data: buyerRefundReleased
            ? {
                resolution: 'Return completed, buyer refunded, rider paid.',
                resolvedAt: dispute.resolvedAt ?? new Date(),
                resolvedBy: dispute.resolvedBy ?? (admin.id ?? admin.userId ?? null),
              }
            : {
                resolution: '__RIDER_PAID__',
              },
        })

        await tx.notification.create({
          data: {
            userId: rider.id,
            type: 'PAYMENT_RECEIVED',
            title: 'Dispute Pickup Payment Released',
            message: `₦${riderPay} for dispute return Order #${dispute.order.orderNumber} is now available.`,
            orderId: dispute.orderId,
            disputeId,
            metadata: { amount: riderPay },
          },
        })
      })

      return NextResponse.json({
        success: true,
        message: `₦${riderPay} released to ${rider.name}.`,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Dispute pickup action error:', error)
    return NextResponse.json({ error: 'Action failed' }, { status: 500 })
  }
}
