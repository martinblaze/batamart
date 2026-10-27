export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { notifyVendorConfirmed } from '@/lib/notify/events';
import jwt from 'jsonwebtoken';
import { OrderStatus } from '@prisma/client';
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request';
import { getEffectiveDeliveryDate, parseReadyDays } from '@/lib/delivery/schedule';

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
  'PROCESSING',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'AT_HUB',
  'PACKED',
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
          select: { id: true, name: true, username: true, profilePhoto: true, email: true },
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
        items: {
          select: { quantity: true, price: true, product: { select: { name: true, deliveryEstimate: true } } },
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

    // The vendor only ever sees the buyer's username (the label on the
    // parcel), never their real name, contact or address.
    if (isSeller && !isBuyer && !isAdmin) {
      return jsonResponse({
        ...order,
        deliveryDate: getEffectiveDeliveryDate(order, Math.max(0, ...(order.items.length ? order.items.map(i => i.product.deliveryEstimate) : [order.product.deliveryEstimate]).map(parseReadyDays))).toISOString(),
        buyer: { id: order.buyer.id, name: order.buyer.username ?? 'Buyer', username: order.buyer.username },
        deliveryHostel: '',
        deliveryRoom: '',
        deliveryLandmark: '',
        deliveryPhone: '',
      });
    }

    // The day this order is on the delivery run (Wed/Sat rule applied to when
    // it will be ready), so apps don't each re-implement the schedule.
    const estimates = order.items.length
      ? order.items.map(i => i.product.deliveryEstimate)
      : [order.product.deliveryEstimate];
    const deliveryDate = getEffectiveDeliveryDate(order, Math.max(0, ...estimates.map(parseReadyDays))).toISOString();

    return jsonResponse({ ...order, deliveryDate });
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
      PENDING:        ['PROCESSING', 'RIDER_ASSIGNED'],
      PROCESSING:     ['RIDER_ASSIGNED'],
      RIDER_ASSIGNED: ['PICKED_UP'],
      PICKED_UP:      ['AT_HUB', 'ON_THE_WAY'],
      AT_HUB:         ['PACKED'],
      PACKED:         ['ON_THE_WAY'],
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
        (isSeller && (
          (currentStatus === 'PENDING' && nextStatus === 'PROCESSING') ||
          (currentStatus === 'RIDER_ASSIGNED' && nextStatus === 'PICKED_UP')
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

    if (currentStatus === 'PENDING' && nextStatus === 'PROCESSING') {
      await notifyVendorConfirmed({ id: existingOrder.id, orderNumber: existingOrder.orderNumber, buyerId: existingOrder.buyerId })
    }

    // No rider notification needed here — riders were already notified when
    // the order was placed (see app/api/payments/verify/route.ts) and can
    // already see this batch on their dashboard. This PENDING -> PROCESSING
    // transition just unblocks their Accept button (see
    // app/api/riders/accept-order/route.ts).

    return jsonResponse(updatedOrder);
  } catch (error) {
    console.error('Error updating order:', error);
    return jsonResponse({ error: 'Internal server error' }, { status: 500 });
  }
}
