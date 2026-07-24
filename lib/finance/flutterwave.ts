// lib/finance/flutterwave.ts — server-only. Flutterwave v4 API client.
//
// v4 auth is OAuth2 client_credentials against a Keycloak-style IdP, not a
// static secret key like v3/Credo/Paystack. Access tokens last 10 minutes
// (confirmed via Flutterwave's docs) — cached in module scope so warm
// serverless invocations reuse a token instead of round-tripping the IdP on
// every request; a cold start just pays for one extra fetch.
//
// IMPORTANT: card numbers/CVV must NEVER pass through this file or any
// server code — they're encrypted in the browser (see
// lib/finance/flutterwave-encrypt.ts) before they ever reach our API routes,
// so this app never touches raw PAN data.

const TOKEN_URL = 'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token'

function getApiBaseUrl(): string {
  // Flutterwave's v4 sandbox host is developersandbox-api.flutterwave.com;
  // the production host isn't publicly documented yet as of this writing —
  // override via env once Flutterwave confirms it for your live account.
  return (process.env.FLUTTERWAVE_API_BASE_URL ?? 'https://developersandbox-api.flutterwave.com').replace(/\/$/, '')
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.accessToken
  }

  const clientId = process.env.FLUTTERWAVE_CLIENT_ID
  const clientSecret = process.env.FLUTTERWAVE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('FLUTTERWAVE_CLIENT_ID / FLUTTERWAVE_CLIENT_SECRET are not set in environment variables.')
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  })
  const data = await res.json().catch(() => ({}))

  if (!res.ok || !data?.access_token) {
    throw new Error(`Failed to get Flutterwave access token: ${data?.message ?? res.status}`)
  }

  // Refresh 60s before actual expiry, per Flutterwave's own recommendation.
  const expiresInMs = (Number(data.expires_in) || 600) * 1000
  cachedToken = { accessToken: data.access_token, expiresAt: now + expiresInMs - 60_000 }
  return cachedToken.accessToken
}

export async function flutterwaveRequest<T = any>(
  path: string,
  init?: { method?: string; body?: unknown; idempotencyKey?: string }
): Promise<{ ok: boolean; status: number; data: T }> {
  const token = await getAccessToken()

  const res = await fetch(`${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Trace-Id': crypto.randomUUID(),
      'X-Idempotency-Key': init?.idempotencyKey ?? crypto.randomUUID(),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })

  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, status: res.status, data }
}

function splitFullName(fullName: string): { first: string; middle?: string; last?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: 'Customer' }
  if (parts.length === 1) return { first: parts[0] }
  if (parts.length === 2) return { first: parts[0], last: parts[1] }
  return { first: parts[0], middle: parts.slice(1, -1).join(' '), last: parts[parts.length - 1] }
}

function normalizeNigerianPhone(phone: string): { country_code: string; number: string } {
  const digits = phone.replace(/\D/g, '')
  if (!digits) {
    return { country_code: '234', number: phone }
  }

  if (digits.startsWith('234')) {
    const local = digits.slice(3)
    return { country_code: '234', number: local.startsWith('0') ? local : '0' + local }
  }

  if (digits.startsWith('0')) {
    return { country_code: '234', number: digits }
  }

  return { country_code: '234', number: '0' + digits }
}

// -- Customers ------------------------------------------------------------
export async function createFlutterwaveCustomer(params: { email: string; name?: string; phone?: string }) {
  return flutterwaveRequest<{ status: string; data?: { id: string } }>('/customers', {
    body: {
      email: params.email,
      name: params.name ? splitFullName(params.name) : undefined,
      phone: params.phone ? normalizeNigerianPhone(params.phone) : undefined,
    },
  })
}


// -- Payment methods (card) ----------------------------------------------
// card fields must already be individually AES-256-GCM-encrypted client-side
// (see lib/finance/flutterwave-encrypt.ts) — this function never sees a raw PAN.
export async function createFlutterwaveCardPaymentMethod(params: {
  encryptedCardNumber: string
  encryptedExpiryMonth: string
  encryptedExpiryYear: string
  encryptedCvv: string
  nonce: string
}) {
  return flutterwaveRequest<{ status: string; data?: { id: string } }>('/payment-methods', {
    body: {
      type: 'card',
      card: {
        encrypted_card_number: params.encryptedCardNumber,
        encrypted_expiry_month: params.encryptedExpiryMonth,
        encrypted_expiry_year: params.encryptedExpiryYear,
        encrypted_cvv: params.encryptedCvv,
        nonce: params.nonce,
      },
    },
  })
}

// -- Charges --------------------------------------------------------------
export async function createFlutterwaveCharge(params: {
  reference: string
  amount: number
  currency: string
  customerId: string
  paymentMethodId: string
  redirectUrl: string
  meta?: Record<string, string>
}) {
  return flutterwaveRequest<{
    status: string
    message?: string
    data?: {
      id: string
      status: string
      next_action?: { type: string; redirect_url?: { url: string } }
    }
  }>('/charges', {
    idempotencyKey: params.reference,
    body: {
      reference: params.reference,
      amount: params.amount,
      currency: params.currency,
      customer_id: params.customerId,
      payment_method_id: params.paymentMethodId,
      redirect_url: params.redirectUrl,
      meta: params.meta,
    },
  })
}

export async function getFlutterwaveCharge(chargeId: string) {
  return flutterwaveRequest<{ status: string; data?: { id: string; status: string; amount?: number; currency?: string } }>(
    `/charges/${encodeURIComponent(chargeId)}`
  )
}

// -- Transfers (withdrawals) ---------------------------------------------
export async function createFlutterwaveTransfer(params: {
  reference: string
  amountNaira: number
  accountNumber: string
  bankCode: string
  narration: string
}) {
  return flutterwaveRequest<{
    status: string
    message?: string
    data?: { id: string; status: string }
  }>('/direct-transfers', {
    idempotencyKey: params.reference,
    body: {
      action: 'instant',
      type: 'bank',
      reference: params.reference,
      narration: params.narration,
      payment_instruction: {
        source_currency: 'NGN',
        destination_currency: 'NGN',
        amount: {
          applies_to: 'destination_currency',
          value: params.amountNaira,
        },
        recipient: {
          bank: {
            account_number: params.accountNumber,
            code: params.bankCode,
          },
        },
      },
    },
  })
}
