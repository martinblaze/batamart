// lib/tickets/notify.ts — server-only. Messages sent after a ticket sale is committed.
// Never throws: a failed email must not undo a completed, paid purchase.

import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify/dispatch'
import { renderEmail, type EmailContent } from '@/lib/notify/email'
import { sendEmail } from '@/lib/email/sendEmail'
import { APP_URL } from '@/lib/tickets/config'
import { naira } from '@/lib/tickets/money'

export const ticketsLinkForGuest = (accessToken: string) => `${APP_URL}/t/${accessToken}`

export const formatEventWhen = (d: Date) =>
  d.toLocaleString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })

/** Receipt for the buyer (with the link to the tickets), plus the host and reseller heads-ups. */
export async function notifyPurchasePaid(purchaseId: string): Promise<void> {
  try {
    const p = await prisma.ticketPurchase.findUnique({
      where: { id: purchaseId },
      include: {
        event: { select: { id: true, name: true, venue: true, startsAt: true, hostId: true } },
        tier: { select: { name: true } },
        buyer: { select: { id: true, name: true } },
      },
    })
    if (!p || p.status !== 'PAID') return

    const when = formatEventWhen(p.event.startsAt)
    const label = `${p.quantity} x ${p.tier.name}`
    const link = p.buyerUserId ? `/tickets?purchase=${p.id}` : ticketsLinkForGuest(p.accessToken)
    const email: EmailContent & { subject: string } = {
      subject: `Your ticket for ${p.event.name}`,
      preheader: `${label} on ${when}`,
      greeting: p.buyer?.name ? `Hi ${p.buyer.name.split(/\s+/)[0]},` : 'Hello,',
      eyebrow: 'Ticket confirmed',
      heading: `You are going to ${p.event.name}`,
      lines: [
        'Your payment went through and your ticket is ready. Open it on the day and show the QR code at the door.',
        'The QR code refreshes every few seconds, so a screenshot will not work. Open the page itself when you arrive.',
      ],
      rows: [
        { label: 'Event', value: p.event.name },
        { label: 'When', value: when },
        { label: 'Where', value: p.event.venue },
        { label: 'Tickets', value: label },
        { label: 'Paid', value: naira(p.subtotal) },
        { label: 'Reference', value: p.reference },
      ],
      ctaLabel: 'Open my ticket',
      ctaUrl: link,
      signoff: 'The BataMart team',
    }

    if (p.buyerUserId) {
      await notifyUser(p.buyerUserId, {
        category: 'transactional', type: 'ORDER_UPDATE',
        title: `Ticket confirmed: ${p.event.name}`, message: `${label}. Tap to open your ticket.`,
        url: link, dedupeKey: `ticket-purchase:${p.id}`, email,
      })
    } else {
      // Guests have no account to notify, so the receipt goes straight to their email.
      const { subject, ...content } = email
      await sendEmail({ to: p.buyerEmail, subject, html: renderEmail(content) })
    }

    await notifyUser(p.event.hostId, {
      category: 'transactional', type: 'PAYMENT_RECEIVED',
      title: `Ticket sale: ${label}`, message: `${p.event.name}. ${naira(p.hostAmount)} added to your wallet.`,
      url: `/my-shop/events/${p.event.id}`, dedupeKey: `ticket-sale:${p.id}`,
    })
    if (p.resellerId && p.commission > 0) {
      await notifyUser(p.resellerId, {
        category: 'transactional', type: 'WALLET_ACTIVITY',
        title: `You earned ${naira(p.commission)}`, message: `Commission on ${label} for ${p.event.name}.`,
        url: '/wallet', dedupeKey: `ticket-commission:${p.id}`,
      })
    }
  } catch (err) {
    console.error('notifyPurchasePaid error:', err)
  }
}
