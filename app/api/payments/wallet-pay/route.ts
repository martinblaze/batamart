// app/api/payments/wallet-pay/route.ts
// Pay for a cart from the BataMart wallet instead of by card. Same item rules,
// fees and order creation as card checkout; the money comes out of
// availableBalance in the same step.
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { checkRateLimitDistributed, getIpKey } from '@/lib/security/rate-limit'
import { getDeliveryFee } from '@/lib/delivery/pricing'
import { resolveCheckoutItems } from '@/lib/checkout/resolve-items'
import { verifySpendPin } from '@/lib/wallet/pin'
import { createOrders } from '../initialize/route'
import { notifyWalletPayment } from '@/lib/notify/events'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const setting = await prisma.appSetting.findUnique({ where: { key: 'checkout_payments_enabled' } })
    if (!(setting?.value ?? true)) {
      return json({ error: 'Payments are temporarily disabled. Please try again later.' }, 503)
    }

    const user = await getUserFromRequest(request)
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
    const rate = await checkRateLimitDistributed(`payments:wallet:${user.id}:${ip}`, 15, 15 * 60 * 1000, {
      requireDistributedInProduction: true,
    })
    if (!rate.allowed) {
      return json({ error: 'Too many attempts. Please wait.' }, 429)
    }

    const buyer = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, username: true, hostelName: true, roomNumber: true, phone: true, landmark: true,
        universityId: true, availableBalance: true,
      },
    })
    if (!buyer) return json({ error: 'User not found' }, 404)
    if (!buyer.username) {
      return json({ error: 'Set a username in your profile settings before placing an order.', code: 'USERNAME_REQUIRED' }, 400)
    }
    if (!buyer.hostelName || !buyer.roomNumber) {
      return json({ error: 'Add your delivery address in profile settings first.', code: 'ADDRESS_REQUIRED' }, 400)
    }

    const body = await request.json()
    const resolved = await resolveCheckoutItems(body, buyer)
    if (!resolved.ok) return json({ error: resolved.error }, resolved.status)
    const items = resolved.items

    const bySeller = new Map<string, typeof items>()
    for (const item of items) {
      if (!bySeller.has(item.sellerId)) bySeller.set(item.sellerId, [])
      bySeller.get(item.sellerId)!.push(item)
    }
    let delivery = 0
    for (const group of Array.from(bySeller.values())) {
      delivery += await getDeliveryFee(buyer.universityId, group[0].landmark, buyer.landmark)
    }
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const total = Math.round((subtotal + delivery) * 100) / 100

    if (Number(buyer.availableBalance) < total) {
      return json({
        error: `Your wallet balance is ₦${Number(buyer.availableBalance).toLocaleString('en-NG')}. This order is ₦${total.toLocaleString('en-NG')}. Top up to continue.`,
        code: 'INSUFFICIENT_BALANCE',
        required: total,
        balance: Number(buyer.availableBalance),
      }, 402)
    }

    const pin = await verifySpendPin(user.id, typeof body?.pin === 'string' ? body.pin : undefined)
    if (!pin.ok) return json({ error: pin.error, code: pin.code }, pin.status)

    const reference = `WALLET-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

    // Take the money first, atomically: the guard fails if a concurrent
    // spend or withdrawal already used the balance.
    let walletBalanceAfter = 0
    const debited = await prisma.$transaction(async tx => {
      const res = await tx.user.updateMany({
        where: { id: user.id, availableBalance: { gte: total } },
        data: { availableBalance: { decrement: total } },
      })
      if (res.count !== 1) return false
      const after = await tx.user.findUnique({ where: { id: user.id }, select: { availableBalance: true } })
      const balanceAfter = walletBalanceAfter = Number(after?.availableBalance ?? 0)
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: 'DEBIT',
          amount: total,
          description: `Wallet payment for ${items.length} item${items.length > 1 ? 's' : ''}`,
          reference: `${reference}-WALLET-DEBIT`,
          balanceBefore: balanceAfter + total,
          balanceAfter,
        },
      })
      return true
    })
    if (!debited) {
      return json({ error: 'Your wallet balance changed. Please try again.', code: 'INSUFFICIENT_BALANCE' }, 409)
    }

    let orders: Awaited<ReturnType<typeof createOrders>>
    try {
      orders = await createOrders(items, buyer, reference, 'WALLET')
    } catch (createErr) {
      // Give back whatever wasn't turned into an order.
      const created = await prisma.order.findMany({
        where: { payment: { transactionId: reference } },
        select: { totalAmount: true },
      })
      const kept = created.reduce((sum, o) => sum + o.totalAmount, 0)
      const refund = Math.round((total - kept) * 100) / 100
      if (refund > 0) {
        await prisma.$transaction(async tx => {
          const now = await tx.user.findUnique({ where: { id: user.id }, select: { availableBalance: true } })
          const before = Number(now?.availableBalance ?? 0)
          await tx.user.update({ where: { id: user.id }, data: { availableBalance: { increment: refund } } })
          await tx.transaction.create({
            data: {
              userId: user.id,
              type: 'CREDIT',
              amount: refund,
              description: 'Refund: wallet order could not be completed',
              reference: `${reference}-WALLET-REFUND`,
              balanceBefore: before,
              balanceAfter: before + refund,
            },
          })
        })
      }
      if (createErr instanceof Error && createErr.message.startsWith('STOCK_GONE:')) {
        const name = createErr.message.split(':')[2] ?? 'an item'
        return json({ error: `${name} just went out of stock. You have not been charged.`, code: 'OUT_OF_STOCK' }, 409)
      }
      console.error('wallet-pay createOrders failed:', createErr)
      return json({ error: 'We could not place your order. Any unspent money was returned to your wallet.' }, 500)
    }

    // Push notifications, fire-and-forget (in-app ones come from createOrders).
    import('@/lib/push/sendPushNotification')
      .then(push => {
        push.notifyOrderPlaced(buyer.id, orders[0].orderNumber)
        orders.forEach(o => push.notifyNewOrder(o.sellerId, o.orderNumber, o.id))
        if (buyer.universityId) push.notifyAvailableRiders(orders[0].orderNumber, buyer.universityId)
      })
      .catch(err => console.error('wallet-pay push failed:', err))

    await notifyWalletPayment(user.id, orders[0].orderNumber, total, walletBalanceAfter)

    return json({
      success: true,
      orderNumber: orders[0].orderNumber,
      count: orders.length,
      total,
      redirect: `/orders?payment=success&order=${orders[0].orderNumber}&count=${orders.length}`,
    })
  } catch (error) {
    console.error('wallet-pay error:', error)
    return json({ error: 'Failed to pay with wallet' }, 500)
  }
}
