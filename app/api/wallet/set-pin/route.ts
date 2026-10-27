// app/api/wallet/set-pin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyPinChanged } from '@/lib/notify/events'
import { getUserFromRequest, verifyOTP, checkSuspension } from '@/lib/auth/auth'
import bcrypt from 'bcryptjs'

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

    const { pin, currentPin, otpCode } = await request.json()

    if (!pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'New PIN must be exactly 6 digits' },
        { status: 400 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        withdrawalPin: true,
        withdrawalPinAttempts: true,
        withdrawalPinLockedUntil: true,
        email: true,
      },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // CASE 1: First time setting PIN - no verification needed
    if (!dbUser.withdrawalPin) {
      const hashed = await bcrypt.hash(pin, 10)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          withdrawalPin: hashed,
          withdrawalPinAttempts: 0,
          withdrawalPinLockedUntil: null,
        },
      })
      await notifyPinChanged(user.id, 'set')
      return NextResponse.json({ success: true, message: 'Withdrawal PIN set successfully' })
    }

    // CASE 2: Changing PIN via current PIN
    if (currentPin) {
      if (dbUser.withdrawalPinLockedUntil && dbUser.withdrawalPinLockedUntil > new Date()) {
        const minutes = Math.ceil(
          (dbUser.withdrawalPinLockedUntil.getTime() - Date.now()) / 60000
        )
        return NextResponse.json(
          { error: `Too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.` },
          { status: 429 }
        )
      }

      const isMatch = await bcrypt.compare(currentPin, dbUser.withdrawalPin)

      if (!isMatch) {
        const newAttempts = (dbUser.withdrawalPinAttempts ?? 0) + 1
        const shouldLock = newAttempts >= 5
        await prisma.user.update({
          where: { id: user.id },
          data: {
            withdrawalPinAttempts: newAttempts,
            withdrawalPinLockedUntil: shouldLock
              ? new Date(Date.now() + 15 * 60 * 1000)
              : null,
          },
        })
        const attemptsLeft = Math.max(0, 5 - newAttempts)
        return NextResponse.json(
          {
            error: shouldLock
              ? 'Too many failed attempts. PIN locked for 15 minutes.'
              : `Incorrect current PIN. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
          },
          { status: 401 }
        )
      }

      const hashed = await bcrypt.hash(pin, 10)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          withdrawalPin: hashed,
          withdrawalPinAttempts: 0,
          withdrawalPinLockedUntil: null,
        },
      })
      await notifyPinChanged(user.id, 'changed')
      return NextResponse.json({ success: true, message: 'PIN changed successfully' })
    }

    // CASE 3: Forgot PIN - verify OTP then reset
    if (otpCode) {
      if (!dbUser.email) {
        return NextResponse.json(
          { error: 'No email address on your account to verify with' },
          { status: 400 }
        )
      }

      const isValidOTP = await verifyOTP(dbUser.email, otpCode)
      if (!isValidOTP) {
        return NextResponse.json(
          { error: 'Invalid or expired OTP code. Please request a new one.' },
          { status: 400 }
        )
      }

      const hashed = await bcrypt.hash(pin, 10)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          withdrawalPin: hashed,
          withdrawalPinAttempts: 0,
          withdrawalPinLockedUntil: null,
        },
      })
      await notifyPinChanged(user.id, 'reset')
      return NextResponse.json({ success: true, message: 'PIN reset successfully' })
    }

    return NextResponse.json(
      { error: 'Current PIN or OTP code required to change PIN' },
      { status: 400 }
    )

  } catch (error) {
    console.error('[set-pin]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
