'use client'

import { useState } from 'react'
import { Send, Users, Mail, ArrowRight } from 'lucide-react'
import { adminFetch } from '@/lib/auth-client'

const sampleMessage = `This is a test push notification from BATAMART Admin. Please confirm receipt in your browser.`

export default function AdminPushPage() {
  const [title, setTitle] = useState('BATAMART Test Notification')
  const [message, setMessage] = useState(sampleMessage)
  const [target, setTarget] = useState<'all' | 'user'>('all')
  const [email, setEmail] = useState('')
  const [url, setUrl] = useState('/')
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    setStatus(null)
    setLoading(true)

    try {
      const body = { title, message, target, email: target === 'user' ? email : undefined, url }
      const res = await adminFetch('/api/admin/push', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (res.ok) {
        setStatus(`✅ ${data.message} Attempted: ${data.attempted}, Delivered: ${data.delivered}`)
      } else {
        setStatus(`❌ ${data.error || 'Failed to send push notification.'}`)
      }
    } catch (error) {
      console.error(error)
      setStatus('❌ Unexpected error sending push notification.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-gray-700 bg-gray-900 p-8 shadow-xl shadow-black/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-2xl bg-red-500/10 text-red-400 p-3">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Send Push Notification</h1>
            <p className="text-sm text-gray-400">Test push delivery to your users from the admin panel.</p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <p className="text-sm text-gray-400 mb-2">Title</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-red-500"
            />
          </label>

          <label className="block">
            <p className="text-sm text-gray-400 mb-2">Redirect URL</p>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-2xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-red-500"
              placeholder="/"
            />
          </label>
        </div>

        <label className="block">
          <p className="text-sm text-gray-400 mb-2">Message</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full rounded-3xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-red-500"
          />
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Target</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTarget('all')}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${target === 'all'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Users className="inline mr-2 h-4 w-4" /> All users
              </button>
              <button
                type="button"
                onClick={() => setTarget('user')}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ${target === 'user'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Mail className="inline mr-2 h-4 w-4" /> Single user
              </button>
            </div>
          </div>

          {target === 'user' && (
            <label className="block">
              <p className="text-sm text-gray-400 mb-2">User Email</p>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:border-red-500"
                placeholder="user@example.com"
              />
            </label>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-400">
            <p className="font-medium">Note:</p>
            <p>Push notifications will be delivered only to users with active subscriptions.</p>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-gray-700"
          >
            {loading ? 'Sending…' : 'Send Push'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {status && (
          <div className="mt-6 rounded-3xl border border-gray-700 bg-gray-950/40 p-4 text-sm text-gray-200">
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
