'use client'

import { useState } from 'react'
import { Send, Users, Mail, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Heart } from 'lucide-react'
import { adminFetch } from '@/lib/auth-client'
import {
  AdminHeader, AdminPanel, AdminButton,
} from '@/components/admin/AdminUI'
import { DataRow } from '@/components/ui/Shell'

const sampleMessage = `This is a test push notification from BataMart Admin. Please confirm receipt in your browser.`

const GFD_TITLE = "Girlfriend's Day is live 💕"
const GFD_MESSAGE = 'Got something she’d love? List it and tag it "Girlfriend’s Day" so gift shoppers can find it. Selling a package? Describe everything inside the box. Tap for a quick walkthrough.'

const labelClass = 'mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary'
const controlClass =
  'w-full border border-border bg-card px-4 text-[15px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

/** Inline result banner shared by both broadcast panels. */
function StatusBanner({
  kind,
  children,
}: {
  kind: 'success' | 'warning' | 'error'
  children: React.ReactNode
}) {
  const tones = {
    success: 'border-success/25 bg-success/5 text-success',
    warning: 'border-warning/25 bg-warning/5 text-warning',
    error: 'border-danger/25 bg-danger/5 text-danger',
  }
  const Icon = kind === 'success' ? CheckCircle2 : kind === 'warning' ? AlertTriangle : XCircle
  return (
    <div className={`mt-6 flex items-start gap-3 border p-4 text-sm ${tones[kind]}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}

type GfdAnnounceResult = { success: boolean; notified: number; pushDelivered: number; message: string }

function GirlfriendsDayAnnounceCard() {
  const [title, setTitle] = useState(GFD_TITLE)
  const [message, setMessage] = useState(GFD_MESSAGE)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GfdAnnounceResult | null>(null)
  const [error, setError] = useState('')

  const handleSend = async () => {
    if (!confirm('This sends a real push + in-app notification to every active seller right now. Continue?')) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await adminFetch('/api/admin/campaigns/girlfriends-day-announce', {
        method: 'POST',
        body: JSON.stringify({ title, message }),
      })
      const data = await res.json()
      if (res.ok) setResult(data)
      else setError(data.error || 'Failed to send announcement.')
    } catch {
      setError('Unexpected error sending announcement.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="border border-rose-500/25 bg-card">
      <div className="flex items-start gap-4 border-b border-border p-5 sm:p-6">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-rose-500/25 bg-rose-500/5">
          <Heart className="h-4 w-4 text-rose-600" fill="currentColor" strokeWidth={0} />
        </span>
        <div className="min-w-0">
          <p className="ui-eyebrow mb-3">Campaign</p>
          <h2 className="text-lg text-ink">Girlfriend&apos;s Day seller announcement</h2>
          <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-ink-secondary">
            A one-time broadcast to every active seller. Tapping it opens a guided walkthrough of the
            Sell page.
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <label className={labelClass}>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${controlClass} h-12`}
          />
        </div>

        <div>
          <label className={labelClass}>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className={`${controlClass} resize-none py-3.5 leading-relaxed`}
          />
        </div>

        <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-secondary">
            Targets every seller currently in seller mode and not suspended.
          </p>
          <AdminButton
            onClick={handleSend}
            disabled={loading}
            tone="ink"
            className="h-11 flex-shrink-0 px-6"
          >
            {loading ? 'Sending…' : 'Send announcement'}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </AdminButton>
        </div>

        {error && <StatusBanner kind="error">{error}</StatusBanner>}
        {result && <StatusBanner kind="success">{result.message}</StatusBanner>}
      </div>
    </section>
  )
}

type AdminPushResult = {
  success: boolean
  message: string
  attempted: number
  delivered: number
  target: 'all' | 'user'
  targetedEmail?: string
  userSubscriptionCount?: number
  totalSubscribers?: number
}

export default function AdminPushPage() {
  const [title, setTitle] = useState('BataMart test notification')
  const [message, setMessage] = useState(sampleMessage)
  const [target, setTarget] = useState<'all' | 'user'>('all')
  const [email, setEmail] = useState('')
  const [url, setUrl] = useState('/')
  const [status, setStatus] = useState<{ kind: 'success' | 'warning' | 'error'; text: string } | null>(null)
  const [result, setResult] = useState<AdminPushResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    setStatus(null)
    setResult(null)
    setLoading(true)

    try {
      const body = { title, message, target, email: target === 'user' ? email : undefined, url }
      const res = await adminFetch('/api/admin/push', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setStatus(data.success ? { kind: 'success', text: data.message } : { kind: 'warning', text: data.message })
      } else {
        setStatus({ kind: 'error', text: data.error || 'Failed to send push notification.' })
      }
    } catch (error) {
      console.error(error)
      setStatus({ kind: 'error', text: 'Unexpected error sending push notification.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <AdminHeader
        eyebrow="Broadcast"
        title="Push notifications"
        description="Send a push to everyone, or to a single account, to verify delivery end to end."
      />

      <GirlfriendsDayAnnounceCard />

      <AdminPanel title="Send a push">
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${controlClass} h-12`}
              />
            </div>

            <div>
              <label className={labelClass}>Redirect URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={`${controlClass} h-12`}
                placeholder="/"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className={`${controlClass} resize-none py-3.5 leading-relaxed`}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className={labelClass}>Target</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTarget('all')}
                  data-active={target === 'all'}
                  className="ui-chip h-11 flex-1 justify-center"
                >
                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                  All users
                </button>
                <button
                  type="button"
                  onClick={() => setTarget('user')}
                  data-active={target === 'user'}
                  className="ui-chip h-11 flex-1 justify-center"
                >
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Single user
                </button>
              </div>
            </div>

            {target === 'user' && (
              <div>
                <label className={labelClass}>User email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${controlClass} h-12`}
                  placeholder="user@example.com"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[52ch] text-sm text-ink-secondary">
              Only reaches users with an active push subscription — everyone else is skipped
              silently.
            </p>
            <AdminButton
              onClick={handleSend}
              disabled={loading}
              tone="ink"
              icon={Send}
              className="h-11 flex-shrink-0 px-6"
            >
              {loading ? 'Sending…' : 'Send push'}
            </AdminButton>
          </div>

          {status && <StatusBanner kind={status.kind}>{status.text}</StatusBanner>}

          {result && (
            <div className="ui-divide border border-border">
              {result.targetedEmail && (
                <DataRow label="Targeted email" value={result.targetedEmail} className="px-4" />
              )}
              <DataRow
                label="Target"
                value={result.target === 'all' ? 'All users' : 'Single user'}
                className="px-4"
              />
              <DataRow label="Attempted" value={result.attempted} className="px-4" />
              <DataRow label="Delivered" value={result.delivered} emphasis className="px-4" />
              {typeof result.userSubscriptionCount === 'number' && (
                <DataRow
                  label="User subscriptions"
                  value={result.userSubscriptionCount}
                  className="px-4"
                />
              )}
              {typeof result.totalSubscribers === 'number' && (
                <DataRow
                  label="Subscribed users"
                  value={result.totalSubscribers}
                  className="px-4"
                />
              )}
            </div>
          )}
        </div>
      </AdminPanel>
    </div>
  )
}
