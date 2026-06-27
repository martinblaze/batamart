import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://batamart.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const routes = [
    '/',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/terms/sellers',
    '/signup',
    '/login',
    '/marketplace',
    '/seller',
    '/sell',
    '/wallet',
    '/referrals',
  ]

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === '/' || route === '/marketplace' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : route === '/marketplace' ? 0.9 : 0.7,
  }))
}


