import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

// Design bible section 8 — Category card. Real photography or a single
// lucide icon (never emoji), white bg, 12px radius, 1px border, one
// "Shop [category]" link per card in --color-primary.
export default function CategoryCard({
  name,
  href,
  image,
  icon: Icon,
}: {
  name: string
  href: string
  image?: string | null
  icon?: LucideIcon
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center transition-transform duration-150 ease-out hover:-translate-y-0.5"
    >
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : Icon ? (
          <Icon className="h-6 w-6 text-ink-secondary" strokeWidth={1.75} />
        ) : null}
      </div>
      <h3 className="text-[15px] font-medium text-ink">{name}</h3>
      <span className="text-xs font-medium text-primary">Shop {name}</span>
    </Link>
  )
}
