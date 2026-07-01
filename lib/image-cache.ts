import { optimizeCloudinaryUrl, IMAGE_SIZES } from './cloudinary'

const IMAGE_CACHE_KEY = 'batamart:image-cache'
const loadedImages = new Set<string>()
const inflightImages = new Map<string, Promise<void>>()
let hydrated = false

function hydrateCache() {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true
  try {
    const raw = window.localStorage.getItem(IMAGE_CACHE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    for (const src of parsed) {
      if (typeof src === 'string' && src.trim()) loadedImages.add(src)
    }
  } catch {}
}

function persistCache() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(Array.from(loadedImages).slice(-250)))
  } catch {}
}

function markLoaded(src: string) {
  loadedImages.add(src)
  inflightImages.delete(src)
  persistCache()
}

export function markImageLoaded(src?: string | null) {
  if (!src) return
  hydrateCache()
  markLoaded(src)
}

export function isImagePrimed(src?: string | null) {
  hydrateCache()
  return !!src && loadedImages.has(src)
}

export function primeImage(src?: string | null, opts: { width?: number } = {}) {
  if (typeof window === 'undefined' || !src) return Promise.resolve()
  const target = optimizeCloudinaryUrl(src, { width: opts.width ?? IMAGE_SIZES.card })
  hydrateCache()
  if (loadedImages.has(target)) return Promise.resolve()
  const pending = inflightImages.get(target)
  if (pending) return pending

  const promise = new Promise<void>((resolve) => {
    const img = new window.Image()
    if ('fetchPriority' in img) {
      ;(img as HTMLImageElement).fetchPriority = 'low'
    }
    img.decoding = 'async'
    img.onload = () => {
      markLoaded(target)
      resolve()
    }
    img.onerror = () => {
      markLoaded(target)
      resolve()
    }
    img.src = target
  })

  inflightImages.set(target, promise)
  return promise
}

export function primeImageBatch(
  srcs: Array<string | null | undefined>,
  limit = 8,
  opts: { width?: number } = {},
) {
  if (typeof window === 'undefined') return
  hydrateCache()
  const width = opts.width ?? IMAGE_SIZES.card
  const unique: string[] = []
  for (const src of srcs) {
    if (!src) continue
    const target = optimizeCloudinaryUrl(src, { width })
    if (unique.includes(target) || loadedImages.has(target)) continue
    unique.push(target)
    if (unique.length >= limit) break
  }

  if (!unique.length) return

  const start = () => {
    unique.forEach((target, index) => {
      const delay = index * 50
      window.setTimeout(() => {
        primeImage(target)
      }, delay)
    })
  }

  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
  if (idle) {
    idle(start)
    return
  }

  window.setTimeout(start, 0)
}
