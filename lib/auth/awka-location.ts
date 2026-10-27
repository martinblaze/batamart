import jwt from 'jsonwebtoken'

// Batamart serves Awka (UNIZIK) only. Signup requires a GPS fix inside this
// circle; the server hands back a short-lived token that send-otp, google and
// signup-with-password then insist on, so the check can't be skipped by
// calling those routes directly.
export const AWKA_CENTER = { lat: 6.23, lng: 7.09 }
export const AWKA_RADIUS_KM = 12
export const MAX_FIX_ACCURACY_M = 5000

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Server misconfiguration: JWT_SECRET is not set.')
  return secret
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isInsideAwka(lat: unknown, lng: unknown, accuracy: unknown) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  if (typeof accuracy === 'number' && accuracy > MAX_FIX_ACCURACY_M) return false
  return distanceKm(lat, lng, AWKA_CENTER.lat, AWKA_CENTER.lng) <= AWKA_RADIUS_KM
}

export function issueAwkaLocationToken(): string {
  return jwt.sign({ t: 'awka-location' }, getSecret(), { expiresIn: '60m' })
}

export function verifyAwkaLocationToken(token: unknown): boolean {
  if (typeof token !== 'string' || !token) return false
  try {
    const decoded = jwt.verify(token, getSecret()) as any
    return decoded?.t === 'awka-location'
  } catch {
    return false
  }
}

export const AWKA_ONLY_MESSAGE =
  'Batamart is only available to people in Awka right now. We could not confirm you are in Awka, so signup is closed for you.'
