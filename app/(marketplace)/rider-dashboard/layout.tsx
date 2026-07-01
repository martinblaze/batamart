import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  manifest: '/rider-manifest.json',
}

export default function RiderDashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}