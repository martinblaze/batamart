// app/api/payments/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createOrders } from '../initialize/route'
import { checkRateLimitDistributed, getIpKey } from '@/lib/security/rate-limit'
import { flutterwaveRequest } from '@/lib/finance/flutterwave'

export const dynamic = 'force-dynamic'

// Helper: redirect to the correct app domain
function appRedirect(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base) {
    console.error('❌ CRITICAL: NEXT_PUBLIC_APP_URL is not set in environment variables!')
    return NextResponse.redirect(`https://batamart.com${path}`)
  }

  try {
    const url = new URL(path, base)
    return NextResponse.redirect(url.toString())
  } catch (redirectError) {
    console.error('❌ Invalid NEXT_PUBLIC_APP_URL:', base, redirectError)
    return NextResponse.redirect(`https://batamart.com${path}`)
  }
}

type VerifiedCartItem = {
  productId:  string
  variantId?: string | null
  price:      number
  quantity:   number
  sellerId:   string
  orderNote?: string
  buyerDeliveryAcknowledged?: boolean
}

type MetadataShape = {
  userId: string
  cartItems: VerifiedCartItem[]
}

function parseMetadata(value: unknown): MetadataShape | null {
  const normalizeItem = (item: unknown): VerifiedCartItem | null => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const obj = item as Record<string, unknown>

    const productId = typeof obj.productId === 'string' ? obj.productId : ''
    const sellerId = typeof obj.sellerId === 'string' ? obj.sellerId : ''
    const quantity = Number(obj.quantity)
    const price = Number(obj.price)
    const variantId = typeof obj.variantId === 'string' && obj.variantId.trim().length > 0
      ? obj.variantId
      : null
    const orderNote = typeof obj.orderNote === 'string' ? obj.orderNote : undefined
    const buyerDeliveryAcknowledged =
      obj.buyerDeliveryAcknowledged === true ||
      obj.buyerDeliveryAcknowledged === 'true' ||
      obj.buyerDeliveryAcknowledged === 1 ||
      obj.buyerDeliveryAcknowledged === '1'

    if (!productId || !sellerId || !Number.isFinite(quantity) || !Number.isFinite(price)) return null

    return {
      productId,
      variantId,
      price,
      quantity: Math.trunc(quantity),
      sellerId,
      orderNote,
      buyerDeliveryAcknowledged,
    }
  }

  const normalizeRoot = (input: unknown): MetadataShape | null => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null
    const obj = input as Record<string, unknown>
    if (typeof obj.userId !== 'string') return null

    // Flutterwave's `meta` values must be flat (string/number), so
    // initialize/route.ts sends cartItems as a JSON string — parse it back here.
    let rawCartItems: unknown = obj.cartItems
    if (typeof rawCartItems === 'string') {
      try {
        rawCartItems = JSON.parse(rawCartItems)
      } catch {
        return null
      }
    }
    if (!Array.isArray(rawCartItems)) return null

    const cartItems = rawCartItems.map(normalizeItem).filter((item): item is VerifiedCartItem => Boolean(item))
    if (cartItems.length === 0) return null

    return { userId: obj.userId, cartItems }
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'string') {
        try {
          return normalizeRoot(JSON.parse(parsed))
        } catch {
          return null
        }
      }
      return normalizeRoot(parsed)
    } catch {
      return null
    }
  }

  return normalizeRoot(value)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  // Flutterwave's redirect_url callback appends ?status=...&tx_ref=...&transaction_id=...
  // tx_ref is the reference WE generated (BATAMART-...) and is what's stored as
  // Payment.transactionId for idempotency; transaction_id is Flutterwave's own
  // numeric transaction ID, required to call the verify endpoint.
  const transRef = (searchParams.get('tx_ref') ?? searchParams.get('transRef') ?? searchParams.get('reference'))?.trim() || null
  const flwTransactionId = searchParams.get('transaction_id')?.trim() || null
  const flwStatus = searchParams.get('status')?.trim() || null
  const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))

  console.log('═'.repeat(70))
  console.log('🔥 PAYMENT VERIFICATION STARTED')
  console.log('═'.repeat(70))
  console.log('🔍 transRef:', transRef)
  console.log('🔍 Timestamp:', new Date().toISOString())
  console.log('🔍 APP_URL:', process.env.NEXT_PUBLIC_APP_URL ?? '⚠️  NOT SET')

  if (!transRef) {
    console.error('❌ ERROR: No transaction reference in URL')
    return appRedirect('/checkout?error=no_reference')
  }
  if (!/^[A-Za-z0-9._:-]{6,128}$/.test(transRef)) {
    return appRedirect('/checkout?error=invalid_reference')
  }
  // Flutterwave sends status=cancelled (no transaction_id) if the buyer backs
  // out of the checkout page — bail before spending a verify call/rate-limit slot.
  if (flwStatus && flwStatus !== 'successful' && flwStatus !== 'completed') {
    console.log('⚠️  Flutterwave redirect status was not successful:', flwStatus)
    return appRedirect('/checkout?error=payment_failed')
  }
  if (!flwTransactionId) {
    console.error('❌ ERROR: No Flutterwave transaction_id in URL')
    return appRedirect('/checkout?error=no_reference')
  }
  const rate = await checkRateLimitDistributed(
    `payments:verify:${ip}:${transRef}`,
    10,
    10 * 60 * 1000,
    { requireDistributedInProduction: true },
  )
  if (!rate.allowed) {
    return appRedirect('/checkout?error=rate_limited')
  }

  try {
    // STEP 1: Verify with Flutterwave
    console.log('\n💾 STEP 1: Verifying with Flutterwave')

    let verifyData: any
    try {
      const { data } = await flutterwaveRequest(`/transactions/${encodeURIComponent(flwTransactionId)}/verify`)
      verifyData = data
    } catch (fetchErr) {
      console.error('Network error calling Flutterwave:', fetchErr)
      return appRedirect('/checkout?error=payment_failed')
    }

    console.log('Flutterwave status:', verifyData?.status, '| tx status:', verifyData?.data?.status)

    if (verifyData?.status !== 'success') {
      console.error('Flutterwave returned a non-success status:', verifyData?.message)
      return appRedirect('/checkout?error=payment_failed')
    }

    // Cross-check the tx_ref Flutterwave has on file for this transaction_id
    // matches the tx_ref from the redirect URL, so a stale/tampered
    // transaction_id can't be swapped in for a different order's tx_ref.
    if (verifyData?.data?.tx_ref && verifyData.data.tx_ref !== transRef) {
      console.error('❌ tx_ref mismatch:', { expected: transRef, got: verifyData.data.tx_ref })
      return appRedirect('/checkout?error=invalid_reference')
    }

    const paymentStatus = String(verifyData?.data?.status ?? '').toLowerCase()
    if (paymentStatus !== 'successful' && paymentStatus !== 'success') {
      console.error('Payment not successful. Status:', verifyData?.data?.status)
      return appRedirect('/checkout?error=payment_failed')
    }

    console.log('Payment verified with Flutterwave')

    // STEP 2: Idempotency guard
    // If Flutterwave fires the callback twice or the user hits reload, we must
    // NOT create a second order. We look up by Payment.transactionId (the
    // tx_ref stored when createOrders creates the Payment record).
    console.log('\n🧷 STEP 2: Idempotency check')

    const existingPayment = await prisma.payment.findFirst({
      where:   { transactionId: transRef },
      include: { order: { select: { id: true, orderNumber: true } } },
    })

    if (existingPayment?.order) {
      console.log('Already processed - idempotent redirect to:', existingPayment.order.orderNumber)
      return appRedirect(`/orders?payment=success&order=${existingPayment.order.orderNumber}`)
    }

    console.log('No duplicate - safe to proceed')

    // STEP 3: Extract metadata
    console.log('\n📦 STEP 3: Extracting Metadata')

    const rawMetadata = verifyData.data.meta
    const meta = parseMetadata(rawMetadata)
    const perOrderDelivery = 800

    if (!meta || !meta.userId || !Array.isArray(meta.cartItems) || meta.cartItems.length === 0) {
      console.error('Invalid/missing metadata:', JSON.stringify(meta))
      return appRedirect('/checkout?error=invalid_metadata')
    }
    if (verifyData?.data?.currency && verifyData.data.currency !== 'NGN') {
      return appRedirect('/checkout?error=payment_failed')
    }

    for (const item of meta.cartItems) {
      if (!item?.productId || !item.sellerId || !Number.isInteger(item?.quantity) || item.quantity < 1 || item.quantity > 50) {
        console.error('Invalid cart item in metadata:', item)
        return appRedirect('/checkout?error=invalid_metadata')
      }
      if (!Number.isFinite(item.price) || item.price < 0) {
        console.error('Invalid cart item price in metadata:', item)
        return appRedirect('/checkout?error=invalid_metadata')
      }
    }

    console.log('Metadata OK - User:', meta.userId, '| Items:', meta.cartItems.length)

    const distinctSellerCount = new Set(meta.cartItems.map(i => i.sellerId)).size
    const recomputedSubtotal = meta.cartItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0)
    // Flutterwave amounts are whole Naira units, NOT kobo — don't reintroduce *100 here.
    const expectedAmountNaira = Math.round((recomputedSubtotal + (distinctSellerCount * perOrderDelivery)) * 100) / 100
    const paidAmountNaira = Number(verifyData?.data?.amount ?? 0)
    if (!Number.isFinite(paidAmountNaira) || Math.round(paidAmountNaira * 100) !== Math.round(expectedAmountNaira * 100)) {
      console.error('❌ Paid amount mismatch', { expectedAmountNaira, paidAmountNaira })
      return appRedirect('/checkout?error=amount_mismatch')
    }

    // STEP 4: Fetch buyer (include universityId for batch campus-scoping)
    console.log('\n👤 STEP 4: Fetching Buyer')

    const buyer = await prisma.user.findUnique({
      where:  { id: meta.userId },
      select: {
        id: true, name: true, email: true,
        hostelName: true, roomNumber: true,
        phone: true, landmark: true,
        universityId: true,
      },
    })

    if (!buyer) {
      console.error('❌ Buyer not found for userId:', meta.userId)
      return appRedirect('/checkout?error=user_not_found')
    }

    console.log('✅ Buyer found:', buyer.name)

    // STEP 5: Optimistic stock check (fast path ? catches obvious failures early)
    // NOTE: This is NOT the authoritative stock gate. The real atomic guard is
    // the updateMany(...where quantity >= item.quantity) inside createOrders.
    // This pre-check is just a cheap early-exit that saves us from entering the
    // transaction when stock is clearly exhausted.
    console.log('\n?? STEP 5: Pre-flight Stock Check')

    const enrichedCartItems: Array<VerifiedCartItem & {
      name: string
      category: string
      sellerName: string
    }> = []

    for (const item of meta.cartItems) {
      const product = await prisma.product.findUnique({
        where:  { id: item.productId },
        include: {
          variants: true,
          seller: { select: { name: true } },
        },
      })

      if (!product) {
        return appRedirect(`/checkout?error=product_not_found&product=${encodeURIComponent(item.productId)}`)
      }
      if (!product.isActive) {
        return appRedirect(`/checkout?error=product_inactive&product=${encodeURIComponent(product.name)}`)
      }
      const variant = item.variantId
        ? product.variants.find(v => v.id === item.variantId)
        : null
      if (item.variantId && !variant) {
        return appRedirect(`/checkout?error=product_inactive&product=${encodeURIComponent(product.name)}`)
      }
      const availableStock = variant ? variant.stock : product.quantity
      if (availableStock < item.quantity) {
        return appRedirect(`/checkout?error=out_of_stock&product=${encodeURIComponent(product.name)}`)
      }

      enrichedCartItems.push({
        ...item,
        name: product.name,
        category: product.category,
        sellerName: product.seller.name,
      })
      console.log(`? ${product.name}: OK (stock: ${availableStock})`)
    }

    // STEP 6: Create orders + DeliveryBatch
    // createOrders creates ONE DeliveryBatch then one Order per seller group.
    // Each order carries a full ?800 delivery fee.
    // updateMany with quantity >= guard atomically claims stock.
    // If two buyers race for the last unit, the second gets STOCK_GONE thrown.
    console.log('\n?? STEP 6: Creating Orders + DeliveryBatch')

    let orders: Awaited<ReturnType<typeof createOrders>>
    try {
      orders = await createOrders(enrichedCartItems, buyer, transRef)
    } catch (createErr) {
      // Handle the STOCK_GONE error thrown by the TOCTOU-safe updateMany guard.
      if (createErr instanceof Error && createErr.message.startsWith('STOCK_GONE:')) {
        const [, , productName] = createErr.message.split(':')
        console.error('? Stock claimed by concurrent buyer for:', productName)
        return appRedirect(`/checkout?error=out_of_stock&product=${encodeURIComponent(productName ?? 'item')}`)
      }
      throw createErr // re-throw anything else so the outer catch handles it
    }

    if (!orders || orders.length === 0) {
      console.error('? createOrders returned empty result')
      return appRedirect('/checkout?error=order_creation_failed')
    }

    console.log('? Orders created:', orders.map(o => o.orderNumber).join(', '))

    // STEP 7: Fire notifications (non-blocking ? NEVER delays the redirect)
    console.log('\n🔔 STEP 7: Queueing Notifications')

    const sellerMap = new Map<string, {
      orderId:     string
      orderNumber: string
      orderNote?:  string
      itemsList:   string
    }>()

    for (const order of orders) {
      if (order.sellerId && !sellerMap.has(order.sellerId)) {
        const sellerItems = enrichedCartItems.filter(i => i.sellerId === order.sellerId)
        sellerMap.set(order.sellerId, {
          orderId:     order.id,
          orderNumber: order.orderNumber,
          orderNote:   sellerItems[0]?.orderNote,
          itemsList:   sellerItems.map(i => `${i.name} (x${i.quantity})`).join(', '),
        })
      }
    }

    // All notification work is fire-and-forget — never blocks the redirect
    Promise.allSettled([
      import('@/lib/notification')
        .then(({ notifyOrderPlaced }) =>
          notifyOrderPlaced(
            orders[0].id,
            buyer.id,
            orders[0].sellerId,
            orders[0].orderNumber,
            enrichedCartItems.map(i => i.name).join(', ')
          )
        )
        .catch(err => console.error('⚠️  Buyer bell notification failed:', err)),

      import('@/lib/push/sendPushNotification')
        .then(({ notifyOrderPlaced: pushBuyer }) => pushBuyer(buyer.id, orders[0].orderNumber))
        .catch(err => console.error('⚠️  Buyer push failed:', err)),

      ...Array.from(sellerMap.entries()).map(([sellerId, info]) =>
        notifySellerOfNewOrder(
          sellerId,
          info.orderId,
          info.orderNumber,
          info.orderNote,
          buyer.name ?? 'A buyer',
          info.itemsList,
        ).catch(err => console.error(`⚠️  Seller notification failed for ${sellerId}:`, err))
      ),

      // Riders are notified right away — they can see the job on their
      // dashboard immediately, they just can't tap Accept until every seller
      // in the batch has confirmed (see app/api/riders/accept-order/route.ts).
      // Scoped to the buyer's campus — riders elsewhere can't see or accept
      // this batch anyway (see app/api/riders/available-orders/route.ts).
      ...(buyer.universityId ? [
        import('@/lib/push/sendPushNotification')
          .then(({ notifyAvailableRiders }) => notifyAvailableRiders(orders[0].orderNumber, buyer.universityId!))
          .catch(err => console.error('⚠️  Rider push failed:', err)),
      ] : []),
    ]).then(results => {
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.error(`Notification slot ${i} rejected:`, r.reason)
      })
    })

    // SUCCESS
    const redirectUrl = `/orders?payment=success&order=${orders[0]?.orderNumber}&count=${orders.length}`
    console.log('\n🎉 SUCCESS — Redirecting to:', redirectUrl)
    console.log('═'.repeat(70))

    return appRedirect(redirectUrl)

  } catch (error) {
    console.error('\n💥 FATAL ERROR in payment verification:')
    console.error(error instanceof Error ? error.message : error)
    if (error instanceof Error) console.error(error.stack)
    return appRedirect('/checkout?error=verification_failed&reason=exception')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Seller notification helper — all imports are dynamic so a missing module
// never crashes the verify route.
// Restored exactly from original: in-app bell, note notification, push,
// and full email template (only when buyer left a note).
// ─────────────────────────────────────────────────────────────────────────────
async function notifySellerOfNewOrder(
  sellerId:    string,
  orderId:     string,
  orderNumber: string,
  orderNote:   string | undefined,
  buyerName:   string,
  itemsList:   string,
) {
  const hasNote = Boolean(orderNote?.trim())

  const [notifMod, pushMod, emailMod, prismaMod] = await Promise.all([
    import('@/lib/notification').catch(() => null),
    import('@/lib/push/sendPushNotification').catch(() => null),
    import('@/lib/email/sendEmail').catch(() => null),
    import('@/lib/prisma').catch(() => null),
  ])

  const seller = prismaMod
    ? await prismaMod.prisma.user.findUnique({
        where:  { id: sellerId },
        select: { email: true },
      }).catch(() => null)
    : null

  const tasks: Promise<any>[] = []

  if (notifMod?.createNotification) {
    tasks.push(
      notifMod.createNotification({
        userId:  sellerId,
        type:    'ORDER_PLACED',
        title:   '🛒 New Order Received!',
        message: `You have a new order (#${orderNumber}) for ${itemsList}`,
        orderId,
        metadata: { orderNumber, buyerName, itemsList, sellerId, orderUrl: `/orders/sales?highlight=${orderId}` },
      })
    )

    // Separate in-app notification for the buyer's note
    if (hasNote) {
      tasks.push(
        notifMod.createNotification({
          userId:  sellerId,
          type:    'ORDER_PLACED',
          title:   '📝 Note from Buyer',
          message: `For order #${orderNumber}: "${orderNote}"`,
          orderId,
          metadata: { orderNumber, orderNote, sellerId, orderUrl: `/orders/sales?highlight=${orderId}` },
        })
      )
    }
  }

  if (pushMod?.notifyNewOrder) {
    tasks.push(pushMod.notifyNewOrder(sellerId, orderNumber, orderId))
  }

  // Email only fires when the buyer left a note (same as original)
  if (hasNote && seller?.email && emailMod?.sendEmail) {
    const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://batamart.com').replace(/\/$/, '')
    tasks.push(
      emailMod.sendEmail({
        to:      seller.email,
        subject: `🎉 New Order #${orderNumber} — BATAMART`,
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
              <p style="font-size:32px;margin:0 0 8px;">🎉</p>
              <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">New Order Received!</h2>
              <p style="font-size:15px;color:#6b7280;margin:0 0 4px;">
                <strong style="color:#111827;">${buyerName}</strong> just placed order
                <strong style="color:#111827;">#${orderNumber}</strong>.
              </p>
              <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">
                Please confirm it as soon as possible so a rider can be assigned.
              </p>
              <div style="margin:20px 0;padding:16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:8px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;">
                  📝 Customer's Note to You
                </p>
                <p style="margin:0;font-size:15px;color:#78350f;line-height:1.6;font-style:italic;">
                  "${orderNote}"
                </p>
              </div>
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;"/>
              <p style="font-size:13px;color:#9ca3af;margin:0 0 20px;">
                ⚠️ Orders not confirmed within 30 minutes may be auto-cancelled.
              </p>
              <a href="${APP_URL}/orders/sales"
                 style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff;font-size:15px;font-weight:600;border-radius:10px;text-decoration:none;">
                Confirm Order Now →
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="font-size:12px;color:#9ca3af;margin:0;">
                BATAMART — Campus Marketplace · Awka, Anambra State
              </p>
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

