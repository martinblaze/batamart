// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const RIDER_ONLY_PAGES = ['/rider-dashboard']

const RIDER_ALLOWED_PAGES = [
  '/rider/login',
  '/rider-dashboard',
  '/wallet',
  '/notifications',
]

const PUBLIC_PAGES = [
  '/',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/forgot-password',
  '/verify',
  '/rider/login',
]

async function decodeToken(token: string): Promise<{ userId: string; role?: string } | null> {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return { userId: payload.userId as string, role: payload.role as string | undefined }
  } catch {
    return null
  }
}

async function verifyAdminToken(token: string): Promise<boolean> {
  const secret = process.env.JWT_SECRET
  if (!secret) return false
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return payload.role === 'ADMIN'
  } catch {
    return false
  }
}

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  return auth.slice(7)
}

function getAdminCookieToken(req: NextRequest): string | null {
  return req.cookies.get('adminToken')?.value ?? null
}

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return res
}

function forceRiderLogout(req: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL('/rider/login?reason=no_access', req.url))
  res.cookies.set('token', '', { path: '/', maxAge: 0 })
  return res
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') {
    const bearer = getBearerToken(req)
    const cookieToken = getAdminCookieToken(req)
    const token = bearer ?? cookieToken
    if (!token) return withSecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    const isValid = await verifyAdminToken(token)
    if (!isValid) return withSecurityHeaders(NextResponse.json({ error: 'Forbidden' }, { status: 403 }))
  }

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin-login')) {
    const token = getAdminCookieToken(req)
    if (!token) return withSecurityHeaders(NextResponse.redirect(new URL('/admin-login', req.url)))
    const isValid = await verifyAdminToken(token)
    if (!isValid) {
      const res = NextResponse.redirect(new URL('/admin-login', req.url))
      res.cookies.delete('adminToken')
      return withSecurityHeaders(res)
    }
    return withSecurityHeaders(NextResponse.next())
  }

  if (pathname === '/login' || pathname.startsWith('/login/') || pathname === '/signup' || pathname.startsWith('/signup/')) {
    const token = req.cookies.get('token')?.value
    if (token) {
      const user = await decodeToken(token)
      if (user?.role === 'RIDER') return withSecurityHeaders(forceRiderLogout(req))
    }
    return withSecurityHeaders(NextResponse.next())
  }

  const isRiderPage = RIDER_ONLY_PAGES.some(p => pathname.startsWith(p))
  if (isRiderPage) {
    const token = req.cookies.get('token')?.value
    if (!token) return withSecurityHeaders(NextResponse.redirect(new URL('/rider/login', req.url)))
    const user = await decodeToken(token)
    if (!user || user.role !== 'RIDER') return withSecurityHeaders(NextResponse.redirect(new URL('/rider/login', req.url)))
    return withSecurityHeaders(NextResponse.next())
  }

  const isPublic = PUBLIC_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isRiderAllowed = RIDER_ALLOWED_PAGES.some(p => pathname.startsWith(p))
  const isApiRoute = pathname.startsWith('/api/')
  const isStaticFile = pathname.startsWith('/_next/') || pathname.includes('.')

  if (!isPublic && !isRiderAllowed && !isApiRoute && !isStaticFile) {
    const token = req.cookies.get('token')?.value
    if (token) {
      const user = await decodeToken(token)
      if (user?.role === 'RIDER') return withSecurityHeaders(forceRiderLogout(req))
    }
  }

  return withSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/login',
    '/login/:path*',
    '/signup',
    '/signup/:path*',
    '/rider-dashboard/:path*',
    '/rider-dashboard',
    '/marketplace/:path*',
    '/cart/:path*',
    '/orders/:path*',
    '/sell/:path*',
    '/my-shop/:path*',
    '/checkout/:path*',
    '/product/:path*',
    '/become-seller/:path*',
    '/myprofile/:path*',
    '/profile/:path*',
    '/dispute/:path*',
    '/referrals/:path*',
    '/search/:path*',
    '/seller/:path*',
    '/notifications/:path*',
    '/wallet/:path*',
    '/api/admin/:path*',
  ],
}
