// lib/auth/auth.ts

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('Server misconfiguration: JWT_SECRET is not set.')
  }
  return secret
}

// -- FIXED: added optional `role` param so rider tokens carry the role claim --
export function generateToken(userId: string, phone: string | null, role?: string): string {
  return jwt.sign({ userId, phone, ...(role ? { role } : {}) }, getJwtSecret(), { expiresIn: '30d' })
}

export function verifyToken(token: string): { userId: string; phone: string; role?: string } | null {
  try {
    return jwt.verify(token, getJwtSecret()) as { userId: string; phone: string; role?: string }
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('234')) return `+${digits}`
  if (digits.startsWith('0')) return `+234${digits.slice(1)}`
  return `+234${digits}`
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function createOTP(email: string): Promise<string> {
  const code = generateOTP()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.oTP.deleteMany({
    where: { email, isUsed: false },
  })

  await prisma.oTP.create({
    data: { email, code, expiresAt },
  })

  return code
}

export async function verifyOTP(email: string, code: string): Promise<boolean> {
  const otp = await prisma.oTP.findFirst({
    where: {
      email,
      code,
      isUsed: false,
      expiresAt: { gt: new Date() },
    },
  })

  if (!otp) return false

  await prisma.oTP.update({
    where: { id: otp.id },
    data: { isUsed: true },
  })

  return true
}

export async function sendEmailOTP(email: string, code: string): Promise<boolean> {
  try {
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== '') {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'BATAMART <noreply@batamart.com>',
          to: [email],
          subject: `Your BATAMART code is ${code}`,
          text: `Your BATAMART verification code is ${code}. It expires in 10 minutes.`, 
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #3D95E8, #4DABFF); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">BATAMART</h1>
              </div>
              <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #333;">Verification Code</h2>
                <p style="color: #666;">Enter this code to continue. It expires in 10 minutes.</p>
                <div style="background: white; border: 2px solid #3D95E8; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                  <span style="font-size: 36px; font-weight: bold; color: #3D95E8; letter-spacing: 8px;">${code}</span>
                </div>
                <p style="color: #999; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              </div>
            </div>
          `,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        console.error('Resend API error:', err)
        return false
      }

      return true
    } else {
      console.log('=====================================')
      console.log('?? EMAIL OTP (dev mode - no RESEND_API_KEY set)')
      console.log(`To: ${email}`)
      console.log(`Code: ${code}`)
      console.log('=====================================')
      return true
    }
  } catch (error) {
    console.error('Failed to send email OTP:', error)
    return false
  }
}

// --- Suspension check helper --------------------------------------------------
export async function checkSuspension(userId: string): Promise<{ suspended: boolean; reason?: string; until?: Date | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuspended: true, suspendedUntil: true, suspensionReason: true },
  })

  if (!user) return { suspended: false }

  // Auto-lift expired suspension
  if (user.isSuspended && user.suspendedUntil && new Date(user.suspendedUntil) < new Date()) {
    await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: false, suspendedUntil: null, suspensionReason: null },
    })
    return { suspended: false }
  }

  if (user.isSuspended) {
    return {
      suspended: true,
      reason: user.suspensionReason ?? 'Violation of platform terms',
      until: user.suspendedUntil,
    }
  }

  return { suspended: false }
}

// --- getUserFromRequest --------------------------------------------------------
// Used by every API route to get the current authenticated user.
export const getUserFromRequest = async (request: Request) => {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const decoded = verifyToken(token)
  if (!decoded) return null

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id:               true,
      name:             true,
      phone:            true,
      email:            true,
      matricNumber:     true,
      profilePhoto:     true,
      role:             true,
      hostelName:       true,
      roomNumber:       true,
      landmark:         true,
      availableBalance: true,
      pendingBalance:   true,
      isSuspended:      true,
      suspendedUntil:   true,
      suspensionReason: true,
      isRiderVerified:  true,
      isAvailable:      true,
      universityId:     true,
    },
  })

  return user
}

