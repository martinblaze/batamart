// app/api/auth/update-profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { normalizeUsername, validateUsername } from '@/lib/username'
import { z } from 'zod'

export async function PATCH(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const schema = z.object({
      name: z.string().trim().min(1).max(80).optional(),
      phone: z.string().trim().min(10).max(20).optional(),
      hostelName: z.string().trim().max(120).optional().nullable(),
      roomNumber: z.string().trim().max(40).optional().nullable(),
      landmark: z.string().trim().max(200).optional().nullable(),
      username: z.string().trim().max(40).optional(),
    }).strict()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid profile payload' }, { status: 400 })
    }
    const { name, phone, hostelName, roomNumber, landmark } = parsed.data

    let newUsername: string | undefined
    if (parsed.data.username !== undefined) {
      newUsername = normalizeUsername(parsed.data.username)
      const problem = validateUsername(newUsername)
      if (problem) return NextResponse.json({ error: problem }, { status: 400 })

      const current = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { username: true },
      })
      if (current?.username && current.username !== newUsername) {
        // Labels with the old username are already on parcels in flight.
        const inFlight = await prisma.order.count({
          where: {
            buyerId: payload.userId,
            status: { in: ['PENDING', 'PROCESSING', 'SHIPPED', 'RIDER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'] },
          },
        })
        if (inFlight > 0) {
          return NextResponse.json(
            { error: 'You cannot change your username while you have an order in progress' },
            { status: 400 },
          )
        }
      }
    }

    // Validate phone number
    let formattedPhone = phone
    if (phone) {
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 10 || digits.length > 11) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
      }
      formattedPhone = digits
    }

    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        ...(name && { name }),
        ...(formattedPhone && { phone: formattedPhone }),
        ...(hostelName !== undefined && { hostelName }),
        ...(roomNumber !== undefined && { roomNumber }),
        ...(landmark !== undefined && { landmark }),
        ...(newUsername && { username: newUsername }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        hostelName: true,
        roomNumber: true,
        landmark: true,
        role: true,
        isSellerMode: true,
        username: true,
      }
    })

    return NextResponse.json({ user: updatedUser })

  } catch (error: any) {
    if (error?.code === 'P2002' && String(error?.meta?.target).includes('username')) {
      return NextResponse.json({ error: 'That username is taken' }, { status: 409 })
    }
    console.error('Update profile error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
