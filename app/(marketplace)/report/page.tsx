'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    AlertCircle, Link as LinkIcon, User, Package, Shield, Clock, MessageSquare, CheckCircle,
    Ban, FileText, Star, Pin, Frown, type LucideIcon,
} from 'lucide-react'
import { Shell, PageHeader, Skeleton } from '@/components/ui/Shell'
import { Button } from '@/components/ui/button'

const labelClass =
    'mb-2 block font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary'
const controlClass =
    'w-full border border-border bg-card text-[15px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink-muted/80 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15'

// Separate the component that uses useSearchParams
function ReportFormContent() {
    const router = useRouter()
    const searchParams = typeof window === 'undefined'
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search)

    // Get pre-filled data from URL params
    const type = searchParams.get('type') || ''
    const productId = searchParams.get('productId')
    const orderId = searchParams.get('orderId')
    const productName = searchParams.get('productName')
    const riderName = searchParams.get('riderName')

    const [formData, setFormData] = useState({
        type: type || '',
        reason: '',
        description: '',
        evidence: [] as string[],
        reportedProductId: productId || '',
        reportedOrderId: orderId || '',
        productLink: '',
        riderName: riderName || ''
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [submitted, setSubmitted] = useState(false)

    const reportReasons: Record<string, { value: string; label: string; icon: LucideIcon }[]> = {
        PRODUCT: [
            { value: 'FAKE_PRODUCT', label: 'Fake or counterfeit product', icon: Ban },
            { value: 'WRONG_DESCRIPTION', label: 'Misleading description', icon: FileText },
            { value: 'POOR_QUALITY', label: 'Poor quality', icon: Star },
            { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content', icon: AlertCircle },
            { value: 'OTHER', label: 'Other', icon: Pin }
        ],
        RIDER: [
            { value: 'DELAYED_DELIVERY', label: 'Delayed delivery', icon: Clock },
            { value: 'RUDE_BEHAVIOR', label: 'Rude or unprofessional', icon: Frown },
            { value: 'DAMAGED_PRODUCT', label: 'Damaged product', icon: Package },
            { value: 'OTHER', label: 'Other', icon: Pin }
        ]
    }

    const currentReasons = reportReasons[formData.type as keyof typeof reportReasons] || []

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        // Validate based on report type
        if (formData.type === 'RIDER' && !formData.riderName.trim()) {
            setError('Please provide the rider\'s name')
            setLoading(false)
            return
        }

        if (formData.type === 'PRODUCT' && !formData.productLink.trim()) {
            setError('Please provide the product link')
            setLoading(false)
            return
        }

        try {
            const token = localStorage.getItem('token')
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            })

            const data = await response.json()

            if (response.ok) {
                // Confirm in place rather than through a blocking alert(), then
                // hand off to the orders list.
                setSubmitted(true)
                setTimeout(() => router.push('/orders'), 2000)
            } else {
                setError(data.error || 'Failed to submit report')
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
            console.error('Report submission error:', err)
        } finally {
            setLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-surface pb-20">
                <Shell width="narrow" className="pt-16 sm:pt-24">
                    <div className="flex flex-col items-center border border-border bg-card px-6 py-20 text-center">
                        <CheckCircle className="mb-6 h-10 w-10 text-success" strokeWidth={1.5} />
                        <p className="ui-eyebrow mb-4 justify-center before:hidden after:hidden">Received</p>
                        <h1 className="text-[clamp(1.5rem,4vw,2rem)] leading-tight text-ink">
                            Report submitted
                        </h1>
                        <p className="mt-3 max-w-[44ch] text-sm leading-relaxed text-ink-secondary">
                            Our team reviews every report within 24–48 hours and will let you know the
                            outcome. Taking you back to your orders…
                        </p>
                    </div>
                </Shell>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-surface pb-20">
            <Shell className="pt-8 sm:pt-12">
                <PageHeader
                    eyebrow="Trust & safety"
                    back={{ href: '/orders', label: 'All orders' }}
                    title={
                        <>
                            Report an <span className="ui-serif">issue</span>
                        </>
                    }
                    description="Confidential, and reviewed by a real person within 24–48 hours. The more specific you are, the faster it resolves."
                />

                <div className="mt-10 grid gap-10 lg:grid-cols-3 lg:gap-8">
                    {/* ── Main form ─────────────────────────────────────────── */}
                    <div className="lg:col-span-2">
                        {(productName || riderName) && (
                            <div className="mb-6 flex items-start gap-3 border border-border bg-card p-4">
                                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                                <p className="text-sm text-ink">
                                    {productName && <>Reporting product: <span className="font-medium">{productName}</span></>}
                                    {riderName && <>Reporting rider: <span className="font-medium">{riderName}</span></>}
                                </p>
                            </div>
                        )}

                        {error && (
                            <div className="mb-6 flex items-start gap-3 border border-danger/25 bg-danger/5 p-4">
                                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" strokeWidth={1.75} />
                                <p className="text-sm text-danger">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-9">
                            {/* Report Type Selection */}
                            <section>
                                <p className="ui-eyebrow mb-6">What are you reporting?</p>
                                <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
                                    {[
                                        { key: 'PRODUCT', icon: Package, title: 'Product', sub: 'A listing or item problem' },
                                        { key: 'RIDER', icon: User, title: 'Rider', sub: 'A delivery problem' },
                                    ].map(({ key, icon: Icon, title, sub }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            aria-pressed={formData.type === key}
                                            onClick={() => setFormData({
                                                ...formData,
                                                type: key,
                                                reason: '',
                                                riderName: '',
                                                productLink: ''
                                            })}
                                            className={`p-5 text-left transition-colors duration-300 ${
                                                formData.type === key
                                                    ? 'bg-ink text-background'
                                                    : 'bg-card text-ink hover:bg-surface'
                                            }`}
                                        >
                                            <Icon
                                                className={`h-5 w-5 ${formData.type === key ? 'text-white' : 'text-ink-muted'}`}
                                                strokeWidth={1.5}
                                            />
                                            <p className="mt-4 text-sm font-medium">{title}</p>
                                            <p className={`mt-1 text-xs ${formData.type === key ? 'text-white/65' : 'text-ink-secondary'}`}>
                                                {sub}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {/* Dynamic Input Fields */}
                            {formData.type === 'RIDER' && (
                                <section>
                                    <label className={labelClass}>Rider&apos;s name *</label>
                                    <div className="relative">
                                        <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} />
                                        <input
                                            type="text"
                                            value={formData.riderName}
                                            onChange={(e) => setFormData({ ...formData, riderName: e.target.value })}
                                            className={`${controlClass} h-12 pl-11 pr-4`}
                                            placeholder="Their full name, as shown on the order"
                                            required
                                        />
                                    </div>
                                </section>
                            )}

                            {formData.type === 'PRODUCT' && (
                                <section>
                                    <label className={labelClass}>Product link *</label>
                                    <div className="relative">
                                        <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.75} />
                                        <input
                                            type="url"
                                            value={formData.productLink}
                                            onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                                            className={`${controlClass} h-12 pl-11 pr-4`}
                                            placeholder="https://…"
                                            required
                                        />
                                    </div>
                                </section>
                            )}

                            {/* Reason Selection */}
                            {formData.type && (
                                <section>
                                    <p className="ui-eyebrow mb-6">Main reason</p>
                                    <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
                                        {currentReasons.map((r) => (
                                            <button
                                                key={r.value}
                                                type="button"
                                                aria-pressed={formData.reason === r.value}
                                                onClick={() => setFormData({ ...formData, reason: r.value })}
                                                className={`flex items-center gap-3 p-4 text-left transition-colors duration-300 ${
                                                    formData.reason === r.value
                                                        ? 'bg-ink text-background'
                                                        : 'bg-card text-ink hover:bg-surface'
                                                }`}
                                            >
                                                <r.icon
                                                    className={`h-4 w-4 flex-shrink-0 ${formData.reason === r.value ? 'text-white' : 'text-ink-muted'}`}
                                                    strokeWidth={1.75}
                                                />
                                                <span className="text-sm">{r.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Description */}
                            {formData.type && (
                                <section>
                                    <label className={labelClass}>Describe what happened *</label>
                                    <div className="relative">
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className={`${controlClass} min-h-36 resize-y px-4 py-3.5 leading-relaxed`}
                                            placeholder={
                                                formData.type === 'PRODUCT'
                                                    ? 'What exactly is wrong with the product? How does it differ from the listing? When did you notice?'
                                                    : 'What happened during the delivery? How did the rider behave? When did it happen?'
                                            }
                                            required
                                        />
                                        <MessageSquare className="pointer-events-none absolute right-4 top-4 h-4 w-4 text-ink-muted" strokeWidth={1.75} />
                                    </div>
                                    <p className="mt-2 text-xs text-ink-muted">
                                        Include dates, times and any other detail that helps us verify it.
                                    </p>
                                </section>
                            )}

                            {/* Submit Buttons */}
                            {formData.type && (
                                <div className="flex flex-col gap-3 border-t border-border pt-8 sm:flex-row">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="lg"
                                        onClick={() => router.back()}
                                        disabled={loading}
                                        className="sm:flex-1"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="danger"
                                        size="lg"
                                        isLoading={loading}
                                        loadingText="Submitting…"
                                        disabled={!formData.type || !formData.reason || !formData.description}
                                        className="sm:flex-[2]"
                                    >
                                        Submit report
                                    </Button>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* ── Sidebar ───────────────────────────────────────────── */}
                    <aside className="space-y-6">
                        <section className="ui-panel">
                            <p className="ui-eyebrow mb-6">
                                <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                                What happens next
                            </p>
                            <ol className="space-y-5">
                                {[
                                    { t: 'Submitted', d: 'Your report reaches our queue immediately.' },
                                    { t: 'Reviewed', d: 'A real person reads it within 24–48 hours.' },
                                    { t: 'Acted on', d: 'We take action if a policy was broken.' },
                                    { t: 'You hear back', d: 'We tell you the outcome either way.' },
                                ].map((step, i) => (
                                    <li key={step.t} className="flex items-start gap-3.5">
                                        <span className="ui-mono ui-mono-sm flex h-6 w-6 flex-shrink-0 items-center justify-center border border-border text-ink-muted">
                                            {i + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-ink">{step.t}</p>
                                            <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{step.d}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </section>

                        <section className="border border-warning/25 bg-warning/5 p-5">
                            <p className="ui-eyebrow mb-4 text-warning">
                                <Shield className="h-3.5 w-3.5" strokeWidth={1.75} />
                                Before you send
                            </p>
                            <p className="text-sm leading-relaxed text-warning">
                                Reports are confidential, but false reports can cost you your account. Only
                                send what you know to be true.
                            </p>
                        </section>

                        <section className="ui-panel">
                            <p className="ui-eyebrow mb-5">Tips</p>
                            <ul className="space-y-3">
                                {[
                                    'Give specific dates and times.',
                                    'Stick to what actually happened.',
                                    'Say what outcome you are looking for.',
                                    'Keep it factual — emotion slows review down.',
                                ].map((tip) => (
                                    <li key={tip} className="flex items-start gap-3 text-sm text-ink-secondary">
                                        <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-muted" strokeWidth={1.75} />
                                        {tip}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </aside>
                </div>
            </Shell>
        </div>
    )
}

// Loading fallback component
function ReportPageLoading() {
    return (
        <div className="min-h-screen bg-surface pb-20">
            <Shell className="pt-8 sm:pt-12">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-6 h-10 w-2/5" />
                <Skeleton className="mt-4 h-4 w-3/5" />
                <div className="mt-12 grid gap-10 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-40 w-full" />
                        <Skeleton className="h-36 w-full" />
                    </div>
                    <Skeleton className="h-72 w-full" />
                </div>
            </Shell>
        </div>
    )
}

// Main export with Suspense boundary
export default function ReportPage() {
    return (
        <Suspense fallback={<ReportPageLoading />}>
            <ReportFormContent />
        </Suspense>
    )
}
