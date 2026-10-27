// Usernames let sellers and riders refer to a buyer without ever seeing their
// real name, room or phone. Stored lowercase so uniqueness is case-insensitive.

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

const RESERVED = new Set([
  'admin', 'administrator', 'batamart', 'support', 'help', 'rider', 'seller',
  'buyer', 'staff', 'hub', 'system', 'moderator',
])

export function normalizeUsername(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
}

/** Returns an error message, or null if the (normalised) username is acceptable. */
export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN} to ${USERNAME_MAX} characters`
  }
  if (!/^[a-z0-9]+$/.test(username)) {
    return 'Use letters and numbers only, with no spaces or symbols'
  }
  if (RESERVED.has(username)) {
    return 'That username is not available'
  }
  return null
}
