// lib/auth-client.ts
// ── FIX #3 + FIX #6: Centralised fetch wrapper that:
//   - Always reads the token fresh from localStorage (not a stale closure)
//   - Intercepts 401 responses globally and redirects to /login
//     so expired/invalid tokens are handled automatically everywhere
//     instead of silently failing or leaving users on broken pages.
//
// USAGE — replace:
//   fetch('/api/...', { headers: { 'Authorization': `Bearer ${token}` } })
// WITH:
//   authFetch('/api/...')
//   authFetch('/api/...', { method: 'POST', body: JSON.stringify(data) })
//
// For the admin panel, use authFetch with { adminToken: true }:
//   authFetch('/api/admin/...', {}, { adminToken: true })

interface AuthFetchOptions extends RequestInit {
  /** Set to true in admin panel pages to use adminToken instead of token */
  _adminToken?: boolean
}

export async function authFetch(
  url: string,
  options: AuthFetchOptions = {}
): Promise<Response> {
  const { _adminToken, ...fetchOptions } = options

  // Always read the token fresh — avoids stale closure bugs
  const token = _adminToken
    ? localStorage.getItem('adminToken')
    : localStorage.getItem('token')

  const headers = new Headers(fetchOptions.headers)

  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  })

  // ── FIX #6: Global 401 handler ─────────────────────────────────────────
  // If the server returns 401, the token is expired or invalid.
  // Clear stored credentials and redirect to login instead of letting
  // the page silently fail or show a broken state.
  if (response.status === 401) {
    if (_adminToken) {
      localStorage.removeItem('adminToken')
      // Small delay so any in-flight state updates can settle
      setTimeout(() => { window.location.href = '/admin-login' }, 100)
    } else {
      // Riders have their own login page — bounce them back there, not the
      // buyer/seller /login, so an expired rider session doesn't strand them
      // on a login form that can't authenticate a rider account.
      const wasRider = localStorage.getItem('userRole') === 'RIDER'
      localStorage.removeItem('token')
      localStorage.removeItem('userName')
      localStorage.removeItem('userRole')
      window.dispatchEvent(new Event('auth-change'))
      setTimeout(() => {
        if (wasRider) {
          window.location.href = '/rider/login'
          return
        }
        // Preserve the current path so we can redirect back after login
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.href = `/login?returnTo=${returnTo}`
      }, 100)
    }
  }

  return response
}

/** Convenience wrapper for admin panel pages */
export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return authFetch(url, { ...options, _adminToken: true })
}

/** Read the current user token without triggering a fetch */
export function getToken(): string | null {
  return localStorage.getItem('token')
}

/** Check if a user is currently logged in (client side only) */
export function isLoggedIn(): boolean {
  return !!localStorage.getItem('token')
}