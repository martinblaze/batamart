export const dynamic = 'force-dynamic'
// POST /api/admin/tickets/events/[id]  { action: 'approve'|'reject'|'pause'|'resume', note? }
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify/dispatch'
import { adminIdFromRequest } from '../../_auth'

type Action = 'approve' | 'reject' | 'pause' | 'resume'
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
