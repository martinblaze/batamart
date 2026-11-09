// app/api/tickets/listings/[id]/route.ts
// DELETE: the owner stops reselling an event (soft: sets isActive = false).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { enforceSameOrigin } from '@/lib/security/request'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    // Ownership is part of the WHERE clause: someone else's id simply matches nothing.
    const res = await prisma.ticketListing.updateMany({
      where: { id, sellerId: user.id },
      data: { isActive: false },
    })
    if (res.count === 0) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Deactivate ticket listing error:', error)
    return NextResponse.json({ error: 'Could not update the listing.' }, { status: 500 })
  }
}
