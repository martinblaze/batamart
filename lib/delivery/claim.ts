// lib/delivery/claim.ts
// Order-level pickup claims. A rider takes the orders of a pickup area (several
// vendors, possibly several buyers) in one go; each order keeps its own rider,
// so one buyer's order can be collected by a different rider than their other
// order. Nothing is escrowed here: the rider's fee is released when the buyer
// marks the order delivered (app/api/orders/confirm-delivery/route.ts).

import { prisma } from '@/lib/prisma'
import { CAMPAIGNS, isCampaignDeliverable, isValidCampaignKey } from '@/lib/campaigns'
import { formatDeliveryDate, getEffectiveDeliveryDate, parseReadyDays } from '@/lib/delivery/schedule'

// Flat shape on purpose: the project runs without strictNullChecks, where
// discriminated unions on `ok` don't narrow.
export type ClaimResult = {
  ok: boolean
  claimedIds?: string[]
  skipped?: { orderNumber: string; reason: string }[]
  status?: number
  error?: string
  blockReason?: string
}

export async function claimPickupOrders(
  rider: { id: string; name: string | null; universityId: string | null },
  orderIds: string[],
): Promise<ClaimResult> {
  if (orderIds.length === 0) return { ok: false, status: 400, error: 'No orders selected' }

  const pendingReturn = await prisma.order.findFirst({
    where: { riderId: rider.id, isDisputed: true, status: 'RIDER_ASSIGNED', dispute: { resolution: '__AWAITING_PICKUP__' } },
    select: { orderNumber: true },
  })
  if (pendingReturn) {
    return {
      ok: false,
      status: 400,
      error: `You have a pending dispute pickup (Order #${pendingReturn.orderNumber}). Complete that return first.`,
      blockReason: 'DISPUTE_PICKUP_PENDING',
    }
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      riderId: true,
      buyerId: true,
      sellerId: true,
      batchId: true,
      createdAt: true,
      deferredUntil: true,
      campaignTag: true,
      buyer: { select: { universityId: true } },
      product: { select: { deliveryEstimate: true, campaignTag: true } },
      items: { select: { product: { select: { deliveryEstimate: true } } } },
    },
  })

  const skipped: { orderNumber: string; reason: string }[] = []
  const eligible: typeof orders = []

  for (const order of orders) {
    if (order.riderId || !['PENDING', 'PROCESSING'].includes(order.status)) {
      skipped.push({ orderNumber: order.orderNumber, reason: 'Already taken by another rider' })
      continue
    }
    if (rider.universityId && order.buyer.universityId !== rider.universityId) {
      skipped.push({ orderNumber: order.orderNumber, reason: 'Outside your campus area' })
      continue
    }
    const estimates = order.items.length > 0 ? order.items.map(i => i.product.deliveryEstimate) : [order.product?.deliveryEstimate]
    const readyDays = Math.max(0, ...estimates.map(parseReadyDays))
    const day = getEffectiveDeliveryDate(order, readyDays)
    if (Date.now() < day.getTime()) {
      skipped.push({ orderNumber: order.orderNumber, reason: `Scheduled for ${formatDeliveryDate(day)}` })
      continue
    }
    const tag = order.campaignTag || order.product?.campaignTag
    if (isValidCampaignKey(tag) && !isCampaignDeliverable(tag)) {
      const date = new Date(CAMPAIGNS[tag].deliverableFrom).toLocaleDateString('en-NG', { day: 'numeric', month: 'long' })
      skipped.push({ orderNumber: order.orderNumber, reason: `Campaign item, pickup opens ${date}` })
      continue
    }
    eligible.push(order)
  }

  if (eligible.length === 0) {
    return {
      ok: false,
      status: 409,
      error: skipped[0]?.reason || 'These orders are no longer available',
      blockReason: 'NOTHING_CLAIMABLE',
    }
  }

  const claimedIds: string[] = []
  await prisma.$transaction(async tx => {
    for (const order of eligible) {
      const res = await tx.order.updateMany({
        where: { id: order.id, riderId: null, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { riderId: rider.id, status: 'RIDER_ASSIGNED', riderAssignedAt: new Date() },
      })
      if (res.count === 1) {
        claimedIds.push(order.id)
      } else {
        skipped.push({ orderNumber: order.orderNumber, reason: 'Just taken by another rider' })
      }
    }

    if (claimedIds.length > 0) {
      await tx.auditLog.createMany({
        data: eligible
          .filter(o => claimedIds.includes(o.id))
          .map(o => ({
            userId: rider.id,
            action: 'RIDER_TRACKING_STARTED',
            entityType: 'ORDER_TRACKING',
            entityId: o.id,
            newValue: { status: 'RIDER_ASSIGNED', orderNumber: o.orderNumber, note: 'Rider claimed pickup' },
          })),
      })
    }

    // Keep the legacy batch record in step: once every order of a batch has a
    // rider, the batch stops appearing as available.
    const batchIds = Array.from(new Set(eligible.filter(o => claimedIds.includes(o.id)).map(o => o.batchId).filter(Boolean))) as string[]
    for (const batchId of batchIds) {
      const open = await tx.order.count({ where: { batchId, riderId: null, status: { in: ['PENDING', 'PROCESSING'] } } })
      if (open === 0) {
        await tx.deliveryBatch.updateMany({
          where: { id: batchId, riderId: null },
          data: { riderId: rider.id, status: 'RIDER_ASSIGNED' },
        })
      }
    }
  }, { timeout: 15000, maxWait: 20000 })

  if (claimedIds.length === 0) {
    return { ok: false, status: 409, error: 'Another rider just took these orders', blockReason: 'RACE_LOST' }
  }

  const claimed = eligible.filter(o => claimedIds.includes(o.id))
  import('@/lib/notification')
    .then(({ notifyRiderAssigned }) =>
      Promise.allSettled(
        claimed.map(o => notifyRiderAssigned(o.id, o.buyerId, o.sellerId, rider.id, rider.name || 'Your rider', o.orderNumber)),
      ),
    )
    .catch(err => console.error('Pickup-claim notifications failed:', err))

  return { ok: true, claimedIds, skipped }
}
