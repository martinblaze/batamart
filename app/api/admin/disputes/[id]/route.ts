export const dynamic = 'force-dynamic'
// app/api/admin/disputes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'

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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: params.id },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        seller: { select: { id: true, name: true, email: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            deliveryFee: true,
            product: { select: { name: true, images: true } },
            rider: {
              select: {
                id: true,
                name: true,
                phone: true,
                profilePhoto: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ dispute })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dispute' }, { status: 500 })
  }
}