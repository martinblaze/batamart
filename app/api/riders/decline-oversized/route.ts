import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth'
import { applyOversizedDecline } from '@/lib/oversized-protection'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'RIDER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId, reason, proofImageUrl } = await request.json()
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    if (reason !== 'Item Too Large For Motorcycle Delivery') {
      return NextResponse.json({ error: 'Invalid decline reason' }, { status: 400 })
    }

    const result = await applyOversizedDecline({ orderId, riderId: user.id, proofImageUrl: proofImageUrl || null })
    return NextResponse.json({
      success: true,
      message: 'Order cancelled and buyer refunded (delivery fee retained).',
      strikeCount: result.strikeCount,
      order: result.order,
    })
  } catch (error: any) {
    const msg = error?.message || 'Failed to process oversized decline'
    const status = ['ORDER_NOT_FOUND', 'NOT_ASSIGNED_RIDER'].includes(msg) ? 404 : ['ORDER_ALREADY_CANCELLED', 'DUPLICATE_DECLINE'].includes(msg) ? 409 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
