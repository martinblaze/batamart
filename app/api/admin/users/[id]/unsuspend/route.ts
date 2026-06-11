export const dynamic = 'force-dynamic'
// app/api/admin/users/[id]/unsuspend/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import prisma from '@/lib/prisma'
import { notifyAccountUnsuspended } from '@/lib/notification'

interface AdminTokenPayload {
  role?: string
}

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AdminTokenPayload
    if (decoded.role !== 'ADMIN') return null
    return decoded
  } catch {
    return null
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await verifyAdmin(req)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.user.update({
      where: { id: params.id },
      data: {
        isSuspended: false,
        suspendedUntil: null,
        suspensionReason: null,
      },
    })

    // Notification should not block the unsuspend action.
    notifyAccountUnsuspended(params.id).catch(error => {
      console.error('Unsuspend notification failed:', error)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unsuspend error:', error)
    return NextResponse.json({ error: 'Failed to unsuspend user' }, { status: 500 })
  }
}
