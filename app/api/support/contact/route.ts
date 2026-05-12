export const dynamic = 'force-dynamic'
// app/api/support/contact/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { sendEmail } from '@/lib/email/sendEmail'

const ADMIN_EMAIL = 'support@BATAMART.com'

const CATEGORY_LABELS: Record<string, string> = {
  PAYMENT_ISSUE: 'Payment Issue',
  ORDER_PROBLEM: 'Order Problem',
  ACCOUNT_ISSUE: 'Account Issue',
  DISPUTE_HELP: 'Dispute Help',
  SELLER_ISSUE: 'Seller Issue',
  RIDER_ISSUE: 'Rider Issue',
  BUG_REPORT: 'Bug Report',
  OTHER: 'Other',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, category = 'OTHER', message } = body

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      )
    }

    if (message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Message is too short. Please provide more detail.' },
        { status: 400 }
      )
    }

    // Check if logged-in user
    const user = await getUserFromRequest(request).catch(() => null)

    // Save to database
    const ticket = await prisma.supportTicket.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        category,
        message: message.trim(),
        userId: user?.id ?? null,
      },
    })

    const categoryLabel = CATEGORY_LABELS[category] ?? 'Other'
    const ticketRef = `TICKET-${ticket.id.slice(-8).toUpperCase()}`

    // ── Email admin ───────────────────────────────────────────────────────────
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `[BATAMART Support] New ticket: ${categoryLabel} — ${ticketRef}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <span style="font-size:26px;font-weight:800;color:#111827;">BATAMART</span>
                    <span style="font-size:11px;color:#6b7280;display:block;">Admin Notification</span>
                  </td>
                </tr>
                <tr>
                  <td style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                    <p style="font-size:22px;margin:0 0 4px;">📬</p>
                    <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px;">New Support Ticket</h2>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                          <span style="font-size:13px;color:#6b7280;display:block;">Reference</span>
                          <span style="font-size:15px;color:#111827;font-weight:600;">${ticketRef}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                          <span style="font-size:13px;color:#6b7280;display:block;">From</span>
                          <span style="font-size:15px;color:#111827;">${name} &lt;${email}&gt;</span>
                          ${user ? `<span style="font-size:12px;color:#6b7280;"> — Registered user (ID: ${user.id})</span>` : '<span style="font-size:12px;color:#6b7280;"> — Guest</span>'}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
                          <span style="font-size:13px;color:#6b7280;display:block;">Category</span>
                          <span style="font-size:15px;color:#111827;">${categoryLabel}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="font-size:13px;color:#6b7280;display:block;">Submitted</span>
                          <span style="font-size:15px;color:#111827;">${new Date().toLocaleString('en-NG')}</span>
                        </td>
                      </tr>
                    </table>

                    <div style="background:#f9fafb;border-left:4px solid #6366f1;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
                      <p style="font-size:13px;color:#6b7280;margin:0 0 8px;font-weight:600;">MESSAGE</p>
                      <p style="font-size:15px;color:#374151;margin:0;line-height:1.6;white-space:pre-wrap;">${message.trim()}</p>
                    </div>

                    <a href="mailto:${email}?subject=Re: Your BATAMART Support Request [${ticketRef}]"
                       style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
                      Reply to ${name}
                    </a>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    })

    // ── Auto-reply to user ────────────────────────────────────────────────────
    await sendEmail({
      to: email.trim().toLowerCase(),
      subject: `We received your message — BATAMART Support [${ticketRef}]`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <span style="font-size:26px;font-weight:800;color:#111827;">BATAMART</span>
                    <span style="font-size:11px;color:#6b7280;display:block;">Campus Marketplace</span>
                  </td>
                </tr>
                <tr>
                  <td style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                    <p style="font-size:36px;margin:0 0 12px;">✅</p>
                    <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">We got your message, ${name.split(' ')[0]}!</h2>
                    <p style="font-size:15px;color:#6b7280;margin:0 0 24px;">
                      Thanks for reaching out. Our support team will review your message and get back to you within 
                      <strong style="color:#111827;">24–48 hours</strong>.
                    </p>

                    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:24px;">
                      <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Your ticket reference</p>
                      <p style="font-size:22px;font-weight:800;color:#6366f1;margin:0;letter-spacing:1px;">${ticketRef}</p>
                      <p style="font-size:12px;color:#9ca3af;margin:4px 0 0;">Keep this for your records</p>
                    </div>

                    <div style="background:#f9fafb;border-left:4px solid #e5e7eb;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
                      <p style="font-size:13px;color:#6b7280;margin:0 0 6px;font-weight:600;">YOUR MESSAGE (${categoryLabel})</p>
                      <p style="font-size:14px;color:#374151;margin:0;line-height:1.6;white-space:pre-wrap;">${message.trim()}</p>
                    </div>

                    <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0;" />
                    <p style="font-size:13px;color:#9ca3af;margin:0;">
                      If your issue is urgent, you can also reach us on WhatsApp.<br/>
                      Please do not reply to this email — use <strong>support@BATAMART.com</strong> to follow up.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:20px;">
                    <p style="font-size:12px;color:#9ca3af;margin:0;">BATAMART — Campus Marketplace, Awka, Anambra State.</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    })

    return NextResponse.json({
      success: true,
      ticketRef,
      message: 'Your message has been sent. Check your email for confirmation.',
    })
  } catch (error) {
    console.error('Support contact error:', error)
    return NextResponse.json({ error: 'Failed to send message. Please try again.' }, { status: 500 })
  }
}

