// app/api/admin/tickets/_auth.ts
// Same admin check the other /api/admin routes use (Bearer JWT with role ADMIN;
// middleware already guards /api/admin/**). Returns the admin's user id.
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

export function adminIdFromRequest(req: NextRequest): string | null {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  try {
    const decoded = jwt.verify(header.substring(7), process.env.JWT_SECRET!) as any
    if (decoded?.role !== 'ADMIN') return null
    const id = decoded.userId ?? decoded.id
    return typeof id === 'string' && id ? id : null
  } catch {
    return null
  }
}
