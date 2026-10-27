// lib/checkout/resolve-items.ts
// Validates a checkout request body and turns it into priced cart items.
// Shared by card checkout (app/api/payments/initialize) and wallet checkout
// (app/api/payments/wallet-pay) so both enforce the same rules. Prices always
// come from the database, never from the client.

import { z } from 'zod'
import { prisma } from '@/lib/prisma'

export type CheckoutItem = {
  productId: string
  variantId?: string | null
  price: number
  quantity: number
  sellerId: string
  landmark: string
  orderNote?: string
  buyerDeliveryAcknowledged?: boolean
  // Used when the order is created straight from the server (wallet pay).
  name: string
  category: string
  sellerName: string
  campaignTag: string | null
}

// Flat shape on purpose: without strictNullChecks a union on `ok` doesn't narrow.
export type ResolveResult = { ok: boolean; items?: CheckoutItem[]; status?: number; error?: string }

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
  // wallet-pay only
  pin: z.string().optional(),
}).strict()

export const checkoutBodySchema = schema

export async function resolveCheckoutItems(
  body: unknown,
  user: { id: string; universityId?: string | null },
): Promise<ResolveResult> {
  const parsed = schema.safeParse(body)
  if (!parsed.success) return { ok: false, status: 400, error: 'Invalid request payload' }
  const { productId, cartItems } = parsed.data

  const items: CheckoutItem[] = []

  const load = async (id: string) =>
    prisma.product.findUnique({
      where: { id },
      include: { seller: { select: { name: true, isSuspended: true } }, variants: true },
    })

  if (cartItems && cartItems.length > 0) {
    for (const item of cartItems) {
      const product = await load(item.productId)
      if (!product) return { ok: false, status: 404, error: `Product not found: ${item.productId}` }

      let price = product.price
      let stock = product.quantity
      if (item.variantId) {
        const variant = product.variants.find(v => v.id === item.variantId)
        if (!variant) return { ok: false, status: 400, error: `Variant not found for product: ${product.name}` }
        price = variant.price
        stock = variant.stock
      }
      if (product.seller.isSuspended || product.moderationStatus === 'UNDER_REVIEW' || product.moderationStatus === 'REMOVED') {
        return { ok: false, status: 400, error: `Product unavailable: ${product.name}` }
      }
      // Delivery is hyperlocal: a link can be viewed from anywhere, but only
      // buyers on the seller's campus can check out.
      if (product.universityId && product.universityId !== user.universityId) {
        return { ok: false, status: 400, error: `${product.name} isn't available for delivery to your campus` }
      }
      if (!product.isActive || stock < item.quantity) {
        return { ok: false, status: 400, error: `Product unavailable: ${product.name}` }
      }
      items.push({
        productId: product.id,
        variantId: item.variantId || null,
        price,
        quantity: item.quantity,
        sellerId: product.sellerId,
        landmark: product.landmark,
        orderNote: item.orderNote,
        buyerDeliveryAcknowledged: item.buyerDeliveryAcknowledged === true,
        name: product.name,
        category: product.category,
        sellerName: product.seller.name,
        campaignTag: product.campaignTag,
      })
    }
  } else if (productId) {
    const product = await load(productId)
    if (!product) return { ok: false, status: 404, error: 'Product not found' }

    let price = product.price
    let stock = product.quantity
    const variantId = parsed.data.variantId || null
    if (variantId) {
      const variant = product.variants.find(v => v.id === variantId)
      if (!variant) return { ok: false, status: 400, error: `Variant not found for product: ${product.name}` }
      price = variant.price
      stock = variant.stock
    }
    if (product.universityId && product.universityId !== user.universityId) {
      return { ok: false, status: 400, error: `${product.name} isn't available for delivery to your campus` }
    }
    if (!product.isActive || stock < 1) return { ok: false, status: 400, error: 'Product unavailable' }

    items.push({
      productId: product.id,
      variantId,
      price,
      quantity: 1,
      sellerId: product.sellerId,
      landmark: product.landmark,
      orderNote: parsed.data.orderNote,
      buyerDeliveryAcknowledged: false,
      name: product.name,
      category: product.category,
      sellerName: product.seller.name,
      campaignTag: product.campaignTag,
    })
  } else {
    return { ok: false, status: 400, error: 'No products provided' }
  }

  if (items.some(i => i.sellerId === user.id)) {
    return { ok: false, status: 400, error: 'You cannot buy your own product' }
  }

  return { ok: true, items }
}
