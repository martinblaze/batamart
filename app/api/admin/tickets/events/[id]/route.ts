export const dynamic = 'force-dynamic'
// POST /api/admin/tickets/events/[id]  { action: 'approve'|'reject'|'pause'|'resume', note? }
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify/dispatch'
import { adminIdFromRequest } from '../../_auth'

type Action = 'approve' | 'reject' | 'pause' | 'resume'
type ChangeAction = 'approve_change' | 'reject_change'
type Status = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'PAUSED' | 'CANCELLED'

// Spec section 6. Everything not listed here is illegal (409).
const TRANSITIONS: Record<Action, { from: Status; to: Status }> = {
  approve: { from: 'PENDING_REVIEW', to: 'ACTIVE' },
  reject: { from: 'PENDING_REVIEW', to: 'REJECTED' },
  pause: { from: 'ACTIVE', to: 'PAUSED' },
  resume: { from: 'PAUSED', to: 'ACTIVE' },
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const adminId = adminIdFromRequest(req)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json().catch(() => null)
    if (body && (body.action === 'approve_change' || body.action === 'reject_change')) {
      return await handleChange(req, params.id, adminId, body.action as ChangeAction, typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '')
    }
    const action = body?.action as Action
    if (!body || !Object.prototype.hasOwnProperty.call(TRANSITIONS, action)) {
      return NextResponse.json({ error: 'Invalid action. Use approve, reject, pause or resume.' }, { status: 400 })
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
    if (action === 'reject' && !note) {
      return NextResponse.json({ error: 'A note is required when rejecting. The host sees it.' }, { status: 400 })
    }

    const event = await prisma.ticketEvent.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, status: true, hostId: true },
    })
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const { from, to } = TRANSITIONS[action]
    if (event.status !== from) {
      return NextResponse.json(
        { error: `Cannot ${action} an event that is ${event.status.toLowerCase().replace('_', ' ')}.`, code: 'ILLEGAL_TRANSITION' },
        { status: 409 },
      )
    }

    // Guarded write: only succeeds if nobody else moved the event in between.
    const updated = await prisma.ticketEvent.updateMany({
      where: { id: event.id, status: from },
      data: {
        status: to,
        reviewNote: action === 'reject' || action === 'pause' ? note || null : null,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    })
    if (updated.count !== 1) {
      return NextResponse.json({ error: 'The event changed while you were reviewing it. Reload and try again.', code: 'ILLEGAL_TRANSITION' }, { status: 409 })
    }

    await prisma.auditLog
      .create({
        data: {
          userId: adminId,
          // Past-tense names, which is what the host's audit timeline labels.
          action: `TICKET_EVENT_${({ approve: 'APPROVED', reject: 'REJECTED', pause: 'PAUSED', resume: 'RESUMED' } as Record<string, string>)[action] ?? String(action).toUpperCase()}`,
          entityType: 'TicketEvent',
          entityId: event.id,
          oldValue: { status: from },
          newValue: { status: to, note: note || null, adminId },
          ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          userAgent: req.headers.get('user-agent')?.slice(0, 300) || null,
        },
      })
      .catch(err => console.error('Ticket event audit log failed:', err))

    const url = `/my-shop/events/${event.id}`
    const copy: Record<Action, { title: string; message: string }> = {
      approve: { title: `${event.name} is live`, message: 'Your event was approved and is now public. Tickets are on sale.' },
      reject: { title: `${event.name} was not approved`, message: `Reason: ${note}. Edit the event and resubmit it.` },
      pause: { title: `${event.name} is paused`, message: `Ticket sales are paused.${note ? ` Note: ${note}` : ''}` },
      resume: { title: `${event.name} is back on sale`, message: 'Your event is live again and tickets can be bought.' },
    }
    await notifyUser(event.hostId, {
      category: 'transactional',
      title: copy[action].title,
      message: copy[action].message,
      url,
      metadata: { eventId: event.id, action },
    }).catch(err => console.error('Ticket event host notify failed:', err))

    return NextResponse.json({ success: true, id: event.id, status: to })
  } catch (error) {
    console.error('Admin ticket event action error:', error)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}

// A host edit to the flyer/description of a live event waits in the pending* columns.
// Approving copies them onto the live fields; rejecting just clears them. The event status never changes.
async function handleChange(req: NextRequest, eventId: string, adminId: string, action: ChangeAction, note: string) {
  if (action === 'reject_change' && !note) {
    return NextResponse.json({ error: 'A note is required when rejecting a change. The host sees it.' }, { status: 400 })
  }
  const event = await prisma.ticketEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true, name: true, hostId: true, flyerUrl: true, description: true,
      pendingFlyerUrl: true, pendingDescription: true, pendingChangeAt: true,
    },
  })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!event.pendingChangeAt) {
    return NextResponse.json({ error: 'There is no pending change on this event.', code: 'NO_PENDING_CHANGE' }, { status: 409 })
  }

  const approving = action === 'approve_change'
  // Guarded on the exact request we showed the admin, so a newer host edit is never approved unseen.
  const res = await prisma.ticketEvent.updateMany({
    where: { id: event.id, pendingChangeAt: event.pendingChangeAt },
    data: {
      ...(approving
        ? {
            ...(event.pendingFlyerUrl ? { flyerUrl: event.pendingFlyerUrl } : {}),
            ...(event.pendingDescription !== null ? { description: event.pendingDescription || null } : {}),
          }
        : {}),
      pendingFlyerUrl: null,
      pendingDescription: null,
      pendingChangeAt: null,
    },
  })
  if (res.count !== 1) {
    return NextResponse.json({ error: 'The host changed this request while you were reviewing it. Reload and try again.', code: 'CONFLICT' }, { status: 409 })
  }

  await prisma.auditLog
    .create({
      data: {
        userId: adminId,
        action: approving ? 'TICKET_EVENT_CHANGE_APPROVED' : 'TICKET_EVENT_CHANGE_REJECTED',
        entityType: 'TicketEvent',
        entityId: event.id,
        oldValue: { flyerUrl: event.flyerUrl, description: event.description },
        newValue: { flyerUrl: event.pendingFlyerUrl, description: event.pendingDescription, note: note || null, adminId },
        ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: req.headers.get('user-agent')?.slice(0, 300) || null,
      },
    })
    .catch(err => console.error('Ticket event change audit log failed:', err))

  await notifyUser(event.hostId, {
    category: 'transactional',
    title: approving ? `${event.name}: your changes are live` : `${event.name}: changes not approved`,
    message: approving
      ? 'Your new flyer/description was approved and is now showing on the public page.'
      : `Your new flyer/description was not approved and the old one stays. Reason: ${note}`,
    url: `/my-shop/events/${event.id}`,
    metadata: { eventId: event.id, action },
  }).catch(err => console.error('Ticket event change host notify failed:', err))

  return NextResponse.json({ success: true, id: event.id })
}
