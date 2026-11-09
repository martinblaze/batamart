// lib/tickets/host-mail.ts — server-only. Messages the host side of ticketing sends.
// Never throws and never logs a token or link: a failed email must not undo the action.

import { prisma } from '@/lib/prisma'
import { notifyMany } from '@/lib/notify/dispatch'
import { renderEmail } from '@/lib/notify/email'
import { sendEmail } from '@/lib/email/sendEmail'
import { APP_URL } from '@/lib/tickets/config'
import { formatEventWhen, ticketsLinkForGuest } from '@/lib/tickets/notify'

export const checkerLink = (token: string) => `${APP_URL}/checkin/${token}`

/** Emails a door checker their personal sign-in link. Resolves true only if a provider accepted it. */
export async function sendCheckerInvite(input: {
  to: string
  name?: string | null
  token: string
  event: { name: string; venue: string; startsAt: Date }
  hostName: string
  resend?: boolean
}): Promise<boolean> {
  try {
    const html = renderEmail({
      preheader: `Your door link for ${input.event.name}`,
      greeting: input.name ? `Hi ${input.name.split(/\s+/)[0]},` : 'Hello,',
      eyebrow: 'Door access',
      heading: input.resend ? 'Your new check-in link' : `You will be checking in tickets for ${input.event.name}`,
      lines: [
        `${input.hostName} added you as a ticket checker. Open the link below on the phone you will use at the door, then type this email address to sign in. After that you can scan guests' QR codes.`,
        input.resend
          ? 'This replaces any link you were sent before. The old link no longer works.'
          : 'Keep this link private. Anyone with it who knows your email could sign in as you.',
      ],
      rows: [
        { label: 'Event', value: input.event.name },
        { label: 'When', value: formatEventWhen(input.event.startsAt) },
        { label: 'Where', value: input.event.venue },
      ],
      ctaLabel: 'Open check-in',
      ctaUrl: checkerLink(input.token),
      signoff: 'The BataMart team',
    })
    return await sendEmail({
      to: input.to,
      subject: `${input.resend ? 'New check-in link' : 'Check-in link'}: ${input.event.name}`,
      html,
    })
  } catch {
    console.error('sendCheckerInvite failed')
    return false
  }
}

/**
 * Tells everyone currently holding a valid ticket for the event: in-app, push and
 * email for account holders, email for guests. Runs after the change is committed.
 */
export async function notifyTicketHolders(
  eventId: string,
  msg: { title: string; message: string; dedupeKey: string; heading?: string },
): Promise<void> {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { eventId, status: 'VALID' },
      select: { ownerUserId: true, ownerEmail: true, purchase: { select: { accessToken: true } } },
    })
    const userIds = Array.from(new Set(tickets.map(t => t.ownerUserId).filter((x): x is string => !!x)))
    const guests = new Map<string, string>()
    for (const t of tickets) {
      if (!t.ownerUserId && !guests.has(t.ownerEmail)) guests.set(t.ownerEmail, t.purchase.accessToken)
    }

    await notifyMany(userIds, () => ({
      category: 'transactional',
      type: 'ORDER_UPDATE',
      title: msg.title,
      message: msg.message,
      url: '/tickets',
      dedupeKey: msg.dedupeKey,
      email: { heading: msg.heading ?? msg.title, lines: [msg.message], ctaLabel: 'Open my tickets', ctaUrl: '/tickets', subject: msg.title },
    }))

    const entries = Array.from(guests.entries())
    for (let i = 0; i < entries.length; i += 10) {
      await Promise.all(
        entries.slice(i, i + 10).map(([email, accessToken]) =>
          sendEmail({
            to: email,
            subject: msg.title,
            html: renderEmail({
              heading: msg.heading ?? msg.title,
              lines: [msg.message],
              ctaLabel: 'Open my tickets',
              ctaUrl: ticketsLinkForGuest(accessToken),
              signoff: 'The BataMart team',
            }),
          }).catch(() => false),
        ),
      )
    }
  } catch {
    console.error('notifyTicketHolders failed')
  }
}
