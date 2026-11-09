// GET /api/tickets/lookup-user?username=   (auth)
// Lets the "send to a friend" step confirm who it is going to. Reveals only
// first name + last initial, and only for active accounts.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { normalizeUsername } from '@/lib/username'
import { json, fail, hit, shortName } from '@/lib/tickets/buyer'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return json({ error: 'Unauthorized' }, 401)
    if (!(await hit(`tickets:lookup:${user.id}`, 30, 10 * 60_000))) {
      return json({ error: 'Too many lookups. Please wait a few minutes.' }, 429)
    }
    const username = normalizeUsername((new URL(request.url).searchParams.get('username') ?? '').replace(/^@/, ''))
    if (!username || username.length > 40) return json({ found: false })

    const u = await prisma.user.findUnique({
      where: { username },
      select: { id: true, name: true, isSuspended: true, isDeleted: true },
    })
    if (!u || u.isDeleted || u.isSuspended) return json({ found: false })
    if (u.id === user.id) return json({ found: false, self: true })
    return json({ found: true, name: shortName(u.name) })
  } catch (err) {
    return fail(err, 'Could not look that up')
  }
}
