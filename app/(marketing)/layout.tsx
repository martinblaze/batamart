import '@/styles/marketing.css'
import { MarketingShell } from '@/components/marketing/MarketingShell'

/* The display, serif and mono faces now load once in the root layout and are
   published as CSS variables, so the marketing surface and the product share
   one type system instead of each shipping its own copy of the same fonts. */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MarketingShell>{children}</MarketingShell>
}
