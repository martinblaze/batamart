// app/api/admin/delivery-routes/route.ts
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

// GET — list all routes between zones belonging to a university
export async function GET(req: NextRequest) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const universityId = searchParams.get('universityId')
  if (!universityId) {
    return NextResponse.json({ error: 'universityId is required' }, { status: 400 })
  }

  const routes = await prisma.deliveryRoute.findMany({
    where: {
      zoneA: { universityId },
      zoneB: { universityId },
    },
    include: {
      zoneA: { select: { id: true, name: true } },
      zoneB: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ routes })
}

// POST — create a route between two zones
export async function POST(req: NextRequest) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { zoneAId, zoneBId, price } = await req.json()
  if (!zoneAId || !zoneBId || typeof price !== 'number' || price <= 0) {
    return NextResponse.json({ error: 'zoneAId, zoneBId and a positive price are required' }, { status: 400 })
  }
  if (zoneAId === zoneBId) {
    return NextResponse.json({ error: 'A route needs two different zones — same-zone delivery uses a fixed fee, not a route' }, { status: 400 })
  }

  const existing = await prisma.deliveryRoute.findFirst({
    where: {
      OR: [
        { zoneAId, zoneBId },
        { zoneAId: zoneBId, zoneBId: zoneAId },
      ],
    },
  })
  if (existing) {
    return NextResponse.json({ error: 'A route between these zones already exists — edit it instead' }, { status: 409 })
  }

  const route = await prisma.deliveryRoute.create({
    data: { zoneAId, zoneBId, price },
    include: {
      zoneA: { select: { id: true, name: true } },
      zoneB: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ success: true, route })
}
