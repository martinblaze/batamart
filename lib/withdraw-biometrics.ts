'use client'

export type BiometricPreference = 'enabled' | 'disabled'

const PREF_KEY_PREFIX = 'batamart:withdraw:biometric-pref:'
const CRED_KEY_PREFIX = 'batamart:withdraw:webauthn:'

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const fromBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const raw = atob(padded)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

export const getBiometricPreference = (userId: string): BiometricPreference | null => {
  if (typeof window === 'undefined') return null
  const value = localStorage.getItem(`${PREF_KEY_PREFIX}${userId}`)
  return value === 'enabled' || value === 'disabled' ? value : null
}

export const setBiometricPreference = (userId: string, pref: BiometricPreference) => {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${PREF_KEY_PREFIX}${userId}`, pref)
}

export const isBiometricSupported = async () => {
  if (typeof window === 'undefined' || typeof PublicKeyCredential === 'undefined' || !window.isSecureContext) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

type BiometricUser = { id: string; name?: string; email?: string }

export const enableWithdrawalBiometrics = async (user: BiometricUser) => {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const storageKey = `${CRED_KEY_PREFIX}${user.id}`
  const storedCredentialId = localStorage.getItem(storageKey)

  if (!storedCredentialId) {
    const userHandle = crypto.getRandomValues(new Uint8Array(16))
    const created = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'BATAMART', id: window.location.hostname },
        user: {
          id: userHandle,
          name: user.email || `${user.id}@batamart.local`,
          displayName: user.name || 'BATAMART User',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null

    if (!created) throw new Error('setup_failed')
    localStorage.setItem(storageKey, toBase64Url(new Uint8Array(created.rawId)))
  } else {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(storedCredentialId) }],
        userVerification: 'required',
        timeout: 60000,
        rpId: window.location.hostname,
      },
    }) as PublicKeyCredential | null

    if (!assertion) throw new Error('verify_failed')
  }

  setBiometricPreference(user.id, 'enabled')
}

export const verifyWithdrawalBiometrics = async (userId: string) => {
  const storedCredentialId = localStorage.getItem(`${CRED_KEY_PREFIX}${userId}`)
  if (!storedCredentialId) throw new Error('not_enrolled')

  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: fromBase64Url(storedCredentialId) }],
      userVerification: 'required',
      timeout: 60000,
      rpId: window.location.hostname,
    },
  }) as PublicKeyCredential | null

  if (!assertion) throw new Error('verify_failed')
  return true
}
