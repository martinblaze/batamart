// app/api/wallet/withdraw/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest, checkSuspension } from '@/lib/auth/auth'
import bcrypt from 'bcryptjs'
import { releaseMaturedSellerEscrowForUser } from '@/lib/escrow'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { checkRateLimitDistributed, getIpKey, incrementRateLimit } from '@/lib/security/rate-limit'
import { flutterwaveRequest } from '@/lib/finance/flutterwave'
import { FIELD_MARKETER_MIN_WITHDRAWAL, withdrawalFloorMessage } from '@/lib/field-marketer/config'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const MAX_PIN_ATTEMPTS = 5
const PIN_LOCK_DURATION = 15 * 60 * 1000
const MIN_WITHDRAWAL = 2_000
const MAX_WITHDRAWAL = 500_000
const WITHDRAW_COOLDOWN = 30_000

const withdrawalSchema = z.object({
  amount: z.number().int().min(MIN_WITHDRAWAL).max(MAX_WITHDRAWAL),
  source: z.enum(['MAIN', 'MARKETING']).optional(),
  bankCode: z.string().trim().min(2).max(20),
  accountNumber: z.string().trim().min(6).max(20),
  accountName: z.string().trim().min(2).max(100),
  pin: z.string().regex(/^\d{6}$/),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  clientRequestId: z.string().trim().min(8).max(120).optional(),
}).strict()

function maskedAccount(accountNumber: string) {
  return `****${accountNumber.slice(-4)}`
}

async function rejectWithdrawalRequest(requestId: string, reason: string) {
  await prisma.withdrawalRequest.update({
    where: { id: requestId },
    data: {
      status: 'REJECTED',
      adminNotes: reason,
      updatedAt: new Date(),
    },
  })
}

async function refundBalance(userId: string, amount: number, source: 'MAIN' | 'MARKETING'): Promise<void> {
  try {
    if (source === 'MARKETING') {
      await prisma.fieldMarketer.update({
        where: { userId },
        data: { balance: { increment: amount } },
      })
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { availableBalance: { increment: amount } },
      })
    }
    console.log(`[withdraw] Refunded ₦${amount} to user ${userId} after Flutterwave failure`)
  } catch (err) {
    console.error(`[withdraw] CRITICAL: Failed to refund ₦${amount} to user ${userId}`, err)
  }
}

export async function POST(request: NextRequest) {
  let withdrawalRequest: { id: string; status: string; bankDetails: any } | null = null
  let balanceDeducted = false

  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr

    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

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

    if (user.role === 'SELLER') {
      await releaseMaturedSellerEscrowForUser(user.id)
    }

    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown')
    const rateKey = `withdraw:${user.id}:${ip}`
    const rate = await checkRateLimitDistributed(rateKey, 1, WITHDRAW_COOLDOWN, { requireDistributedInProduction: true })
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: 'Please wait before requesting another withdrawal.',
          retryAfterSecs: rate.retryAfterSecs,
        },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSecs) } }
      )
    }
    await incrementRateLimit(rateKey, WITHDRAW_COOLDOWN)

    const body = await request.json()
    // The marketing wallet has a higher floor, only revealed here when hit.
    if (body?.source === 'MARKETING') {
      const marketer = await prisma.fieldMarketer.findUnique({
        where: { userId: user.id },
        select: { balance: true },
      })
      if (!marketer) {
        return NextResponse.json({ error: 'No marketing wallet on this account' }, { status: 403 })
      }
      if (typeof body.amount !== 'number' || body.amount < FIELD_MARKETER_MIN_WITHDRAWAL) {
        return NextResponse.json({ error: withdrawalFloorMessage(marketer.balance) }, { status: 400 })
      }
    }

    const parsed = withdrawalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid withdrawal payload' }, { status: 400 })
    }

    const {
      amount,
      bankCode,
      accountNumber,
      accountName,
      pin,
      source: sourceInput,
      idempotencyKey,
      clientRequestId,
    } = parsed.data
    const source: 'MAIN' | 'MARKETING' = sourceInput ?? 'MAIN'
    const requestKey = clientRequestId || idempotencyKey || null

    if (!requestKey) {
      return NextResponse.json({ error: 'Missing withdrawal request key' }, { status: 400 })
    }

    const existingRequest = await prisma.withdrawalRequest.findUnique({
      where: { clientRequestId: requestKey },
    })

    if (existingRequest) {
      const bankDetails = existingRequest.bankDetails as Record<string, any>
      return NextResponse.json(
        {
          success: existingRequest.status !== 'REJECTED',
          reference: bankDetails?.transferReference || existingRequest.id,
          requestId: existingRequest.id,
          status: existingRequest.status,
          message:
            existingRequest.status === 'REJECTED'
              ? existingRequest.adminNotes || 'Withdrawal request was rejected'
              : 'Withdrawal request already exists',
        },
        { status: existingRequest.status === 'REJECTED' ? 400 : 200 }
      )
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        availableBalance: true,
        withdrawalPin: true,
        withdrawalPinAttempts: true,
        withdrawalPinLockedUntil: true,
      },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!currentUser.withdrawalPin) {
      return NextResponse.json({ error: 'PIN_REQUIRED' }, { status: 403 })
    }

    if (currentUser.withdrawalPinLockedUntil && currentUser.withdrawalPinLockedUntil > new Date()) {
      const minutes = Math.ceil((currentUser.withdrawalPinLockedUntil.getTime() - Date.now()) / 60000)
      return NextResponse.json(
        { error: `Too many failed attempts. PIN locked for ${minutes} more minute${minutes !== 1 ? 's' : ''}.` },
        { status: 429 }
      )
    }

    const isPinValid = await bcrypt.compare(String(pin), currentUser.withdrawalPin)
    if (!isPinValid) {
      const newAttempts = (currentUser.withdrawalPinAttempts ?? 0) + 1
      const shouldLock = newAttempts >= MAX_PIN_ATTEMPTS

      await prisma.user.update({
        where: { id: user.id },
        data: {
          withdrawalPinAttempts: newAttempts,
          withdrawalPinLockedUntil: shouldLock ? new Date(Date.now() + PIN_LOCK_DURATION) : null,
        },
      })

      const attemptsLeft = Math.max(0, MAX_PIN_ATTEMPTS - newAttempts)
      return NextResponse.json(
        {
          error: shouldLock
            ? 'Too many failed attempts. PIN locked for 15 minutes.'
            : `Incorrect PIN. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
        },
        { status: 401 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { withdrawalPinAttempts: 0, withdrawalPinLockedUntil: null },
    })

    try {
      withdrawalRequest = await prisma.withdrawalRequest.create({
        data: {
          userId: user.id,
          clientRequestId: requestKey,
          amount,
          status: 'PENDING',
          bankDetails: {
            bankCode,
            accountNumber,
            accountName,
            status: 'PENDING',
          },
        },
        select: {
          id: true,
          status: true,
          bankDetails: true,
        },
      })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const existing = await prisma.withdrawalRequest.findUnique({
          where: { clientRequestId: requestKey },
        })
        if (existing) {
          const bankDetails = existing.bankDetails as Record<string, any>
          return NextResponse.json(
            {
              success: existing.status !== 'REJECTED',
              reference: bankDetails?.transferReference || existing.id,
              requestId: existing.id,
              status: existing.status,
              message:
                existing.status === 'REJECTED'
                  ? existing.adminNotes || 'Withdrawal request was rejected'
                  : 'Withdrawal request already exists',
            },
            { status: existing.status === 'REJECTED' ? 400 : 200 }
          )
        }
      }
      throw err
    }

    let balanceBefore = Number(currentUser.availableBalance)
    let deductResult: { count: number }
    if (source === 'MARKETING') {
      const marketer = await prisma.fieldMarketer.findUnique({
        where: { userId: user.id },
        select: { balance: true },
      })
      balanceBefore = marketer?.balance ?? 0
      deductResult = await prisma.fieldMarketer.updateMany({
        where: { userId: user.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })
    } else {
      deductResult = await prisma.user.updateMany({
        where: {
          id: user.id,
          availableBalance: { gte: amount },
        },
        data: {
          availableBalance: { decrement: amount },
        },
      })
    }

    if (deductResult.count === 0) {
      await rejectWithdrawalRequest(withdrawalRequest.id, 'Insufficient balance')
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    balanceDeducted = true

    const transferReference = withdrawalRequest.id
    let transferCode: string | null = null
    let flwStatus: string | null = null

    try {
      // Flutterwave v3's Transfers API is a single call — no separate
      // "create recipient" step like Paystack requires. Amount is whole
      // Naira, not kobo.
      const { ok, data: transferData } = await flutterwaveRequest('/transfers', {
        body: {
          account_bank: bankCode,
          account_number: accountNumber,
          amount,
          narration: `BATAMART withdrawal - ${accountName}`,
          currency: 'NGN',
          reference: transferReference,
          debit_currency: 'NGN',
        },
      })

      if (!ok || transferData?.status !== 'success') {
        await refundBalance(user.id, amount, source)
        await rejectWithdrawalRequest(withdrawalRequest.id, transferData?.message || 'Transfer initiation failed')
        return NextResponse.json(
          { error: transferData?.message || 'Transfer initiation failed' },
          { status: 400 }
        )
      }

      transferCode = transferData.data?.id ? String(transferData.data.id) : null
      flwStatus = transferData.data?.status ?? null

      await prisma.$transaction(async (tx) => {
        await tx.withdrawalRequest.update({
          where: { id: withdrawalRequest!.id },
          data: {
            status: 'PROCESSING',
            bankDetails: {
              bankCode,
              accountNumber,
              accountName,
              status: 'PROCESSING',
              transferReference,
              transferCode,
              flutterwaveStatus: flwStatus,
            },
            processedAt: new Date(),
          },
        })

        await tx.transaction.create({
          data: {
            userId: user.id,
            type: 'WITHDRAWAL',
            amount,
            description: `${source === 'MARKETING' ? 'Marketing wallet withdrawal' : 'Withdrawal'} to ${accountName} - ${maskedAccount(accountNumber)}`,
            reference: transferReference,
            balanceBefore,
            balanceAfter: balanceBefore - amount,
          },
        })

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'WITHDRAWAL_INITIATED',
            entityType: 'WithdrawalRequest',
            entityId: transferReference,
            newValue: {
              amount,
              bankCode,
              accountNumber: maskedAccount(accountNumber),
              accountName,
              source,
              transferReference,
              transferCode,
              flutterwaveStatus: flwStatus,
              balanceBefore,
              balanceAfter: balanceBefore - amount,
            },
            ipAddress: ip,
            userAgent: request.headers.get('user-agent') ?? undefined,
          },
        })
      }, { timeout: 15_000, maxWait: 20_000 })

      return NextResponse.json({
        success: true,
        message: 'Withdrawal initiated successfully',
        reference: transferReference,
        transferCode,
        requestId: withdrawalRequest.id,
      })
    } catch (flutterwaveErr) {
      console.error('Flutterwave error during withdrawal:', flutterwaveErr)
      if (balanceDeducted) {
        await refundBalance(user.id, amount, source)
      }
      await rejectWithdrawalRequest(withdrawalRequest.id, 'Payment provider error')
      return NextResponse.json(
        { error: 'Payment network error. Your balance has been restored. Please try again.' },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('Withdrawal error:', error)
    return NextResponse.json({ error: 'Failed to process withdrawal' }, { status: 500 })
  }
}

