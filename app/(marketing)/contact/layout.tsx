import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact Support',
  description:
    'Contact BATAMART support for payment issues, disputes, seller help, and general campus marketplace assistance.',
  alternates: { canonical: '/contact' },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}

