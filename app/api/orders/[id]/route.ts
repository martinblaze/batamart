export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { OrderStatus } from '@prisma/client';
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  })
}

const ORDER_STATUS_VALUES: OrderStatus[] = [
  'PENDING',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
]

async function getUserFromToken(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true },
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromToken(req);
    if (!user?.id) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        product: {
          include: {
            seller: {
              select: {
                id: true,
                name: true,
                profilePhoto: true,
                avgRating: true,
                totalReviews: true,
                trustLevel: true,
                completedOrders: true,
              },
            },
          },
        },
        buyer: {
          select: { id: true, name: true, profilePhoto: true, email: true },
        },
        seller: {
          select: {
            id: true, name: true, profilePhoto: true, email: true,
            avgRating: true, totalReviews: true, trustLevel: true,
          },
        },
        rider: {
          select: {
            id: true, name: true, phone: true, profilePhoto: true, email: true,
            avgRating: true, totalReviews: true, trustLevel: true,
          },
        },
        reviews: {
          include: {
            reviewer: { select: { id: true, name: true, profilePhoto: true } },
          },
        },
        productReviews: {
          include: {
            reviewer: { select: { id: true, name: true, profilePhoto: true } },
          },
        },
        // ✅ Expose dispute so the order detail page can link to it
        dispute: {
          select: { id: true, status: true, createdAt: true, resolution: true, refundAmount: true },
        },
      },
    });

    if (!order) {
      return jsonResponse({ error: 'Order not found' }, { status: 404 });
    }

    const isBuyer  = order.buyerId  === user.id;
    const isSeller = order.sellerId === user.id;
    const isRider  = order.riderId  === user.id;
    const isAdmin  = user.role === 'ADMIN';

    if (!isBuyer && !isSeller && !isRider && !isAdmin) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 403 });
    }

    return jsonResponse(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jsonErr = enforceJsonRequest(req);
    if (jsonErr) return jsonErr;
    const originErr = enforceSameOrigin(req);
    if (originErr) return originErr;

    const user = await getUserFromToken(req);
    if (!user?.id) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status } = body;
    if (!ORDER_STATUS_VALUES.includes(status as OrderStatus)) {
      return jsonResponse({ error: 'Invalid status' }, { status: 400 });
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: params.id },
      include: { buyer: true, seller: true },
    });

    if (!existingOrder) {
      return jsonResponse({ error: 'Order not found' }, { status: 404 });
    }

    const isBuyer  = existingOrder.buyerId  === user.id;
    const isSeller = existingOrder.sellerId === user.id;
    const isRider  = existingOrder.riderId  === user.id;
    const isAdmin  = user.role === 'ADMIN';

    if (!isBuyer && !isSeller && !isRider && !isAdmin) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 403 });
    }

    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      PENDING:        ['RIDER_ASSIGNED'],
      RIDER_ASSIGNED: ['PICKED_UP'],
      PICKED_UP:      ['ON_THE_WAY'],
      ON_THE_WAY:     ['DELIVERED'],
      DELIVERED:      ['COMPLETED'],
      COMPLETED:      [],
      CANCELLED:      [],
    };

    const currentStatus = existingOrder.status as OrderStatus;
    const allowedTransitions = validTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(status as OrderStatus)) {
      return jsonResponse(
        { error: `Cannot transition from ${currentStatus} to ${status}` },
        { status: 400 }
      );
    }

    const nextStatus = status as OrderStatus;
    // Actor-specific controls to prevent privilege abuse.
    if (!isAdmin) {
      const actorAllowed = (
        (isRider && (
          (currentStatus === 'RIDER_ASSIGNED' && nextStatus === 'PICKED_UP') ||
          (currentStatus === 'PICKED_UP' && nextStatus === 'ON_THE_WAY') ||
          (currentStatus === 'ON_THE_WAY' && nextStatus === 'DELIVERED')
        )) ||
        (isBuyer && (
          currentStatus === 'DELIVERED' && nextStatus === 'COMPLETED'
        ))
      );

      if (!actorAllowed) {
        return jsonResponse(
          { error: `You are not allowed to set status to ${nextStatus} from ${currentStatus}` },
          { status: 403 }
        );
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: {
        status: status as OrderStatus,
        ...(status === 'RIDER_ASSIGNED' && { riderAssignedAt: new Date() }),
        ...(status === 'PICKED_UP'      && { pickedUpAt:      new Date() }),
        ...(status === 'DELIVERED'      && { deliveredAt:     new Date() }),
        ...(status === 'COMPLETED'      && { completedAt:     new Date() }),
      },
      include: {
        product: {
          include: {
            seller: {
              select: {
                id: true, name: true, profilePhoto: true,
                avgRating: true, totalReviews: true, trustLevel: true,
              },
            },
          },
        },
        buyer:  { select: { id: true, name: true, profilePhoto: true, email: true } },
        seller: { select: { id: true, name: true, profilePhoto: true, email: true, avgRating: true, totalReviews: true, trustLevel: true } },
        rider:  { select: { id: true, name: true, phone: true, profilePhoto: true, email: true, avgRating: true, totalReviews: true, trustLevel: true } },
        dispute: { select: { id: true, status: true, createdAt: true, resolution: true, refundAmount: true } },
      },
    });

    return jsonResponse(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}
