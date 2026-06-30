export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'

const PAYMENT_SETTING_KEY = 'checkout_payments_enabled'

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  try {
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    if (decoded.role !== 'ADMIN') return null
    return decoded
  } catch {
    return null
  }
}

async function getPaymentSetting() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: PAYMENT_SETTING_KEY },
  })
  return setting?.value ?? true
}

export async function GET() {
  const enabled = await getPaymentSetting()
  return NextResponse.json({ enabled })
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
    }

    await prisma.appSetting.upsert({
      where: { key: PAYMENT_SETTING_KEY },
      create: { key: PAYMENT_SETTING_KEY, value: body.enabled },
      update: { value: body.enabled },
    })

    return NextResponse.json({ enabled: body.enabled })
  } catch (error) {
    console.error('Payment availability toggle error:', error)
    return NextResponse.json({ error: 'Failed to update payment availability' }, { status: 500 })
  }
}