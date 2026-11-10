export const dynamic = 'force-dynamic'
// app/api/notifications/unsubscribe/route.ts
// Signed one-click unsubscribe from marketing email. POST is the RFC 8058
// one-click call mail apps make; GET is the link in the email footer and shows
// a confirmation page (it changes nothing). Both POST forms switch off emails for the account (order, payment
// and security emails still arrive).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyUnsubscribeToken } from '@/lib/notify/unsubscribe'

async function apply(userId: string | null, token: string | null): Promise<boolean> {
  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) return false
  try {
    await prisma.notificationPreference.upsert({
      where: { userId },
      update: { emailEnabled: false },
      create: { userId, emailEnabled: false },
    })
    return true
  } catch (error) {
    console.error('unsubscribe error:', error)
    return false
  }
}

function params(req: NextRequest) {
  const url = new URL(req.url)
  return { u: url.searchParams.get('u'), t: url.searchParams.get('t') }
}

function page(body: string, status: number) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><title>BataMart emails</title></head><body style="margin:0;background:#f6f4ef;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#131311;"><div style="max-width:480px;margin:12vh auto;padding:32px 28px;background:#fff;border:1px solid #e3e0d8;">${body}</div></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

const DONE = '<h1>You are unsubscribed</h1><p>We will not send you marketing emails any more. Order, payment and security emails will still reach you. You can change this any time in Notification settings in the app.</p>'
const INVALID = '<h1>This link is not valid</h1><p>Open BataMart and go to Notification settings to manage your emails.</p>'

// POST: the RFC 8058 one-click call from mail apps (answers JSON), or the
// confirm button on the page below (confirm=1, answers HTML).
export async function POST(req: NextRequest) {
  const { u, t } = params(req)
  const form = await req.text().catch(() => '')
  const fromPage = new URLSearchParams(form).get('confirm') === '1'
  const ok = await apply(u, t)
  if (fromPage) return page(ok ? DONE : INVALID, ok ? 200 : 400)
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}

// GET never changes anything: email scanners and link previews open links
// automatically and would otherwise unsubscribe people who never asked to.
export async function GET(req: NextRequest) {
  const { u, t } = params(req)
  if (!u || !t || !verifyUnsubscribeToken(u, t)) return page(INVALID, 400)
  const action = `/api/notifications/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`
  return page(
    `<h1>Unsubscribe from marketing emails?</h1><p>You will stop getting deals and recommendations by email. Order, payment and security emails will still reach you.</p><form method="POST" action="${action}"><input type="hidden" name="confirm" value="1"/><button type="submit" style="margin-top:12px;padding:14px 28px;background:#131311;color:#fff;border:0;font-size:14px;font-weight:700;cursor:pointer;">Yes, unsubscribe me</button></form>`,
    200,
  )
}
