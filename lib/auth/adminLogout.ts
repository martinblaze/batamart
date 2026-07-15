// lib/auth/adminLogout.ts
// Call this function whenever you want to log out of admin
// e.g: import { adminLogout } from '@/lib/auth/adminLogout'
//      <button onClick={adminLogout}>Logout</button>

export async function adminLogout() {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Ignore network errors and still clear local state below.
  }

  localStorage.removeItem('adminToken')
  window.location.href = '/admin-login'
}
