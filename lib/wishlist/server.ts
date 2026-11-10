import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth'
import { checkRateLimitDistributed, incrementRateLimit } from '@/lib/security/rate-limit'

export const SAVEABLE_PRODUCT = {
  isActive: true,
  isDeleted: false,
  moderationStatus: { notIn: ['UNDER_REVIEW', 'REMOVED'] as any },
}

type AuthedUser = NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>

/** Auth + rate limit shared by every wishlist route. */
export async function guard(
  request: NextRequest,
  max = 120,
): Promise<{ user: AuthedUser; error?: undefined } | { user?: undefined; error: NextResponse }> {
  const user = await getUserFromRequest(request)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.isSuspended) return { error: NextResponse.json({ error: 'Account suspended' }, { status: 403 }) }

  const key = `wishlist:${user.id}`
  const windowMs = 60_000
  const { allowed, retryAfterSecs } = await checkRateLimitDistributed(key, max, windowMs)
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } },
      ),
    }
  }
  await incrementRateLimit(key, windowMs)
  return { user }
}
