// app/api/admin/delivery-routes/[id]/route.ts
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

// PATCH — update a route's price or active state
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { price, isActive } = await req.json()
  const data: { price?: number; isActive?: boolean } = {}
  if (typeof price === 'number' && price > 0) data.price = price
  if (typeof isActive === 'boolean') data.isActive = isActive

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const route = await prisma.deliveryRoute.update({
      where: { id: params.id },
      data,
      include: {
        zoneA: { select: { id: true, name: true } },
        zoneB: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ success: true, route })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }
    console.error('Update delivery route error:', error)
    return NextResponse.json({ error: 'Failed to update route' }, { status: 500 })
  }
}

// DELETE — remove a route
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await prisma.deliveryRoute.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 })
    }
    console.error('Delete delivery route error:', error)
    return NextResponse.json({ error: 'Failed to delete route' }, { status: 500 })
  }
}
