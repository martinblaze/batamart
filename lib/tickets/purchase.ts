// lib/tickets/purchase.ts — server-only.
// The two money-critical steps of ticketing, kept in one place so every entry
// point (card checkout, wallet checkout, resale) applies the same rules:
//
//   prepareSale()     validates event / tier / quantity / reseller and prices it
//   settlePurchase()  the ONLY place a purchase becomes PAID. Idempotent: the
//                     PENDING -> PAID flip is a single guarded update, so a
//                     double callback or a double click can never issue twice.

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  PENDING_HOLD_MINUTES, MAX_QTY_PER_PURCHASE, salesCloseAt,
} from '@/lib/tickets/config'
import { splitTicketMoney, type TicketSplit } from '@/lib/tickets/money'
import { generateTicketCode, generateTicketSecret, generateLinkToken, generatePurchaseReference } from '@/lib/tickets/codes'

export class TicketError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message)
  }
}

export interface PreparedSale {
  event: { id: string; name: string; hostId: string; startsAt: Date }
  tier: { id: string; name: string; price: number }
  quantity: number
  split: TicketSplit
  resellerId: string | null
  sellerKind: 'DIRECT' | 'RANDOM' | 'UNIQUE'
}

/** Tickets still on sale for a tier: capacity minus paid minus recent unpaid holds. */
export async function availableForTier(tierId: string, excludePurchaseId?: string): Promise<number> {
  const tier = await prisma.ticketTier.findUnique({ where: { id: tierId }, select: { capacity: true, sold: true } })
  if (!tier) return 0
  const since = new Date(Date.now() - PENDING_HOLD_MINUTES * 60_000)
  const held = await prisma.ticketPurchase.aggregate({
    _sum: { quantity: true },
    where: { tierId, status: 'PENDING', createdAt: { gte: since }, ...(excludePurchaseId ? { id: { not: excludePurchaseId } } : {}) },
  })
  return Math.max(0, tier.capacity - tier.sold - (held._sum.quantity ?? 0))
}

export async function prepareSale(input: {
  eventId: string
  tierId: string
  quantity: number
  resellerId?: string | null
  buyerUserId?: string | null
}): Promise<PreparedSale> {
  const quantity = Math.floor(Number(input.quantity))
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_PURCHASE) {
    throw new TicketError('BAD_QUANTITY', `You can buy 1 to ${MAX_QTY_PER_PURCHASE} tickets at a time.`)
  }

  const tier = await prisma.ticketTier.findUnique({
    where: { id: input.tierId },
    select: {
      id: true, eventId: true, name: true, price: true, isActive: true, saleStartsAt: true, saleEndsAt: true,
      randomCommissionPct: true, uniqueCommissionPct: true,
      event: { select: { id: true, name: true, hostId: true, startsAt: true, endsAt: true, status: true, allowResale: true } },
    },
  })
  if (!tier || tier.eventId !== input.eventId) throw new TicketError('NOT_FOUND', 'That ticket is not available.', 404)
  const event = tier.event
  if (event.status !== 'ACTIVE') throw new TicketError('EVENT_NOT_ON_SALE', 'Tickets for this event are not on sale right now.')
  const now = Date.now()
  if (now > salesCloseAt(event.startsAt, event.endsAt)) {
    throw new TicketError('EVENT_OVER', 'This event has already taken place.')
  }
  if (!tier.isActive) throw new TicketError('TIER_OFF', 'This ticket type is not on sale.')
  if (tier.saleStartsAt && now < tier.saleStartsAt.getTime()) throw new TicketError('NOT_YET', 'Sales for this ticket have not opened yet.')
  if (tier.saleEndsAt && now > tier.saleEndsAt.getTime()) throw new TicketError('SALES_CLOSED', 'Sales for this ticket have closed.')

  const available = await availableForTier(tier.id)
  if (quantity > available) {
    throw new TicketError('SOLD_OUT', available === 0 ? 'Sold out.' : `Only ${available} left.`, 409)
  }

  // Who, if anyone, resold it. A reseller who is the host or the buyer earns nothing:
  // the sale is just treated as a direct one.
  let resellerId: string | null = null
  let sellerKind: PreparedSale['sellerKind'] = 'DIRECT'
  let commissionPct = 0
  if (input.resellerId && input.resellerId !== event.hostId && input.resellerId !== input.buyerUserId) {
    if (!event.allowResale) throw new TicketError('NO_RESALE', 'This event does not allow resale.')
    const listing = await prisma.ticketListing.findUnique({
      where: { eventId_sellerId: { eventId: event.id, sellerId: input.resellerId } },
      select: { isActive: true, seller: { select: { isSuspended: true, isDeleted: true } } },
    })
    if (!listing || !listing.isActive || listing.seller.isSuspended || listing.seller.isDeleted) {
      throw new TicketError('BAD_SELLER', 'This seller is not selling these tickets any more.')
    }
    const unique = await prisma.eventSeller.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: input.resellerId } },
      select: { isActive: true },
    })
    resellerId = input.resellerId
    sellerKind = unique?.isActive ? 'UNIQUE' : 'RANDOM'
    commissionPct = sellerKind === 'UNIQUE' ? tier.uniqueCommissionPct : tier.randomCommissionPct
  }

  const split = splitTicketMoney(tier.price, quantity, commissionPct)
  return {
    event: { id: event.id, name: event.name, hostId: event.hostId, startsAt: event.startsAt },
    tier: { id: tier.id, name: tier.name, price: tier.price },
    quantity,
    split,
    resellerId,
    sellerKind,
  }
}

export async function createPendingPurchase(sale: PreparedSale, buyer: { userId?: string | null; email: string }, method: 'CARD' | 'WALLET') {
  const created = await createPendingRow(sale, buyer, method)
  // prepareSale's availability check is not atomic: many parallel checkouts can all pass it.
  // Re-count now that our hold exists; if the tier is over-held, drop ours (safe direction:
  // when two race, both may back off and retry, but nobody pays for a ticket that is not there).
  const left = await availableForTier(sale.tier.id, created.id)
  if (left < sale.quantity) {
    await prisma.ticketPurchase.deleteMany({ where: { id: created.id, status: 'PENDING' } })
    throw new TicketError('SOLD_OUT', left === 0 ? 'Sold out.' : `Only ${left} left.`, 409)
  }
  return created
}

async function createPendingRow(sale: PreparedSale, buyer: { userId?: string | null; email: string }, method: 'CARD' | 'WALLET') {
  return prisma.ticketPurchase.create({
    data: {
      reference: generatePurchaseReference(),
      eventId: sale.event.id,
      tierId: sale.tier.id,
      buyerUserId: buyer.userId ?? null,
      buyerEmail: buyer.email,
      quantity: sale.quantity,
      unitPrice: sale.split.unitPrice,
      subtotal: sale.split.subtotal,
      platformFee: sale.split.platformFee,
      commission: sale.split.commission,
      hostAmount: sale.split.hostAmount,
      resellerId: sale.resellerId,
      sellerKind: sale.sellerKind,
      paymentMethod: method,
      accessToken: generateLinkToken(),
    },
  })
}

async function credit(tx: Prisma.TransactionClient, userId: string, amount: number, description: string, reference: string) {
  if (amount <= 0) return
  const u = await tx.user.update({
    where: { id: userId },
    data: { availableBalance: { increment: amount } },
    select: { availableBalance: true },
  })
  const after = Number(u.availableBalance)
  await tx.transaction.create({
    data: { userId, type: 'CREDIT', amount, description, reference, balanceBefore: after - amount, balanceAfter: after },
  })
}

export type SettleResult =
  | { ok: true; already: boolean; purchaseId: string }
  | { ok: false; code: string; message: string }

/**
 * Marks a purchase paid, issues its tickets and pays everyone, atomically.
 *  - CARD:   pass the gateway-verified amount; it must equal the purchase subtotal.
 *  - WALLET: pass walletUserId; the buyer's balance is debited in the same transaction.
 */
export async function settlePurchase(
  purchaseId: string,
  opts: { method: 'CARD' | 'WALLET'; gatewayTxId?: string; paidAmount?: number; walletUserId?: string },
): Promise<SettleResult> {
  try {
    const out = await prisma.$transaction(
      async tx => {
        const claimed = await tx.ticketPurchase.updateMany({
          where: { id: purchaseId, status: { in: ['PENDING', 'FAILED'] } },
          data: { status: 'PAID', paidAt: new Date(), paymentMethod: opts.method, gatewayTxId: opts.gatewayTxId ?? null },
        })
        if (claimed.count === 0) return { already: true as const }

        const p = await tx.ticketPurchase.findUnique({
          where: { id: purchaseId },
          include: { event: { select: { id: true, name: true, hostId: true } }, tier: { select: { id: true, name: true } } },
        })
        if (!p) throw new TicketError('NOT_FOUND', 'Purchase not found', 404)

        // A reseller buying their own ticket (signed in, or as a guest with their own email)
        // earns nothing: the commission stays with the host and the sale becomes DIRECT.
        if (p.resellerId) {
          const rs = await tx.user.findUnique({ where: { id: p.resellerId }, select: { email: true } })
          const same = p.resellerId === p.buyerUserId
            || (!!rs?.email && rs.email.trim().toLowerCase() === p.buyerEmail.trim().toLowerCase())
          if (same) {
            await tx.ticketPurchase.update({
              where: { id: p.id },
              data: { resellerId: null, sellerKind: 'DIRECT', hostAmount: p.hostAmount + p.commission, commission: 0 },
            })
            p.hostAmount += p.commission
            p.commission = 0
            p.resellerId = null
          }
        }

        if (opts.method === 'CARD') {
          if (!Number.isFinite(opts.paidAmount) || Math.round(Number(opts.paidAmount)) !== p.subtotal) {
            throw new TicketError('AMOUNT_MISMATCH', 'The amount paid does not match this order.')
          }
        } else {
          if (!opts.walletUserId || opts.walletUserId !== p.buyerUserId) {
            throw new TicketError('BAD_BUYER', 'Wallet payment is only for the signed-in buyer.', 403)
          }
          const debited = await tx.user.updateMany({
            where: { id: opts.walletUserId, availableBalance: { gte: p.subtotal } },
            data: { availableBalance: { decrement: p.subtotal } },
          })
          if (debited.count === 0) throw new TicketError('INSUFFICIENT_FUNDS', 'Your wallet balance is too low.')
          const after = await tx.user.findUnique({ where: { id: opts.walletUserId }, select: { availableBalance: true } })
          const bal = Number(after?.availableBalance ?? 0)
          await tx.transaction.create({
            data: {
              userId: opts.walletUserId, type: 'DEBIT', amount: p.subtotal,
              description: `Tickets: ${p.quantity} x ${p.tier.name}, ${p.event.name}`,
              reference: `${p.reference}-BUYER`, balanceBefore: bal + p.subtotal, balanceAfter: bal,
            },
          })
        }

        // Capacity: a guarded increment. If the last tickets were taken while this buyer
        // was paying, the paid buyer still gets theirs (never keep money without a ticket)
        // and the purchase is flagged for the host and admin.
        const bumped = await tx.$executeRaw`
          UPDATE "public"."TicketTier" SET "sold" = "sold" + ${p.quantity}
          WHERE "id" = ${p.tierId} AND "sold" + ${p.quantity} <= "capacity"`
        let overbooked = false
        if (bumped === 0) {
          await tx.ticketTier.update({ where: { id: p.tierId }, data: { sold: { increment: p.quantity } } })
          overbooked = true
          await tx.auditLog.create({
            data: { action: 'TICKET_OVERBOOKED', entityType: 'TicketPurchase', entityId: p.id, newValue: { tierId: p.tierId, quantity: p.quantity } },
          })
        }

        const ticketIds: string[] = []
        for (let i = 0; i < p.quantity; i++) {
          const t = await tx.ticket.create({
            data: {
              purchaseId: p.id, eventId: p.eventId, tierId: p.tierId,
              code: generateTicketCode(), secret: generateTicketSecret(),
              ownerUserId: p.buyerUserId, ownerEmail: p.buyerEmail,
            },
            select: { id: true },
          })
          ticketIds.push(t.id)
        }

        await credit(tx, p.event.hostId, p.hostAmount, `Ticket sale: ${p.quantity} x ${p.tier.name}, ${p.event.name}`, `${p.reference}-HOST`)
        if (p.resellerId && p.commission > 0) {
          await credit(tx, p.resellerId, p.commission, `Ticket resale commission: ${p.event.name}`, `${p.reference}-RESELLER`)
        }
        if (overbooked) await tx.ticketPurchase.update({ where: { id: p.id }, data: { overbooked: true } })

        return { already: false as const, ticketIds }
      },
      { timeout: 20_000, maxWait: 20_000 },
    )
    return { ok: true, already: out.already, purchaseId }
  } catch (err: any) {
    if (err instanceof TicketError) return { ok: false, code: err.code, message: err.message }
    if (err?.code === 'P2002') return { ok: false, code: 'RETRY', message: 'Please try again.' }
    console.error('settlePurchase error:', err)
    return { ok: false, code: 'SERVER', message: 'Could not complete the purchase.' }
  }
}
