export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFromRequest } from '@/lib/auth/auth'
import { enforceSameOrigin } from '@/lib/security/request'
import { generateUniqueMarketerCode } from '@/lib/field-marketer/config'

export async function POST(request: NextRequest) {
  try {
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role === 'RIDER' || user.role === 'ADMIN') {
      return NextResponse.json({ error: 'This account type cannot join' }, { status: 403 })
    }

    const existing = await prisma.fieldMarketer.findUnique({ where: { userId: user.id } })
    if (existing) return NextResponse.json({ success: true, alreadyJoined: true })

    const code = await generateUniqueMarketerCode(
      async (c) => !!(await prisma.fieldMarketer.findUnique({ where: { code: c }, select: { id: true } })),
    )

    try {
      await prisma.fieldMarketer.create({ data: { userId: user.id, code } })
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err // double-tap race: already created
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Field marketer join error:', error)
    return NextResponse.json({ error: 'Could not join right now' }, { status: 500 })
  }
}
