export const dynamic = 'force-dynamic'
// app/api/products/[id]/route.ts - FULLY FIXED VERSION WITH INTERNAL API SECRET

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MAX_LISTING_IMAGES } from '@/lib/listing-limits'
import { notifyUser } from '@/lib/notify/dispatch'
import { notifyAdmins } from '@/lib/notify/events'
import { getUserFromRequest } from '@/lib/auth/auth'
import { getCategoryDisplayInfo } from '@/lib/variants'
import { getCampaignExpiry, isValidCampaignKey } from '@/lib/campaigns'

// GET single product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check for internal API secret (for WhatsApp crawler / OG meta fetches)
    const authHeader = request.headers.get('Authorization')
    const isInternal = authHeader === `Bearer ${process.env.INTERNAL_API_SECRET}`

    // Product pages are publicly viewable — a shared link works whether the
    // visitor is logged out or logged in from a different university.
    // Purchasing itself is what's gated (same-university only), enforced at
    // checkout time in app/api/payments/initialize/route.ts, not here.
    const user = isInternal ? null : await getUserFromRequest(request)

    const product = await prisma.product.findFirst({
      where: { id: params.id, isDeleted: false, isActive: true },
      include: {
        variants: true,
        attributeValues: true,
        seller: {
          select: {
            id: true,
            name: true,
            avgRating: true,
            trustLevel: true,
            completedOrders: true,
            profilePhoto: true,
            hostelName: true,
            roomNumber: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const { category, subcategory } = getCategoryDisplayInfo(
      product.categoryKey,
      product.subcategoryKey,
      product.category,
      product.subcategory,
    )
    const hydratedProduct = {
      ...product,
      category: category || product.category || '',
      subcategory: subcategory || product.subcategory || null,
    }

    // Increment view count only for identifiable logged-in visitors — skips
    // both crawler/OG-meta hits and anonymous viewers to avoid spam counts.
    if (!isInternal && user) {
      await prisma.product.update({
        where: { id: params.id },
        data: { viewCount: { increment: 1 } },
      }).catch(err => console.error('View count increment failed:', err))
    }

    return NextResponse.json({ product: hydratedProduct })
  } catch (error) {
    console.error('Fetch product error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// DELETE product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.isSuspended) {
      return NextResponse.json({ error: 'Suspended sellers cannot edit products.' }, { status: 403 })
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.sellerId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to delete this product' }, { status: 403 })
    }

    await prisma.product.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Delete product error:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}

// PUT - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const product = await prisma.product.findUnique({
      where: { id: params.id },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.sellerId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to edit this product' }, { status: 403 })
    }

    const body = await request.json()
    
    // Allow partial updates
    const updateData: any = {}
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.price !== undefined) updateData.price = parseFloat(body.price)
    if (body.description !== undefined) updateData.description = body.description
    if (body.category !== undefined) updateData.category = body.category
    if (body.categoryKey !== undefined) updateData.categoryKey = body.categoryKey
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory
    if (body.subcategoryKey !== undefined) updateData.subcategoryKey = body.subcategoryKey
    if (body.basePrice !== undefined) updateData.basePrice = parseFloat(body.basePrice)
    if (body.variantsEnabled !== undefined) updateData.variantsEnabled = Boolean(body.variantsEnabled)
    if (body.images !== undefined) {
      // Same cap as the create route, or edit would be a way around it.
      if (!Array.isArray(body.images)) {
        return NextResponse.json({ error: 'Invalid images' }, { status: 400 })
      }
      if (body.images.length > MAX_LISTING_IMAGES) {
        return NextResponse.json(
          { error: `You can add up to ${MAX_LISTING_IMAGES} images per listing` },
          { status: 400 }
        )
      }
      updateData.images = body.images
    }
    if (body.hostelName !== undefined) updateData.hostelName = body.hostelName
    if (body.roomNumber !== undefined) updateData.roomNumber = body.roomNumber
    if (body.landmark !== undefined) updateData.landmark = body.landmark
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.quantity !== undefined) updateData.quantity = parseInt(body.quantity)
    if (body.deliveryEstimate !== undefined) updateData.deliveryEstimate = body.deliveryEstimate ? String(body.deliveryEstimate).trim().substring(0, 80) : null
    if (body.campaignTag !== undefined) {
      if (!body.campaignTag) {
        updateData.campaignTag = null
        updateData.campaignExpiresAt = null
      } else if (isValidCampaignKey(body.campaignTag)) {
        updateData.campaignTag = body.campaignTag
        updateData.campaignExpiresAt = getCampaignExpiry(body.campaignTag)
      }
    }

    // Only an approved listing can be switched on by its seller; a pending or
    // rejected one goes live through review, not through this flag.
    if (updateData.isActive === true && product.moderationStatus !== 'APPROVED') {
      delete updateData.isActive
    }

    // Editing what buyers actually see (name, photos, description, price,
    // category) sends the listing back for review. It is taken off the
    // marketplace until an admin approves it again. Stock, pausing, delivery
    // time and pickup place don't need a new review.
    const REVIEWED_FIELDS = [
      'name', 'description', 'images', 'price', 'basePrice',
      'category', 'categoryKey', 'subcategory', 'subcategoryKey', 'variantsEnabled',
    ]
    const needsReview = REVIEWED_FIELDS.some(
      key => key in updateData && JSON.stringify(updateData[key]) !== JSON.stringify((product as any)[key]),
    )
    if (needsReview) {
      updateData.moderationStatus = 'PENDING'
      updateData.isActive = false
      updateData.rejectionReason = null
    }

    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
    })

    if (needsReview) {
      await Promise.allSettled([
        notifyUser(user.id, {
          category: 'transactional',
          type: 'ORDER_UPDATE',
          title: 'Edit sent for review',
          message: `"${updatedProduct.name}" is off the marketplace until it is approved again. We usually review within a day.`,
          url: '/my-shop',
          productId: updatedProduct.id,
        }),
        notifyAdmins('Edited listing needs review', `"${updatedProduct.name}" was edited and is waiting for approval.`, '/admin/products'),
      ])
    }

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      needsReview,
      message: needsReview
        ? 'Saved. Your listing is off the marketplace until it is approved again.'
        : 'Product updated successfully',
    })
  } catch (error) {
    console.error('Update product error:', {
      productId: params.id,
      message: (error as any)?.message,
      code: (error as any)?.code,
    })
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}
