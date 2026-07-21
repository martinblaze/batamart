'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    AlertCircle, Upload, X, Link, User, Package, Shield, Clock, MessageSquare, CheckCircle,
    Ban, FileText, Star, Pin, Frown, type LucideIcon,
} from 'lucide-react'

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
                alert('Report submitted successfully. Our team will review it within 24-48 hours.')
                router.push('/orders')
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

    return (
        <div className="min-h-screen bg-surface py-8 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header Card */}
                <div className="bg-danger rounded-2xl shadow-soft p-8 mb-8 text-white">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                            <Shield className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold">Report an Issue</h1>
                            <p className="text-white/80 opacity-90">Help us maintain a safe and trustworthy marketplace</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        <span>Your report is confidential and will be reviewed within 24-48 hours</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-soft p-6">
                            {(productName || riderName) && (
                                <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                                    <div className="flex items-center gap-2 text-primary">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="font-medium">
                                            {productName && `Reporting product: ${productName}`}
                                            {riderName && `Reporting rider: ${riderName}`}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-xl">
                                    <div className="flex items-center gap-2 text-danger">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Report Type Selection */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-ink-secondary">
                                        What would you like to report? *
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setFormData({
                                                ...formData,
                                                type: 'PRODUCT',
                                                reason: '',
                                                riderName: '',
                                                productLink: ''
                                            })}
                                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${formData.type === 'PRODUCT'
                                                ? 'border-danger bg-danger/10 shadow-soft'
                                                : 'border-border hover:border-border hover:bg-surface'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${formData.type === 'PRODUCT' ? 'bg-danger/10 text-danger' : 'bg-surface text-ink-secondary'}`}>
                                                    <Package className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-medium text-ink">Product</div>
                                                    <div className="text-xs text-ink-secondary">Report a product issue</div>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setFormData({
                                                ...formData,
                                                type: 'RIDER',
                                                reason: '',
                                                riderName: '',
                                                productLink: ''
                                            })}
                                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${formData.type === 'RIDER'
                                                ? 'border-danger bg-danger/10 shadow-soft'
                                                : 'border-border hover:border-border hover:bg-surface'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${formData.type === 'RIDER' ? 'bg-danger/10 text-danger' : 'bg-surface text-ink-secondary'}`}>
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-medium text-ink">Rider</div>
                                                    <div className="text-xs text-ink-secondary">Report delivery issues</div>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Dynamic Input Fields */}
                                {formData.type === 'RIDER' && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-ink-secondary">
                                            Rider's Name *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={formData.riderName}
                                                onChange={(e) => setFormData({ ...formData, riderName: e.target.value })}
                                                className="w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-xl focus:ring-2 focus:ring-danger/40 focus:border-danger transition-all"
                                                placeholder="Enter the rider's full name or ID..."
                                                required
                                            />
                                            <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-muted" />
                                        </div>
                                    </div>
                                )}

                                {formData.type === 'PRODUCT' && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-ink-secondary">
                                            Product Link *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="url"
                                                value={formData.productLink}
                                                onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                                                className="w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-xl focus:ring-2 focus:ring-danger/40 focus:border-danger transition-all"
                                                placeholder="https://yourstore.com/products/..."
                                                required
                                            />
                                            <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-ink-muted" />
                                        </div>
                                    </div>
                                )}

                                {/* Reason Selection */}
                                {formData.type && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-ink-secondary">
                                            Select the main reason *
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {currentReasons.map((r) => (
                                                <button
                                                    key={r.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, reason: r.value })}
                                                    className={`p-3 rounded-lg border text-left transition-all duration-150 ${formData.reason === r.value
                                                        ? 'border-danger bg-danger/10'
                                                        : 'border-border hover:bg-surface'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <r.icon className="w-4 h-4 text-ink-secondary" strokeWidth={1.75} />
                                                        <span className="text-sm font-medium text-ink">{r.label}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Description */}
                                {formData.type && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-ink-secondary">
                                            Please describe the issue in detail *
                                        </label>
                                        <div className="relative">
                                            <textarea
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full px-4 py-3 bg-surface border border-border rounded-xl focus:ring-2 focus:ring-danger/40 focus:border-danger min-h-32 resize-y transition-all"
                                                placeholder={
                                                    formData.type === 'PRODUCT'
                                                        ? "• What specifically is wrong with the product?\n• How does it differ from the description?\n• When did you discover the issue?"
                                                        : "• What exactly happened during delivery?\n• How was the rider's behavior?\n• When did this occur?"
                                                }
                                                required
                                            />
                                            <MessageSquare className="absolute right-4 top-4 w-5 h-5 text-ink-muted" />
                                        </div>
                                        <p className="text-xs text-ink-secondary">
                                            Be as specific as possible. Include dates, times, and any relevant details.
                                        </p>
                                    </div>
                                )}

                                {/* Evidence Upload */}
                                {formData.type && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-ink-secondary">
                                            Add Evidence (Optional)
                                        </label>
                                        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-surface hover:bg-surface transition-colors cursor-pointer">
                                            <Upload className="w-12 h-12 text-ink-muted mx-auto mb-3" />
                                            <p className="text-sm font-medium text-ink-secondary mb-1">Upload screenshots or photos</p>
                                            <p className="text-xs text-ink-muted">Drag & drop or click to browse</p>
                                            <p className="text-xs text-ink-muted mt-2">Max file size: 5MB • Supported: JPG, PNG, PDF</p>
                                        </div>
                                    </div>
                                )}

                                {/* Submit Buttons */}
                                {formData.type && (
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => router.back()}
                                            className="flex-1 px-6 py-3.5 border-2 border-border rounded-xl font-medium text-ink-secondary hover:bg-surface transition-all"
                                            disabled={loading}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading || !formData.type || !formData.reason || !formData.description}
                                            className="flex-1 px-6 py-3.5 bg-danger hover:brightness-95 text-white rounded-xl font-semibold shadow-soft hover:shadow-soft transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <AlertCircle className="w-5 h-5" />
                                                    Submit Report
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-6">
                        {/* Process Steps */}
                        <div className="bg-white rounded-2xl shadow-soft p-6">
                            <h3 className="font-semibold text-ink mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-danger" />
                                Review Process
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-danger/10 text-danger rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <p className="font-medium text-ink">Report Submission</p>
                                        <p className="text-sm text-ink-secondary">Your report is securely submitted</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-danger/10 text-danger rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <p className="font-medium text-ink">Team Review</p>
                                        <p className="text-sm text-ink-secondary">Our team reviews within 24-48 hours</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-danger/10 text-danger rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <p className="font-medium text-ink">Action Taken</p>
                                        <p className="text-sm text-ink-secondary">Appropriate action if violations found</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-danger/10 text-danger rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                        4
                                    </div>
                                    <div>
                                        <p className="font-medium text-ink">Notification</p>
                                        <p className="text-sm text-ink-secondary">You'll be notified of the outcome</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Important Note */}
                        <div className="bg-warning/10 border border-warning/20 rounded-2xl p-6">
                            <h3 className="font-semibold text-warning mb-2 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                Important
                            </h3>
                            <p className="text-sm text-warning">
                                False reports may result in account penalties. Please ensure your report is accurate and truthful. All reports are confidential.
                            </p>
                        </div>

                        {/* Quick Tips */}
                        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6">
                            <h3 className="font-semibold text-primary mb-3">Tips for effective reports</h3>
                            <ul className="space-y-2 text-sm text-primary">
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                    <span>Include specific dates and times</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                    <span>Provide clear, factual information</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                    <span>Attach screenshots if available</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                    <span>Stay objective and avoid emotional language</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Loading fallback component
function ReportPageLoading() {
    return (
        <div className="min-h-screen bg-surface py-8 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-2xl shadow-soft p-8 animate-pulse">
                    <div className="h-8 bg-border rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-border rounded w-2/3 mb-8"></div>
                    <div className="space-y-4">
                        <div className="h-12 bg-border rounded"></div>
                        <div className="h-12 bg-border rounded"></div>
                        <div className="h-32 bg-border rounded"></div>
                    </div>
                </div>
            </div>
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
