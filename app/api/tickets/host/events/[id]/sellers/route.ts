// app/api/tickets/host/events/[id]/sellers/route.ts
// Host: name a "unique seller" for this event by username.
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { normalizeUsername } from '@/lib/username'
import { MAX_UNIQUE_SELLERS_PER_EVENT } from '@/lib/tickets/config'
import { fail, requireHost, safeJson, writeAudit, zodMessage } from '../../../_lib'

const schema = z.object({ username: z.string().trim().min(1).max(40) }).strict()

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const host = await requireHost(request)
    if (host instanceof NextResponse) return host

    const parsed = schema.safeParse(await safeJson(request))
    if (!parsed.success) return fail(zodMessage(parsed.error))
    const username = normalizeUsername(parsed.data.username.replace(/^@/, ''))

    const event = await prisma.ticketEvent.findFirst({ where: { id: params.id, hostId: host.userId }, select: { id: true, status: true } })
    if (!event) return fail('Event not found', 404)
    if (event.status === 'CANCELLED') return fail('This event is cancelled.', 409)

    if (username === host.username) return fail('You cannot name yourself as a unique seller.')
    const user = await prisma.user.findFirst({
      where: { username, isDeleted: false, isSuspended: false },
      select: { id: true, name: true, username: true },
    })
    if (!user) return fail(`No active user with the username @${username}.`, 404, 'UNKNOWN_USERNAME')

    const count = await prisma.eventSeller.count({ where: { eventId: event.id } })
    const existing = await prisma.eventSeller.findUnique({ where: { eventId_userId: { eventId: event.id, userId: user.id } }, select: { id: true } })
    if (existing) return fail(`@${username} is already a unique seller for this event.`, 409)
    if (count >= MAX_UNIQUE_SELLERS_PER_EVENT) return fail(`You can name up to ${MAX_UNIQUE_SELLERS_PER_EVENT} unique sellers.`)

    const row = await prisma.$transaction(async tx => {
      const r = await tx.eventSeller.create({ data: { eventId: event.id, userId: user.id }, select: { id: true } })
      await writeAudit(tx, host.userId, 'TICKET_SELLER_ADDED', event.id, undefined, { userId: user.id, username })
      return r
    })
    return NextResponse.json({
      seller: {
        rowId: row.id, kind: 'UNIQUE', userId: user.id, name: user.name, username: user.username,
        ticketsSold: 0, grossSales: 0, commission: 0,
      },
    })
  } catch (error: any) {
    if (error?.code === 'P2002') return fail('That seller is already added.', 409)
    console.error('host seller add error:', error)
    return fail('Could not add the seller', 500)
  }
}
