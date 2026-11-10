'use client'

import { Heart } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useIsSaved, toggleSaved } from '@/lib/wishlist/client'
import { useToast } from '@/components/ui/Toast'

/**
 * Save-for-later heart. State comes from a shared per-page cache, so a feed of
 * cards makes one request in total. Signed-out users are sent to login and
 * brought back to the page they were on.
 */
export default function WishlistHeart({
  productId,
  className = '',
  iconClassName = 'h-4 w-4',
}: {
  productId: string
  className?: string
  iconClassName?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const saved = useIsSaved(productId)

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const { result, message } = await toggleSaved(productId)
    if (result === 'login') {
      const here = window.location.pathname + window.location.search
      router.push(`/login?redirect=${encodeURIComponent(here)}`)
    } else if (result === 'error') {
      toast.error(message || 'Could not update your wishlist')
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      className={className}
    >
      <Heart
        className={`${iconClassName} transition-colors ${saved ? 'fill-danger text-danger' : ''}`}
        strokeWidth={1.75}
      />
    </button>
  )
}
