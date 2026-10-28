// lib/email/sendEmail.ts
// Server-side only — never import this in client components
//
// Every email goes through here, and the kind decides the route:
//
//   kind 'otp'      sign-in, sign-up and PIN-reset codes. These must arrive, so
//                   they use Resend only, which has the best inbox placement.
//   kind 'general'  everything else (order updates, receipts, reminders,
//                   broadcasts). These go through your own SMTP server (the VPS),
//                   then Brevo if that is configured as a backup. Resend is never
//                   used for these, so its small free daily allowance is kept for
//                   codes.
//
// Settings:
//   RESEND_API_KEY, RESEND_FROM_EMAIL                 codes
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
//   SMTP_SECURE (optional), EMAIL_FROM                everything else (the VPS)
//   BREVO_API_KEY (optional)                          backup for everything else
//
// sendEmail resolves true only if a provider accepted the message, so callers
// can tell a real send from a failure.

interface EmailPayload {
  to: string
  subject: string
  html: string
  /** Plain-text version; recommended for codes and better spam scores. */
  text?: string
  /** 'otp' for verification codes, otherwise 'general'. */
  kind?: 'otp' | 'general'
}

type Provider = 'resend' | 'smtp' | 'brevo'

const DEFAULT_FROM = 'BataMart <support@batamart.com>'

function parseFrom(raw: string): { name: string; email: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw)
  if (match) return { name: match[1].trim() || 'BataMart', email: match[2].trim() }
  return { name: 'BataMart', email: raw.trim() }
}

/** Codes keep the sender Resend already has verified; the rest use EMAIL_FROM. */
function fromAddress(kind: 'otp' | 'general') {
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim()
  const generalFrom = process.env.EMAIL_FROM?.trim()
  return kind === 'otp' ? resendFrom || generalFrom || DEFAULT_FROM : generalFrom || resendFrom || DEFAULT_FROM
}

const isConfigured: Record<Provider, () => boolean> = {
  resend: () => !!process.env.RESEND_API_KEY?.trim(),
  smtp: () => !!process.env.SMTP_HOST?.trim(),
  brevo: () => !!process.env.BREVO_API_KEY?.trim(),
}

/** The providers that have credentials for this kind of email, in the order they are tried. */
export function configuredProviders(kind: 'otp' | 'general' = 'general'): Provider[] {
  const order: Provider[] = kind === 'otp' ? ['resend'] : ['smtp', 'brevo']
  return order.filter(p => isConfigured[p]())
}

async function viaResend(p: EmailPayload): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress('otp'),
      to: [p.to],
      subject: p.subject,
      html: p.html,
      ...(p.text ? { text: p.text } : {}),
    }),
  })
  if (!res.ok) {
    console.error('Resend error:', res.status, await res.text().catch(() => ''))
    return false
  }
  return true
}

let smtpTransport: any = null
async function viaSmtp(p: EmailPayload): Promise<boolean> {
  if (!smtpTransport) {
    const nodemailer: any = await import('nodemailer')
    const port = Number(process.env.SMTP_PORT || 587)
    smtpTransport = (nodemailer.default ?? nodemailer).createTransport({
      host: process.env.SMTP_HOST!.trim(),
      port,
      // 465 is implicit TLS; 587 starts plain and upgrades with STARTTLS.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }
  await smtpTransport.sendMail({
    from: fromAddress('general'),
    to: p.to,
    subject: p.subject,
    html: p.html,
    ...(p.text ? { text: p.text } : {}),
  })
  return true
}

async function viaBrevo(p: EmailPayload): Promise<boolean> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!.trim(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: parseFrom(fromAddress('general')),
      to: [{ email: p.to }],
      subject: p.subject,
      htmlContent: p.html,
      ...(p.text ? { textContent: p.text } : {}),
    }),
  })
  if (!res.ok) {
    console.error('Brevo error:', res.status, await res.text().catch(() => ''))
    return false
  }
  return true
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const kind = payload.kind ?? 'general'
  const providers = configuredProviders(kind)

  if (providers.length === 0) {
    console.log(`📧 [DEV] ${kind} email skipped: no provider configured for it`)
    console.log('   To:', payload.to)
    console.log('   Subject:', payload.subject)
    return false
  }

  for (const provider of providers) {
    try {
      const ok =
        provider === 'resend' ? await viaResend(payload) : provider === 'smtp' ? await viaSmtp(payload) : await viaBrevo(payload)
      if (ok) return true
    } catch (error) {
      console.error(`Send email error (${provider}):`, error)
    }
    // Rejected or unreachable: try the next provider for this kind, if any.
  }
  return false
}
