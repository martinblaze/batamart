// POST /api/tickets/ticket/[id]/transfer  body { toUsername }
// Moves a VALID ticket to another BataMart user. A guarded update makes it
// race-safe against a door scan or a second transfer, and the secret rotates so
// every QR the old holder could still show stops working.
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { normalizeUsername } from '@/lib/username'
import { generateTicketSecret } from '@/lib/tickets/codes'
import { normalizeEmail } from '@/lib/tickets/email-guard'
import { formatEventWhen } from '@/lib/tickets/notify'
import { notifyUser } from '@/lib/notify/dispatch'
import { json, fail, hit, clientIp, isEventOver, shortName } from '@/lib/tickets/buyer'

export const dynamic = 'force-dynamic'

const schema = z.object({ toUsername: z.string().min(1).max(40) }).strict()

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const user = await getUserFromRequest(request)
    if (!user) return json({ error: 'Unauthorized' }, 401)
    if (!(await hit(`tickets:transfer:${user.id}`, 10, 15 * 60_000)) ||
        !(await hit(`tickets:transfer:ip:${clientIp(request)}`, 30, 15 * 60_000))) {
      return json({ error: 'Too many attempts. Please wait a few minutes.' }, 429)
    }

    let raw: unknown
    try { raw = await request.json() } catch { return json({ error: 'Invalid request' }, 400) }
    const parsed = schema.safeParse(raw)
    if (!parsed.success) return json({ error: 'Enter your friend\'s username.' }, 400)
    const toUsername = normalizeUsername(parsed.data.toUsername.replace(/^@/, ''))
    if (!toUsername) return json({ error: 'Enter your friend\'s username.' }, 400)

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, username: true, email: true, isSuspended: true, isDeleted: true },
    })
    if (!me || me.isDeleted) return json({ error: 'Unauthorized' }, 401)
    if (me.isSuspended) return json({ error: 'Your account is suspended.' }, 403)

    const friend = await prisma.user.findUnique({
      where: { username: toUsername },
      select: { id: true, name: true, username: true, email: true, isSuspended: true, isDeleted: true },
    })
    if (!friend || friend.isDeleted || friend.isSuspended) {
      return json({ error: 'We could not find an active BataMart user with that username.', code: 'USER_NOT_FOUND' }, 404)
    }
    if (friend.id === me.id) return json({ error: 'You cannot send a ticket to yourself.', code: 'SELF_TRANSFER' }, 400)

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      select: {
        id: true, code: true, status: true, ownerUserId: true, ownerEmail: true,
        tier: { select: { name: true } },
        event: { select: { id: true, name: true, venue: true, startsAt: true, endsAt: true, status: true } },
      },
    })
    if (!ticket || ticket.ownerUserId !== me.id) return json({ error: 'Ticket not found' }, 404)
    if (ticket.status === 'CHECKED_IN') return json({ error: 'This ticket has already been used.', code: 'CHECKED_IN' }, 409)
    if (ticket.status !== 'VALID') return json({ error: 'This ticket cannot be sent.', code: 'NOT_VALID' }, 409)
    if (ticket.event.status === 'CANCELLED') return json({ error: 'This event was cancelled.', code: 'EVENT_CANCELLED' }, 409)
    if (isEventOver(ticket.event)) return json({ error: 'This event is over.', code: 'EVENT_OVER' }, 409)

    const friendEmail = normalizeEmail(friend.email)
    const moved = await prisma.$transaction(async tx => {
      const res = await tx.ticket.updateMany({
        where: { id: ticket.id, ownerUserId: me.id, status: 'VALID' },
        data: {
          ownerUserId: friend.id,
          ownerEmail: friendEmail,
          secret: generateTicketSecret(),
          secretVersion: { increment: 1 },
        },
      })
      if (res.count !== 1) return false
      await tx.ticketTransfer.create({
        data: { ticketId: ticket.id, eventId: ticket.event.id, ticketCode: ticket.code, fromUserId: me.id, fromEmail: ticket.ownerEmail, toUserId: friend.id },
      })
      await tx.auditLog.create({
        data: {
          userId: me.id, action: 'TICKET_TRANSFERRED', entityType: 'Ticket', entityId: ticket.id,
          oldValue: { ownerUserId: me.id }, newValue: { ownerUserId: friend.id, eventId: ticket.event.id },
          ipAddress: clientIp(request),
        },
      })
      return true
    })
    if (!moved) {
      return json({ error: 'This ticket can no longer be sent (it may have just been used or moved).', code: 'CONFLICT' }, 409)
    }

    // Notifications never undo the transfer.
    const when = formatEventWhen(ticket.event.startsAt)
    const fromLabel = me.username ? `@${me.username}` : shortName(me.name)
    await notifyUser(friend.id, {
      category: 'transactional', type: 'ORDER_UPDATE',
      title: `${shortName(me.name)} sent you a ticket`,
      message: `${ticket.tier.name} for ${ticket.event.name}. Tap to open it.`,
      url: `/tickets/${ticket.id}`, dedupeKey: `ticket-transfer-in:${ticket.id}:${Date.now()}`,
      email: {
        subject: `${shortName(me.name)} sent you a ticket for ${ticket.event.name}`,
        preheader: `${ticket.tier.name} on ${when}`,
        greeting: `Hi ${friend.name.split(/\s+/)[0]},`,
        eyebrow: 'Ticket received',
        heading: `You have a ticket to ${ticket.event.name}`,
        lines: [
          `${fromLabel} sent you a ticket on BataMart. It is now yours and shows in your tickets.`,
          'Open it on the day and show the QR code at the door. It refreshes every few seconds, so a screenshot will not work.',
        ],
        rows: [
          { label: 'Event', value: ticket.event.name },
          { label: 'When', value: when },
          { label: 'Where', value: ticket.event.venue },
          { label: 'Ticket', value: ticket.tier.name },
        ],
        ctaLabel: 'Open my ticket', ctaUrl: `/tickets/${ticket.id}`, signoff: 'The BataMart team',
      },
    }).catch(err => console.error('transfer notify (friend) failed:', err))
    await notifyUser(me.id, {
      category: 'transactional', type: 'ORDER_UPDATE',
      title: 'Ticket sent',
      message: `Your ${ticket.tier.name} ticket for ${ticket.event.name} now belongs to @${friend.username}. It no longer works for you.`,
      url: '/tickets', dedupeKey: `ticket-transfer-out:${ticket.id}:${Date.now()}`,
    }).catch(err => console.error('transfer notify (sender) failed:', err))

    return json({ ok: true, toUsername: friend.username })
  } catch (err) {
    return fail(err, 'Could not send the ticket')
  }
}
