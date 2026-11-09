'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  AlertTriangle, Ban, Camera, CheckCircle2, Clock, History, Loader2, LogOut, MapPin,
  RefreshCw, ScanLine, ShieldAlert, XCircle,
} from 'lucide-react'

const ScannerCamera = dynamic(() => import('@/components/tickets/ScannerCamera'), { ssr: false })

type Phase = 'loading' | 'login' | 'scanner' | 'invalid'
type ScanResultCode = 'OK' | 'ALREADY_USED' | 'INVALID' | 'WRONG_EVENT' | 'STALE' | 'VOID'

interface EventInfo { name: string; venue?: string; startsAt?: string }
interface Stats { checkedIn: number; total: number; myScans: number }
interface ScanOutcome {
  kind: ScanResultCode | 'ERROR'
  message: string
  tier?: string
  holder?: string
  at?: string | null
}
interface LogRow { id: string; result: string; holderName: string | null; tierName: string | null; code: string | null; createdAt: string; mine: boolean }

const AUTO_RESUME_MS = 2000
const SAME_QR_WINDOW_MS = 6000

const storageKey = (token: string) => `batamart_checker_${token}`
const readStored = (token: string) => { try { return localStorage.getItem(storageKey(token)) } catch { return null } }
const writeStored = (token: string, v: string | null) => {
  try { v ? localStorage.setItem(storageKey(token), v) : localStorage.removeItem(storageKey(token)) } catch { /* private mode */ }
}

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''

const THEME: Record<ScanOutcome['kind'], { bg: string; title: string; Icon: typeof XCircle }> = {
  OK: { bg: 'bg-emerald-600', title: 'CHECKED IN', Icon: CheckCircle2 },
  ALREADY_USED: { bg: 'bg-red-700', title: 'ALREADY USED', Icon: XCircle },
  WRONG_EVENT: { bg: 'bg-red-700', title: 'WRONG EVENT', Icon: ShieldAlert },
  INVALID: { bg: 'bg-red-700', title: 'INVALID', Icon: XCircle },
  VOID: { bg: 'bg-red-700', title: 'CANCELLED TICKET', Icon: Ban },
  STALE: { bg: 'bg-amber-600', title: 'EXPIRED CODE', Icon: Clock },
  ERROR: { bg: 'bg-neutral-700', title: 'TRY AGAIN', Icon: AlertTriangle },
}

const RESULT_LABEL: Record<string, string> = {
  OK: 'Checked in', ALREADY_USED: 'Already used', INVALID: 'Invalid', WRONG_EVENT: 'Wrong event', STALE: 'Expired code', VOID: 'Cancelled',
}

function beep(ok: boolean) {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 880 : 200
    gain.gain.value = 0.08
    osc.connect(gain); gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.35))
    setTimeout(() => ctx.close().catch(() => {}), 600)
  } catch { /* optional */ }
  try { navigator.vibrate?.(ok ? 80 : [120, 60, 120]) } catch { /* optional */ }
}

export default function CheckinPage() {
  const params = useParams()
  const token = String(Array.isArray(params?.token) ? params.token[0] : params?.token ?? '')

  const [phase, setPhase] = useState<Phase>('loading')
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const [stats, setStats] = useState<Stats | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [showLog, setShowLog] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)

  const sessionRef = useRef<string | null>(null)
  const busyRef = useRef(false)
  const lastRef = useRef<{ text: string; at: number } | null>(null)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const authFetch = useCallback((url: string, init: RequestInit = {}) => {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
    if (sessionRef.current) headers.Authorization = `Bearer ${sessionRef.current}`
    return fetch(url, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
  }, [])

  const signOut = useCallback(async (reason?: string) => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    sessionRef.current = null
    writeStored(token, null)
    setCameraOn(false); setOutcome(null); busyRef.current = false; lastRef.current = null
    try { await fetch('/api/tickets/checker/login', { method: 'DELETE' }) } catch { /* ignore */ }
    setStats(null); setLog([])
    setLoginError(reason ?? '')
    setPhase('login')
  }, [token])

  const refresh = useCallback(async () => {
    try {
      const [me, lg] = await Promise.all([authFetch('/api/tickets/checker/me'), authFetch('/api/tickets/checker/log')])
      if (me.status === 401) { await signOut('Your session ended. Enter your email to sign in again.'); return }
      if (me.ok) { const d = await me.json(); setStats(d.stats); setEvent((e) => ({ ...e, ...d.event })) }
      if (lg.ok) setLog((await lg.json()).scans ?? [])
    } catch { /* offline: keep what we have */ }
  }, [authFetch, signOut])

  // Boot: event info + try an existing session.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const info = await fetch(`/api/tickets/checker/login?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
        if (!alive) return
        if (info.status === 429) { setNotice('Too many attempts. Wait a few minutes and reload.'); setPhase('invalid'); return }
        if (!info.ok) { setPhase('invalid'); return }
        const d = await info.json()
        setEvent(d.event); setNotice(d.notice ?? null)

        sessionRef.current = readStored(token)
        const me = await authFetch('/api/tickets/checker/me')
        if (!alive) return
        if (me.ok) {
          const m = await me.json()
          setStats(m.stats); setEvent((e) => ({ ...e, ...m.event }))
          setPhase('scanner')
          refresh()
          return
        }
        sessionRef.current = null; writeStored(token, null)
        setPhase('login')
      } catch {
        if (alive) { setNotice('No connection. Check your internet and reload.'); setPhase('invalid') }
      }
    })()
    return () => { alive = false }
  }, [token, authFetch, refresh])

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current) }, [])

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    if (loggingIn) return
    setLoggingIn(true); setLoginError('')
    try {
      const res = await fetch('/api/tickets/checker/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ token, email: email.trim() }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setLoginError(d.error || 'Could not sign in.'); return }
      sessionRef.current = d.sessionToken
      writeStored(token, d.sessionToken)
      setEvent((prev) => ({ ...prev, ...d.event }))
      setPhase('scanner')
      refresh()
    } catch {
      setLoginError('No connection. Check your internet and try again.')
    } finally {
      setLoggingIn(false)
    }
  }

  const resume = useCallback(() => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    setOutcome(null)
    busyRef.current = false
  }, [])

  const handleDecode = useCallback(async (text: string) => {
    if (busyRef.current) return
    const now = Date.now()
    const last = lastRef.current
    if (last && last.text === text && now - last.at < SAME_QR_WINDOW_MS) return
    busyRef.current = true
    lastRef.current = { text, at: now }

    let out: ScanOutcome
    try {
      const res = await authFetch('/api/tickets/checker/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qr: text }),
      })
      if (res.status === 401) { await signOut('Your session ended. Enter your email to sign in again.'); return }
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        out = { kind: 'ERROR', message: d.error || 'Could not check this ticket. Scan again.' }
        lastRef.current = null // allow an immediate retry of the same code
      } else {
        out = { kind: d.result, message: d.message, tier: d.ticket?.tierName, holder: d.ticket?.holder, at: d.ticket?.checkedInAt }
      }
    } catch {
      out = { kind: 'ERROR', message: 'No connection. Scan again when you are back online.' }
      lastRef.current = null
    }
    beep(out.kind === 'OK')
    setOutcome(out)
    refresh()
    if (resumeTimer.current) clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(resume, AUTO_RESUME_MS)
  }, [authFetch, refresh, resume, signOut])

  /* ---------- screens ---------- */

  if (phase === 'loading') {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-neutral-400" aria-label="Loading" />
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <XCircle className="h-14 w-14 text-red-500" />
        <h1 className="text-2xl font-bold">Link not valid</h1>
        <p className="text-neutral-300">{notice || 'This check-in link is not valid or has been replaced. Ask the event host to send you a new one.'}</p>
      </div>
    )
  }

  if (phase === 'login') {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-5 py-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-800 px-3 py-1 text-sm text-neutral-300">
            <ScanLine className="h-4 w-4" /> Door check-in
          </div>
          <h1 className="text-3xl font-extrabold leading-tight">{event?.name ?? 'Event'}</h1>
          {event?.venue && <p className="flex items-center gap-1.5 text-neutral-400"><MapPin className="h-4 w-4" />{event.venue}</p>}
        </div>

        {notice && (
          <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0" /><p>{notice}</p>
          </div>
        )}

        <form onSubmit={submitLogin} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-lg font-medium">Enter the email this link was sent to</span>
            <input
              type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" required
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              className="h-14 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-lg text-white placeholder-neutral-500 outline-none focus:border-white"
            />
          </label>
          {loginError && <p role="alert" className="rounded-xl bg-red-950 p-3 text-red-200">{loginError}</p>}
          <button
            type="submit" disabled={loggingIn || !email.trim()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-white text-lg font-bold text-black disabled:opacity-50"
          >
            {loggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}
            Continue
          </button>
        </form>
      </div>
    )
  }

  // scanner
  const theme = outcome ? THEME[outcome.kind] : null
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{event?.name}</h1>
          {event?.venue && <p className="truncate text-sm text-neutral-400">{event.venue}</p>}
        </div>
        <button onClick={() => signOut()} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-neutral-800 px-3 text-sm" aria-label="Sign out">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-neutral-900 p-4">
          <p className="text-3xl font-extrabold tabular-nums">{stats ? `${stats.checkedIn}/${stats.total}` : '-'}</p>
          <p className="text-sm text-neutral-400">Checked in</p>
        </div>
        <div className="rounded-2xl bg-neutral-900 p-4">
          <p className="text-3xl font-extrabold tabular-nums">{stats?.myScans ?? '-'}</p>
          <p className="text-sm text-neutral-400">My scans</p>
        </div>
      </div>

      {!cameraOn ? (
        <button
          onClick={() => { setCameraError(''); setCameraOn(true) }}
          className="flex h-40 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-white text-xl font-bold text-black"
        >
          <Camera className="h-10 w-10" /> Start camera
        </button>
      ) : (
        <ScannerCamera
          active={cameraOn}
          onDecode={handleDecode}
          onError={(m) => { setCameraError(m); setCameraOn(false) }}
        />
      )}
      {cameraError && (
        <p role="alert" className="flex gap-2 rounded-xl bg-red-950 p-3 text-red-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />{cameraError}</p>
      )}
      {cameraOn && <p className="text-center text-sm text-neutral-400">Point the camera at the QR on the guest&apos;s ticket page.</p>}

      <section className="rounded-2xl bg-neutral-900">
        <button onClick={() => setShowLog((v) => !v)} className="flex h-14 w-full items-center justify-between px-4 text-left font-medium">
          <span className="flex items-center gap-2"><History className="h-5 w-5" /> Recent scans</span>
          <span className="text-sm text-neutral-400">{showLog ? 'Hide' : 'Show'}</span>
        </button>
        {showLog && (
          <ul className="divide-y divide-neutral-800 px-4 pb-2">
            {log.length === 0 && <li className="py-4 text-neutral-400">No scans yet.</li>}
            {log.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.holderName || '-'}{r.tierName ? ` · ${r.tierName}` : ''}</p>
                  <p className="text-sm text-neutral-400">{fmtTime(r.createdAt)}{r.mine ? '' : ' · other checker'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${r.result === 'OK' ? 'bg-emerald-600/30 text-emerald-300' : r.result === 'STALE' ? 'bg-amber-600/30 text-amber-300' : 'bg-red-700/30 text-red-300'}`}>
                  {RESULT_LABEL[r.result] ?? r.result}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {outcome && theme && (
        <button
          onClick={resume}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 text-center text-white ${theme.bg}`}
          aria-live="assertive"
        >
          <theme.Icon className="h-28 w-28" strokeWidth={2.2} />
          <p className="text-4xl font-black tracking-tight">{theme.title}</p>
          {outcome.kind === 'OK' && (
            <div className="space-y-1">
              <p className="text-3xl font-bold">{outcome.tier}</p>
              <p className="text-2xl">{outcome.holder}</p>
            </div>
          )}
          {outcome.kind === 'ALREADY_USED' && (
            <div className="space-y-1">
              <p className="text-2xl font-semibold">Used at {fmtTime(outcome.at) || 'an earlier time'}</p>
              {outcome.holder && <p className="text-xl">{outcome.tier} · {outcome.holder}</p>}
            </div>
          )}
          {outcome.kind !== 'OK' && outcome.kind !== 'ALREADY_USED' && <p className="max-w-xs text-xl">{outcome.message}</p>}
          <p className="mt-6 flex items-center gap-2 text-sm opacity-80"><RefreshCw className="h-4 w-4" /> Tap to scan the next ticket</p>
        </button>
      )}
    </div>
  )
}
