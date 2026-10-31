// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id:             true,
        name:           true,
        phone:          true,
        email:          true,
        matricNumber:   true,
        username:       true,
        profilePhoto:   true,
        role:           true,
        isSellerMode:   true,
        hostelName:     true,
        roomNumber:     true,
        landmark:       true,
        trustLevel:     true,
        avgRating:      true,
        totalReviews:   true,
        completedOrders:true,
        pendingBalance: true,
        availableBalance:true,
        penaltyPoints:  true,
        isSuspended:    true,
        suspendedUntil: true,
        suspensionReason:true,
        isRiderVerified:true,
        isAvailable:    true,
        withdrawalPin:  true,
        createdAt:      true,
        updatedAt:      true,
        // ── University ────────────────────────────────────────────────────
        universityId:   true,
        university: {
          select: {
            id:            true,
            name:          true,
            shortName:     true,
            slug:          true,
            location:      true,
            deliveryAreas: true,
            hostels:       true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Auto-lift expired suspension
    if (user.isSuspended && user.suspendedUntil && new Date(user.suspendedUntil) < new Date()) {
      await prisma.user.update({
        where: { id: user.id },
        data:  { isSuspended: false, suspendedUntil: null, suspensionReason: null },
      })
      user.isSuspended     = false
      user.suspendedUntil  = null
      user.suspensionReason = null
    }

    if (user.isSuspended) {
      return NextResponse.json(
        {
          error:     'Account suspended',
          suspended: true,
          reason:    user.suspensionReason ?? 'Violation of platform terms',
          until:     user.suspendedUntil,
        },
        { status: 403 }
      )
    }

    return NextResponse.json({
      user: {
        id:              user.id,
        name:            user.name,
        phone:           user.phone,
        email:           user.email,
        matricNumber:    user.matricNumber,
        username:       user.username,
        profilePhoto:    user.profilePhoto,
        role:            user.role,
        isSellerMode:    user.isSellerMode,
        hostelName:      user.hostelName,
        roomNumber:      user.roomNumber,
        landmark:        user.landmark,
        trustLevel:      user.trustLevel,
        rating:          user.avgRating,
        totalRatings:    user.totalReviews,
        completedOrders: user.completedOrders,
        pendingBalance:  user.pendingBalance,
        availableBalance:user.availableBalance,
        penaltyPoints:   user.penaltyPoints,
        isSuspended:     user.isSuspended,
        suspendedUntil:  user.suspendedUntil,
        isRiderVerified: user.isRiderVerified,
        isAvailable:     user.isAvailable,
        hasWithdrawalPin:!!user.withdrawalPin,
        createdAt:       user.createdAt,
        updatedAt:       user.updatedAt,
        // ── University ─────────────────────────────────────────────────────
        universityId:    user.universityId,
        university:      user.university,
      },
    })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}