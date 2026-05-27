// app/api/auth/signup-with-password/route.ts
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, hashPassword } from '@/lib/auth/auth'
import { generateUniqueReferralCode } from '@/lib/referral/generateReferralCode'
import { verifyOtpSessionToken } from '@/app/api/auth/verify-otp/route'
import { verifyGoogleSignupToken } from '@/lib/auth/google-signup-token'
import { checkRateLimitDistributed, getIpKey, incrementRateLimit } from '@/lib/security/rate-limit'

const SIGNUP_WINDOW_MS = 60 * 60 * 1000
const SIGNUP_MAX_REQUESTS = 5

export async function POST(request: NextRequest) {
  try {
    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
    const rateLimitKey = `signup:${ip}`
    const { allowed, retryAfterSecs } = await checkRateLimitDistributed(
      rateLimitKey,
      SIGNUP_MAX_REQUESTS,
      SIGNUP_WINDOW_MS,
      { requireDistributedInProduction: true },
    )
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many signup attempts. Please wait ${Math.ceil(retryAfterSecs / 60)} minute(s) and try again.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } },
      )
    }
    await incrementRateLimit(rateLimitKey, SIGNUP_WINDOW_MS)

    const body = await request.json()
    const {
      email,
      name,
      password,
      otpSessionToken,
      // NOTE: `role` from the request body is intentionally ignored.
      // All new users are created as BUYER. They can upgrade to SELLER
      // only via the /become-seller flow (POST /api/auth/become-seller).
      phone,
      referralCode,
      universityId,
      // ── Delivery location ──────────────────────────────────────────────
      hostelName,
      roomNumber,
      landmark,
    } = body

    // ── Field presence check ───────────────────────────────────────────────
    if (!email || !otpSessionToken || !password || !name || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // ── University required ────────────────────────────────────────────────
    if (!universityId) {
      return NextResponse.json({ error: 'Please select your university or campus area' }, { status: 400 })
    }

    // ── Delivery location required ─────────────────────────────────────────
    if (!hostelName || !String(hostelName).trim()) {
      return NextResponse.json({ error: 'Please enter your lodge or landmark name' }, { status: 400 })
    }
    if (!roomNumber || !String(roomNumber).trim()) {
      return NextResponse.json({ error: 'Please enter your room number' }, { status: 400 })
    }
    if (!landmark || !String(landmark).trim()) {
      return NextResponse.json({ error: 'Please select your delivery area' }, { status: 400 })
    }

    // ── Input length guards ────────────────────────────────────────────────
    if (String(name).trim().length < 2 || String(name).trim().length > 80) {
      return NextResponse.json({ error: 'Name must be between 2 and 80 characters' }, { status: 400 })
    }
    if (String(password).length < 6 || String(password).length > 128) {
      return NextResponse.json({ error: 'Password must be between 6 and 128 characters' }, { status: 400 })
    }

    // ── OTP session token verification ────────────────────────────────────
    const verifiedIdentifier = verifyOtpSessionToken(otpSessionToken)
    const googleSignup = verifiedIdentifier ? null : verifyGoogleSignupToken(otpSessionToken)

    if (!verifiedIdentifier && !googleSignup) {
      return NextResponse.json(
        { error: 'Session expired or invalid. Please restart signup.' },
        { status: 400 }
      )
    }

    const verifiedEmail = verifiedIdentifier || googleSignup?.email || ''
    if (verifiedEmail.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email does not match the verified address. Please restart the signup flow.' },
        { status: 400 }
      )
    }

    // ── Validate university exists ─────────────────────────────────────────
    const university = await prisma.university.findUnique({
      where:  { id: universityId },
      select: { id: true, isActive: true, name: true, shortName: true },
    })

    if (!university || !university.isActive) {
      return NextResponse.json({ error: 'Selected university is not available' }, { status: 400 })
    }

    // ── Duplicate account check ────────────────────────────────────────────
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
    })

    if (existingUser) {
      const conflict = existingUser.email === email ? 'email' : 'phone number'
      return NextResponse.json(
        { error: `An account with this ${conflict} already exists` },
        { status: 400 }
      )
    }

    // ── Resolve referral code ──────────────────────────────────────────────
    let referredById: string | undefined = undefined

    if (referralCode && typeof referralCode === 'string') {
      const referrer = await prisma.user.findUnique({
        where:  { referralCode: referralCode.trim().toUpperCase() },
        select: { id: true },
      })
      if (referrer) {
        referredById = referrer.id
      }
    }

    const hashedPassword  = await hashPassword(password)
    const newReferralCode = await generateUniqueReferralCode()

    // ── Always create as BUYER ─────────────────────────────────────────────
    // Sellers are created exclusively via POST /api/auth/become-seller.
    // This prevents confusion where buyers accidentally got seller accounts.
    const user = await prisma.user.create({
      data: {
        email,
        name:         name.trim(),
        phone,
        password:     hashedPassword,
        role:         'BUYER',
        referralCode: newReferralCode,
        universityId: university.id,
        // ── Delivery location ────────────────────────────────────────────
        hostelName:   String(hostelName).trim(),
        roomNumber:   String(roomNumber).trim(),
        landmark:     String(landmark).trim(),
        ...(referredById ? { referredById } : {}),
      },
    })

    const token = generateToken(user.id, user.phone)

    return NextResponse.json({
      success: true,
      token,
      user: {
        id:           user.id,
        name:         user.name,
        phone:        user.phone,
        email:        user.email,
        role:         user.role,
        hostelName:   user.hostelName,
        roomNumber:   user.roomNumber,
        landmark:     user.landmark,
        referralCode: user.referralCode,
        universityId: user.universityId,
        university:   { name: university.name, shortName: university.shortName },
      },
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 })
  }
}
