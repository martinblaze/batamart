// app/product/[id]/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Server Component — generates Open Graph / Twitter Card meta tags so that
// pasting a product link into WhatsApp, Telegram, Twitter, iMessage, etc.
// shows a rich preview card (image + title + price + description).
// This sits alongside your existing 'use client' page.tsx — Next.js will
// merge the metadata automatically.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from 'next'
import { ReactNode } from 'react'

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n)

// Resolve absolute URL for OG images — required by WhatsApp / FB crawlers.
const absoluteUrl = (path: string): string => {
  // Prefer an explicit env var so it works on every deploy target.
  // (Previously `A || B ? X : Y` — `||` binds tighter than `?:` in JS, so
  // whenever NEXT_PUBLIC_APP_URL was set this still evaluated the VERCEL_URL
  // branch, silently producing "https://undefined" on any deploy where
  // VERCEL_URL itself wasn't set. Parenthesized now to actually prefer it.)
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||      // e.g. https://batamart.com
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // If it's already an absolute URL (Cloudinary, S3, etc.) return as-is
  if (path.startsWith('http')) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ProductData {
  id: string
  name: string
  description?: string
  price: number
  category: string
  subcategory?: string
  images: string[]
  quantity: number
  seller: {
    name: string
    trustLevel: string
    avgRating: number
  }
}

// ── Fetch product on the server (no auth needed for public OG data) ─────────
// Adjust the URL / auth strategy to match your API setup.

async function fetchProductForMeta(id: string): Promise<ProductData | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    // If your /api/products/:id endpoint requires a server-side token, set it
    // in an env var (INTERNAL_API_SECRET) and pass it here.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (process.env.INTERNAL_API_SECRET) {
      headers['Authorization'] = `Bearer ${process.env.INTERNAL_API_SECRET}`
    }

    const res = await fetch(`${baseUrl}/api/products/${id}`, {
      headers,
      // Cache for 60 s so crawlers don't hammer your DB, but product changes
      // are reflected reasonably quickly.
      next: { revalidate: 60 },
    })

    if (!res.ok) return null
    const data = await res.json()
    return (data.product ?? data) as ProductData
  } catch {
    return null
  }
}

// Strip the VARIANTS_V2 encoding and pipe-separated tags from description
// so the OG description is clean, human-readable text.
function cleanDescription(raw?: string): string {
  if (!raw) return ''
  if (raw.startsWith('VARIANTS_V2::')) return ''
  return raw.split(' | ')[0].trim().slice(0, 200)
}

// ── generateMetadata — the Next.js hook that powers link previews ───────────

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const product = await fetchProductForMeta(params.id)

  // ── Fallback metadata when product can't be loaded ──────────────────────
  if (!product) {
    return {
      title: 'Product | BataMart',
      description: 'Shop on BataMart — your campus marketplace.',
      openGraph: {
        siteName: 'BataMart',
        type: 'website',
      },
    }
  }

  // ── Build rich metadata ─────────────────────────────────────────────────
  const price = fmt(product.price)
  const stock =
    product.quantity === 0
      ? 'Out of stock'
      : product.quantity <= 5
      ? `Only ${product.quantity} left`
      : 'In stock'

  const title = `${product.name} — ${price} | BataMart`

  const descParts: string[] = []
  const cleanDesc = cleanDescription(product.description)
  if (cleanDesc) descParts.push(cleanDesc)
  descParts.push(`${stock} · Sold by ${product.seller.name}`)
  if (product.category) descParts.push(`Category: ${product.category}`)
  const description = descParts.join(' · ').slice(0, 300)

  // Use the first product image; fall back to your app's default OG image.
  const ogImage =
    product.images?.[0]
      ? absoluteUrl(product.images[0])
      : absoluteUrl('/og-default.png')   // place a 1200×630 fallback in /public

  const productUrl = absoluteUrl(`/product/${product.id}`)

  return {
    // ── <title> and <meta name="description"> ──────────────────────────────
    title,
    description,

    // ── Open Graph (WhatsApp, Facebook, LinkedIn, Telegram, iMessage) ──────
    openGraph: {
      title,
      description,
      url: productUrl,
      siteName: 'BataMart',
      type: 'website',          // 'og:type = product' requires Facebook app approval;
                                 // 'website' works universally including WhatsApp
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
      locale: 'en_NG',
    },

    // ── Twitter / X Card ────────────────────────────────────────────────────
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },

    // ── Extra meta tags WhatsApp specifically reads ─────────────────────────
    // WhatsApp uses og:image, og:title, og:description — all covered above.
    // It also reads og:image:width / og:image:height which Next.js emits
    // automatically from the images array above.

    // ── Canonical URL ────────────────────────────────────────────────────────
    alternates: {
      canonical: productUrl,
    },

    // ── Robots ──────────────────────────────────────────────────────────────
    robots: {
      index: true,
      follow: true,
    },
  }
}

// ── Layout component — just renders children (your page.tsx) ─────────────────

export default function ProductLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}