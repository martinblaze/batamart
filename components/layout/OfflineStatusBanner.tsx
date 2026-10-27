'use client'

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OfflineStatusBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div className="fixed left-0 right-0 top-0 z-[12000] border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink">
        <WifiOff className="h-3.5 w-3.5 text-warning" strokeWidth={1.75} />
        Offline. Showing last synced data.
      </div>
    </div>
  )
}
