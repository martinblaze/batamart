'use client'

import { useState } from 'react'
import { Send, Users, Mail, ArrowRight, CheckCircle2, AlertTriangle, XCircle, Heart, Sparkles, Loader2 } from 'lucide-react'
import { adminFetch } from '@/lib/auth-client'
import {
  AdminHeader, AdminPanel, AdminButton,
} from '@/components/admin/AdminUI'
import { DataRow } from '@/components/ui/Shell'
import { renderEmail } from '@/lib/notify/email'
import { autoDraftEmail } from '@/lib/notify/email-drafts'
import { EMAIL_TOPICS, EMAIL_TOPIC_GROUPS } from '@/lib/notify/email-topics'

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
  target: 'all' | 'user'
  targetedEmail?: string
  audience: number
  attempted: number
  reached: number
  webPush: number
  appPush: number
  email: number
  inApp: number
  alreadyReceived: number
  optedOut: number
  remaining: number
  broadcastId: string
  channel: 'push' | 'email' | 'both'
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
  const [channel, setChannel] = useState<'push' | 'email' | 'both'>('both')
  // Email fields follow the push text until you edit them.
  const [emailSubject, setEmailSubject] = useState<string | null>(null)
  const [emailHeading, setEmailHeading] = useState<string | null>(null)
  const [emailBody, setEmailBody] = useState<string | null>(null)
  const [emailButton, setEmailButton] = useState<string | null>(null)
  // '' means detect the topic from the text automatically.
  const [topicKey, setTopicKey] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [draftNote, setDraftNote] = useState('')

  // Writes the full email from the short text above; the result stays editable.
  const draftEmail = async () => {
    setDrafting(true)
    setDraftNote('')
    try {
      const res = await adminFetch('/api/admin/push/draft-email', {
        method: 'POST',
        body: JSON.stringify({ title, message, url }),
      })
      const data = await res.json()
      if (!res.ok) { setDraftNote(data.error || 'Could not write the email.'); return }
      setEmailSubject(data.draft.subject)
      setEmailHeading(data.draft.heading)
      setEmailBody(data.draft.body)
      setEmailButton(data.draft.button)
      setDraftNote(data.note || 'Written for you. Read it through and edit anything you like before sending.')
    } catch {
      setDraftNote('Could not write the email. Check your connection and try again.')
    } finally {
      setDrafting(false)
    }
  }

  // Written automatically from the push text, live. Editing a field takes it over.
  const auto = autoDraftEmail({ title, message, url, topic: topicKey || undefined })
  const subjectValue = emailSubject ?? auto.subject
  const headingValue = emailHeading ?? auto.heading
  const bodyValue = emailBody ?? auto.body
  const buttonValue = emailButton ?? auto.button
  const edited = emailSubject !== null || emailHeading !== null || emailBody !== null || emailButton !== null
  const resetToAuto = () => {
    setEmailSubject(null); setEmailHeading(null); setEmailBody(null); setEmailButton(null); setDraftNote('')
  }
  const previewHtml = renderEmail({
    preheader: message,
    greeting: 'Hi Chidi,',
    heading: headingValue,
    lines: bodyValue.split(/\n\s*\n/).map(p => p.trim().replace(/\n/g, ' ')).filter(Boolean),
    ctaLabel: buttonValue || 'Open BataMart',
    ctaUrl: url || '/',
    signoff: 'The BataMart team',
    showPreferences: true,
  })
  // Kept while a send is unfinished, so sending again continues instead of repeating.
  const [retryId, setRetryId] = useState<string | null>(null)

  const handleSend = async () => {
    setStatus(null)
    setResult(null)
    setLoading(true)

    try {
      const broadcastId = retryId || crypto.randomUUID()
      const body = { title, message, target, email: target === 'user' ? email : undefined, url, channel, broadcastId, emailSubject: subjectValue, emailHeading: headingValue, emailBody: bodyValue, emailButton: buttonValue }
      const res = await adminFetch('/api/admin/push', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setRetryId(data.remaining > 0 ? data.broadcastId : null)
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

          {channel !== 'push' && (
            <div className="space-y-5 border border-border bg-surface/50 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={labelClass}>The email</p>
                  <p className="max-w-[56ch] text-sm text-ink-secondary">
                    Written for you automatically from the title and message above, and it updates as you type.
                    It opens with the person&apos;s first name, ends with a button to your redirect link, and closes
                    with a sign-off. Change any field below to take it over.
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-wrap gap-2">
                  {edited && (
                    <AdminButton onClick={resetToAuto} tone="default" className="h-11 px-4">Back to automatic</AdminButton>
                  )}
                  <AdminButton onClick={draftEmail} disabled={drafting || (!title && !message)} tone="default" icon={drafting ? Loader2 : Sparkles} className="h-11 px-4">
                    {drafting ? 'Writing…' : 'Rewrite with AI (optional)'}
                  </AdminButton>
                </div>
              </div>
              {draftNote && <p className="text-sm text-ink-secondary">{draftNote}</p>}
              <div>
                <label className={labelClass}>Topic</label>
                <select
                  value={topicKey}
                  onChange={(e) => { setTopicKey(e.target.value); setEmailBody(null); setEmailButton(null) }}
                  className={`${controlClass} h-12`}
                >
                  <option value="">Detect automatically (now: {auto.topicLabel})</option>
                  {EMAIL_TOPIC_GROUPS.map(group => (
                    <optgroup key={group} label={group}>
                      {EMAIL_TOPICS.filter(t => t.group === group).map(t => (
                        <option key={t.key} value={t.key}>{t.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-2 text-xs text-ink-secondary">
                  The topic decides the extra paragraphs and the button text. Pick one yourself if the automatic choice is not right.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Subject line</label>
                  <input value={subjectValue} onChange={(e) => setEmailSubject(e.target.value)} className={`${controlClass} h-12`} />
                </div>
                <div>
                  <label className={labelClass}>Button text</label>
                  <input value={buttonValue} onChange={(e) => setEmailButton(e.target.value)} className={`${controlClass} h-12`} placeholder="Set my username" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Heading</label>
                <input value={headingValue} onChange={(e) => setEmailHeading(e.target.value)} className={`${controlClass} h-12`} />
              </div>
              <div>
                <label className={labelClass}>Body (leave a blank line between paragraphs)</label>
                <textarea
                  value={bodyValue}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={7}
                  className={`${controlClass} resize-y py-3.5 leading-relaxed`}
                />
              </div>
              <div>
                <p className={labelClass}>Preview</p>
                <iframe title="Email preview" srcDoc={previewHtml} className="h-[620px] w-full border border-border bg-white" />
              </div>
            </div>
          )}

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
            <div className="max-w-[56ch] space-y-3">
              <div>
                <p className={labelClass}>Send as</p>
                <div className="flex gap-2">
                  {([['push', 'Push'], ['email', 'Email'], ['both', 'Both']] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChannel(value)}
                      data-active={channel === value}
                      className="ui-chip h-11 flex-1 justify-center"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-ink-secondary">
                {channel === 'push' && 'Browser push, app push and the in-app bell. No email.'}
                {channel === 'email' && 'Email only. No push and nothing in the bell.'}
                {channel === 'both' && 'Browser push, app push, the in-app bell and email.'}{' '}
                Reaches every user, not just people with push turned on. People who switched off
                offers are skipped, and sending the same broadcast again never repeats it to anyone.
              </p>
            </div>
            <AdminButton
              onClick={handleSend}
              disabled={loading}
              tone="ink"
              icon={Send}
              className="h-11 flex-shrink-0 px-6"
            >
              {loading ? 'Sending…' : retryId ? 'Continue sending' : 'Send'}
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
              <DataRow label="Audience" value={result.audience} className="px-4" />
              <DataRow label="Reached" value={result.reached} emphasis className="px-4" />
              {result.channel !== 'email' && <DataRow label="Browser push" value={result.webPush} className="px-4" />}
              {result.channel !== 'email' && <DataRow label="App push" value={result.appPush} className="px-4" />}
              {result.channel !== 'push' && <DataRow label="Email" value={result.email} className="px-4" />}
              {result.channel !== 'email' && <DataRow label="In the bell" value={result.inApp} className="px-4" />}
              {result.optedOut > 0 && <DataRow label="Opted out of offers" value={result.optedOut} className="px-4" />}
              {result.alreadyReceived > 0 && <DataRow label="Already received" value={result.alreadyReceived} className="px-4" />}
              {result.remaining > 0 && <DataRow label="Still to send" value={result.remaining} className="px-4" />}
            </div>
          )}
        </div>
      </AdminPanel>
    </div>
  )
}
