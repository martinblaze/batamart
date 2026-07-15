// app/api/auth/verify-otp/route.ts
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyOTP, generateToken, formatPhone } from '@/lib/auth/auth'
import { generateUniqueReferralCode } from '@/lib/referral/generateReferralCode'
import { checkRateLimitDistributed, getIpKey, incrementRateLimit } from '@/lib/security/rate-limit'
import jwt from 'jsonwebtoken'

// OTP session token
// After a successful OTP verification we return a short-lived signed token that
// proves "this email/phone passed OTP". The signup-with-password route verifies
// this token before creating the account so you can't sign up with an email
// you never verified.
const OTP_SESSION_EXPIRES = '15m' // must complete signup within 15 minutes

function getOtpSessionSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('Server misconfiguration: JWT_SECRET is not set.')
  }
  return secret
}

function issueOtpSessionToken(identifier: string): string {
  return jwt.sign({ verified: identifier }, getOtpSessionSecret(), { expiresIn: OTP_SESSION_EXPIRES })
}

export function verifyOtpSessionToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, getOtpSessionSecret()) as { verified: string }
    return payload.verified ?? null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, email, code, otpCode, name } = body
    const identifier = phone ? formatPhone(phone) : email
    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))

    const { allowed, retryAfterSecs } = await checkRateLimitDistributed(
      `verify-otp:${ip}:${identifier || 'unknown'}`,
      15,
      15 * 60 * 1000,
      { requireDistributedInProduction: true }
    )
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please wait ${Math.ceil(retryAfterSecs / 60)} minute(s) before trying again.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } }
      )
    }
    await incrementRateLimit(`verify-otp:${ip}:${identifier || 'unknown'}`, 15 * 60 * 1000)

    const otpValue = otpCode || code

    if (!otpValue) {
      return NextResponse.json({ error: 'OTP code is required' }, { status: 400 })
    }

    if (!identifier) {
      return NextResponse.json({ error: 'Phone or email is required' }, { status: 400 })
    }

    const isValid = await verifyOTP(identifier, otpValue)

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 })
    }

    // Signup flow (no name passed)
    // Issue a short-lived OTP session token that proves this identifier was verified.
    if (!name) {
      const otpSessionToken = issueOtpSessionToken(identifier)
      return NextResponse.json({ success: true, otpSessionToken })
    }

    // Login / other flows that pass a name
    let user = await prisma.user.findFirst({
      where: phone ? { phone: formatPhone(phone) } : { email },
    })

    if (!user) {
      const referralCode = await generateUniqueReferralCode()
      user = await prisma.user.create({
        data: {
          phone: phone ? formatPhone(phone) : undefined,
          email: email || undefined,
          name,
          password: '',
          referralCode,
        },
      })
    }

    const token = generateToken(user.id, user.phone || user.email || '')

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        hostelName: user.hostelName,
      },
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 })
  }
}
