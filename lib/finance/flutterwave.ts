// lib/finance/flutterwave.ts — server-only. Flutterwave v3 API client.
//
// Using v3 (not v4) deliberately: v3 has a hosted checkout page
// (POST /payments -> redirect the buyer to data.link, Flutterwave collects
// card/bank-transfer/USSD details on THEIR page, then redirects back to our
// /api/payments/verify). v4's equivalent hosted checkout isn't shipped yet
// (confirmed directly by Flutterwave's own team as of Feb 2026), and its
// current direct-charge API requires collecting card details on our own
// page — which is what this app used briefly before switching back to v3.
//
// v3 auth is a static secret key (FLWSECK_TEST-... / FLWSECK-...), NOT the
// OAuth2 Client ID/Secret used by v4 — get it from Flutterwave dashboard
// Settings > API Keys > Developers tab.
const FLUTTERWAVE_BASE_URL = (process.env.FLUTTERWAVE_BASE_URL ?? 'https://api.flutterwave.com/v3').replace(/\/$/, '')

export function getFlutterwaveSecretKey(): string | null {
  return process.env.FLUTTERWAVE_SECRET_KEY ?? null
}

export function getFlutterwavePublicKey(): string | null {
  return process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ?? null
}

export async function flutterwaveRequest<T = any>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: T }> {
  const secretKey = getFlutterwaveSecretKey()
  if (!secretKey) {
    throw new Error('FLUTTERWAVE_SECRET_KEY is not set in environment variables.')
  }

  const res = await fetch(`${FLUTTERWAVE_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })

  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}
