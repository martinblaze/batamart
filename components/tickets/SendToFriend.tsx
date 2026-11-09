'use client'

// "Send to a friend": warn -> username -> confirm the person -> transfer.
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, Send, UserCheck, UserX } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'

type Step = 'warn' | 'username' | 'confirm' | 'sending'

export default function SendToFriend({
  ticketId, eventName, tierName, onSent,
}: {
  ticketId: string
  eventName: string
  tierName: string
  onSent: (toUsername: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('warn')
  const [username, setUsername] = useState('')
  const [friendName, setFriendName] = useState('')
  const [error, setError] = useState('')
  const [looking, setLooking] = useState(false)
  const busy = useRef(false)

  const reset = () => { setStep('warn'); setUsername(''); setFriendName(''); setError(''); setLooking(false) }
  const close = () => { if (step === 'sending') return; setOpen(false); reset() }

  const headers = (): Record<string, string> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const lookup = async () => {
    const clean = username.trim().replace(/^@/, '').toLowerCase()
    if (!clean) { setError('Enter your friend\'s username.'); return }
    setLooking(true); setError('')
    try {
      const res = await fetch(`/api/tickets/lookup-user?username=${encodeURIComponent(clean)}`, { headers: headers() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Could not look that up. Try again.'); return }
      if (data.self) { setError('That is your own username. Enter a friend\'s username.'); return }
      if (!data.found) { setError('No active BataMart user has that username. Check the spelling.'); return }
      setUsername(clean)
      setFriendName(data.name || clean)
      setStep('confirm')
    } catch {
      setError('Could not reach BataMart. Check your connection.')
    } finally {
      setLooking(false)
    }
  }

  const send = async () => {
    if (busy.current) return
    busy.current = true
    setStep('sending'); setError('')
    try {
      const res = await fetch(`/api/tickets/ticket/${ticketId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ toUsername: username }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Could not send the ticket.'); setStep('confirm'); return }
      setOpen(false); reset()
      onSent(data.toUsername || username)
    } catch {
      setError('Could not reach BataMart. Check your connection.')
      setStep('confirm')
    } finally {
      busy.current = false
    }
  }

  useEffect(() => { if (!open) busy.current = false }, [open])

  return (
    <>
      <Button variant="secondary" fullWidth leftIcon={<Send className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Send to a friend
      </Button>

      <Modal open={open} onClose={close} title="Send to a friend">
        <div className="space-y-4">
          {step === 'warn' && (
            <>
              <div className="flex gap-3 border border-warning/40 bg-warning/10 p-3.5">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" strokeWidth={1.75} />
                <div className="text-sm text-ink">
                  <p className="font-semibold">This stops the ticket working for you.</p>
                  <p className="mt-1 text-ink-secondary">
                    Your {tierName} ticket for {eventName} moves to your friend's account and your QR code is
                    deactivated straight away. You cannot take it back.
                  </p>
                </div>
              </div>
              <Button fullWidth onClick={() => setStep('username')} rightIcon={<ArrowRight className="h-4 w-4" />}>I understand, continue</Button>
              <Button fullWidth variant="ghost" onClick={close}>Cancel</Button>
            </>
          )}

          {step === 'username' && (
            <>
              <label className="block">
                <span className="ui-mono ui-mono-sm text-ink-muted">Friend's BataMart username</span>
                <input
                  autoFocus
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') lookup() }}
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  placeholder="e.g. chidi23"
                  className="mt-2 h-12 w-full border border-border bg-card px-4 text-base text-ink outline-none focus:border-primary"
                />
              </label>
              <p className="text-xs text-ink-muted">They need a BataMart account with a username. Tickets cannot be sent to an email address.</p>
              {error && <p className="flex items-start gap-2 text-sm text-danger"><UserX className="mt-0.5 h-4 w-4 flex-shrink-0" />{error}</p>}
              <Button fullWidth isLoading={looking} onClick={lookup}>Find my friend</Button>
              <Button fullWidth variant="ghost" onClick={close}>Cancel</Button>
            </>
          )}

          {(step === 'confirm' || step === 'sending') && (
            <>
              <div className="flex items-center gap-3 border border-border bg-surface p-3.5">
                <UserCheck className="h-6 w-6 flex-shrink-0 text-success" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{friendName}</p>
                  <p className="truncate text-sm text-ink-secondary">@{username}</p>
                </div>
              </div>
              <p className="text-sm text-ink-secondary">
                Send your {tierName} ticket for {eventName} to <strong className="text-ink">@{username}</strong>? Your QR code will stop working.
              </p>
              {error && <p className="flex items-start gap-2 text-sm text-danger"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />{error}</p>}
              <Button fullWidth isLoading={step === 'sending'} loadingText="Sending" onClick={send} leftIcon={<Send className="h-4 w-4" />}>
                Yes, send the ticket
              </Button>
              <Button fullWidth variant="ghost" disabled={step === 'sending'} onClick={() => { setStep('username'); setError('') }}>Not them, go back</Button>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}

export function SentNotice({ toUsername }: { toUsername: string }) {
  return (
    <div className="flex items-start gap-3 border border-success/40 bg-success/10 p-4">
      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" strokeWidth={1.75} />
      <div className="text-sm">
        <p className="font-semibold text-ink">Ticket sent to @{toUsername}</p>
        <p className="mt-0.5 text-ink-secondary">It now belongs to them and your QR code no longer works.</p>
      </div>
    </div>
  )
}
