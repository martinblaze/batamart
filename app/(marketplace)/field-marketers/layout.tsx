import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Unlisted on purpose: no links point here and crawlers are told to skip it.
export const metadata: Metadata = {
  title: 'Field marketers',
  robots: { index: false, follow: false, nocache: true },
}

export default function FieldMarketersLayout({ children }: { children: ReactNode }) {
  return children
}
