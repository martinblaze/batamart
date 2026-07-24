// lib/finance/flutterwave-encrypt.ts — browser-only. AES-256-GCM encryption
// for Flutterwave v4 card fields, per https://developer.flutterwave.com/docs/encryption.
//
// Card number/expiry/CVV are encrypted HERE, in the browser, before anything
// is sent to our server — our API routes and database never see a raw PAN.
// Uses the Web Crypto API (available natively in every modern browser),
// keyed by NEXT_PUBLIC_FLUTTERWAVE_ENCRYPTION_KEY (safe to ship to the
// client — it's the public half of this scheme; Flutterwave holds the
// matching decryption side).
'use client'

const NONCE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function generateFlutterwaveNonce(): string {
  let nonce = ''
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  for (let i = 0; i < 12; i++) {
    nonce += NONCE_CHARS[bytes[i] % NONCE_CHARS.length]
  }
  return nonce
}

async function importEncryptionKey(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt'])
}

// Encrypts one field (card number, expiry month, expiry year, or CVV) with
// AES-256-GCM. The auth tag is appended to the ciphertext automatically by
// the Web Crypto API — this returns the base64 of ciphertext+tag combined,
// exactly the shape Flutterwave's payment-methods endpoint expects.
export async function encryptFlutterwaveField(value: string, nonce: string): Promise<string> {
  if (nonce.length !== 12) {
    throw new Error('Nonce must be exactly 12 characters long')
  }
  const encryptionKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('NEXT_PUBLIC_FLUTTERWAVE_ENCRYPTION_KEY is not set.')
  }

  const key = await importEncryptionKey(encryptionKey)
  const iv = new TextEncoder().encode(nonce)

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))

  let binary = ''
  new Uint8Array(encrypted).forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

export interface EncryptedCardFields {
  nonce: string
  encryptedCardNumber: string
  encryptedExpiryMonth: string
  encryptedExpiryYear: string
  encryptedCvv: string
}

export async function encryptCardFields(card: {
  cardNumber: string
  expiryMonth: string
  expiryYear: string
  cvv: string
}): Promise<EncryptedCardFields> {
  const nonce = generateFlutterwaveNonce()
  const [encryptedCardNumber, encryptedExpiryMonth, encryptedExpiryYear, encryptedCvv] = await Promise.all([
    encryptFlutterwaveField(card.cardNumber.replace(/\s+/g, ''), nonce),
    encryptFlutterwaveField(card.expiryMonth, nonce),
    encryptFlutterwaveField(card.expiryYear, nonce),
    encryptFlutterwaveField(card.cvv, nonce),
  ])
  return { nonce, encryptedCardNumber, encryptedExpiryMonth, encryptedExpiryYear, encryptedCvv }
}
