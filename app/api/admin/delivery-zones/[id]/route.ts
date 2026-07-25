// app/api/admin/delivery-zones/[id]/route.ts
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

// PATCH — rename a zone or toggle its active state
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, isActive } = await req.json()
  const data: { name?: string; isActive?: boolean } = {}
  if (typeof name === 'string' && name.trim()) data.name = name.trim()
  if (typeof isActive === 'boolean') data.isActive = isActive

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  try {
    const zone = await prisma.deliveryZone.update({ where: { id: params.id }, data })
    return NextResponse.json({ success: true, zone })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A zone with that name already exists for this university' }, { status: 409 })
    }
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    }
    console.error('Update delivery zone error:', error)
    return NextResponse.json({ error: 'Failed to update zone' }, { status: 500 })
  }
}

// DELETE — remove a zone (cascades to its routes)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = verifyAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await prisma.deliveryZone.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 })
    }
    console.error('Delete delivery zone error:', error)
    return NextResponse.json({ error: 'Failed to delete zone' }, { status: 500 })
  }
}
