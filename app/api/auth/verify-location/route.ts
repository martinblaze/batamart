export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { enforceJsonRequest, enforceSameOrigin } from '@/lib/security/request'
import { AWKA_ONLY_MESSAGE, isInsideAwka, issueAwkaLocationToken } from '@/lib/auth/awka-location'

export async function POST(request: NextRequest) {
  try {
    const jsonErr = enforceJsonRequest(request)
    if (jsonErr) return jsonErr
    const originErr = enforceSameOrigin(request)
    if (originErr) return originErr

    const { latitude, longitude, accuracy } = await request.json()

    if (!isInsideAwka(latitude, longitude, accuracy)) {
      return NextResponse.json({ error: AWKA_ONLY_MESSAGE }, { status: 403 })
    }

    return NextResponse.json({ success: true, locationToken: issueAwkaLocationToken() })
  } catch (error) {
    console.error('Verify location error:', error)
    return NextResponse.json({ error: 'Could not verify your location' }, { status: 500 })
  }
}
