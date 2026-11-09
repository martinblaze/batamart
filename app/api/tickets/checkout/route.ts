// POST /api/tickets/checkout
// Guests: CARD only, with an email. Signed-in buyers (username required): CARD or WALLET.
// All money logic lives in lib/tickets/purchase.ts; this route only validates and routes.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { flutterwaveRequest, getFlutterwaveSecretKey } from '@/lib/finance/flutterwave'
import { verifySpendPin } from '@/lib/wallet/pin'
import { checkEmailAllowed, normalizeEmail } from '@/lib/tickets/email-guard'
import { prepareSale, createPendingPurchase, settlePurchase } from '@/lib/tickets/purchase'
import { notifyPurchasePaid } from '@/lib/tickets/notify'
import { json, fail, hit, clientIp } from '@/lib/tickets/buyer'
import { PENDING_HOLD_MINUTES } from '@/lib/tickets/config'

export const dynamic = 'force-dynamic'

const schema = z.object({
  eventId: z.string().min(1).max(60),
  tierId: z.string().min(1).max(60),
  quantity: z.number().int().min(1).max(100),
  method: z.enum(['CARD', 'WALLET']),
  email: z.string().max(254).optional(),
  resellerId: z.string().max(60).nullish(),
  pin: z.string().max(12).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr

    const authUser = await getUserFromRequest(request)
    // CSRF only matters when a browser cookie could be doing the talking.
    if (authUser) {
      const originErr = enforceSameOrigin(request)
      if (originErr) return originErr
    }

    const ip = clientIp(request)
    if (!(await hit(`tickets:checkout:ip:${ip}`, 20, 15 * 60_000))) {
      return json({ error: 'Too many attempts. Please wait a few minutes.' }, 429)
    }
    if (authUser && !(await hit(`tickets:checkout:user:${authUser.id}`, 20, 15 * 60_000))) {
      return json({ error: 'Too many attempts. Please wait a few minutes.' }, 429)
    }

    const setting = await prisma.appSetting.findUnique({ where: { key: 'checkout_payments_enabled' } })
    if (!(setting?.value ?? true)) return json({ error: 'Payments are temporarily disabled. Please try again later.' }, 503)

    let raw: unknown
    try { raw = await request.json() } catch { return json({ error: 'Invalid request' }, 400) }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) return json({ error: 'Invalid request' }, 400)
    const body = parsed.data

    let buyerUserId: string | null = null
    let buyerEmail = ''

    if (authUser) {
      const me = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { id: true, email: true, username: true, isSuspended: true, isDeleted: true },
      })
      if (!me || me.isDeleted) return json({ error: 'Unauthorized' }, 401)
      if (me.isSuspended) return json({ error: 'Your account is suspended.' }, 403)
      if (!me.username) {
        return json({ error: 'Set a username in your profile settings before buying tickets.', code: 'USERNAME_REQUIRED' }, 400)
      }
      buyerUserId = me.id
      const candidate = me.email ?? body.email
      const check = await checkEmailAllowed(candidate)
      if (!check.ok) return json({ error: (check as { reason: string }).reason, code: 'EMAIL_REQUIRED' }, 400)
      buyerEmail = (check as { email: string }).email
    } else {
      if (body.method !== 'CARD') {
        return json({ error: 'Sign in to pay with your wallet, or pay by card with your email.', code: 'LOGIN_REQUIRED' }, 400)
      }
      const check = await checkEmailAllowed(body.email)
      if (!check.ok) return json({ error: (check as { reason: string }).reason, code: 'BAD_EMAIL' }, 400)
      buyerEmail = (check as { email: string }).email
      if (!(await hit(`tickets:checkout:email:${buyerEmail}`, 6, 15 * 60_000))) {
        return json({ error: 'Too many attempts for this email. Please wait a few minutes.' }, 429)
      }
    }

    const sale = await prepareSale({
      eventId: body.eventId, tierId: body.tierId, quantity: body.quantity,
      resellerId: body.resellerId ?? null, buyerUserId,
    })

    // Cap unpaid holds per buyer so one person cannot lock up a whole tier.
    const holdsSince = new Date(Date.now() - PENDING_HOLD_MINUTES * 60_000)
    const openHolds = await prisma.ticketPurchase.count({
      where: {
        status: 'PENDING', createdAt: { gte: holdsSince },
        OR: [{ buyerEmail }, ...(buyerUserId ? [{ buyerUserId }] : [])],
      },
    })
    if (openHolds >= 3) {
      return json({ error: 'You have unfinished payments waiting. Complete or wait a few minutes before starting another.', code: 'TOO_MANY_PENDING' }, 429)
    }

    // ── Wallet ────────────────────────────────────────────────────────────
    if (body.method === 'WALLET') {
      if (!buyerUserId) return json({ error: 'Sign in to pay with your wallet.', code: 'LOGIN_REQUIRED' }, 401)
      const w = await prisma.user.findUnique({ where: { id: buyerUserId }, select: { availableBalance: true } })
      const balance = Number(w?.availableBalance ?? 0)
      if (balance < sale.split.subtotal) {
        return json({
          error: `Your wallet balance is ₦${balance.toLocaleString('en-NG')}. These tickets cost ₦${sale.split.subtotal.toLocaleString('en-NG')}. Top up to continue.`,
          code: 'INSUFFICIENT_BALANCE', required: sale.split.subtotal, balance,
        }, 402)
      }
      const pin = await verifySpendPin(buyerUserId, body.pin)
      if (!pin.ok) return json({ error: pin.error, code: pin.code }, pin.status ?? 400)

      const purchase = await createPendingPurchase(sale, { userId: buyerUserId, email: buyerEmail }, 'WALLET')
      const settled = await settlePurchase(purchase.id, { method: 'WALLET', walletUserId: buyerUserId })
      if (!settled.ok) {
        const bad = settled as { code: string; message: string }
        await prisma.ticketPurchase.updateMany({ where: { id: purchase.id, status: 'PENDING' }, data: { status: 'FAILED' } })
        const status = bad.code === 'INSUFFICIENT_FUNDS' ? 402 : 400
        return json({ error: bad.message, code: bad.code === 'INSUFFICIENT_FUNDS' ? 'INSUFFICIENT_BALANCE' : bad.code }, status)
      }
      if (!settled.already) await notifyPurchasePaid(purchase.id)
      return json({ ok: true, purchaseId: purchase.id })
    }

    // ── Card (Flutterwave hosted page) ────────────────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl || !getFlutterwaveSecretKey()) return json({ error: 'Card payments are not available right now.' }, 500)

    const purchase = await createPendingPurchase(sale, { userId: buyerUserId, email: buyerEmail }, 'CARD')
    const { ok, data } = await flutterwaveRequest('/payments', {
      body: {
        tx_ref: purchase.reference,
        amount: purchase.subtotal,
        currency: 'NGN',
        redirect_url: `${appUrl.replace(/\/$/, '')}/api/tickets/verify`,
        customer: { email: normalizeEmail(buyerEmail) },
        customizations: { title: 'BataMart tickets', description: `${sale.quantity} x ${sale.tier.name}, ${sale.event.name}`.slice(0, 100) },
        meta: { purpose: 'TICKET_PURCHASE', purchaseId: purchase.id },
      },
    })
    const link = data?.data?.link
    if (!ok || data?.status !== 'success' || !link) {
      console.error('Ticket payment init failed:', JSON.stringify(data))
      await prisma.ticketPurchase.updateMany({ where: { id: purchase.id, status: 'PENDING' }, data: { status: 'FAILED' } })
      return json({ error: 'Could not start the payment. Please try again.' }, 400)
    }
    return json({ success: true, authorizationUrl: link, reference: purchase.reference })
  } catch (err) {
    return fail(err, 'Could not start checkout')
  }
}
