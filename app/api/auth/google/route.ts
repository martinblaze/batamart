export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { generateToken } from '@/lib/auth/auth'
import { issueGoogleSignupToken } from '@/lib/auth/google-signup-token'

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

// ── Signups closed until June 22, 2026 ──────────────────────────────────────
function googleAudience() {
  return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
}

export async function POST(request: NextRequest) {
  try {
    const { idToken, mode, universityId, referralCode, signupAccessCode } = await request.json()

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Google token is required' }, { status: 400 })
    }

    const aud = googleAudience()
    if (!aud) {
      return NextResponse.json({ error: 'Google auth is not configured' }, { status: 500 })
    }

    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: aud,
    })

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null
    const name = typeof payload.name === 'string' ? payload.name : 'Google User'

    if (!email) {
      return NextResponse.json({ error: 'Google account has no email' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      if (mode !== 'signup') {
        return NextResponse.json({ error: 'No account found. Use Sign up with Google first.' }, { status: 404 })
      }

      const signupToken = issueGoogleSignupToken({
        email,
        name,
        universityId: typeof universityId === 'string' && universityId.trim() ? universityId : undefined,
        referralCode: typeof referralCode === 'string' && referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
        signupAccessCode: typeof signupAccessCode === 'string' && signupAccessCode.trim() ? signupAccessCode.trim().toUpperCase() : undefined,
      })

      return NextResponse.json({
        success: true,
        requiresProfile: true,
        signupToken,
        profile: { email, name },
      })
    }

    if (user.role === 'RIDER') {
      return NextResponse.json(
        { error: 'Rider accounts cannot use this login. Use Rider Login.', isRider: true },
        { status: 403 }
      )
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
    console.error('Google auth error:', error)
    return NextResponse.json({ error: 'Google authentication failed' }, { status: 500 })
  }
}
