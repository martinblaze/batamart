// lib/email/emailTemplates.ts
// All email templates for BATAMART notifications

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://batamart.com'

// ─── Base layout wrapper ──────────────────────────────────────────────────────
function baseTemplate(content: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BATAMART</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:28px;font-weight:800;color:#111827;letter-spacing:-1px;">BATAMART</span>
              <span style="font-size:12px;color:#6b7280;display:block;margin-top:2px;">Campus Marketplace</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="font-size:12px;color:#9ca3af;margin:0;">
                You're receiving this because you have an account on BATAMART.<br/>
                Campus Marketplace.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

// ─── CTA Button ───────────────────────────────────────────────────────────────
function ctaButton(label: string, url: string, color = '#2563eb') {
  return `
    <a href="${url}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:${color};color:#ffffff;font-size:15px;font-weight:600;border-radius:10px;text-decoration:none;">
      ${label}
    </a>
  `
}

// ─── Divider ──────────────────────────────────────────────────────────────────
const divider = `<hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />`

// ─── Templates ───────────────────────────────────────────────────────────────

export function orderPlacedEmail(orderNumber: string) {
  return {
    subject: '🛒 Your order has been placed — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">🛒</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Order Confirmed!</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        Your order <strong style="color:#111827;">#${orderNumber}</strong> has been placed successfully. 
        The seller has been notified and will confirm it shortly.
      </p>
      ${divider}
      <p style="font-size:14px;color:#6b7280;margin:0;">Track your order status in real time from your orders page.</p>
      ${ctaButton('View Order', `${APP_URL}/orders/${orderNumber}`)}
    `)
  }
}

export function newOrderEmail(orderNumber: string) {
  return {
    subject: '🎉 You have a new order! — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">🎉</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">New Order Received!</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        Order <strong style="color:#111827;">#${orderNumber}</strong> is waiting for your confirmation. 
        Please confirm it as soon as possible so a rider can be assigned.
      </p>
      ${divider}
      <p style="font-size:14px;color:#6b7280;margin:0;">Orders not confirmed within 30 minutes may be auto-cancelled.</p>
      ${ctaButton('Confirm Order', `${APP_URL}/orders/sales`, '#16a34a')}
    `)
  }
}

export function riderAssignedEmail(orderNumber: string) {
  return {
    subject: '🚴 A rider has been assigned — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">🚴</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Rider Assigned</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        A rider has been assigned to your order <strong style="color:#111827;">#${orderNumber}</strong> and will pick it up soon.
      </p>
      ${ctaButton('Track Order', `${APP_URL}/orders/${orderNumber}`)}
    `)
  }
}

export function orderOnTheWayEmail(orderNumber: string) {
  return {
    subject: '🛵 Your order is on its way! — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">🛵</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Order On The Way!</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        Your order <strong style="color:#111827;">#${orderNumber}</strong> has been picked up and is heading your way. 
        Be ready to receive it!
      </p>
      ${ctaButton('View Order', `${APP_URL}/orders/${orderNumber}`)}
    `)
  }
}

export function orderDeliveredEmail(orderNumber: string) {
  return {
    subject: '✅ Your order has been delivered — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">✅</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Order Delivered!</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        Your order <strong style="color:#111827;">#${orderNumber}</strong> has been delivered successfully. Enjoy your purchase!
      </p>
      ${divider}
      <p style="font-size:14px;color:#6b7280;margin:0;">Had a good experience? Leave a review to help other students.</p>
      ${ctaButton('Leave a Review', `${APP_URL}/orders/${orderNumber}`, '#16a34a')}
    `)
  }
}

export function paymentReceivedEmail(amount: string) {
  return {
    subject: '💰 Payment received — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">💰</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Payment Received!</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        You just received a payment of <strong style="color:#16a34a;font-size:18px;">${amount}</strong>. 
        It has been added to your BATAMART wallet.
      </p>
      ${ctaButton('View Wallet', `${APP_URL}/wallet`, '#16a34a')}
    `)
  }
}

export function withdrawalProcessedEmail(amount: string) {
  return {
    subject: '💸 Withdrawal processed — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">💸</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Withdrawal Processed</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        Your withdrawal of <strong style="color:#111827;">${amount}</strong> has been processed successfully. 
        It should reflect in your bank account within 24 hours.
      </p>
      ${ctaButton('View Wallet', `${APP_URL}/wallet`)}
    `)
  }
}

export function disputeOpenedEmail(orderNumber: string) {
  return {
    subject: '⚠️ A dispute has been opened — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">⚠️</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Dispute Opened</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        A dispute has been opened for order <strong style="color:#111827;">#${orderNumber}</strong>. 
        Please respond as soon as possible to help resolve it quickly.
      </p>
      ${ctaButton('View Dispute', `${APP_URL}/disputes`, '#dc2626')}
    `)
  }
}

export function disputeResolvedEmail(orderNumber: string) {
  return {
    subject: '✅ Dispute resolved — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">✅</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Dispute Resolved</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        The dispute for order <strong style="color:#111827;">#${orderNumber}</strong> has been resolved. 
        Check the outcome in your disputes page.
      </p>
      ${ctaButton('View Outcome', `${APP_URL}/disputes`)}
    `)
  }
}

export function newReviewEmail(productName: string) {
  return {
    subject: '⭐ You have a new review — BATAMART',
    html: baseTemplate(`
      <p style="font-size:28px;margin:0 0 8px;">⭐</p>
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">New Review!</h2>
      <p style="font-size:15px;color:#6b7280;margin:0 0 20px;">
        <strong style="color:#111827;">${productName}</strong> just received a new review from a buyer.
      </p>
      ${ctaButton('View Review', `${APP_URL}/reviews`)}
    `)
  }
}
