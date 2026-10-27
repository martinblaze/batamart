// lib/notification.ts
import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import {
  notifyNewOrder as pushNewOrder,
  notifyOrderPlaced as pushOrderPlaced,
  notifyRiderAssigned as pushRiderAssigned,
  notifyOrderOnTheWay as pushOrderOnTheWay,
  notifyOrderDelivered as pushOrderDelivered,
  notifyPaymentReceived as pushPaymentReceived,
  notifyDisputeOpened as pushDisputeOpened,
  notifyDisputeResolved as pushDisputeResolved,
  notifyNewReview as pushNewReview,
  notifyWithdrawalProcessed as pushWithdrawalProcessed,
  sendPushToUser,
} from '@/lib/push/sendPushNotification'

interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  orderId?: string
  productId?: string
  disputeId?: string
  reportId?: string
  reviewId?: string
  metadata?: any
}

/**
 * Create a DB notification for a user (updates the bell)
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        orderId: params.orderId,
        productId: params.productId,
        disputeId: params.disputeId,
        reportId: params.reportId,
        reviewId: params.reviewId,
        metadata: params.metadata || null,
      },
    })
    return notification
  } catch (error) {
    console.error('Create notification error:', error)
    return null
  }
}

/**
 * Create DB notifications for multiple users
 */
export async function createBulkNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  try {
    const notifications = await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        orderId: params.orderId,
        productId: params.productId,
        disputeId: params.disputeId,
        reportId: params.reportId,
        reviewId: params.reviewId,
        metadata: params.metadata || null,
      })),
    })
    return notifications
  } catch (error) {
    console.error('Create bulk notifications error:', error)
    return null
  }
}

// ==========================================
// ORDER NOTIFICATIONS
// ==========================================

export async function notifyOrderPlaced(
  orderId: string,
  buyerId: string,
  sellerId: string,
  orderNumber: string,
  productName: string
) {
  // Sellers only ever see the buyer's username, never their name or address.
  const [buyer, seller, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: buyerId }, select: { username: true } }),
    prisma.user.findUnique({ where: { id: sellerId }, select: { name: true, phone: true } }),
    prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } }),
  ])
  const handle = buyer?.username ? `@${buyer.username}` : 'a buyer'

  await createNotification({
    userId: buyerId,
    type: 'ORDER_PLACED',
    title: 'Order placed',
    message: `Your order (#${orderNumber}) for ${productName} was placed successfully.`,
    orderId,
    metadata: { orderNumber, productName },
  })

  await createNotification({
    userId: sellerId,
    type: 'ORDER_PLACED',
    title: `New order from ${handle}`,
    message: `You have a new order (#${orderNumber}) for ${productName} from ${handle}.`,
    orderId,
    metadata: { orderNumber, productName, sellerId, orderUrl: `/orders/sales?highlight=${orderId}` },
  })

  await createNotification({
    userId: sellerId,
    type: 'ORDER_PLACED',
    title: 'Wrap it well and label it',
    message: `Please wrap order #${orderNumber} properly and write the buyer's username ${handle} and the order code ${orderNumber} on the package, so it can be sorted correctly.`,
    orderId,
    metadata: { orderNumber, username: buyer?.username ?? null },
  })

  // The admin calls the vendor to confirm when the product will be ready.
  await Promise.all(
    admins.map(admin =>
      createNotification({
        userId: admin.id,
        type: 'ORDER_PLACED',
        title: 'New order to confirm with vendor',
        message: `Order #${orderNumber} for ${productName} (vendor: ${seller?.name ?? 'unknown'}${seller?.phone ? `, ${seller.phone}` : ''}). Call the vendor to confirm the ready date.`,
        orderId,
        metadata: { orderNumber, productName, sellerId, orderUrl: '/admin/order-intake' },
      }).catch(() => null),
    ),
  )

  await pushOrderPlaced(buyerId, orderNumber)

  await pushNewOrder(sellerId, orderNumber, orderId)
}

export async function notifyRiderAssigned(
  orderId: string,
  buyerId: string,
  sellerId: string,
  riderId: string,
  riderName: string,
  orderNumber: string
) {
  // ✅ DB notifications
  await createNotification({
    userId: buyerId,
    type: 'RIDER_ASSIGNED',
    title: '🚴 Rider Assigned!',
    message: `${riderName} has been assigned to deliver your order (#${orderNumber})`,
    orderId,
    metadata: { orderNumber, riderName },
  })

  await createNotification({
    userId: sellerId,
    type: 'RIDER_ASSIGNED',
    title: '🚴 Rider Assigned',
    message: `${riderName} will deliver order #${orderNumber}`,
    orderId,
    metadata: { orderNumber, riderName },
  })

  // ✅ PUSH notifications
  await pushRiderAssigned(buyerId, orderNumber)
}

export async function notifyOrderPickedUp(
  orderId: string,
  buyerId: string,
  orderNumber: string,
  riderName: string
) {
  // ✅ DB notification
  await createNotification({
    userId: buyerId,
    type: 'ORDER_PICKED_UP',
    title: '📦 Order Picked Up!',
    message: `${riderName} has picked up your order (#${orderNumber})`,
    orderId,
    metadata: { orderNumber, riderName },
  })

  // ✅ PUSH notification
  await sendPushToUser(buyerId, {
    title: '📦 Order Picked Up!',
    message: `${riderName} has picked up your order (#${orderNumber})`,
    url: `/orders`,
    tag: `order-picked-up-${orderId}`,
  })
}

export async function notifyOrderOnTheWay(
  orderId: string,
  buyerId: string,
  orderNumber: string,
  riderName: string
) {
  // ✅ DB notification
  await createNotification({
    userId: buyerId,
    type: 'ORDER_ON_THE_WAY',
    title: '🛵 Order On The Way!',
    message: `${riderName} is on the way with your order (#${orderNumber})`,
    orderId,
    metadata: { orderNumber, riderName },
  })

  // ✅ PUSH notification
  await pushOrderOnTheWay(buyerId, orderNumber)
}

export async function notifyOrderDelivered(
  orderId: string,
  buyerId: string,
  orderNumber: string
) {
  // ✅ DB notification
  await createNotification({
    userId: buyerId,
    type: 'ORDER_DELIVERED',
    title: '✅ Order Delivered!',
    message: `Your order (#${orderNumber}) has been delivered. Please confirm receipt.`,
    orderId,
    metadata: { orderNumber },
  })

  // ✅ PUSH notification
  await pushOrderDelivered(buyerId, orderNumber)
}

export async function notifyOrderCompleted(
  orderId: string,
  buyerId: string,
  sellerId: string,
  riderId: string | null,
  orderNumber: string,
  amount: number
) {
  const amountFormatted = `₦${amount.toFixed(2)}`

  // ✅ DB notifications
  await createNotification({
    userId: buyerId,
    type: 'ORDER_COMPLETED',
    title: '🎉 Order Completed!',
    message: `Order #${orderNumber} is complete. Don't forget to leave a review!`,
    orderId,
    metadata: { orderNumber, amount },
  })

  await createNotification({
    userId: sellerId,
    type: 'PAYMENT_RECEIVED',
    title: '💰 Payment Received!',
    message: `You've received ${amountFormatted} for order #${orderNumber}`,
    orderId,
    metadata: { orderNumber, amount },
  })

  if (riderId) {
    await createNotification({
      userId: riderId,
      type: 'PAYMENT_RECEIVED',
      title: '💰 Delivery Payment!',
      message: `You've received payment for delivering order #${orderNumber}`,
      orderId,
      metadata: { orderNumber },
    })
  }

  // ✅ PUSH notifications
  await pushPaymentReceived(sellerId, amountFormatted)
  if (riderId) {
    await pushPaymentReceived(riderId, 'your delivery fee')
  }
}

// ==========================================
// REVIEW NOTIFICATIONS
// ==========================================

export async function notifyProductReviewed(
  sellerId: string,
  productId: string,
  productName: string,
  rating: number,
  buyerName: string
) {
  // ✅ DB notification
  await createNotification({
    userId: sellerId,
    type: 'PRODUCT_REVIEWED',
    title: '⭐ New Product Review!',
    message: `${buyerName} left a ${rating}-star review for ${productName}`,
    productId,
    metadata: { productName, rating, buyerName },
  })

  // ✅ PUSH notification
  await pushNewReview(sellerId, productName)
}

export async function notifySellerReviewed(
  sellerId: string,
  rating: number,
  buyerName: string,
  orderId: string
) {
  // ✅ DB notification
  await createNotification({
    userId: sellerId,
    type: 'SELLER_REVIEWED',
    title: '⭐ New Seller Review!',
    message: `${buyerName} gave you a ${rating}-star rating`,
    orderId,
    metadata: { rating, buyerName },
  })

  // ✅ PUSH notification
  await sendPushToUser(sellerId, {
    title: '⭐ New Seller Review!',
    message: `${buyerName} gave you a ${rating}-star rating`,
    url: `/my-shop`,
    tag: `seller-review-${orderId}`,
  })
}

export async function notifyRiderReviewed(
  riderId: string,
  rating: number,
  buyerName: string,
  orderId: string
) {
  // ✅ DB notification
  await createNotification({
    userId: riderId,
    type: 'RIDER_REVIEWED',
    title: '⭐ New Delivery Review!',
    message: `${buyerName} gave you a ${rating}-star rating`,
    orderId,
    metadata: { rating, buyerName },
  })

  // ✅ PUSH notification
  await sendPushToUser(riderId, {
    title: '⭐ New Delivery Review!',
    message: `${buyerName} gave you a ${rating}-star rating`,
    url: `/rider-dashboard`,
    tag: `rider-review-${orderId}`,
  })
}

// ==========================================
// DISPUTE NOTIFICATIONS
// ==========================================

export async function notifyDisputeOpened(
  disputeId: string,
  sellerId: string,
  buyerName: string,
  orderNumber: string,
  orderId: string
) {
  // ✅ DB notification
  await createNotification({
    userId: sellerId,
    type: 'DISPUTE_OPENED',
    title: '⚠️ Dispute Opened',
    message: `${buyerName} opened a dispute for order #${orderNumber}`,
    orderId,
    disputeId,
    metadata: { orderNumber, buyerName },
  })

  // ✅ PUSH notification
  await pushDisputeOpened(sellerId, orderNumber)
}

export async function notifyDisputeMessage(
  disputeId: string,
  recipientId: string,
  senderName: string,
  orderId: string
) {
  // ✅ DB notification
  await createNotification({
    userId: recipientId,
    type: 'DISPUTE_MESSAGE',
    title: '💬 New Dispute Message',
    message: `${senderName} sent a message in your dispute`,
    orderId,
    disputeId,
    metadata: { senderName },
  })

  // ✅ PUSH notification
  await sendPushToUser(recipientId, {
    title: '💬 New Dispute Message',
    message: `${senderName} sent a message in your dispute`,
    url: `/disputes`,
    tag: `dispute-msg-${disputeId}`,
    requireInteraction: true,
  })
}

export async function notifyDisputeResolved(
  disputeId: string,
  buyerId: string,
  sellerId: string,
  resolution: string,
  orderNumber: string,
  orderId: string
) {
  // ✅ DB notifications
  await createNotification({
    userId: buyerId,
    type: 'DISPUTE_RESOLVED',
    title: '✅ Dispute Resolved',
    message: `Your dispute for order #${orderNumber} has been resolved: ${resolution}`,
    orderId,
    disputeId,
    metadata: { orderNumber, resolution },
  })

  await createNotification({
    userId: sellerId,
    type: 'DISPUTE_RESOLVED',
    title: '✅ Dispute Resolved',
    message: `Dispute for order #${orderNumber} has been resolved: ${resolution}`,
    orderId,
    disputeId,
    metadata: { orderNumber, resolution },
  })

  // ✅ PUSH notifications
  await pushDisputeResolved(buyerId, orderNumber)
  await pushDisputeResolved(sellerId, orderNumber)
}

// ==========================================
// REPORT NOTIFICATIONS
// ==========================================

export async function notifyReportSubmitted(
  reportId: string,
  reportedUserId: string,
  reporterName: string,
  reportType: string
) {
  await createNotification({
    userId: reportedUserId,
    type: 'REPORT_SUBMITTED',
    title: '⚠️ Report Filed',
    message: `A report has been filed against you. Our team is reviewing it.`,
    reportId,
    metadata: { reportType },
  })
}

export async function notifyReportResolved(
  reportId: string,
  reporterId: string,
  reportedUserId: string | null,
  resolution: string
) {
  await createNotification({
    userId: reporterId,
    type: 'REPORT_RESOLVED',
    title: '✅ Report Resolved',
    message: `Your report has been reviewed: ${resolution}`,
    reportId,
    metadata: { resolution },
  })

  if (reportedUserId) {
    await createNotification({
      userId: reportedUserId,
      type: 'REPORT_RESOLVED',
      title: '✅ Report Resolved',
      message: `The report against you has been resolved: ${resolution}`,
      reportId,
      metadata: { resolution },
    })
  }
}

// ==========================================
// PENALTY NOTIFICATIONS
// ==========================================

export async function notifyPenaltyIssued(
  userId: string,
  penaltyAction: string,
  reason: string,
  points: number
) {
  await createNotification({
    userId,
    type: 'PENALTY_ISSUED',
    title: '⚠️ Penalty Issued',
    message: `You received a penalty: ${penaltyAction}. ${points} penalty points added. Reason: ${reason}`,
    metadata: { penaltyAction, reason, points },
  })
}

// ==========================================
// ACCOUNT NOTIFICATIONS
// ==========================================

export async function notifyAccountSuspended(
  userId: string,
  until: Date | null,
  reason: string
) {
  const message = until
    ? `Your account has been suspended until ${until.toLocaleDateString()}. Reason: ${reason}`
    : `Your account has been permanently suspended. Reason: ${reason}. Contact support to appeal.`

  await createNotification({
    userId,
    type: 'ACCOUNT_SUSPENDED',
    title: '🚫 Account Suspended',
    message,
    metadata: { until: until?.toISOString() ?? 'permanent', reason },
  })

  // ✅ PUSH notification
  await sendPushToUser(userId, {
    title: '🚫 Account Suspended',
    message,
    url: '/',
    tag: 'account-suspended',
    requireInteraction: true,
  })
}

export async function notifyAccountUnsuspended(userId: string) {
  await createNotification({
    userId,
    type: 'ACCOUNT_UNSUSPENDED',
    title: '✅ Account Restored',
    message: `Your account suspension has been lifted. Welcome back!`,
    metadata: {},
  })

  // ✅ PUSH notification
  await sendPushToUser(userId, {
    title: '✅ Account Restored',
    message: `Your account suspension has been lifted. Welcome back!`,
    url: '/',
    tag: 'account-unsuspended',
  })
}

// ==========================================
// WALLET NOTIFICATIONS
// ==========================================

export async function notifyWithdrawalProcessed(
  userId: string,
  amount: number,
  reference: string
) {
  const amountFormatted = `₦${amount.toFixed(2)}`

  // ✅ DB notification
  await createNotification({
    userId,
    type: 'WITHDRAWAL_PROCESSED',
    title: '💸 Withdrawal Processed',
    message: `Your withdrawal of ${amountFormatted} has been processed successfully`,
    metadata: { amount, reference },
  })

  // ✅ PUSH notification
  await pushWithdrawalProcessed(userId, amountFormatted)
}