'use client'

// Tiny shared store of the signed-in user's saved product ids. One request per
// page load, however many hearts are on screen; toggles are optimistic.

import { useSyncExternalStore } from 'react'

let ids = new Set<string>()
let snapshot: ReadonlySet<string> = ids
let loadedFor: string | null = null // token the ids belong to
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

const emit = () => {
  snapshot = new Set(ids)
  listeners.forEach(l => l())
}

const getToken = () => {
  try { return localStorage.getItem('token') } catch { return null }
}

const headers = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

export function ensureWishlistLoaded() {
  const token = getToken()
  if (!token) {
    if (loadedFor !== null || ids.size) { ids = new Set(); loadedFor = null; emit() }
    return
  }
  if (loadedFor === token || inflight) return
  inflight = fetch('/api/wishlist/ids', { headers: headers(token), cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (d && Array.isArray(d.ids)) {
        ids = new Set<string>(d.ids)
        loadedFor = token
        emit()
      }
    })
    .catch(() => {})
    .finally(() => { inflight = null })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  ensureWishlistLoaded()
  return () => { listeners.delete(cb) }
}

const emptySnapshot: ReadonlySet<string> = new Set()

export function useIsSaved(productId: string): boolean {
  const s = useSyncExternalStore(subscribe, () => snapshot, () => emptySnapshot)
  return s.has(productId)
}

export function useSavedIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => snapshot, () => emptySnapshot)
}

export type ToggleResult = 'saved' | 'removed' | 'login' | 'error'

/** Optimistic toggle. Returns 'login' when signed out so the caller can redirect. */
export async function toggleSaved(productId: string): Promise<{ result: ToggleResult; message?: string }> {
  const token = getToken()
  if (!token) return { result: 'login' }
  const was = ids.has(productId)
  if (was) ids.delete(productId); else ids.add(productId)
  emit()
  try {
    const res = await fetch(was ? `/api/wishlist/${encodeURIComponent(productId)}` : '/api/wishlist', {
      method: was ? 'DELETE' : 'POST',
      headers: headers(token),
      body: was ? undefined : JSON.stringify({ productId }),
    })
    if (res.status === 401) {
      throw Object.assign(new Error('login'), { login: true })
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || 'Something went wrong')
    }
    return { result: was ? 'removed' : 'saved' }
  } catch (e: any) {
    if (was) ids.add(productId); else ids.delete(productId)
    emit()
    if (e?.login) return { result: 'login' }
    return { result: 'error', message: e?.message || 'Something went wrong' }
  }
}
