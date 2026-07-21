'use client'

import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export function OfflineStatusBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[12000] bg-warning text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        You are offline. Showing last synced data where available.
      </div>
    </div>
  )
}
