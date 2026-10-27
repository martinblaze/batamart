// lib/notify/events.ts
// Every event-driven message in one place: wording, channel and whether it
// also emails. Call sites stay one-liners. All of these swallow their own
// errors (notifyUser never throws), so they are safe to fire without await.

import { notifyUser, adminIds } from '@/lib/notify/dispatch'

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`

// ── Account and security (always sent, always emailed) ──────────────────────

export const notifyWelcome = (userId: string, name?: string | null) =>
  notifyUser(userId, {
    category: 'transactional',
    type: 'WELCOME',
    title: 'Welcome to BataMart',
    message: 'Browse campus deals, or start selling in minutes. Your first order ships on the next Wednesday or Saturday.',
    url: '/marketplace',
    dedupeKey: 'welcome',
    email: {
      subject: 'Welcome to BataMart',
      eyebrow: 'Welcome',
      heading: `Welcome${name ? `, ${name.split(' ')[0]}` : ''}`,
      lines: [
        'BataMart is the campus marketplace for Awka. Buy from students you can trust, with your money held safely until your order arrives.',
        'Deliveries run every Wednesday and Saturday. Pick a username in your profile so sellers can label your parcel without ever seeing your address.',
      ],
      ctaLabel: 'Start browsing',
      ctaUrl: '/marketplace',
    },
  })

export const notifyPasswordChanged = (userId: string) =>
  notifyUser(userId, {
    category: 'security',
    title: 'Your password was changed',
    message: 'If this was not you, reset your password now and contact support.',
    url: '/forgot-password',
    email: {
      subject: 'Your BataMart password was changed',
      eyebrow: 'Security',
      heading: 'Your password was changed',
      lines: ['Your BataMart password has just been changed.', 'If you did this, no action is needed. If not, reset your password straight away.'],
      ctaLabel: 'Reset password',
      ctaUrl: '/forgot-password',
    },
  })

export const notifyPinChanged = (userId: string, kind: 'set' | 'changed' | 'reset') =>
  notifyUser(userId, {
    category: 'security',
    title: kind === 'set' ? 'Wallet PIN set' : kind === 'reset' ? 'Wallet PIN reset' : 'Wallet PIN changed',
    message: 'Your wallet PIN protects withdrawals and wallet payments. If this was not you, contact support now.',
    url: '/wallet',
    email: {
      subject: 'Your BataMart wallet PIN was updated',
      eyebrow: 'Security',
      heading: `Wallet PIN ${kind === 'set' ? 'set' : kind === 'reset' ? 'reset' : 'changed'}`,
      lines: ['Your wallet PIN was just updated.', 'If you did not do this, contact support immediately.'],
      ctaLabel: 'Open wallet',
      ctaUrl: '/wallet',
    },
  })

// ── Orders: buyer ───────────────────────────────────────────────────────────

export const notifyVendorConfirmed = (o: { id: string; orderNumber: string; buyerId: string }) =>
  notifyUser(o.buyerId, {
    category: 'transactional',
    type: 'ORDER_PROCESSING' as any,
    title: 'Vendor confirmed your order',
    message: `Order #${o.orderNumber} is confirmed. We will tell you when a rider collects it.`,
    url: `/orders/${o.id}`,
    orderId: o.id,
    dedupeKey: `vendor-confirmed:${o.id}`,
  })

export const notifyOrderCancelledRefund = (o: { id: string; orderNumber: string; buyerId: string }, reason: string, refund: number) =>
  notifyUser(o.buyerId, {
    category: 'transactional',
    type: 'ORDER_CANCELLED',
    title: 'Order cancelled, refund sent',
    message: `Order #${o.orderNumber} was cancelled: ${reason}. ${naira(refund)} is back in your wallet.`,
    url: `/orders/${o.id}`,
    orderId: o.id,
    email: {
      subject: `Order #${o.orderNumber} cancelled, refund issued`,
      eyebrow: 'Order update',
      heading: 'Your order was cancelled',
      lines: [`Order #${o.orderNumber} could not go ahead: ${reason}.`, 'Your money is back in your BataMart wallet. You can spend it on anything, or withdraw it.'],
      rows: [{ label: 'Refunded to wallet', value: naira(refund) }],
      ctaLabel: 'View wallet',
      ctaUrl: '/wallet',
    },
  })

export const notifyDeliveryMoved = (o: { id: string; orderNumber: string; buyerId: string; sellerId: string }, when: string) =>
  Promise.all([
    notifyUser(o.buyerId, {
      category: 'transactional',
      title: 'Delivery moved',
      message: `Order #${o.orderNumber} was not ready for pickup. New delivery day: ${when}.`,
      url: `/orders/${o.id}`,
      orderId: o.id,
    }),
    notifyUser(o.sellerId, {
      category: 'transactional',
      title: 'Rider found your product not ready',
      message: `Order #${o.orderNumber} rolls over to ${when}. Please have it ready.`,
      url: '/orders/sales',
      orderId: o.id,
    }),
  ])

export const notifyHandedOver = (o: { id: string; orderNumber: string; buyerId: string }) =>
  notifyUser(o.buyerId, {
    category: 'transactional',
    type: 'ORDER_PICKED_UP',
    title: 'Picked up from the vendor',
    message: `Order #${o.orderNumber} has been collected and is heading to our sorting hub.`,
    url: `/orders/${o.id}`,
    orderId: o.id,
    dedupeKey: `handed-over:${o.id}`,
  })

export const notifyAtHub = (o: { id: string; orderNumber: string; buyerId: string }) =>
  notifyUser(o.buyerId, {
    category: 'transactional',
    title: 'At our hub',
    message: `Order #${o.orderNumber} reached our sorting hub and is being checked.`,
    url: `/orders/${o.id}`,
    orderId: o.id,
    dedupeKey: `at-hub:${o.id}`,
  })

export const notifyPacked = (o: { id: string; orderNumber: string; buyerId: string }) =>
  notifyUser(o.buyerId, {
    category: 'transactional',
    title: 'Packed for delivery',
    message: `Order #${o.orderNumber} is packed and waiting for a rider.`,
    url: `/orders/${o.id}`,
    orderId: o.id,
    dedupeKey: `packed:${o.id}`,
  })

export const notifyOutForDelivery = (o: { id: string; orderNumber: string; buyerId: string }, riderName: string) =>
  notifyUser(o.buyerId, {
    category: 'transactional',
    type: 'ORDER_ON_THE_WAY',
    title: 'Out for delivery',
    message: `${riderName} is on the way with order #${o.orderNumber}. Track the rider live, and tap Mark delivered once you have it.`,
    url: `/orders/${o.id}`,
    orderId: o.id,
    dedupeKey: `out-for-delivery:${o.id}`,
  })

export const notifyReceipt = (
  buyerId: string,
  o: { id: string; orderNumber: string; totalAmount: number; deliveryFee: number; productPrice: number },
  itemsLine: string,
) =>
  notifyUser(buyerId, {
    category: 'transactional',
    type: 'ORDER_COMPLETED',
    title: 'Order complete',
    message: `Thanks for confirming order #${o.orderNumber}. How was it? Leave a quick review.`,
    url: `/orders/${o.id}`,
    orderId: o.id,
    dedupeKey: `receipt:${o.id}`,
    email: {
      subject: `Your BataMart receipt, order #${o.orderNumber}`,
      eyebrow: 'Receipt',
      heading: 'Thanks for your order',
      lines: [itemsLine, 'Your delivery is confirmed. If something is wrong, you can open a dispute from the order page within 48 hours.'],
      rows: [
        { label: 'Items', value: naira(o.productPrice) },
        { label: 'Delivery', value: naira(o.deliveryFee) },
        { label: 'Total paid', value: naira(o.totalAmount) },
      ],
      ctaLabel: 'Review your order',
      ctaUrl: `/orders/${o.id}`,
    },
  })

// ── Orders: seller and rider ────────────────────────────────────────────────

export const notifyRiderComing = (o: { id: string; orderNumber: string; sellerId: string }, riderName: string) =>
  notifyUser(o.sellerId, {
    category: 'transactional',
    title: 'A rider is coming for your parcel',
    message: `${riderName} will collect order #${o.orderNumber}. Have it wrapped and labelled, then tap Mark picked up when you hand it over.`,
    url: '/orders/sales',
    orderId: o.id,
    dedupeKey: `rider-coming:${o.id}`,
  })

export const notifyDeliveredToSeller = (o: { id: string; orderNumber: string; sellerId: string }) =>
  notifyUser(o.sellerId, {
    category: 'transactional',
    type: 'ORDER_DELIVERED',
    title: 'Buyer confirmed delivery',
    message: `Order #${o.orderNumber} was delivered. Your money is released after the 48-hour dispute window.`,
    url: '/orders/sales',
    orderId: o.id,
    dedupeKey: `seller-delivered:${o.id}`,
  })

export const notifyRiderPaid = (riderId: string, orderNumber: string, amount: number) =>
  notifyUser(riderId, {
    category: 'transactional',
    type: 'PAYMENT_RECEIVED',
    title: `You earned ${naira(amount)}`,
    message: `The buyer confirmed order #${orderNumber}. Your fee is in your wallet.`,
    url: '/wallet',
  })

// ── Wallet ──────────────────────────────────────────────────────────────────

export const notifyTopUp = (userId: string, amount: number, balance: number) =>
  notifyUser(userId, {
    category: 'transactional',
    type: 'WALLET_ACTIVITY',
    title: `${naira(amount)} added to your wallet`,
    message: `Your balance is now ${naira(balance)}. Spend it at checkout.`,
    url: '/wallet',
    email: {
      subject: `${naira(amount)} added to your BataMart wallet`,
      eyebrow: 'Wallet',
      heading: 'Top-up received',
      lines: ['Your wallet has been topped up.'],
      rows: [{ label: 'Added', value: naira(amount) }, { label: 'New balance', value: naira(balance) }],
      ctaLabel: 'Shop now',
      ctaUrl: '/marketplace',
    },
  })

export const notifyWalletPayment = (userId: string, orderNumber: string, total: number, balance: number) =>
  notifyUser(userId, {
    category: 'transactional',
    type: 'WALLET_ACTIVITY',
    title: `Paid ${naira(total)} from your wallet`,
    message: `Order #${orderNumber} is placed. Wallet balance: ${naira(balance)}.`,
    url: '/orders',
    email: {
      subject: `Order #${orderNumber} paid from your wallet`,
      eyebrow: 'Wallet',
      heading: 'Payment confirmed',
      lines: [`We took the payment for order #${orderNumber} from your wallet.`],
      rows: [{ label: 'Paid', value: naira(total) }, { label: 'Wallet balance', value: naira(balance) }],
      ctaLabel: 'Track order',
      ctaUrl: '/orders',
    },
  })

// ── Referrals and field marketers ───────────────────────────────────────────

export const notifyReferralJoined = (referrerId: string, friendName: string) =>
  notifyUser(referrerId, {
    category: 'transactional',
    type: 'REFERRAL_REWARD',
    title: `${friendName.split(' ')[0]} joined with your code`,
    message: 'You earn a reward for every order they get delivered. Nudge them to place their first one.',
    url: '/referrals',
    dedupeKey: `ref-joined:${friendName}:${Date.now().toString().slice(0, 8)}`,
  })

export const notifyReferralReward = (referrerId: string, amount: number, orderNumber: string) =>
  notifyUser(referrerId, {
    category: 'transactional',
    type: 'REFERRAL_REWARD',
    title: `You earned ${naira(amount)}`,
    message: `A friend's order #${orderNumber} was delivered. Your referral reward is in your wallet.`,
    url: '/wallet',
    dedupeKey: `ref-reward:${orderNumber}`,
  })

export const notifyMarketerSignup = (userId: string, amount: number, total: number) =>
  notifyUser(userId, {
    category: 'transactional',
    type: 'REFERRAL_REWARD',
    title: `New signup, +${naira(amount)}`,
    message: `Someone just joined through your field link. ${total} signups so far.`,
    url: '/field-marketers',
  })

// ── Operations ──────────────────────────────────────────────────────────────

export async function notifyAdmins(title: string, message: string, url = '/admin/order-intake', dedupeKey?: string) {
  const ids = await adminIds()
  return Promise.all(
    ids.map(id =>
      notifyUser(id, {
        category: 'transactional',
        title,
        message,
        url,
        dedupeKey: dedupeKey ? `${dedupeKey}:${id}` : undefined,
      }),
    ),
  )
}
