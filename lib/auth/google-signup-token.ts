import jwt from 'jsonwebtoken'

type GoogleSignupPayload = {
  email: string
  name: string
  universityId?: string
  referralCode?: string
  signupAccessCode?: string
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Server misconfiguration: JWT_SECRET is not set.')
  return secret
}

export function issueGoogleSignupToken(payload: GoogleSignupPayload): string {
  return jwt.sign({ t: 'google-signup', ...payload }, getSecret(), { expiresIn: '15m' })
}

export function verifyGoogleSignupToken(token: string): GoogleSignupPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as any
    if (decoded?.t !== 'google-signup') return null
    if (!decoded?.email || !decoded?.name) return null
    return {
      email: String(decoded.email),
      name: String(decoded.name),
      universityId: decoded.universityId ? String(decoded.universityId) : undefined,
      referralCode: decoded.referralCode ? String(decoded.referralCode) : undefined,
      signupAccessCode: decoded.signupAccessCode ? String(decoded.signupAccessCode) : undefined,
    }
  } catch {
    return null
  }
}
