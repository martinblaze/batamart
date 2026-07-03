export const dynamic = 'force-dynamic'
// app/api/riders/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, generateToken } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Find rider by email
    const rider = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        password: true,
        isRiderVerified: true,
        isAvailable: true,
        availableBalance: true,
        pendingBalance: true,
        isSuspended: true,
      },
    })

    if (!rider) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Must be a rider
    if (rider.role !== 'RIDER') {
      return NextResponse.json({ error: 'This account is not a rider account' }, { status: 403 })
    }

    if (!rider.isRiderVerified) {
      return NextResponse.json({ error: 'Rider account pending verification' }, { status: 403 })
    }

    // Check if suspended
    if (rider.isSuspended) {
      return NextResponse.json({ error: 'Your account has been suspended' }, { status: 403 })
    }

    // Verify password
    const passwordMatch = await comparePassword(password, rider.password)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // ── FIXED: pass rider.phone as 2nd arg, rider.role as 3rd arg ──
    // Previously `rider.role` was passed as the `phone` slot, so the token
    // never contained a `role` claim, silently breaking all role-based auth.
    const token = generateToken(rider.id, rider.phone, rider.role)

    return NextResponse.json({
      success: true,
      token,
      user: {
        id:               rider.id,
        name:             rider.name,
        email:            rider.email,
        phone:            rider.phone,
        role:             rider.role,
        isRiderVerified:  rider.isRiderVerified,
        isAvailable:      rider.isAvailable,
        availableBalance: rider.availableBalance,
        pendingBalance:   rider.pendingBalance,
      },
    })
  } catch (error) {
    console.error('Rider login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
