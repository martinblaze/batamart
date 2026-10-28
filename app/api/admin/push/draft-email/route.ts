export const dynamic = 'force-dynamic'
export const maxDuration = 30
// app/api/admin/push/draft-email/route.ts
// Turns the short push text an admin typed into a full email: subject, heading,
// a few paragraphs and a button label. The admin reviews and edits it on the
// push page before anything is sent.
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { autoDraftEmail } from '@/lib/notify/email-drafts'

function isAdmin(req: NextRequest) {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return false
  try {
    const decoded = jwt.verify(header.substring(7), process.env.JWT_SECRET!) as any
    return decoded.role === 'ADMIN'
  } catch {
    return false
  }
}

// Facts the writer may use. Anything else it must not state as fact.
const FACTS = `
- BataMart is a campus marketplace for students in Awka (UNIZIK area), Anambra State.
- Listing items is free. Buyers pay by card, bank transfer or from their BataMart wallet.
- Money is held in escrow. The seller is paid 48 hours after the buyer confirms delivery, if no dispute is open. A buyer can open a dispute within 48 hours of delivery.
- Deliveries run every Wednesday and Saturday for a flat fee of NGN 1,200 per order, to any area on campus. Buyers can follow the rider live on a map for the last stretch and confirm delivery themselves.
- Every user has a referral code. They earn NGN 120 for every order their friends get delivered, with no cap.
- Users pick a username (3 to 20 letters and numbers, each one belongs to one person). Sellers see only the username on an order and write it on the parcel, so buyers' names and addresses stay private. A username is needed to place an order.
- Users can top up a wallet and pay with it. Refunds for cancelled orders go to the wallet.
- Users can choose which notifications they get in Settings.`

const SYSTEM = `You write emails for BataMart, a campus marketplace. The admin gives you a short push notification (title, message and the page it links to). Expand it into a complete, polished email that reads as if a well-run company sent it.

Rules:
- Tone: warm, clear and confident. Plain, friendly English that Nigerian students find natural. No slang overload, no hype, no emojis, no ALL CAPS, no exclamation spam.
- Length: 2 to 4 short paragraphs, 70 to 130 words in total. Each paragraph is 1 to 3 sentences.
- Say what it is, why it matters to the reader, and what to do next. End the body by pointing to the button.
- Only state facts that are in the admin's text or in the FACTS list below. Never invent discounts, prices, dates, deadlines, numbers, features or promises. If unsure, leave it out.
- Do not start with "Hi" or "Dear", and do not add a sign-off. The email adds a greeting and sign-off itself.
- Subject: under 60 characters, specific, no clickbait. Heading: under 10 words. Button: 2 to 4 words, an action such as "Set my username".

Reply with JSON only: {"subject": string, "heading": string, "body": string, "button": string}. In "body", separate paragraphs with a blank line (two newline characters).

FACTS:${FACTS}`

const MODELS = [process.env.GEMINI_MODEL, 'gemini-2.0-flash', 'gemini-1.5-flash'].filter(Boolean) as string[]

async function callGemini(apiKey: string, userText: string) {
  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 700, responseMimeType: 'application/json' },
        }),
      },
    )
    if (res.status === 404) continue // model retired, try the next one
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text === 'string') return text
  }
  throw new Error('No Gemini model available')
}

/** The automatic draft, used when the AI is unavailable. */
function plainDraft(title: string, message: string, url = '/') {
  const { subject, heading, body, button } = autoDraftEmail({ title, message, url })
  return { subject, heading, body, button }
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const title = String(body.title || '').trim().slice(0, 200)
  const message = String(body.message || '').trim().slice(0, 1000)
  const url = String(body.url || '/').trim().slice(0, 200)
  if (!title && !message) {
    return NextResponse.json({ error: 'Write a title or message first' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ draft: plainDraft(title, message, url), usedAi: false, note: 'The AI writer is not set up, so this is the automatic draft.' })
  }

  try {
    const raw = await callGemini(apiKey, JSON.stringify({ title, message, linksTo: url }))
    const parsed = JSON.parse(raw.replace(/^```json\s*|```$/g, ''))
    const draft = {
      subject: String(parsed.subject || title).slice(0, 90),
      heading: String(parsed.heading || title).slice(0, 120),
      body: String(parsed.body || message).slice(0, 2000),
      button: String(parsed.button || 'Open BataMart').slice(0, 40),
    }
    return NextResponse.json({ draft, usedAi: true })
  } catch (error) {
    console.error('draft-email failed:', error)
    return NextResponse.json({
      draft: plainDraft(title, message, url),
      usedAi: false,
      note: 'The AI writer could not be reached, so this is the automatic draft.',
    })
  }
}
