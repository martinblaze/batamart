// app/api/wallet/topup/route.ts
// Start a wallet top-up: a Flutterwave hosted payment that, once verified at
// /api/wallet/topup/verify, credits the buyer's available balance.
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { checkRateLimitDistributed, getIpKey } from '@/lib/security/rate-limit'
import { flutterwaveRequest, getFlutterwaveSecretKey } from '@/lib/finance/flutterwave'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const TOPUP_MIN = 100
const TOPUP_MAX = 500_000

const schema = z.object({ amount: z.number().int().min(TOPUP_MIN).max(TOPUP_MAX) }).strict()

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
    const rate = await checkRateLimitDistributed(`wallet:topup:${user.id}:${ip}`, 10, 15 * 60 * 1000, {
      requireDistributedInProduction: true,
    })
    if (!rate.allowed) return NextResponse.json({ error: 'Too many attempts. Please wait.' }, { status: 429 })

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Enter an amount between ₦${TOPUP_MIN.toLocaleString('en-NG')} and ₦${TOPUP_MAX.toLocaleString('en-NG')}` },
        { status: 400 },
      )
    }
    const { amount } = parsed.data

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl || !getFlutterwaveSecretKey()) {
      return NextResponse.json({ error: 'Top-ups are not available right now.' }, { status: 500 })
    }

    const reference = `TOPUP-${Date.now()}-${user.id.substring(0, 8)}`
    const { ok, data } = await flutterwaveRequest('/payments', {
      body: {
        tx_ref: reference,
        amount,
        currency: 'NGN',
        redirect_url: `${appUrl.replace(/\/$/, '')}/api/wallet/topup/verify`,
        customer: { email: user.email || `${user.id}@batamart.app`, name: user.name ?? undefined },
        customizations: { title: 'BataMart wallet top-up' },
        meta: { userId: user.id, purpose: 'WALLET_TOPUP' },
      },
    })

    const link = data?.data?.link
    if (!ok || data?.status !== 'success' || !link) {
      console.error('Top-up init failed:', JSON.stringify(data))
      return NextResponse.json({ error: data?.message || 'Could not start the top-up' }, { status: 400 })
    }

    return NextResponse.json({ success: true, authorizationUrl: link, reference })
  } catch (error) {
    console.error('wallet topup error:', error)
    return NextResponse.json({ error: 'Failed to start top-up' }, { status: 500 })
  }
}
