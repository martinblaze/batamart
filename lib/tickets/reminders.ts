// lib/tickets/reminders.ts — server-only.
// Reminders to ticket holders (3 days before, the day before, the morning of)
// and a morning-of summary for the host. Run from the daily morning cron.
//
// Duplicate-send safety: account holders go through notifyUser's dedupeKey;
// guests use a unique prisma.notificationLog row created BEFORE the email is
// sent and deleted if the send fails (same pattern as lib/notify/dispatch.ts).

import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify/dispatch'
import { renderEmail, absoluteUrl, type EmailContent } from '@/lib/notify/email'
import { sendEmail } from '@/lib/email/sendEmail'
import { formatEventWhen } from '@/lib/tickets/notify'
import { reminderWindow, lagosDayStart, type ReminderWindow } from '@/lib/tickets/reminder-window'

export { reminderWindow } from '@/lib/tickets/reminder-window'

const DAY = 24 * 60 * 60 * 1000

const WORDS: Record<ReminderWindow, { when: string; subject: string }> = {
  d3: { when: 'in 3 days', subject: 'in 3 days' },
  d1: { when: 'tomorrow', subject: 'tomorrow' },
  d0: { when: 'today', subject: 'today' },
}

const timeOnly = (d: Date) =>
  d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' })

export interface ReminderCounts {
  events: number
  accountSent: number
  guestSent: number
  skipped: number
  failed: number
  hostNudges: number
}

interface Group {
  ownerUserId: string | null
  email: string
  tickets: { id: string; accessToken: string }[]
}

function buildEmail(
  ev: { name: string; venue: string; startsAt: Date },
  w: ReminderWindow,
  count: number,
  ctaUrl: string,
  extraLinks: string[],
): EmailContent & { subject: string } {
  const word = WORDS[w]
  return {
    subject: `${ev.name} is ${word.subject}`,
    preheader: `${formatEventWhen(ev.startsAt)} at ${ev.venue}`,
    eyebrow: 'Event reminder',
    heading: `${ev.name} is ${word.when}`,
    lines: [
      count > 1
        ? `You have ${count} tickets. Open them on the day and show the QR code at the door.`
        : 'Open your ticket on the day and show the QR code at the door. The code refreshes every few seconds, so a screenshot will not work.',
      ...extraLinks.map(l => `More tickets: ${l}`),
    ],
    rows: [
      { label: 'Event', value: ev.name },
      { label: 'When', value: formatEventWhen(ev.startsAt) },
      { label: 'Where', value: ev.venue },
    ],
    ctaLabel: count > 1 ? 'Open my tickets' : 'Open my ticket',
    ctaUrl,
    signoff: 'The BataMart team',
  }
}

/** Guest email, once only. Returns true if sent, false if skipped or failed. */
async function sendGuestOnce(key: string, to: string, email: EmailContent & { subject: string }): Promise<'sent' | 'duplicate' | 'failed'> {
  let tracked = true
  try {
    await prisma.notificationLog.create({ data: { userId: 'system', key } })
  } catch (error: any) {
    if (error?.code === 'P2002') return 'duplicate'
    // No log table yet: send anyway, without the once-only guarantee.
    if (error?.code !== 'P2021') throw error
    tracked = false
  }
  const { subject, ...content } = email
  let ok = false
  try {
    ok = (await sendEmail({ to, subject, html: renderEmail({ ...content, showPreferences: false }) })) === true
  } catch (err) {
    console.error('[ticket-reminders] guest email failed:', err)
  }
  if (!ok && tracked) {
    await prisma.notificationLog.deleteMany({ where: { userId: 'system', key } }).catch(() => {})
  }
  return ok ? 'sent' : 'failed'
}

export async function runTicketReminders(now: Date = new Date(), opts: { deadline?: number } = {}): Promise<ReminderCounts> {
  const counts: ReminderCounts = { events: 0, accountSent: 0, guestSent: 0, skipped: 0, failed: 0, hostNudges: 0 }
  const outOfTime = () => !!opts.deadline && Date.now() > opts.deadline

  const events = await prisma.ticketEvent.findMany({
    where: {
      status: 'ACTIVE',
      startsAt: { gt: now, lte: new Date(now.getTime() + 5 * DAY) },
    },
    select: { id: true, name: true, venue: true, startsAt: true },
    orderBy: { startsAt: 'asc' },
    take: 200,
  })

  for (const ev of events) {
    if (outOfTime()) break
    const w = reminderWindow(now, ev.startsAt)
    if (!w) continue
    counts.events++

    const tickets = await prisma.ticket.findMany({
      where: { eventId: ev.id, status: 'VALID' },
      select: {
        id: true,
        ownerUserId: true,
        ownerEmail: true,
        purchase: { select: { accessToken: true } },
      },
      orderBy: { id: 'asc' },
    })

    // One message per person per event, even with several tickets.
    const groups = new Map<string, Group>()
    for (const t of tickets) {
      const email = t.ownerEmail.trim().toLowerCase()
      const key = t.ownerUserId ? `u:${t.ownerUserId}` : `e:${email}`
      const g = groups.get(key) ?? { ownerUserId: t.ownerUserId, email, tickets: [] }
      g.tickets.push({ id: t.id, accessToken: t.purchase.accessToken })
      groups.set(key, g)
    }

    for (const g of Array.from(groups.values())) {
      if (outOfTime()) break
      const lead = g.tickets[0] // lowest ticket id: stable key for the dedupe slot
      try {
        if (g.ownerUserId) {
          const link = g.tickets.length > 1 ? '/tickets' : `/tickets/${lead.id}`
          const email = buildEmail(ev, w, g.tickets.length, link, [])
          const res = await notifyUser(g.ownerUserId, {
            category: 'reminder',
            type: 'REMINDER',
            title: `${ev.name} is ${WORDS[w].when}`,
            message: `${timeOnly(ev.startsAt)} at ${ev.venue}. Tap to open your ${g.tickets.length > 1 ? 'tickets' : 'ticket'}.`,
            url: link,
            push: true,
            inApp: true,
            email,
            dedupeKey: `ticket-reminder:${lead.id}:${w}`,
            bypassLimits: true,
            metadata: { eventId: ev.id, window: w },
          })
          if (res.sent) counts.accountSent++
          else if (res.skipped) counts.skipped++
          else counts.failed++
        } else {
          // Guests: one link per distinct purchase (the page shows that purchase's tickets).
          const tokens = Array.from(new Set(g.tickets.map(t => t.accessToken)))
          const links = tokens.map(tok => absoluteUrl(`/t/${tok}`))
          const email = buildEmail(ev, w, g.tickets.length, `/t/${tokens[0]}`, links.slice(1, 4))
          const r = await sendGuestOnce(`ticket-reminder-guest:${lead.id}:${w}`, g.email, email)
          if (r === 'sent') counts.guestSent++
          else if (r === 'duplicate') counts.skipped++
          else counts.failed++
        }
      } catch (err) {
        counts.failed++
        console.error('[ticket-reminders] group failed:', ev.id, err)
      }
    }
  }

  try {
    counts.hostNudges = await hostMorningNudges(now, opts.deadline)
  } catch (err) {
    console.error('[ticket-reminders] host nudges failed:', err)
  }
  return counts
}

/** On the event day, tell the host how many tickets are sold and whether the door is staffed. */
async function hostMorningNudges(now: Date, deadline?: number): Promise<number> {
  const start = lagosDayStart(now)
  const events = await prisma.ticketEvent.findMany({
    where: {
      status: 'ACTIVE',
      startsAt: { gte: start, lt: new Date(start.getTime() + DAY) },
    },
    select: { id: true, name: true, venue: true, startsAt: true, hostId: true },
    take: 200,
  })

  let sent = 0
  for (const ev of events) {
    if (deadline && Date.now() > deadline) break
    const [sold, checkers] = await Promise.all([
      prisma.ticket.count({ where: { eventId: ev.id, status: { not: 'VOID' } } }),
      prisma.eventChecker.count({ where: { eventId: ev.id, isActive: true } }),
    ])
    const doorNote = checkers > 0
      ? `${checkers} checker${checkers > 1 ? 's' : ''} set up.`
      : 'No checkers set up yet. Add one so someone can scan at the door.'
    const res = await notifyUser(ev.hostId, {
      category: 'reminder',
      type: 'REMINDER',
      title: `${ev.name} is today`,
      message: `${sold} ticket${sold === 1 ? '' : 's'} sold. ${doorNote} Starts ${timeOnly(ev.startsAt)} at ${ev.venue}.`,
      url: `/my-shop/events/${ev.id}`,
      push: true,
      inApp: true,
      bypassLimits: true,
      dedupeKey: `ticket-host-day:${ev.id}`,
    })
    if (res.sent) sent++
  }
  return sent
}
