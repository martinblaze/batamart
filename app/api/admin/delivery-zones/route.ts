// app/api/admin/delivery-zones/route.ts
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

function verifyAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const token = auth.slice(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    if (decoded.role !== 'ADMIN') return null
    return decoded
  } catch {
    return null
  }
}

// GET — list zones for a university (defaults to the first active one)
export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  let universityId = searchParams.get('universityId')

  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: { id: true, name: true, shortName: true },
    orderBy: { name: 'asc' },
  })

  if (!universityId) {
    universityId = universities[0]?.id ?? null
  }

  const zones = universityId
    ? await prisma.deliveryZone.findMany({
        where: { universityId },
        orderBy: { name: 'asc' },
      })
    : []

  return NextResponse.json({ universities, universityId, zones })
}

// POST — create a new zone
export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { universityId, name } = await req.json()
  if (!universityId || !name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'universityId and name are required' }, { status: 400 })
  }

  try {
    const zone = await prisma.deliveryZone.create({
      data: { universityId, name: name.trim() },
    })
    return NextResponse.json({ success: true, zone })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A zone with that name already exists for this university' }, { status: 409 })
    }
    console.error('Create delivery zone error:', error)
    return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 })
  }
}
