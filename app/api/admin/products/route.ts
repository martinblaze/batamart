export const dynamic = 'force-dynamic'
// app/api/admin/products/route.ts
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

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const universityId = searchParams.get('universityId') || 'all'
    const search       = searchParams.get('search') || ''
    const flagged      = searchParams.get('flagged') === 'true'
    const status       = searchParams.get('status') || 'PENDING' // Default to PENDING products for review
    const page         = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit        = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const skip         = (page - 1) * limit

    const where: any = { isDeleted: false }

    // Filter by moderation status
    if (status && status !== 'all') {
      where.moderationStatus = status
    }

    if (flagged) {
      where.isFlagged = true
    }

    if (universityId !== 'all') {
      where.universityId = universityId
    }

    if (search.trim()) {
      where.OR = [
        { name:     { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          seller: {
            select: {
              id:   true,
              name: true,
              phone: true,
              email: true,
              university: { select: { shortName: true } },
            },
          },
          _count: {
            select: { productReports: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return NextResponse.json({ products, total, page, limit })
  } catch (error) {
    console.error('Admin products error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { productId, action, rejectionReason } = body

    if (!productId || !action) {
      return NextResponse.json({ error: 'Missing productId or action' }, { status: 400 })
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject"' }, { status: 400 })
    }

    if (action === 'reject' && !rejectionReason?.trim()) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    // Fetch the product first
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { seller: { select: { id: true, email: true, phone: true, name: true } } },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.moderationStatus !== 'PENDING') {
      return NextResponse.json(
        { error: `Product is already ${product.moderationStatus.toLowerCase()}` },
        { status: 400 }
      )
    }

    // Update product based on action
    const updateData: any = {
      moderationStatus: action === 'approve' ? 'APPROVED' : 'REJECTED',
    }

    if (action === 'approve') {
      updateData.isActive = true
    } else if (action === 'reject') {
      updateData.rejectionReason = rejectionReason?.trim()
      updateData.isActive = false
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: { seller: true },
    })

    // Create notification for seller
    if (updatedProduct.seller) {
      const notificationMessage =
        action === 'approve'
          ? `Your product "${updatedProduct.name}" has been approved and is now live in the marketplace!`
          : `Your product "${updatedProduct.name}" was rejected. Reason: ${rejectionReason}`

      await prisma.notification.create({
        data: {
          userId: updatedProduct.seller.id,
          title: action === 'approve' ? 'Product Approved ✓' : 'Product Rejected',
          message: notificationMessage,
          type: action === 'approve' ? 'PRODUCT_APPROVED' : 'PRODUCT_REJECTED',
          link: `/marketplace/product/${productId}`,
          isRead: false,
        },
      }).catch(() => {
        // Notification creation failed, but product update succeeded
        console.warn('Failed to create notification for product approval/rejection')
      })
    }

    return NextResponse.json({
      success: true,
      message: `Product ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      product: updatedProduct,
    })
  } catch (error) {
    console.error('Admin product update error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}
