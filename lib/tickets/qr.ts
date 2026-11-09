// lib/tickets/qr.ts
// The rotating ticket QR. Works on the server and in the browser (Web Crypto),
// and the Flutter app implements the same recipe with package:crypto.
//
//   step = floor(unixSeconds / 30)
//   mac  = first 16 hex chars of HMAC-SHA256(key = UTF-8 bytes of ticket.secret,
//                                            msg = `${code}.${step}`)
//   text = `BT1.${code}.${step}.${mac}`
//
// A screenshot is useless after about a minute, and changing ticket.secret
// (done on every transfer) kills every QR the old holder could still show.

import { QR_STEP_SECONDS, QR_PAST_STEPS, QR_FUTURE_STEPS } from '@/lib/tickets/config'

const enc = new TextEncoder()

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  let out = ''
  for (let i = 0; i < 8; i++) out += sig[i].toString(16).padStart(2, '0')
  return out
}

export const qrStepOf = (nowMs: number) => Math.floor(nowMs / 1000 / QR_STEP_SECONDS)

/** Milliseconds until the current code is replaced. */
export const msUntilNextStep = (nowMs: number) => (qrStepOf(nowMs) + 1) * QR_STEP_SECONDS * 1000 - nowMs

export async function buildQrText(code: string, secret: string, nowMs: number): Promise<string> {
  const step = qrStepOf(nowMs)
  return `BT1.${code}.${step}.${await hmacHex(secret, `${code}.${step}`)}`
}

export interface ParsedQr { code: string; step: number; mac: string }

export function parseQrText(text: string): ParsedQr | null {
  const m = /^BT1\.(BT-[A-HJ-NP-Z2-9]{8})\.(\d{1,12})\.([0-9a-f]{16})$/.exec(String(text ?? '').trim())
  if (!m) return null
  return { code: m[1], step: Number(m[2]), mac: m[3] }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type QrCheck = 'OK' | 'STALE' | 'INVALID'

/** INVALID = the code was not made with this ticket's secret; STALE = right secret but too old/new. */
export async function verifyQr(secret: string, parsed: ParsedQr, nowMs: number): Promise<QrCheck> {
  const expected = await hmacHex(secret, `${parsed.code}.${parsed.step}`)
  if (!safeEqual(expected, parsed.mac)) return 'INVALID'
  const now = qrStepOf(nowMs)
  if (parsed.step < now - QR_PAST_STEPS || parsed.step > now + QR_FUTURE_STEPS) return 'STALE'
  return 'OK'
}
