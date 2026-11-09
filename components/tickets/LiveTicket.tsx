'use client'

// The ticket card with its live, rotating QR.
//  - The QR text is built in the browser from the ticket secret every 30 s
//    (lib/tickets/qr.ts), using a clock offset taken from the server, so it keeps
//    working with no connection once the page has loaded.
//  - Ticket status is polled every 4 s so "Checked in" shows up quickly.
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { QRCodeSVG } from 'qrcode.react'
import { CalendarDays, CheckCircle2, Loader2, MapPin, ShieldAlert, Ticket as TicketIcon, UserPlus, WifiOff, Ban } from 'lucide-react'
import { buildQrText, qrStepOf, msUntilNextStep } from '@/lib/tickets/qr'
import { QR_STEP_SECONDS } from '@/lib/tickets/config'
import { formatWhen } from '@/components/tickets/ticket-format'
import SendToFriend, { SentNotice } from '@/components/tickets/SendToFriend'

interface TicketData {
  id: string
  code: string
  secret: string
  secretVersion: number
  status: 'VALID' | 'CHECKED_IN' | 'VOID'
  checkedInAt: string | null
  tierName: string
  tierImageUrl: string | null
  isOwner: boolean
  canTransfer: boolean
  event: {
    id: string; name: string; venue: string; address: string | null; status: string
    startsAt: string; endsAt: string | null; flyerUrl: string | null
  }
}

const POLL_MS = 4000
const cacheKey = (id: string) => `bt-ticket:${id}`

function readCache(id: string): { ticket: TicketData; offset: number } | null {
  try {
    const raw = localStorage.getItem(cacheKey(id))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function writeCache(id: string, value: { ticket: TicketData; offset: number } | null) {
  try {
    if (value) localStorage.setItem(cacheKey(id), JSON.stringify(value))
    else localStorage.removeItem(cacheKey(id))
  } catch { /* storage unavailable: the page still works while open */ }
}

export default function LiveTicket({ ticketId, token, index, total }: { ticketId: string; token?: string; index?: number; total?: number }) {
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'gone' | 'error'>('loading')
  const [offline, setOffline] = useState(false)
  const [qrText, setQrText] = useState('')
  const [remaining, setRemaining] = useState(1)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const offsetRef = useRef(0)
  const lastBuilt = useRef<{ step: number; secret: string } | null>(null)
  const ticketRef = useRef<TicketData | null>(null)
  ticketRef.current = ticket

  const load = useCallback(async () => {
    try {
      const headers: Record<string, string> = {}
      const auth = localStorage.getItem('token')
      if (auth) headers.Authorization = `Bearer ${auth}`
      const url = `/api/tickets/ticket/${encodeURIComponent(ticketId)}${token ? `?token=${encodeURIComponent(token)}` : ''}`
      const res = await fetch(url, { headers, cache: 'no-store' })
      if (res.status === 404) { writeCache(ticketId, null); setState('gone'); return }
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      offsetRef.current = Number(data.serverTime) - Date.now()
      const next: TicketData = data.ticket ?? data
      setTicket(next)
      setState('ready')
      setOffline(false)
      writeCache(ticketId, next.status === 'VALID' ? { ticket: next, offset: offsetRef.current } : null)
    } catch {
      // No connection: keep showing the last good ticket. The QR is computed locally.
      if (!ticketRef.current) {
        const cached = readCache(ticketId)
        if (cached) { offsetRef.current = cached.offset; setTicket(cached.ticket); setState('ready') }
        else setState('error')
      }
      setOffline(true)
    }
  }, [ticketId, token])

  // Initial load + 4 s status poll (paused while the tab is hidden).
  useEffect(() => {
    load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  // The rotating QR + countdown.
  const active = ticket?.status === 'VALID' ? ticket : null
  const secret = active?.secret
  const code = active?.code
  useEffect(() => {
    if (!secret || !code) { setQrText(''); lastBuilt.current = null; return }
    let cancelled = false
    const tick = async () => {
      const now = Date.now() + offsetRef.current
      setRemaining(msUntilNextStep(now) / (QR_STEP_SECONDS * 1000))
      const step = qrStepOf(now)
      const last = lastBuilt.current
      if (last && last.step === step && last.secret === secret) return
      lastBuilt.current = { step, secret }
      try {
        const text = await buildQrText(code, secret, now)
        if (!cancelled) setQrText(text)
      } catch { /* crypto unavailable: leave the previous code up */ }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => { cancelled = true; clearInterval(id) }
  }, [secret, code])

  // Keep the screen awake while a valid ticket is on show (best effort).
  useEffect(() => {
    if (!active) return
    let lock: any = null
    const acquire = async () => {
      try { lock = await (navigator as any).wakeLock?.request('screen') } catch { /* not allowed */ }
    }
    acquire()
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); try { lock?.release() } catch { /* ignore */ } }
  }, [active?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'loading') {
    return <div className="flex items-center justify-center border border-border bg-card py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
  }
  if (state === 'gone') {
    if (sentTo) return <SentNotice toUsername={sentTo} />
    return (
      <div className="border border-border bg-card p-6 text-center">
        <Ban className="mx-auto h-8 w-8 text-ink-muted" strokeWidth={1.5} />
        <p className="mt-3 font-semibold text-ink">This ticket is no longer here</p>
        <p className="mt-1 text-sm text-ink-secondary">It may have been sent to someone else, or the link is not valid.</p>
      </div>
    )
  }
  if (state === 'error' || !ticket) {
    return (
      <div className="border border-border bg-card p-6 text-center">
        <WifiOff className="mx-auto h-8 w-8 text-ink-muted" strokeWidth={1.5} />
        <p className="mt-3 font-semibold text-ink">Could not load this ticket</p>
        <button onClick={() => { setState('loading'); load() }} className="mt-3 text-sm font-semibold text-primary">Try again</button>
      </div>
    )
  }

  const e = ticket.event
  const image = ticket.tierImageUrl || e.flyerUrl
  const cancelled = e.status === 'CANCELLED'

  return (
    <article className="overflow-hidden border border-border bg-card">
      <div className="relative aspect-[16/9] bg-surface">
        {image
          ? <img src={image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center"><TicketIcon className="h-10 w-10 text-ink-muted" strokeWidth={1.25} /></div>}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/80">
            {ticket.tierName}{total && total > 1 ? ` · ${(index ?? 0) + 1} of ${total}` : ''}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-tight text-white">{e.name}</h2>
        </div>
      </div>

      <div className="space-y-1.5 border-b border-dashed border-border px-4 py-3.5 text-sm text-ink-secondary">
        <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" />{formatWhen(e.startsAt)}</p>
        <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" />{e.venue}{e.address ? `, ${e.address}` : ''}</p>
      </div>

      <div className="px-4 py-5">
        {ticket.status === 'CHECKED_IN' ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-success" strokeWidth={1.5} />
            <p className="mt-3 text-xl font-semibold text-ink">Checked in</p>
            <p className="mt-1 text-sm text-ink-secondary">
              {ticket.checkedInAt ? `Scanned at the door on ${formatWhen(ticket.checkedInAt)}.` : 'This ticket has been used.'}
            </p>
            <p className="mt-1 text-sm text-ink-muted">It cannot be used again.</p>
          </div>
        ) : ticket.status === 'VOID' ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Ban className="h-14 w-14 text-danger" strokeWidth={1.5} />
            <p className="mt-3 text-xl font-semibold text-ink">Ticket void</p>
            <p className="mt-1 text-sm text-ink-secondary">This ticket is no longer valid. Contact support if you think this is a mistake.</p>
          </div>
        ) : cancelled ? (
          <div className="flex flex-col items-center py-6 text-center">
            <ShieldAlert className="h-14 w-14 text-danger" strokeWidth={1.5} />
            <p className="mt-3 text-xl font-semibold text-ink">Event cancelled</p>
            <p className="mt-1 text-sm text-ink-secondary">The host has cancelled this event.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="bg-white p-3">
              {qrText
                ? <QRCodeSVG value={qrText} size={232} level="M" marginSize={0} />
                : <div className="flex h-[232px] w-[232px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
            </div>
            <div className="mt-4 w-full max-w-[256px]" aria-hidden>
              <div className="h-1 w-full overflow-hidden bg-border">
                <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(1, remaining)) * 100}%`, transition: 'width 250ms linear' }} />
              </div>
              <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                Refreshes in {Math.max(0, Math.ceil(remaining * QR_STEP_SECONDS))}s
              </p>
            </div>
            <p className="mt-3 font-mono text-sm tracking-[0.2em] text-ink">{ticket.code}</p>
            <p className="mt-1 text-center text-xs text-ink-muted">Show this at the door. Screenshots stop working within a minute.</p>
          </div>
        )}
        {offline && ticket.status === 'VALID' && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
            <WifiOff className="h-3.5 w-3.5" /> Offline. Your QR still works.
          </p>
        )}
      </div>

      {(ticket.status === 'VALID' && !cancelled) && (
        <div className="space-y-3 border-t border-border bg-surface/50 px-4 py-4">
          {sentTo ? (
            <SentNotice toUsername={sentTo} />
          ) : ticket.isOwner ? (
            ticket.canTransfer && (
              <SendToFriend
                ticketId={ticket.id} eventName={e.name} tierName={ticket.tierName}
                onSent={name => { setSentTo(name); writeCache(ticketId, null); setQrText(''); setState('gone'); load() }}
              />
            )
          ) : (
            <p className="flex items-start gap-2 text-sm text-ink-secondary">
              <UserPlus className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" />
              <span>
                Want to send this ticket to a friend?{' '}
                <Link href="/signup" className="font-semibold text-primary">Create an account with this email</Link>{' '}
                first. Tickets can only be sent between BataMart accounts.
              </span>
            </p>
          )}
        </div>
      )}
    </article>
  )
}
