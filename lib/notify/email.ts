// lib/notify/email.ts
// One branded layout for every notification email, so adding a message is a
// heading, a few lines and a button, not a new HTML template.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://batamart.com').replace(/\/$/, '')

const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface EmailContent {
  /** Hidden preview line shown next to the subject in the inbox. */
  preheader?: string
  /** Opens the email, e.g. "Hi Chidi,". */
  greeting?: string
  /** Closes the email, e.g. "The BataMart team". */
  signoff?: string
  heading: string
  /** Plain-text paragraphs; escaped here. */
  lines: string[]
  ctaLabel?: string
  /** Relative ("/orders/abc") or absolute. */
  ctaUrl?: string
  /** Small label above the heading, e.g. "Order update". */
  eyebrow?: string
  /** Optional key/value rows (receipts, summaries). */
  rows?: { label: string; value: string }[]
  /** Promotional emails link to preferences; transactional ones don't need to. */
  showPreferences?: boolean
  /** Product cards (1 to 4) with photo, name, price and optional "% off". Each links to the product. */
  products?: EmailProduct[]
  /** Shortcut for a single product card. */
  product?: EmailProduct
  /** One-click unsubscribe link shown in the footer of marketing emails. */
  unsubscribeUrl?: string
}

export interface EmailProduct {
  /** Already resized https image URL (see lib/notify/image.ts). */
  image?: string
  name: string
  /** Display price, e.g. "N45,000". */
  price: string
  /** Real discount text, e.g. "18% off". Omit if there is no real discount. */
  badge?: string
  /** Relative ("/product/abc") or absolute. */
  url: string
}

export function absoluteUrl(url = '/') {
  return /^https?:\/\//i.test(url) ? url : `${APP_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

export function renderEmail(c: EmailContent): string {
  const rows = (c.rows ?? [])
    .map(
      r => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eceae4;font-size:13px;color:#6b6a63;">${esc(r.label)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #eceae4;font-size:14px;color:#131311;font-weight:600;">${esc(r.value)}</td>
      </tr>`,
    )
    .join('')

  const cards = (c.products ?? (c.product ? [c.product] : [])).slice(0, 4)
    .map(p => {
      const link = esc(absoluteUrl(p.url))
      const img = p.image && /^https:\/\//i.test(p.image)
        ? `<a href="${link}"><img src="${esc(p.image)}" alt="${esc(p.name)}" width="496" style="display:block;width:100%;max-width:496px;height:auto;border:0;"/></a>`
        : ''
      return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;border:1px solid #eceae4;"><tr><td>${img}
        <div style="padding:14px 16px;">
          <a href="${link}" style="font-size:15px;font-weight:700;color:#131311;text-decoration:none;">${esc(p.name)}</a>
          <div style="margin-top:6px;font-size:15px;color:#131311;font-weight:600;">${esc(p.price)}${p.badge ? ` <span style="margin-left:8px;padding:2px 8px;background:#131311;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:.04em;">${esc(p.badge)}</span>` : ''}</div>
        </div></td></tr></table>`
    })
    .join('')

  const href = c.ctaUrl ? absoluteUrl(c.ctaUrl) : ''
  const button = c.ctaLabel && href
    ? `<table cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td style="background:#131311;">
        <a href="${esc(href)}" style="display:inline-block;padding:16px 34px;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:.06em;font-family:'Segoe UI',Helvetica,Arial,sans-serif;text-decoration:none;">${esc(c.ctaLabel)} &rarr;</a>
      </td></tr></table>
      <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#9a958c;">Button not working? Copy this link into your browser:<br/><a href="${esc(href)}" style="color:#46453f;word-break:break-all;">${esc(href)}</a></p>`
    : ''

  const preheader = c.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(c.preheader)}</div>`
    : ''
  const signoff = c.signoff
    ? `<p style="margin:26px 0 0;font-size:15px;line-height:1.6;color:#46453f;">Warm regards,<br/><strong style="color:#131311;">${esc(c.signoff)}</strong></p>`
    : ''
  const prefs = c.showPreferences
    ? `<br/><a href="${APP_URL}/notification-settings" style="color:#9a958c;">Manage what we send you</a>`
    : ''
  const unsub = c.unsubscribeUrl
    ? `<br/><a href="${esc(c.unsubscribeUrl)}" style="color:#9a958c;">Unsubscribe from these emails</a>`
    : ''

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>BataMart</title></head>
<body style="margin:0;padding:0;background:#f6f4ef;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
${preheader}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ef;padding:32px 12px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="padding-bottom:18px;"><span style="font-size:22px;font-weight:800;color:#131311;letter-spacing:-.5px;">BataMart</span></td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e3e0d8;padding:34px 30px;">
    ${c.eyebrow ? `<p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9a958c;">${esc(c.eyebrow)}</p>` : ''}
    <h1 style="margin:0 0 18px;font-size:26px;line-height:1.25;color:#131311;font-weight:700;">${esc(c.heading)}</h1>
    ${c.greeting ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#131311;font-weight:600;">${esc(c.greeting)}</p>` : ''}
    ${c.lines.map(l => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#46453f;">${esc(l)}</p>`).join('')}
    ${cards}
    ${rows ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">${rows}</table>` : ''}
    ${button}
    ${signoff}
  </td></tr>
  <tr><td style="padding-top:20px;font-size:12px;line-height:1.7;color:#9a958c;">
    <strong style="color:#46453f;">BataMart</strong> &middot; The campus marketplace for Awka, Anambra State<br/>
    You are receiving this because you have a BataMart account.${prefs}${unsub}
  </td></tr>
</table></td></tr></table></body></html>`
}
