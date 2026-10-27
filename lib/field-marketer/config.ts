// Server-only. MIN_WITHDRAWAL must never be sent to the client up front —
// marketers are only told the floor when they actually try to withdraw.
export const FIELD_MARKETER_PAY_PER_SIGNUP = 100
export const FIELD_MARKETER_MIN_WITHDRAWAL = 5_000

export async function generateUniqueMarketerCode(
  exists: (code: string) => Promise<boolean>,
): Promise<string> {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = ''
    for (let i = 0; i < 6; i++) suffix += CHARS[Math.floor(Math.random() * CHARS.length)]
    const code = `FM${suffix}`
    if (!(await exists(code))) return code
  }
  return `FM${Date.now().toString(36).toUpperCase().slice(-8)}`
}

export type EncouragementTone = 'start' | 'far' | 'building' | 'halfway' | 'almost' | 'unlocked'
export type MilestoneTier = 'none' | 'broke-the-scale' | 'god-mode'

export function signupsToUnlock(availableBalance: number) {
  const remaining = Math.max(0, FIELD_MARKETER_MIN_WITHDRAWAL - availableBalance)
  return Math.ceil(remaining / FIELD_MARKETER_PAY_PER_SIGNUP)
}

export function getMilestoneTier(totalSignups: number): MilestoneTier {
  if (totalSignups >= 70) return 'god-mode'
  if (totalSignups >= 50) return 'broke-the-scale'
  return 'none'
}

export function buildEncouragement(totalSignups: number, availableBalance: number) {
  const left = signupsToUnlock(availableBalance)
  const pct = availableBalance / FIELD_MARKETER_MIN_WITHDRAWAL
  const more = `${left} more signup${left === 1 ? '' : 's'}`

  let tone: EncouragementTone
  let message: string

  if (left === 0) {
    tone = 'unlocked'
    message = 'Your earnings are ready. You can withdraw now. Keep stacking while you are at it.'
  } else if (totalSignups === 0 && availableBalance === 0) {
    tone = 'start'
    message = 'Your link is live. One signup puts you on the board. Go get the first one.'
  } else if (pct >= 0.75) {
    tone = 'almost'
    message = `You are almost there! Just ${more} and you can withdraw.`
  } else if (pct >= 0.5) {
    tone = 'halfway'
    message = `Past the halfway mark. ${more} left before you can withdraw. Do not slow down now.`
  } else if (pct >= 0.25) {
    tone = 'building'
    message = `Momentum is building. ${more} left before you can withdraw.`
  } else {
    tone = 'far'
    message = `You have a long way to go, ${more} left before you can withdraw. Every top marketer started right here.`
  }

  return { tone, message, signupsLeft: left }
}

export function milestoneMessage(tier: MilestoneTier) {
  if (tier === 'god-mode') return 'GOD MODE. Nobody told you the ceiling was 70, so you went through it.'
  if (tier === 'broke-the-scale') return 'Damn, you hit and broke the scale! Keep it up.'
  return null
}

export function withdrawalFloorMessage(availableBalance: number) {
  const left = signupsToUnlock(availableBalance)
  if (left > 0) {
    return `Field marketers can withdraw from ₦${FIELD_MARKETER_MIN_WITHDRAWAL.toLocaleString('en-NG')}. You are ${left} more signup${left === 1 ? '' : 's'} away, so keep going!`
  }
  return `The minimum withdrawal for field marketers is ₦${FIELD_MARKETER_MIN_WITHDRAWAL.toLocaleString('en-NG')}. Your balance covers it, so enter ₦${FIELD_MARKETER_MIN_WITHDRAWAL.toLocaleString('en-NG')} or more.`
}
