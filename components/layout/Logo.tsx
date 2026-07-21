import Link from 'next/link'

// Design bible section 7 — Logo. Flat single-color mark (not a shopping-bag
// glyph): a rounded square with a path-mark built from two stacked chevrons
// forming a simple "route/delivery" motif, plus a wordmark lockup. Works
// standalone (app icon/favicon) or with the wordmark (navbar).
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1E90FF" />
      <path d="M9 20L16 13L23 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 13.5L16 6.5L23 13.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
    </svg>
  )
}

export function Logo({ href = '/', showWordmark = true, size = 32, className = '' }: { href?: string; showWordmark?: boolean; size?: number; className?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="text-[18px] font-semibold text-ink leading-none">BataMart</span>
      )}
    </Link>
  )
}
