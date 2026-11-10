// GET /api/tickets/mine  (auth)
// The signed-in user's tickets. Secrets are NEVER returned here.
// First, guest purchases made with this user's email are claimed (signup requires
// an email OTP, so User.email is a verified address).
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { normalizeEmail } from '@/lib/tickets/email-guard'
import { json, fail, hit, isEventOver } from '@/lib/tickets/buyer'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return json({ error: 'Unauthorized' }, 401)
    if (!(await hit(`tickets:mine:${user.id}`, 60, 60_000))) return json({ error: 'Too many requests. Please wait.' }, 429)

    const email = normalizeEmail(user.email)
    if (email) {
      await prisma.$transaction(async tx => {
        await tx.ticketPurchase.updateMany({
          where: { buyerUserId: null, buyerEmail: email, status: 'PAID' },
          data: { buyerUserId: user.id },
        })
        await tx.ticket.updateMany({
          where: { ownerUserId: null, ownerEmail: email, purchase: { status: 'PAID' } },
          data: { ownerUserId: user.id },
        })
      })
    }

    const rows = await prisma.ticket.findMany({
      where: { ownerUserId: user.id, purchase: { status: 'PAID' } },
      orderBy: [{ event: { startsAt: 'desc' } }, { createdAt: 'asc' }],
      take: 300,
      select: {
        id: true, code: true, status: true, checkedInAt: true, purchaseId: true,
        tier: { select: { name: true } },
        event: { select: { id: true, name: true, venue: true, startsAt: true, endsAt: true, flyerUrl: true, status: true } },
      },
    })

    // Purchases whose event is over and whose tickets were deleted: shown as "Event ended", not dropped silently.
    const endedRows = await prisma.ticketPurchase.findMany({
      where: { buyerUserId: user.id, status: 'PAID', tickets: { none: {} } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, quantity: true, createdAt: true,
        tier: { select: { name: true } },
        event: { select: { id: true, name: true, venue: true, startsAt: true, endsAt: true, flyerUrl: true, status: true } },
      },
    })
    const endedPurchases = endedRows.filter(p => isEventOver(p.event)).map(p => ({
      purchaseId: p.id, quantity: p.quantity, tierName: p.tier.name, status: 'ENDED',
      event: {
        id: p.event.id, name: p.event.name, venue: p.event.venue,
        startsAt: p.event.startsAt.toISOString(), endsAt: p.event.endsAt?.toISOString() ?? null,
        flyerUrl: p.event.flyerUrl, status: p.event.status,
      },
    }))

    return json({
      endedPurchases,
      tickets: rows.map(t => ({
        id: t.id, code: t.code, status: t.status,
        checkedInAt: t.checkedInAt?.toISOString() ?? null,
        purchaseId: t.purchaseId,
        tierName: t.tier.name,
        event: {
          id: t.event.id, name: t.event.name, venue: t.event.venue,
          startsAt: t.event.startsAt.toISOString(), endsAt: t.event.endsAt?.toISOString() ?? null,
          flyerUrl: t.event.flyerUrl, status: t.event.status,
        },
      })),
    })
  } catch (err) {
    return fail(err, 'Could not load your tickets')
  }
}
