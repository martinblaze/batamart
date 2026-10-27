export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyPasswordChanged } from '@/lib/notify/events'
import { verifyOTP, hashPassword } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { checkRateLimitDistributed, getIpKey } from '@/lib/security/rate-limit'

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
    const { allowed, retryAfterSecs } = await checkRateLimitDistributed(
      `reset-password:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
      { requireDistributedInProduction: true }
    )
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many reset attempts. Please wait ${Math.ceil(retryAfterSecs / 60)} minute(s) before trying again.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } }
      )
    }

    const body = await request.json()
    const { email, otpCode, newPassword } = body

    if (!email || !otpCode || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify OTP (email-based only)
    const isValid = await verifyOTP(email, otpCode)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Update password
    const hashedPassword = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    })
    await notifyPasswordChanged(user.id)

    return NextResponse.json({
      success: true,
      message: 'Password reset successful',
    })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
