export const SIGNUP_ACCESS_CODE = 'BATAMART-P70LZ6'
export const SIGNUP_REOPENS_AT_ISO = '2026-06-22T00:00:00Z'
export const SIGNUP_REOPENS_DATE = '2026-06-22'

export function normalizeSignupAccessCode(code: unknown) {
  return typeof code === 'string' ? code.trim().toUpperCase() : ''
}

export function hasSignupAccessCode(code: unknown) {
  return normalizeSignupAccessCode(code) === SIGNUP_ACCESS_CODE
}

export function getSignupStatus(accessCode?: unknown) {
  if (hasSignupAccessCode(accessCode)) {
    return { isOpen: true, bypassed: true }
  }

  const reopensAt = new Date(SIGNUP_REOPENS_AT_ISO).getTime()
  const now = Date.now()
  if (now >= reopensAt) {
    return { isOpen: true, bypassed: false }
  }

  const msRemaining = reopensAt - now
  const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24))
  const hoursRemaining = Math.floor((msRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60))
  const secondsRemaining = Math.floor((msRemaining % (1000 * 60)) / 1000)

  return {
    isOpen: false,
    bypassed: false,
    countdown: `${daysRemaining}d ${hoursRemaining}h ${minutesRemaining}m ${secondsRemaining}s`,
    reopensAt: SIGNUP_REOPENS_DATE,
  }
}
