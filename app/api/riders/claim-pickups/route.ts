// app/api/riders/claim-pickups/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth'
import { claimPickupOrders } from '@/lib/delivery/claim'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const orderIds: string[] = Array.isArray(body?.orderIds) ? body.orderIds.filter((x: unknown) => typeof x === 'string').slice(0, 100) : []

    const result = await claimPickupOrders({ id: user.id, name: user.name ?? null, universityId: user.universityId ?? null }, orderIds)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, blockReason: result.blockReason }, { status: result.status })
    }
    return NextResponse.json({ success: true, claimed: result.claimedIds.length, skipped: result.skipped })
  } catch (error) {
    console.error('claim-pickups error:', error)
    return NextResponse.json({ error: 'Failed to claim pickups' }, { status: 500 })
  }
}
