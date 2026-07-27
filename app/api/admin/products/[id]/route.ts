export const dynamic = 'force-dynamic'
// app/api/admin/products/[id]/route.ts
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

// Full detail for the admin review page — unlike the public
// app/api/products/[id]/route.ts, this does NOT filter by isActive, since
// admins specifically need to review PENDING (not-yet-active) listings.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        variants: true,
        attributeValues: true,
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profilePhoto: true,
            avgRating: true,
            trustLevel: true,
            completedOrders: true,
            isSuspended: true,
            hostelName: true,
            roomNumber: true,
            landmark: true,
            createdAt: true,
          },
        },
        university: { select: { name: true, shortName: true } },
        productReports: {
          select: { id: true, reason: true, createdAt: true, userId: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { productReports: true, orders: true } },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Admin product detail fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.product.update({
      where: { id: params.id },
      data: {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    console.error('Admin product delete error:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
