'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Shell, PageHeader } from '@/components/ui/Shell'
import { authFetch } from '@/lib/auth-client'

type Prefs = { pushEnabled: boolean; emailEnabled: boolean; reminders: boolean; deals: boolean; marketing: boolean }

const ROWS: { key: keyof Prefs; title: string; hint: string }[] = [
  { key: 'pushEnabled', title: 'Push notifications', hint: 'Alerts on your phone and browser.' },
  { key: 'emailEnabled', title: 'Emails', hint: 'Summaries and updates sent to your inbox.' },
  { key: 'reminders', title: 'Reminders', hint: 'Delivery day, handover and review reminders.' },
  { key: 'deals', title: 'Flash and hot deals', hint: 'New deals and trending items on campus.' },
  { key: 'marketing', title: 'Tips and offers', hint: 'Weekly digest, referral nudges and campaigns.' },
]

export default function NotificationSettingsPage() {
  const router = useRouter()
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push('/login?redirect=/notification-settings')
      return
    }
    authFetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(d => setPrefs(d.preferences))
      .catch(() => setError('Could not load your settings.'))
  }, [router])

  const toggle = async (key: keyof Prefs) => {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(key)
    setError('')
    try {
      const res = await authFetch('/api/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ [key]: next[key] }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setPrefs(prefs)
      setError('Could not save that change. Try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface pb-16">
      <Shell width="narrow" className="pt-10">
        <PageHeader
          eyebrow="Settings"
          title="Notifications"
          description="Order, payment and security messages always reach you. Choose what else you want to hear about."
        />
        {error && <p className="mt-6 text-sm text-danger">{error}</p>}
        {!prefs ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-ink-muted" /></div>
        ) : (
          <div className="ui-panel mt-8 divide-y divide-border p-0">
            {ROWS.map(row => (
              <button
                key={row.key}
                onClick={() => toggle(row.key)}
                disabled={saving === row.key}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span>
                  <span className="block text-sm font-medium text-ink">{row.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-secondary">{row.hint}</span>
                </span>
                <span
                  aria-hidden
                  className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors ${prefs[row.key] ? 'bg-ink' : 'bg-border'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${prefs[row.key] ? 'translate-x-5' : 'translate-x-1'}`} />
                </span>
              </button>
            ))}
          </div>
        )}
      </Shell>
    </div>
  )
}
