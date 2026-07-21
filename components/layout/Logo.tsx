import Link from 'next/link'
import Image from 'next/image'

// The BataMart brand mark — public/BATAMART - logo.png. The wordmark is
// baked into the image itself, so no separate text is rendered alongside it.
const LOGO_ASPECT_RATIO = 808 / 309

export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src="/BATAMART - logo.png"
      alt="BataMart"
      width={Math.round(size * LOGO_ASPECT_RATIO)}
      height={size}
      className={className}
      priority
    />
  )
}

export function Logo({ href = '/', size = 32, className = '' }: { href?: string; showWordmark?: boolean; size?: number; className?: string }) {
  return (
    <Link href={href} className={`flex items-center ${className}`}>
      <LogoMark size={size} />
    </Link>
  )
}
