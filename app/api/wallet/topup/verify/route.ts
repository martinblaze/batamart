// app/api/wallet/topup/verify/route.ts
// Flutterwave redirects here after a top-up payment. The credit is applied
// only after Flutterwave itself confirms the transaction, and only once per
// tx_ref.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { flutterwaveRequest } from '@/lib/finance/flutterwave'
import { checkRateLimitDistributed, getIpKey } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

function appRedirect(path: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://batamart.com'
  try {
    return NextResponse.redirect(new URL(path, base).toString())
  } catch {
    return NextResponse.redirect(`https://batamart.com${path}`)
  }
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams
  const txRef = params.get('tx_ref')?.trim() || null
  const flwId = params.get('transaction_id')?.trim() || null
  const flwStatus = params.get('status')?.trim() || null
  const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))

  if (!txRef || !/^TOPUP-[A-Za-z0-9._:-]{6,120}$/.test(txRef)) return appRedirect('/wallet?topup=failed')
  if (flwStatus && flwStatus !== 'successful' && flwStatus !== 'completed') return appRedirect('/wallet?topup=failed')
  if (!flwId) return appRedirect('/wallet?topup=failed')

  const rate = await checkRateLimitDistributed(`wallet:topup:verify:${ip}:${txRef}`, 10, 10 * 60 * 1000, {
    requireDistributedInProduction: true,
  })
  if (!rate.allowed) return appRedirect('/wallet?topup=failed')

  try {
    const { data } = await flutterwaveRequest(`/transactions/${encodeURIComponent(flwId)}/verify`)
    const tx = data?.data
    const status = String(tx?.status ?? '').toLowerCase()
    if (data?.status !== 'success' || (status !== 'successful' && status !== 'success')) {
      return appRedirect('/wallet?topup=failed')
    }
    if (tx?.tx_ref !== txRef || tx?.currency !== 'NGN') return appRedirect('/wallet?topup=failed')

    let meta = tx?.meta
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta) } catch { meta = null }
    }
    const userId = typeof meta?.userId === 'string' ? meta.userId : null
    if (!userId || meta?.purpose !== 'WALLET_TOPUP') return appRedirect('/wallet?topup=failed')

    const amount = Number(tx?.amount)
    if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000) return appRedirect('/wallet?topup=failed')

    try {
      await prisma.$transaction(async db => {
        const already = await db.transaction.findFirst({ where: { reference: txRef, userId }, select: { id: true } })
        if (already) return
        const user = await db.user.findUnique({ where: { id: userId }, select: { availableBalance: true } })
        if (!user) throw new Error('USER_MISSING')
        const before = Number(user.availableBalance ?? 0)
        await db.user.update({ where: { id: userId }, data: { availableBalance: { increment: amount } } })
        await db.transaction.create({
          data: {
            userId,
            type: 'CREDIT',
            amount,
            description: 'Wallet top-up',
            reference: txRef,
            balanceBefore: before,
            balanceAfter: before + amount,
          },
        })
      }, { isolationLevel: 'Serializable' })
    } catch (err: any) {
      // A concurrent callback for the same tx_ref won the race (serialization
      // failure): the credit is already applied.
      if (err?.code !== 'P2034') throw err
    }

    return appRedirect('/wallet?topup=success')
  } catch (error) {
    console.error('wallet topup verify error:', error)
    return appRedirect('/wallet?topup=failed')
  }
}
