export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createOTP, sendEmailOTP } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { checkRateLimitDistributed, getIpKey, incrementRateLimit } from '@/lib/security/rate-limit'
import { getSignupStatus } from '@/lib/signup-access'

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

// ── Signups closed until June 22, 2026 ──────────────────────────────────────
const SIGNUP_REOPENS_AT = new Date('2026-06-22T00:00:00Z').getTime()

function checkSignupsOpen() {
  const now = Date.now()
  if (now >= SIGNUP_REOPENS_AT) {
    return { isOpen: true }
  }
  
  const msRemaining = SIGNUP_REOPENS_AT - now
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24))
  const hoursRemaining = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60))
  const secondsRemaining = Math.floor((msRemaining % (1000 * 60)) / 1000)
  
  return {
    isOpen: false,
    countdown: `${daysRemaining}d ${hoursRemaining}h ${minutesRemaining}m ${secondsRemaining}s`,
    reopensAt: '2026-06-22'
  }
}

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
    const { allowed, retryAfterSecs } = await checkRateLimitDistributed(
      `send-otp:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS,
      { requireDistributedInProduction: true }
    )
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests. Please wait ${Math.ceil(retryAfterSecs / 60)} minute(s) before trying again.` },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSecs) },
        }
      )
    }
    await incrementRateLimit(`send-otp:${ip}`, RATE_LIMIT_WINDOW_MS)

    const body = await request.json()
    const { email, isLogin, signupAccessCode } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // ── Block new signups until June 22 ────────────────────────────────────
    if (!isLogin) {
      const signupStatus = getSignupStatus(signupAccessCode)
      if (!signupStatus.isOpen) {
        return NextResponse.json(
          {
            error: 'Signups are temporarily closed for maintenance',
            message: `We're upgrading our platform! New signups reopen on ${signupStatus.reopensAt}`,
            countdown: signupStatus.countdown,
            reopensAt: signupStatus.reopensAt,
          },
          { status: 503 }
        )
      }
    }

    if (isLogin) {
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        return NextResponse.json(
          { error: 'Account not found. Please sign up first.' },
          { status: 404 }
        )
      }
    } else {
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        return NextResponse.json(
          { error: 'Account already exists. Please login instead.' },
          { status: 400 }
        )
      }
    }

    const otpCode = await createOTP(email)
    const sent = await sendEmailOTP(email, otpCode)

    if (!sent) {
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json(
      { error: 'Failed to send OTP. Please try again.' },
      { status: 500 }
    )
  }
}
