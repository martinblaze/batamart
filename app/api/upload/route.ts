// app/api/upload/route.ts
export const dynamic = 'force-dynamic'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/auth'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { checkRateLimitDistributed, getIpKey } from '@/lib/security/rate-limit'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function hasExpectedMagicBytes(mimeType: string, data: Buffer): boolean {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  }
  if (mimeType === 'image/png') {
    return data.length >= 8 &&
      data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
      data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a
  }
  if (mimeType === 'image/webp') {
    if (data.length < 12) return false
    const riff = data.subarray(0, 4).toString('ascii')
    const webp = data.subarray(8, 12).toString('ascii')
    return riff === 'RIFF' && webp === 'WEBP'
  }
  return false
}

function signCloudinaryParams(params: Record<string, string | number>, apiSecret: string) {
  const signatureBase = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return crypto.createHash('sha1').update(`${signatureBase}${apiSecret}`).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const ip = getIpKey(request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'))
    const limit = await checkRateLimitDistributed(
      `upload:${user.id}:${ip}`,
      20,
      15 * 60 * 1000,
      { requireDistributedInProduction: true },
    )
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many uploads. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSecs) } }
      )
    }

    const { image } = await request.json()
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const mimeMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/)
    if (!mimeMatch) {
      return NextResponse.json(
        { error: 'Invalid image format. Must be a base64 encoded image.' },
        { status: 400 }
      )
    }
    const mimeType = mimeMatch[1].toLowerCase()
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Invalid file type: ${mimeType}. Only JPEG, PNG, and WebP images are allowed.` },
        { status: 400 }
      )
    }

    const base64Data = image.split(',')[1] || ''
    const approximateSizeBytes = Math.ceil(base64Data.length * 0.75)
    if (approximateSizeBytes > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_SIZE_MB}MB.` },
        { status: 400 }
      )
    }

    const fileBuffer = Buffer.from(base64Data, 'base64')
    if (!hasExpectedMagicBytes(mimeType, fileBuffer)) {
      return NextResponse.json(
        { error: 'File content does not match declared image type.' },
        { status: 400 }
      )
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Image upload not configured' }, { status: 500 })
    }

    const timestamp = Math.round(Date.now() / 1000)
    const folder = `BATAMART-products/${user.id}`
    const signature = signCloudinaryParams({ folder, timestamp }, apiSecret)

    const formData = new FormData()
    formData.append('file', image)
    formData.append('api_key', apiKey)
    formData.append('timestamp', timestamp.toString())
    formData.append('signature', signature)
    formData.append('folder', folder)

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    })
    const data = await response.json()

    if (!response.ok || typeof data?.secure_url !== 'string') {
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    if (!/^https:\/\/res\.cloudinary\.com\//.test(data.secure_url)) {
      return NextResponse.json({ error: 'Invalid upload URL returned' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
