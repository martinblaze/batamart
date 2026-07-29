// app/api/payments/initialize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'
import { notifyOrderPlaced } from '@/lib/notification'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { checkRateLimitDistributed, getIpKey } from '@/lib/security/rate-limit'
import { flutterwaveRequest, getFlutterwaveSecretKey } from '@/lib/finance/flutterwave'
import { getDeliveryFee } from '@/lib/delivery/pricing'
import { RIDER_SHARE_PERCENT, PLATFORM_SHARE_PERCENT } from '@/lib/delivery/commission'
import { isValidCampaignKey } from '@/lib/campaigns'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  })
}

const PAYMENT_SETTING_KEY = 'checkout_payments_enabled'

async function arePaymentsEnabled() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: PAYMENT_SETTING_KEY },
  })
  return setting?.value ?? true
}

// ============================================================
// STANDARDIZED FEE STRUCTURE
// calculateFees is imported by the verify route — both sides
// must always compute fees identically from the same function.
//
// DELIVERY MODEL (batch):
//   Each order in the cart gets its own delivery fee, priced per the
//   pickup-zone <-> dropoff-zone route (see lib/delivery/pricing.ts) —
//   no longer a flat ₦800 per order.
//   Rider gets 70% of that order's delivery fee.
//   Platform keeps 30% of that order's delivery fee (gross).
//   Referral reward (₦120) fires ONCE per batch (not per order), paid out
//   of the platform's share at the reporting layer — see
//   lib/delivery/commission.ts for the full accounting note.
// ============================================================
export function calculateFees(subtotal: number, deliveryFee: number) {
  const PLATFORM_RATE         = 0.05
  const riderShare            = Math.round(deliveryFee * RIDER_SHARE_PERCENT * 100) / 100
  const PLATFORM_DELIVERY_CUT = Math.round(deliveryFee * PLATFORM_SHARE_PERCENT * 100) / 100

  const platformFeeFromProducts = subtotal * PLATFORM_RATE
  const sellerShare             = subtotal - platformFeeFromProducts
  const platformTotal           = platformFeeFromProducts + PLATFORM_DELIVERY_CUT
  const totalAmount             = subtotal + deliveryFee

  return {
    subtotal,
    deliveryFee,
    totalAmount,
    sellerShare,
    riderShare,
    platformTotal,
    platformFeeFromProducts,
    PLATFORM_DELIVERY_CUT,
  }
}

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const paymentsEnabled = await arePaymentsEnabled()
    if (!paymentsEnabled) {
      return jsonResponse(
        { error: 'Payments are temporarily disabled. Please try again later.' },
        { status: 503 }
      )
    }

    const user = await getUserFromRequest(request)
    if (!user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }
    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
    const rate = await checkRateLimitDistributed(
      `payments:init:${user.id}:${ip}`,
      20,
      15 * 60 * 60 * 1000,
      { requireDistributedInProduction: true },
    )
    if (!rate.allowed) {
      return jsonResponse({ error: 'Too many checkout attempts. Please wait.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSecs) } })
    }

    const body = await request.json()
    const schema = z.object({
      productId: z.string().min(1).optional(),
      variantId: z.string().min(1).optional().nullable(),
      variantData: z.record(z.string()).optional().nullable(),
      orderNote: z.string().max(300).optional(),
      cartItems: z.array(z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1).optional().nullable(),
        variantData: z.record(z.string()).optional().nullable(),
        quantity: z.number().int().min(1).max(50),
        orderNote: z.string().max(300).optional(),
        buyerDeliveryAcknowledged: z.boolean().optional(),
      }).strict()).max(50).optional(),
    }).strict()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request payload' }, { status: 400 })
    }
    const { productId, cartItems } = parsed.data

    type CartItem = {
      productId:  string
      variantId?: string | null
      price:      number
      quantity:   number
      sellerId:   string
      landmark:   string
      orderNote?: string
      buyerDeliveryAcknowledged?: boolean
    }

    let items: CartItem[] = []

    if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
      if (cartItems.length > 50) {
        return jsonResponse({ error: 'Too many items in one checkout' }, { status: 400 })
      }
      // Server always re-fetches price from DB — client-supplied price is IGNORED
      for (const item of cartItems) {
        const safeQuantity = Number(item?.quantity)
        if (!Number.isInteger(safeQuantity) || safeQuantity < 1 || safeQuantity > 50) {
          return jsonResponse({ error: 'Invalid quantity in cart item' }, { status: 400 })
        }
        const product = await prisma.product.findUnique({
          where:   { id: item.productId },
          include: { seller: true, variants: true },
        })
        if (!product) {
          return jsonResponse({ error: `Product not found: ${item.productId}` }, { status: 404 })
        }
        let resolvedPrice = product.price
        let resolvedStock = product.quantity

        if (item.variantId) {
          const variant = product.variants.find(v => v.id === item.variantId)
          if (!variant) {
            return jsonResponse({ error: `Variant not found for product: ${product.name}` }, { status: 400 })
          }
          resolvedPrice = variant.price
          resolvedStock = variant.stock
        }
        const seller = await prisma.user.findUnique({ where: { id: product.sellerId }, select: { isSuspended: true } })
        if (seller?.isSuspended || product.moderationStatus === 'UNDER_REVIEW' || product.moderationStatus === 'REMOVED') {
          return jsonResponse({ error: `Product unavailable: ${product.name}` }, { status: 400 })
        }
        // Delivery is hyperlocal (motorcycle riders within one campus) — a
        // product link can be viewed from any university, but only buyers on
        // the same campus as the seller can actually check out.
        if (product.universityId && product.universityId !== user.universityId) {
          return jsonResponse({ error: `${product.name} isn't available for delivery to your campus` }, { status: 400 })
        }

        if (!product.isActive || resolvedStock < safeQuantity) {
          return jsonResponse({ error: `Product unavailable: ${product.name}` }, { status: 400 })
        }
        if (item.orderNote && String(item.orderNote).length > 300) {
          return jsonResponse({ error: 'Order note must be under 300 characters' }, { status: 400 })
        }
        items.push({
          productId:  product.id,
          variantId:  item.variantId || null,
          price:      resolvedPrice, // ? always from DB, never from client
          quantity:   safeQuantity,
          sellerId:   product.sellerId,
          landmark:   product.landmark,
          orderNote:  item.orderNote,
          buyerDeliveryAcknowledged: item.buyerDeliveryAcknowledged === true,
        })
      }
    } else if (productId) {
      const product = await prisma.product.findUnique({
        where:   { id: productId },
        include: { seller: true, variants: true },
      })
      if (!product) {
        return jsonResponse({ error: 'Product not found' }, { status: 404 })
      }
      let resolvedPrice = product.price
      let resolvedStock = product.quantity
      const variantId = body.variantId || null

      if (variantId) {
        const variant = product.variants.find(v => v.id === variantId)
        if (!variant) {
          return jsonResponse({ error: `Variant not found for product: ${product.name}` }, { status: 400 })
        }
        resolvedPrice = variant.price
        resolvedStock = variant.stock
      }

      if (product.universityId && product.universityId !== user.universityId) {
        return jsonResponse({ error: `${product.name} isn't available for delivery to your campus` }, { status: 400 })
      }

      if (!product.isActive || resolvedStock < 1) {
        return jsonResponse({ error: 'Product unavailable' }, { status: 400 })
      }
      items = [{
        productId:  product.id,
        variantId:  variantId,
        price:      resolvedPrice,
        quantity:   1,
        sellerId:   product.sellerId,
        landmark:   product.landmark,
        orderNote:  body.orderNote,
        buyerDeliveryAcknowledged: false,
      }]
    } else {
      return jsonResponse({ error: 'No products provided' }, { status: 400 })
    }

    // Can't buy own product
    const ownProduct = items.find(i => i.sellerId === user.id)
    if (ownProduct) {
      return jsonResponse({ error: 'You cannot buy your own product' }, { status: 400 })
    }

    // ── Calculate totals ──────────────────────────────────────────────────────
    // One order per seller, each with its own zone-priced delivery fee
    // (pickup zone = that seller's first item's landmark, dropoff zone =
    // buyer's landmark). Must match the per-order fees createOrders will
    // persist, and what verify/route.ts recomputes to validate the payment.
    const sellerGroupsForQuote = items.reduce<Record<string, CartItem[]>>((acc, item) => {
      if (!acc[item.sellerId]) acc[item.sellerId] = []
      acc[item.sellerId].push(item)
      return acc
    }, {})

    let totalDelivery = 0
    for (const sellerItems of Object.values(sellerGroupsForQuote)) {
      totalDelivery += await getDeliveryFee(user.universityId, sellerItems[0].landmark, user.landmark)
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

    // fees here represent the TOTAL for Flutterwave (all orders combined)
    const totalSubtotal = subtotal
    const totalAmount   = totalSubtotal + totalDelivery

    // APP_URL required
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL
    if (!APP_URL) {
      console.error('❌ NEXT_PUBLIC_APP_URL is not set!')
      return jsonResponse(
        { error: 'Server misconfiguration: NEXT_PUBLIC_APP_URL is not set.' },
        { status: 500 }
      )
    }

    const reference   = `BATAMART-${Date.now()}-${user.id.substring(0, 8)}`
    const callbackUrl = `${APP_URL.replace(/\/$/, '')}/api/payments/verify`

    if (!getFlutterwaveSecretKey()) {
      console.error('Flutterwave secret key is not set in environment variables.')
      return jsonResponse(
        { error: 'Server misconfiguration: Flutterwave secret key is not set.' },
        { status: 500 }
      )
    }

    console.log('Initializing Flutterwave payment - reference:', reference, '| callback:', callbackUrl)
    console.log(`Cart: ${items.length} item(s), ${Object.keys(sellerGroupsForQuote).length} seller(s), total delivery ₦${totalDelivery}`)

    // NOTE: Flutterwave amounts are in whole Naira units, NOT kobo (unlike
    // Paystack/Credo, which multiply by 100). Don't reintroduce a *100 here.
    const { ok: flwOk, data: flwData } = await flutterwaveRequest('/payments', {
      body: {
        tx_ref:       reference,
        amount:       totalAmount,
        currency:     'NGN',
        redirect_url: callbackUrl,
        customer: {
          email: user.email || `${user.id}@batamart.app`,
          name:  user.name ?? undefined,
        },
        customizations: {
          title: 'BataMart',
        },
        meta: {
          userId: user.id,
          cartItems: JSON.stringify(items),
          orderReference: reference,
        },
      },
    })

    if (!flwOk || flwData?.status !== 'success') {
      console.error('Flutterwave initialization failed:', JSON.stringify(flwData, null, 2))
      return jsonResponse(
        { error: flwData?.message || 'Payment initialization failed' },
        { status: 400 }
      )
    }

    const authorizationUrl = flwData?.data?.link
    const transRef = reference

    if (!authorizationUrl) {
      console.error('Flutterwave returned an incomplete initialization payload:', flwData)
      return jsonResponse(
        { error: 'Payment provider returned an incomplete response.' },
        { status: 502 }
      )
    }

    console.log('Flutterwave initialized successfully - tx_ref:', transRef)

    return jsonResponse({
      success: true,
      authorizationUrl,
      authorization_url: authorizationUrl,
      transRef,
      reference: transRef,
      deliveryFee: totalDelivery,
      totalAmount,
    })
  } catch (error) {
    console.error('Payment init error:', error)
    return jsonResponse(
      { error: 'Failed to initialize payment', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// createOrders — called ONLY from the verify route after Flutterwave confirms.
// Creates ONE DeliveryBatch then one Order per seller group.
// Each order carries its own zone-priced delivery fee — NOT split.
// ══════════════════════════════════════════════════════════════════════════════
export async function createOrders(
  items: {
    productId:  string
    variantId?: string | null
    variantData?: Record<string, string> | null
    name:       string
    price:      number
    quantity:   number
    category:   string
    sellerId:   string
    sellerName: string
    landmark:   string
    orderNote?: string
    buyerDeliveryAcknowledged?: boolean
    campaignTag?: string | null
  }[],
  user: {
    id:           string
    hostelName?:  string | null
    roomNumber?:  string | null
    phone?:       string | null
    landmark?:    string | null
    universityId?: string | null
  },
  paymentReference: string
) {
  console.log('📝 createOrders called — reference:', paymentReference)

  // ── STEP 1: Create the DeliveryBatch FIRST ──────────────────────────────────
  // One batch per checkout session. All orders in this cart link to it.
  const batchNumber = `BATCH-${crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`

  const batch = await prisma.deliveryBatch.create({
    data: {
      batchNumber,
      buyerId:          user.id,
      universityId:     user.universityId ?? '',
      paymentReference,
      status:           'PENDING',
    },
  })

  console.log('📦 DeliveryBatch created:', batchNumber)

  // ── STEP 2: Group items by seller ───────────────────────────────────────────
  const sellerGroups = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.sellerId]) acc[item.sellerId] = []
    acc[item.sellerId].push(item)
    return acc
  }, {})

  const createdOrders: Awaited<ReturnType<typeof prisma.order.create>>[] = []

  const notificationQueue: Array<{
    orderId:     string
    buyerId:     string
    sellerId:    string
    orderNumber: string
    itemsList:   string
  }> = []

  const outOfStockAlerts: Array<{
    sellerId:    string
    productId:   string
    productName: string
  }> = []

  for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
    const orderSubtotal = sellerItems.reduce((sum, i) => sum + i.price * i.quantity, 0)
    // Each order gets its own zone-priced delivery fee (not split, not
    // proportional) — pickup zone from this seller's first item's landmark,
    // dropoff zone from the buyer's landmark.
    const perOrderDelivery = await getDeliveryFee(user.universityId, sellerItems[0].landmark, user.landmark)
    const orderFees        = calculateFees(orderSubtotal, perOrderDelivery)

    const orderNumber = `BATAMART-${crypto.randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase()}`
    const itemsList   = sellerItems.map(i => `${i.name} (x${i.quantity})`).join(', ')
    // Permanent snapshot — if any item in this seller's order was tagged for a
    // campaign, the order is marked forever, regardless of what happens to the
    // product's tag later (reused, retagged, expired). See lib/campaigns.ts.
    const orderCampaignTag = sellerItems.find(i => isValidCampaignKey(i.campaignTag))?.campaignTag || null

    console.log('🔨 Creating order:', orderNumber, 'for seller:', sellerId)

    try {
      const order = await prisma.$transaction(async (tx) => {
        const seller = await tx.user.findUnique({
          where:  { id: sellerId },
          select: { pendingBalance: true },
        })
        if (!seller) throw new Error(`Seller not found: ${sellerId}`)

        const orderNote = sellerItems
          .map(item => item.orderNote?.trim())
          .filter((note): note is string => Boolean(note && note.length > 0))
          .join(' | ') || null

        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            buyerId:            user.id,
            sellerId,
            batchId:            batch.id,   // ← link to the batch
            productId:          sellerItems[0].productId,
            productPrice:       Number(orderSubtotal),
            deliveryFee:        Number(orderFees.deliveryFee),
            totalAmount:        Number(orderFees.totalAmount),
            platformCommission: Number(orderFees.platformTotal),
            quantity:           Number(sellerItems.reduce((sum, i) => sum + i.quantity, 0)),
            deliveryHostel:     String(user.hostelName  ?? ''),
            deliveryRoom:       String(user.roomNumber  ?? ''),
            deliveryPhone:      String(user.phone       ?? ''),
            deliveryLandmark:   String(user.landmark    ?? ''),
            isPaid:             true,
            status:             'PENDING' as const,
            campaignTag:        orderCampaignTag,
            orderNote,
            buyerDeliveryAcknowledged: Boolean(sellerItems.every(i => i.buyerDeliveryAcknowledged === true)),
            items: {
              create: sellerItems.map(item => ({
                productId: item.productId,
                variantId: item.variantId || null,
                variantData: item.variantData || null,
                quantity: Number(item.quantity),
                price: Number(item.price),
              })),
            },
            payment: {
              create: {
                amount:        Number(orderFees.totalAmount),
                method:        'CARD' as const,
                status:        'COMPLETED' as const,
                transactionId: paymentReference,
                paidAt:        new Date(),
              },
            },
          },
        })

        // TOCTOU-safe stock decrement
        for (const item of sellerItems) {
          if (item.variantId) {
            const updatedVariant = await tx.productVariant.updateMany({
              where: {
                id: item.variantId,
                productId: item.productId,
                stock: { gte: Number(item.quantity) },
              },
              data: { stock: { decrement: Number(item.quantity) } },
            })
            if (updatedVariant.count === 0) {
              throw new Error(`STOCK_GONE:${item.productId}:${item.name}`)
            }
            const remainingVariants = await tx.productVariant.findMany({
              where: { productId: item.productId },
              select: { stock: true },
            })
            const totalStock = remainingVariants.reduce((sum, v) => sum + v.stock, 0)
            await tx.product.update({
              where: { id: item.productId },
              data: {
                quantity: totalStock,
                isActive: totalStock > 0,
              },
            })
          } else {
            const updated = await tx.product.updateMany({
              where: {
                id:       item.productId,
                quantity: { gte: Number(item.quantity) },
              },
              data: { quantity: { decrement: Number(item.quantity) } },
            })

            if (updated.count === 0) {
              throw new Error(`STOCK_GONE:${item.productId}:${item.name}`)
            }

            const afterUpdate = await tx.product.findUnique({
              where:  { id: item.productId },
              select: { id: true, name: true, quantity: true },
            })

            if (afterUpdate && afterUpdate.quantity <= 0) {
              await tx.product.update({
                where: { id: item.productId },
                data:  { isActive: false },
              })
              outOfStockAlerts.push({
                sellerId,
                productId:   afterUpdate.id,
                productName: afterUpdate.name,
              })
            }
          }
        }

        // Credit seller's pending (escrow) balance
        const sellerShare        = Number(orderFees.sellerShare)
        const sellerPendingBalance = Number(seller.pendingBalance ?? 0)

        await tx.user.update({
          where: { id: sellerId },
          data:  { pendingBalance: { increment: sellerShare } },
        })

        await tx.transaction.createMany({
          data: [
            {
              userId:        sellerId,
              type:          'ESCROW',
              amount:        sellerShare,
              description:   `Escrow held for: ${itemsList} (Order: ${orderNumber})`,
              reference:     `${orderNumber}-SELLER-ESCROW`,
              balanceBefore: sellerPendingBalance,
              balanceAfter:  sellerPendingBalance + sellerShare,
            },
            {
              userId:        user.id,
              type:          'DEBIT',
              amount:        Number(orderFees.totalAmount),
              description:   `Payment for ${itemsList} (Order: ${orderNumber})`,
              reference:     `${orderNumber}-BUYER-PAYMENT`,
              balanceBefore: 0,
              balanceAfter:  0,
            },
          ],
        })

        return newOrder
      }, { timeout: 15000, maxWait: 20000 })

      createdOrders.push(order)
      notificationQueue.push({
        orderId:     order.id,
        buyerId:     user.id,
        sellerId,
        orderNumber,
        itemsList,
      })

      console.log('✅ Order created:', orderNumber)
    } catch (orderError) {
      console.error('❌ Failed to create order for seller', sellerId, orderError)
      throw orderError
    }
  }

  // Fire in-app notifications — non-blocking
  for (const n of notificationQueue) {
    notifyOrderPlaced(n.orderId, n.buyerId, n.sellerId, n.orderNumber, n.itemsList)
      .catch(err => console.error(`⚠️  Notification failed for ${n.orderNumber}:`, err))
  }

  if (outOfStockAlerts.length > 0) {
    Promise.allSettled(
      outOfStockAlerts.map(alert =>
        notifySellerOutOfStock(alert.sellerId, alert.productId, alert.productName)
      )
    ).catch(() => { })
  }

  console.log('🎉 All orders created:', createdOrders.length, '| Batch:', batchNumber)
  return createdOrders
}

// ─────────────────────────────────────────────────────────────────────────────
// Out-of-stock seller notification (fire-and-forget, all imports dynamic)
// ─────────────────────────────────────────────────────────────────────────────
async function notifySellerOutOfStock(sellerId: string, productId: string, productName: string) {
  const [notifMod, emailMod, prismaMod] = await Promise.all([
    import('@/lib/notification').catch(() => null),
    import('@/lib/email/sendEmail').catch(() => null),
    import('@/lib/prisma').catch(() => null),
  ])

  const seller = prismaMod
    ? await prismaMod.prisma.user.findUnique({
        where:  { id: sellerId },
        select: { email: true, name: true },
      }).catch(() => null)
    : null

  const tasks: Promise<any>[] = []

  if (notifMod?.createNotification) {
    tasks.push(
      notifMod.createNotification({
        userId:   sellerId,
        type:     'ORDER_PLACED',
        title:    '⚠️ Product Out of Stock',
        message:  `"${productName}" has sold out and been hidden from the marketplace. Restock it to make it visible again.`,
        metadata: { productId, productName },
      })
    )
  }

  if (seller?.email && emailMod?.sendEmail) {
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://batamart.com').replace(/\/$/, '')
    tasks.push(
      emailMod.sendEmail({
        to:      seller.email,
        subject: `⚠️ "${productName}" is out of stock — BATAMART`,
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:28px;font-weight:800;color:#111827;letter-spacing:-1px;">BATAMART</span>
              <span style="font-size:12px;color:#6b7280;display:block;margin-top:2px;">Campus Marketplace</span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              <p style="font-size:32px;margin:0 0 8px;">⚠️</p>
              <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Product Out of Stock</h2>
              <p style="font-size:15px;color:#6b7280;margin:0 0 16px;">
                Hi ${seller.name ?? 'Seller'}, your product <strong style="color:#111827;">"${productName}"</strong> has just sold out.
              </p>
              <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:20px;">
                <p style="margin:0;font-size:14px;color:#92400e;font-weight:600;">
                  It has been automatically hidden from the marketplace to prevent buyers from ordering something you can't fulfil.
                </p>
              </div>
              <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">
                To start selling again, go to your shop and restock this product.
              </p>
              <a href="${APP_URL}/my-shop"
                 style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;border-radius:10px;text-decoration:none;">
                Restock Now →
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="font-size:12px;color:#9ca3af;margin:0;">BATAMART — Campus Marketplace</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `,
      })
    )
  }

  await Promise.allSettled(tasks)
}
