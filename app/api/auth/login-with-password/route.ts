export const dynamic = 'force-dynamic'
// app/api/auth/login-with-password/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken, comparePassword } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { checkRateLimitDistributed, incrementRateLimit, getIpKey } from '@/lib/security/rate-limit'

const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOGIN_MAX_REQUESTS = 10

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const ip = getIpKey(
      request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip')
    )
    const rateLimitKey = `login:${ip}`

    const { allowed, retryAfterSecs } = await checkRateLimitDistributed(
      rateLimitKey,
      LOGIN_MAX_REQUESTS,
      LOGIN_WINDOW_MS,
      { requireDistributedInProduction: true }
    )
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Please wait ${Math.ceil(retryAfterSecs / 60)} minute(s) and try again.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } }
      )
    }
    await incrementRateLimit(rateLimitKey, LOGIN_WINDOW_MS)

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Riders have a separate login at /rider/login.
    if (user.role === 'RIDER') {
      return NextResponse.json(
        { error: 'Rider accounts cannot log in here.', isRider: true },
        { status: 403 }
      )
    }

    const isValidPassword = await comparePassword(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    // Auto-lift expired suspension
    if (user.isSuspended && user.suspendedUntil && new Date(user.suspendedUntil) <= new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isSuspended: false, suspendedUntil: null, suspensionReason: null },
      })
      user.isSuspended = false
    }

    if (user.isSuspended) {
      return NextResponse.json(
        {
          error: 'Account suspended',
          suspended: true,
          reason: user.suspensionReason ?? 'Violation of platform terms',
          until: user.suspendedUntil ?? null,
        },
        { status: 403 }
      )
    }

    const token = generateToken(user.id, user.phone)

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        hostelName: user.hostelName,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
