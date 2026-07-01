const CLOUDINARY_MARKER = '/upload/'

export function optimizeCloudinaryUrl(
  url?: string | null,
  opts: { width?: number; quality?: string | number } = {},
): string {
  if (!url) return url || ''
  const idx = url.indexOf(CLOUDINARY_MARKER)
  if (idx === -1) return url

  const after = url.slice(idx + CLOUDINARY_MARKER.length)
  if (/^[a-z]_[^/]+(,[a-z]_[^/]+)*\//.test(after)) return url

  const { width, quality = 'auto' } = opts
  const transforms = ['f_auto', `q_${quality}`]
  if (width) transforms.push(`w_${width}`, 'c_limit')

  const before = url.slice(0, idx + CLOUDINARY_MARKER.length)
  return `${before}${transforms.join(',')}/${after}`
}

export const IMAGE_SIZES = {
  thumb: 96,
  card: 400,
  detail: 900,
} as const
