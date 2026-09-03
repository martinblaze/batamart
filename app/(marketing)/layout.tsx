import { Archivo, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import '@/styles/marketing.css'
import { MarketingShell } from '@/components/marketing/MarketingShell'

/* Three faces, three jobs, no overlap:
   — Archivo sets every headline: a tight grotesque that holds up at 12rem.
   — Instrument Serif italic is the counterpoint, rationed to a word or two.
   — JetBrains Mono carries labels, indices and buttons — the "instrument
     panel" voice that keeps the display type from having to shout. */
const display = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const serif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${display.variable} ${serif.variable} ${mono.variable}`}>
      <MarketingShell>{children}</MarketingShell>
    </div>
  )
}
