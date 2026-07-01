import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  manifest: '/rider-manifest.json',
}

export default function RiderLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}