export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeUsername, validateUsername } from '@/lib/username'

// Public availability check for the signup / settings forms.
export async function GET(request: NextRequest) {
  const username = normalizeUsername(request.nextUrl.searchParams.get('u'))
  const problem = validateUsername(username)
  if (problem) return NextResponse.json({ available: false, error: problem })

  const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } })
  return NextResponse.json({ available: !taken, error: taken ? 'That username is taken' : null })
}
