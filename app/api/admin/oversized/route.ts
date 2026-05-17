import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const token = auth.slice(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    if (decoded.role !== 'ADMIN') return null
    return decoded
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [declines, strikes, suspendedSellers] = await Promise.all([
    prisma.oversizedDeclineLog.findMany({
      include: {  },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.sellerStrike.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.user.findMany({
      where: { isSuspended: true, role: { in: ['SELLER', 'BUYER'] } },
      select: { id: true, name: true, suspensionReason: true, suspendedUntil: true },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
  ])

  const productIds = Array.from(new Set(declines.map((d) => d.productId)))
  const userIds = Array.from(new Set([...declines.map((d) => d.sellerId), ...declines.map((d) => d.buyerId), ...declines.map((d) => d.riderId)]))
  const [products, users] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, moderationStatus: true, isActive: true } }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
  ])

  return NextResponse.json({ declines, strikes, suspendedSellers, products, users })
}

export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { productId, action } = await req.json()
  if (!productId || !['APPROVE', 'REMOVE'].includes(action)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const product = await prisma.product.update({
    where: { id: productId },
    data: action === 'APPROVE'
      ? { moderationStatus: 'APPROVED', isActive: true }
      : { moderationStatus: 'REMOVED', isActive: false },
  })
  return NextResponse.json({ success: true, product })
}
