// GET /api/tickets/verify?tx_ref=&transaction_id=&status=
// Flutterwave redirects the buyer here after paying. Nothing is trusted from the
// URL: the transaction is re-fetched from Flutterwave and checked against the
// purchase row. Safe to hit repeatedly (settlePurchase is a guarded single flip).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { flutterwaveRequest } from '@/lib/finance/flutterwave'
import { settlePurchase } from '@/lib/tickets/purchase'
import { notifyPurchasePaid } from '@/lib/tickets/notify'
import { hit, clientIp } from '@/lib/tickets/buyer'

export const dynamic = 'force-dynamic'

function appRedirect(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://batamart.com'
  let res: NextResponse
  try {
    res = NextResponse.redirect(new URL(path, base).toString())
  } catch {
    res = NextResponse.redirect(`https://batamart.com${path}`)
  }
  // The success URL carries a bearer token for guests: keep it out of referrers and caches.
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('Referrer-Policy', 'no-referrer')
  return res
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  const txRef = params.get('tx_ref')?.trim() || null
  const flwId = params.get('transaction_id')?.trim() || null
  const flwStatus = params.get('status')?.trim() || null

  if (!txRef || !/^TKT-\d{10,15}-[0-9a-f]{8}$/.test(txRef)) return appRedirect('/events')

  const purchase = await prisma.ticketPurchase.findUnique({
    where: { reference: txRef },
    select: { id: true, eventId: true, subtotal: true, status: true, buyerUserId: true, accessToken: true, paymentMethod: true },
  })
  if (!purchase) return appRedirect('/events')
  const failed = appRedirect(`/events/${purchase.eventId}?payment=failed`)
  // Wallet purchases are settled in the checkout request itself, never through the gateway.
  if (purchase.paymentMethod !== 'CARD') return failed

  if (flwStatus && flwStatus !== 'successful' && flwStatus !== 'completed') return failed
  if (!flwId || !/^[0-9A-Za-z_-]{1,40}$/.test(flwId)) return failed

  if (!(await hit(`tickets:verify:${clientIp(request)}:${txRef}`, 10, 10 * 60_000))) return failed

  try {
    const { data } = await flutterwaveRequest(`/transactions/${encodeURIComponent(flwId)}/verify`)
    const tx = data?.data
    const status = String(tx?.status ?? '').toLowerCase()
    if (data?.status !== 'success' || (status !== 'successful' && status !== 'success')) return failed
    if (tx?.tx_ref !== txRef || tx?.currency !== 'NGN') return failed
    // The transaction we fetched must be the one the URL named, and one gateway
    // transaction can settle at most one purchase.
    if (String(tx?.id ?? '') !== String(flwId)) return failed
    const reused = await prisma.ticketPurchase.findFirst({
      where: { gatewayTxId: String(flwId), id: { not: purchase.id } },
      select: { id: true },
    })
    if (reused) {
      console.error('Ticket verify: gateway transaction already used', { purchaseId: purchase.id })
      return failed
    }

    let meta = tx?.meta
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta) } catch { meta = null }
    }
    if (meta?.purpose !== 'TICKET_PURCHASE' || meta?.purchaseId !== purchase.id) return failed

    const paid = Number(tx?.amount)
    if (!Number.isFinite(paid) || Math.round(paid) !== purchase.subtotal) {
      console.error('Ticket verify amount mismatch', { purchaseId: purchase.id, expected: purchase.subtotal, got: tx?.amount })
      return failed
    }

    const settled = await settlePurchase(purchase.id, { method: 'CARD', gatewayTxId: String(flwId), paidAmount: paid })
    if (!settled.ok) {
      console.error('Ticket settle failed', { purchaseId: purchase.id, code: (settled as { code: string }).code })
      return failed
    }
    if (!settled.already) await notifyPurchasePaid(purchase.id)

    return appRedirect(
      purchase.buyerUserId
        ? `/tickets?purchase=${purchase.id}&paid=1`
        : `/t/${purchase.accessToken}?paid=1`,
    )
  } catch (error) {
    console.error('ticket verify error:', error)
    return failed
  }
}
