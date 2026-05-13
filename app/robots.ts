import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://batamart.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}

