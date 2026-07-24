export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'
import { flutterwaveFeePerOrder } from '@/lib/finance/fees'

const SERVICE_FEE_RATE = 0.03

async function getUserFromToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    return await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, role: true },
    })
  } catch {
    return null
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dispute = await prisma.dispute.findUnique({
      where: { id: params.id },
      include: { order: true },
    })
    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    if (dispute.sellerId !== user.id) {
      return NextResponse.json({ error: 'Only seller can confirm return receipt' }, { status: 403 })
    }
    if (dispute.status !== 'UNDER_REVIEW') {
      return NextResponse.json({ error: 'Dispute is not in return confirmation stage' }, { status: 400 })
    }
    if (dispute.resolution !== '__RETURN_DELIVERED_TO_SELLER__') {
      return NextResponse.json({ error: 'Return has not been delivered by rider yet' }, { status: 400 })
    }

    const subtotal = dispute.order.totalAmount - (dispute.order.riderId ? 800 : 0)
    const sellerEscrowHeld = Math.max(0, subtotal - dispute.order.platformCommission)

    const gatewayFee = Math.round(flutterwaveFeePerOrder(sellerEscrowHeld) * 100) / 100
    const serviceFee = Math.round(sellerEscrowHeld * SERVICE_FEE_RATE * 100) / 100
    const netRefund = Math.max(0, Math.round((sellerEscrowHeld - gatewayFee - serviceFee) * 100) / 100)

    await prisma.$transaction(async (tx) => {
      const buyerWallet = await tx.user.findUnique({
        where: { id: dispute.buyerId },
        select: { availableBalance: true },
      })

      await tx.user.update({
        where: { id: dispute.sellerId },
        data: { pendingBalance: { decrement: netRefund } },
      })

      await tx.user.update({
        where: { id: dispute.buyerId },
        data: { availableBalance: { increment: netRefund } },
      })

      await tx.transaction.create({
        data: {
          userId: dispute.buyerId,
          type: 'CREDIT',
          amount: netRefund,
          description: `Dispute refund after seller confirmed return (Order #${dispute.order.orderNumber})`,
          reference: `DISPUTE-REFUND-SELLER-CONFIRM-${dispute.id}`,
          balanceBefore: Number(buyerWallet?.availableBalance ?? 0),
          balanceAfter: Number(buyerWallet?.availableBalance ?? 0) + netRefund,
        },
      })

      await tx.transaction.create({
        data: {
          userId: dispute.sellerId,
          type: 'DEBIT',
          amount: gatewayFee + serviceFee,
          description: `Dispute fees (payment gateway + service) for Order #${dispute.order.orderNumber}`,
          reference: `DISPUTE-FEE-SELLER-CONFIRM-${dispute.id}`,
          balanceBefore: 0,
          balanceAfter: 0,
        },
      })

      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: 'RESOLVED_BUYER_FAVOR',
          resolution: `Seller confirmed returned item. Buyer refunded ₦${netRefund.toLocaleString()} (fees deducted).`,
          refundAmount: netRefund,
          resolvedAt: new Date(),
        },
      })

      await tx.order.update({
        where: { id: dispute.orderId },
        data: { isDisputed: false, status: 'COMPLETED', completedAt: new Date() },
      })

      await tx.notification.createMany({
        data: [
          {
            userId: dispute.buyerId,
            type: 'DISPUTE_RESOLVED',
            title: 'Dispute Refund Released',
            message: `Your dispute refund of ₦${netRefund.toLocaleString()} has been released after return confirmation.`,
            orderId: dispute.orderId,
            disputeId: dispute.id,
            metadata: { gatewayFee, serviceFee, grossRefund: sellerEscrowHeld, netRefund },
          },
          {
            userId: dispute.sellerId,
            type: 'DISPUTE_RESOLVED',
            title: 'Return Confirmed',
            message: `You confirmed return for Order #${dispute.order.orderNumber}. Buyer refund has been released.`,
            orderId: dispute.orderId,
            disputeId: dispute.id,
          },
        ],
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Return confirmed. Buyer refund released.',
      summary: { grossRefund: sellerEscrowHeld, gatewayFee, serviceFee, netRefund },
    })
  } catch (error) {
    console.error('Seller return confirmation error:', error)
    return NextResponse.json({ error: 'Failed to confirm return' }, { status: 500 })
  }
}
