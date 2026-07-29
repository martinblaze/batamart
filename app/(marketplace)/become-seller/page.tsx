'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, Crown, Lock, ClipboardList, Banknote,
  ShoppingBag, PartyPopper,
} from 'lucide-react'

export default function BecomeSellerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
    } else {
      setCheckingAuth(false)
    }
  }, [])

  const handleBecomeSeller = async () => {
    setError('')
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/auth/become-seller', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to become seller')
      }

      localStorage.setItem('userRole', 'SELLER')
      window.dispatchEvent(new Event('auth-change'))
      setDone(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-border p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <PartyPopper className="w-7 h-7 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-semibold text-ink mb-3">You&apos;re a seller</h1>
          <p className="text-ink-secondary text-sm mb-8">
            You can now list products. Set a withdrawal PIN in your wallet to enable payouts.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/sell')}
              className="w-full bg-primary text-white h-11 rounded-lg font-medium hover:brightness-95 transition-all"
            >
              List my first product
            </button>
            <button
              onClick={() => router.push('/wallet')}
              className="w-full border border-border text-ink-secondary h-11 rounded-lg font-medium hover:bg-surface transition"
            >
              Set withdrawal PIN
            </button>
            <button
              onClick={() => router.push('/marketplace')}
              className="w-full border border-border text-ink-secondary h-11 rounded-lg font-medium hover:bg-surface transition"
            >
              Go to marketplace
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-primary hover:underline mb-6 inline-flex items-center gap-1.5 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} /> Back to home
        </Link>

        <div className="bg-white rounded-2xl border border-border p-8">
          <h1 className="text-[28px] font-semibold text-ink mb-2">Become a seller</h1>
          <p className="text-ink-secondary mb-8">Start selling your products to thousands of students on campus</p>

          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="font-semibold text-ink text-[16px] mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" strokeWidth={1.75} /> Seller benefits
              </h3>
              <ul className="space-y-3">
                {[
                  { title: 'Earn money', desc: 'Turn unused items into cash' },
                  { title: 'Secure payments', desc: 'Escrow system protects your earnings' },
                  { title: 'Built-in delivery', desc: 'Rider network handles logistics' },
                  { title: 'Trust system', desc: 'Build reputation with ratings' },
                  { title: 'No listing fees', desc: 'Completely free to list products' },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" strokeWidth={1.75} />
                    <span className="text-sm text-ink-secondary"><strong className="text-ink font-medium">{item.title}:</strong> {item.desc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-surface border border-border rounded-xl p-6">
              <h3 className="font-semibold text-ink text-[16px] mb-3 flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" strokeWidth={1.75} /> PIN security
              </h3>
              <p className="text-ink-secondary text-sm mb-3">
                To protect your earnings, BataMart requires a 6-digit withdrawal PIN.
                Your PIN will be required every time you request a withdrawal — so only you can access your money.
              </p>
              <ul className="text-xs text-ink-secondary space-y-1">
                <li>Set your PIN anytime from your wallet page</li>
                <li>Change it whenever you want</li>
                <li>PIN is hashed and stored securely — never visible to anyone</li>
              </ul>
            </div>

            <div className="bg-warning/10 border border-warning/30 rounded-xl p-6">
              <h3 className="font-semibold text-warning text-[16px] mb-4 flex items-center gap-2">
                <ClipboardList className="w-5 h-5" strokeWidth={1.75} /> Seller requirements
              </h3>
              <ul className="space-y-2 text-ink-secondary text-sm">
                <li>You must be a verified student</li>
                <li>Products must comply with campus policies</li>
                <li>You need to complete your profile with delivery address</li>
                <li>You&apos;re responsible for accurate product descriptions</li>
              </ul>
            </div>

            <div className="bg-success/10 border border-success/30 rounded-xl p-6">
              <h3 className="font-semibold text-success text-[16px] mb-4 flex items-center gap-2">
                <Banknote className="w-5 h-5" strokeWidth={1.75} /> How it works
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { step: 1, title: 'List your product', desc: 'Add photos, description, price' },
                  { step: 2, title: 'Buyer orders', desc: 'Payment held in escrow' },
                  { step: 3, title: 'Get paid', desc: 'Receive payment after delivery' },
                ].map((s) => (
                  <div key={s.step} className="text-center">
                    <div className="w-10 h-10 bg-success/10 text-success rounded-full flex items-center justify-center text-lg font-semibold mx-auto mb-3">{s.step}</div>
                    <p className="font-medium text-ink text-sm">{s.title}</p>
                    <p className="text-sm text-ink-secondary mt-1">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-border">
              <button
                onClick={handleBecomeSeller}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-white h-11 rounded-lg font-medium transition-all hover:brightness-95 disabled:opacity-50"
              >
                <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />
                {loading ? 'Processing…' : 'Become a seller'}
              </button>

              <p className="text-center text-ink-secondary text-sm mt-4">
                By becoming a seller, you agree to our{' '}
                <Link href="/terms/sellers" className="text-primary hover:underline">
                  Seller terms & conditions
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
