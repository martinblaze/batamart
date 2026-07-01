// app/api/orders/confirm-delivery/route.ts
//
// CHANGE vs original:
// After marking an order COMPLETED, we now also:
//   1. Record the confirmed sale price in MarketPrice table
//   2. Re-evaluate hot status for ALL active listings of the same product type
//
// Everything else (rider payout, referral reward, escrow) is unchanged.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { processReferralReward } from '@/lib/referral/processReferralReward'
import {
  normaliseProductName,
  extractVariantValues,
  extractCondition,
  buildVariantKeyFromDescription,
  updateHotStatus,
} from '@/lib/marketPrice/engine'

export const dynamic = 'force-dynamic'

const recentConfirmations = new Map<string, number>()
const CONFIRMATION_COOLDOWN = 5000

function cleanupOldEntries() {
  const now = Date.now()
  const keysToDelete: string[] = []
  recentConfirmations.forEach((timestamp, key) => {
    if (now - timestamp > 60000) keysToDelete.push(key)
  })
  keysToDelete.forEach(key => recentConfirmations.delete(key))
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    const confirmKey = `${user.id}-${orderId}`
    const lastConfirmTime = recentConfirmations.get(confirmKey)
    const now = Date.now()

    if (lastConfirmTime && now - lastConfirmTime < CONFIRMATION_COOLDOWN) {
      const remainingTime = Math.ceil((CONFIRMATION_COOLDOWN - (now - lastConfirmTime)) / 1000)
      return NextResponse.json(
        { error: `Please wait ${remainingTime} seconds before confirming again` },
        { status: 429 },
      )
    }

    recentConfirmations.set(confirmKey, now)
    cleanupOldEntries()

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        rider: true,
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            nameKey: true,
            variantKey: true,
            conditionType: true,
            hasChangedParts: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.buyerId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (order.status === 'COMPLETED') {
      return NextResponse.json(
        {
          error: 'Order already completed',
          message: 'This order has already been confirmed and payment released',
          alreadyCompleted: true,
        },
        { status: 400 },
      )
    }

    if (order.status !== 'DELIVERED') {
      return NextResponse.json(
        { error: `Cannot confirm. Order status is: ${order.status}` },
        { status: 400 },
      )
    }

    const product = order.product
    const variantValues = extractVariantValues(product.description)
    const nameKey = product.nameKey || normaliseProductName(product.name)
    const variantKey = product.variantKey || buildVariantKeyFromDescription(product.description, product.name)
    const { condition, hasChangedParts } = product.conditionType
      ? {
          condition: product.conditionType as 'NEW' | 'USED' | 'REFURBISHED',
          hasChangedParts: product.hasChangedParts,
        }
      : extractCondition(variantValues, product.description || '')

    const confirmedPrice = order.productPrice
    const riderShare = 560
    const hasRider = !!order.riderId

    const result = await prisma.$transaction(
      async tx => {
        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })

        if (order.riderId) {
          const rider = await tx.user.findUnique({
            where: { id: order.riderId },
            select: { availableBalance: true },
          })
          const riderBalance = Number(rider?.availableBalance ?? 0)

          await tx.user.update({
            where: { id: order.riderId },
            data: { availableBalance: { increment: riderShare } },
          })

          await tx.transaction.create({
            data: {
              userId: order.riderId,
              type: 'CREDIT',
              amount: riderShare,
              description: `Delivery fee for Order: ${order.orderNumber}`,
              reference: `${order.orderNumber}-RIDER-RELEASE`,
              balanceBefore: riderBalance,
              balanceAfter: riderBalance + riderShare,
            },
          })
        }

        // Log referral reward processing with buyer info for audit trail
        console.log(`[CONFIRM-DELIVERY] Order ${order.orderNumber} - Buyer ID: ${order.buyerId}`)
        
        await processReferralReward(tx, {
          orderId,
          orderNumber: order.orderNumber,
          orderAmount: order.totalAmount,
          buyerId: order.buyerId,
          hasRider,
          batchId: order.batchId ?? undefined,
        })

        // Record confirmed sale price — the heart of the new hot deals system
        await tx.marketPrice.upsert({
          where: { orderId },
          create: {
            nameKey,
            variantKey,
            category: product.category,
            condition,
            hasChangedParts,
            confirmedPrice,
            productId: product.id,
            orderId,
          },
          update: { confirmedPrice, variantKey },
        })

        // Save matching keys on product for faster future lookups
        if (!product.nameKey || !product.conditionType || !product.variantKey) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              nameKey,
              variantKey,
              conditionType: condition,
              hasChangedParts,
            },
          })
        }

        return updatedOrder
      },
      {
        timeout: 15000,
        maxWait: 20000,
      },
    )

    console.log(`✅ Order ${order.orderNumber} completed — confirmed price ₦${confirmedPrice.toLocaleString()} recorded`)

    // Re-evaluate hot status for all similar active listings — non-blocking
    setImmediate(async () => {
      try {
        const similarListings = await prisma.product.findMany({
          where: {
            nameKey,
            ...(variantKey ? { variantKey } : {}),
            conditionType: condition,
            hasChangedParts,
            isActive: true,
            isDeleted: false,
            quantity: { gt: 0 },
          },
          select: { id: true },
          take: 50,
        })

        const nameKeylessListings = await prisma.product.findMany({
          where: {
            nameKey: null,
            category: product.category,
            isActive: true,
            isDeleted: false,
            quantity: { gt: 0 },
          },
          select: { id: true, name: true },
          take: 100,
        })

        const toUpdate = new Set(similarListings.map(p => p.id))

        for (const p of nameKeylessListings) {
          const pKey = normaliseProductName(p.name)
          if (pKey === nameKey || pKey.includes(nameKey) || nameKey.includes(pKey)) {
            toUpdate.add(p.id)
          }
        }

        for (const pid of toUpdate) {
          await updateHotStatus(pid).catch(() => {})
        }

        console.log(`🔥 Re-evaluated hot status for ${toUpdate.size} similar listings`)
      } catch (err) {
        console.error('Hot status update error (non-blocking):', err)
      }
    })

    return NextResponse.json({
      success: true,
      message: '🎉 Delivery confirmed. Seller funds stay in escrow for 48 hours; rider payment released.',
      order: result,
    })
  } catch (error) {
    console.error('Confirm delivery error:', error)

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        {
          error: 'Order already processed',
          message: 'This order has already been confirmed',
          alreadyCompleted: true,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({ error: 'Failed to confirm delivery' }, { status: 500 })
  }
}
