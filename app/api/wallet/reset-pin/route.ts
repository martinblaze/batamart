// app/api/wallet/reset-pin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, createOTP, sendEmailOTP, checkSuspension } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const suspension = await checkSuspension(user.id)
    if (suspension.suspended) {
      return NextResponse.json(
        {
          error: suspension.reason || 'Your account is suspended. Wallet actions are disabled.',
          suspendedUntil: suspension.until ?? null,
        },
        { status: 403 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, withdrawalPin: true },
    })

    if (!dbUser?.email) {
      return NextResponse.json(
        { error: 'No email address on your account. Contact support.' },
        { status: 400 }
      )
    }

    if (!dbUser.withdrawalPin) {
      return NextResponse.json(
        { error: 'You have not set a PIN yet. Just set a new one directly.' },
        { status: 400 }
      )
    }

    const code = await createOTP(dbUser.email)
    const sent = await sendEmailOTP(dbUser.email, code)

    if (!sent) {
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `OTP sent to ${dbUser.email}`,
      email: dbUser.email,
    })
  } catch (error) {
    console.error('[reset-pin]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
