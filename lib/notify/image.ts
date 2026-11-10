// lib/notify/image.ts
// Product photos are Cloudinary URLs. Pushes and emails get a resized JPEG so
// they stay small; anything that is not https is dropped (push images must be
// publicly reachable over https).

export function pushImageUrl(url: string | null | undefined, width = 720): string | undefined {
  if (!url || typeof url !== 'string') return undefined
  const clean = url.trim()
  if (!/^https:\/\//i.test(clean)) return undefined
  const marker = '/image/upload/'
  const at = clean.indexOf(marker)
  if (at === -1 || !/res\.cloudinary\.com/i.test(clean)) return clean
  const head = clean.slice(0, at + marker.length)
  const rest = clean.slice(at + marker.length)
  return `${head}w_${width},c_fill,f_jpg,q_auto/${rest}`
}
