'use client'

import { useState } from 'react'
import { Send, Users, Mail, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Heart } from 'lucide-react'
import { adminFetch } from '@/lib/auth-client'

const sampleMessage = `This is a test push notification from BATAMART Admin. Please confirm receipt in your browser.`

const GFD_TITLE = "Girlfriend's Day is live 💕"
const GFD_MESSAGE = 'Got something she’d love? List it and tag it "Girlfriend’s Day" so gift shoppers can find it. Selling a package? Describe everything inside the box. Tap for a quick walkthrough.'

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
    <div className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-rose-50 to-white p-8 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-600">
          <Heart className="h-5 w-5" fill="currentColor" strokeWidth={0} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-ink">Girlfriend's Day Seller Announcement</h2>
          <p className="text-sm text-ink-secondary">
            One-time broadcast to every active seller. Tapping it opens a guided walkthrough to the Sell page.
          </p>
        </div>
      </div>

      <label className="block mb-4">
        <p className="text-sm text-ink-secondary mb-2">Title</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-ink outline-none focus:border-rose-400"
        />
      </label>
      <label className="block">
        <p className="text-sm text-ink-secondary mb-2">Message</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-ink outline-none focus:border-rose-400"
        />
      </label>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-secondary">Targets every seller currently in seller mode, active (not suspended).</p>
        <button
          type="button"
          onClick={handleSend}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Sending…' : 'Send Announcement'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mt-6 flex items-center gap-2.5 rounded-3xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}
      {result && (
        <div className="mt-6 flex items-center gap-2.5 rounded-3xl border border-success/30 bg-success/10 p-4 text-sm font-medium text-success">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {result.message}
        </div>
      )}
    </div>
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
  const [title, setTitle] = useState('BATAMART Test Notification')
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
      <GirlfriendsDayAnnounceCard />

      <div className="rounded-3xl border border-border bg-surface p-8 shadow-soft shadow-black/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-2xl bg-danger/10 text-danger p-3">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ink">Send Push Notification</h1>
            <p className="text-sm text-ink-secondary">Test push delivery to your users from the admin panel.</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <p className="text-sm text-ink-secondary mb-2">Title</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-ink outline-none focus:border-danger"
            />
          </label>

          <label className="block">
            <p className="text-sm text-ink-secondary mb-2">Redirect URL</p>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-ink outline-none focus:border-danger"
              placeholder="/"
            />
          </label>
        </div>

        <label className="block">
          <p className="text-sm text-ink-secondary mb-2">Message</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-ink outline-none focus:border-danger"
          />
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-ink-secondary">Target</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTarget('all')}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${target === 'all'
                  ? 'bg-danger/100 text-ink'
                  : 'bg-white text-ink-secondary hover:bg-surface'
                }`}
              >
                <Users className="inline mr-2 h-4 w-4" /> All users
              </button>
              <button
                type="button"
                onClick={() => setTarget('user')}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${target === 'user'
                  ? 'bg-danger/100 text-ink'
                  : 'bg-white text-ink-secondary hover:bg-surface'
                }`}
              >
                <Mail className="inline mr-2 h-4 w-4" /> Single user
              </button>
            </div>
          </div>

          {target === 'user' && (
            <label className="block">
              <p className="text-sm text-ink-secondary mb-2">User Email</p>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-ink outline-none focus:border-danger"
                placeholder="user@example.com"
              />
            </label>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-ink-secondary">
            <p className="font-medium">Note:</p>
            <p>Push notifications will be delivered only to users with active subscriptions.</p>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-danger px-6 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Sending…' : 'Send Push'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {status && (
          <div className={`mt-6 flex items-center gap-2.5 rounded-3xl border p-4 text-sm font-medium ${
            status.kind === 'success' ? 'border-success/30 bg-success/10 text-success'
              : status.kind === 'warning' ? 'border-warning/30 bg-warning/10 text-warning'
                : 'border-danger/30 bg-danger/10 text-danger'
          }`}>
            {status.kind === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : status.kind === 'warning' ? <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                : <XCircle className="w-4 h-4 flex-shrink-0" />}
            {status.text}
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-3xl border border-border bg-surface p-4 text-sm text-ink-secondary">
            {result.targetedEmail && (
              <p>
                <span className="font-medium text-ink">Targeted email:</span> {result.targetedEmail}
              </p>
            )}
            <p>
              <span className="font-medium text-ink">Target:</span> {result.target === 'all' ? 'All users' : 'Single user'}
            </p>
            <p>
              <span className="font-medium text-ink">Attempted:</span> {result.attempted}
            </p>
            <p>
              <span className="font-medium text-ink">Delivered:</span> {result.delivered}
            </p>
            {typeof result.userSubscriptionCount === 'number' && (
              <p>
                <span className="font-medium text-ink">User subscriptions:</span> {result.userSubscriptionCount}
              </p>
            )}
            {typeof result.totalSubscribers === 'number' && (
              <p>
                <span className="font-medium text-ink">Subscribed users:</span> {result.totalSubscribers}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
