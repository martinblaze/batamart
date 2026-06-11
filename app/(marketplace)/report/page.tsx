'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Upload, X, Link, User, Package, Shield, Clock, MessageSquare, CheckCircle } from 'lucide-react'

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

    const reportReasons = {
        PRODUCT: [
            { value: 'FAKE_PRODUCT', label: 'Fake or Counterfeit Product', icon: '🚫' },
            { value: 'WRONG_DESCRIPTION', label: 'Misleading Description', icon: '📝' },
            { value: 'POOR_QUALITY', label: 'Poor Quality', icon: '⭐' },
            { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate Content', icon: '⚠️' },
            { value: 'OTHER', label: 'Other', icon: '📌' }
        ],
        RIDER: [
            { value: 'DELAYED_DELIVERY', label: 'Delayed Delivery', icon: '⏰' },
            { value: 'RUDE_BEHAVIOR', label: 'Rude or Unprofessional', icon: '😠' },
            { value: 'DAMAGED_PRODUCT', label: 'Damaged Product', icon: '📦' },
            { value: 'OTHER', label: 'Other', icon: '📌' }
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
                alert('✅ Report submitted successfully! Our team will review it within 24-48 hours.')
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
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
            <div className="max-w-3xl mx-auto">
                {/* Header Card */}
                <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl shadow-lg p-8 mb-8 text-white">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-white/20 p-3 rounded-xl">
                            <Shield className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Report an Issue</h1>
                            <p className="text-red-100 opacity-90">Help us maintain a safe and trustworthy marketplace</p>
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
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            {(productName || riderName) && (
                                <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                                    <div className="flex items-center gap-2 text-blue-800">
                                        <AlertCircle className="w-4 h-4" />
                                        <span className="font-medium">
                                            {productName && `Reporting product: ${productName}`}
                                            {riderName && `Reporting rider: ${riderName}`}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                                    <div className="flex items-center gap-2 text-red-800">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Report Type Selection */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-gray-700">
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
                                                ? 'border-red-500 bg-red-50 shadow-sm'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${formData.type === 'PRODUCT' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                    <Package className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-medium text-gray-900">Product</div>
                                                    <div className="text-xs text-gray-500">Report a product issue</div>
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
                                                ? 'border-red-500 bg-red-50 shadow-sm'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${formData.type === 'RIDER' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-medium text-gray-900">Rider</div>
                                                    <div className="text-xs text-gray-500">Report delivery issues</div>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* Dynamic Input Fields */}
                                {formData.type === 'RIDER' && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            Rider's Name *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={formData.riderName}
                                                onChange={(e) => setFormData({ ...formData, riderName: e.target.value })}
                                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                                                placeholder="Enter the rider's full name or ID..."
                                                required
                                            />
                                            <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        </div>
                                    </div>
                                )}

                                {formData.type === 'PRODUCT' && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            Product Link *
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="url"
                                                value={formData.productLink}
                                                onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                                                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                                                placeholder="https://yourstore.com/products/..."
                                                required
                                            />
                                            <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        </div>
                                    </div>
                                )}

                                {/* Reason Selection */}
                                {formData.type && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            Select the main reason *
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {currentReasons.map((r) => (
                                                <button
                                                    key={r.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, reason: r.value })}
                                                    className={`p-3 rounded-lg border text-left transition-all duration-200 ${formData.reason === r.value
                                                        ? 'border-red-500 bg-red-50 shadow-sm'
                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{r.icon}</span>
                                                        <span className="text-sm font-medium text-gray-900">{r.label}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Description */}
                                {formData.type && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            Please describe the issue in detail *
                                        </label>
                                        <div className="relative">
                                            <textarea
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-32 resize-y transition-all"
                                                placeholder={
                                                    formData.type === 'PRODUCT'
                                                        ? "• What specifically is wrong with the product?\n• How does it differ from the description?\n• When did you discover the issue?"
                                                        : "• What exactly happened during delivery?\n• How was the rider's behavior?\n• When did this occur?"
                                                }
                                                required
                                            />
                                            <MessageSquare className="absolute right-4 top-4 w-5 h-5 text-gray-400" />
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Be as specific as possible. Include dates, times, and any relevant details.
                                        </p>
                                    </div>
                                )}

                                {/* Evidence Upload */}
                                {formData.type && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            Add Evidence (Optional)
                                        </label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                                            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                            <p className="text-sm font-medium text-gray-600 mb-1">Upload screenshots or photos</p>
                                            <p className="text-xs text-gray-400">Drag & drop or click to browse</p>
                                            <p className="text-xs text-gray-400 mt-2">Max file size: 5MB • Supported: JPG, PNG, PDF</p>
                                        </div>
                                    </div>
                                )}

                                {/* Submit Buttons */}
                                {formData.type && (
                                    <div className="flex gap-3 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => router.back()}
                                            className="flex-1 px-6 py-3.5 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-all"
                                            disabled={loading}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading || !formData.type || !formData.reason || !formData.description}
                                            className="flex-1 px-6 py-3.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-red-500" />
                                Review Process
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-red-100 text-red-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                        1
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">Report Submission</p>
                                        <p className="text-sm text-gray-600">Your report is securely submitted</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-red-100 text-red-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                        2
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">Team Review</p>
                                        <p className="text-sm text-gray-600">Our team reviews within 24-48 hours</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-red-100 text-red-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                        3
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">Action Taken</p>
                                        <p className="text-sm text-gray-600">Appropriate action if violations found</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-red-100 text-red-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                        4
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">Notification</p>
                                        <p className="text-sm text-gray-600">You'll be notified of the outcome</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Important Note */}
                        <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-6">
                            <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                Important
                            </h3>
                            <p className="text-sm text-yellow-800">
                                False reports may result in account penalties. Please ensure your report is accurate and truthful. All reports are confidential.
                            </p>
                        </div>

                        {/* Quick Tips */}
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
                            <h3 className="font-bold text-blue-900 mb-3">📝 Tips for Effective Reports</h3>
                            <ul className="space-y-2 text-sm text-blue-800">
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <span>Include specific dates and times</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <span>Provide clear, factual information</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <span>Attach screenshots if available</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
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
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg p-8 animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3 mb-8"></div>
                    <div className="space-y-4">
                        <div className="h-12 bg-gray-200 rounded"></div>
                        <div className="h-12 bg-gray-200 rounded"></div>
                        <div className="h-32 bg-gray-200 rounded"></div>
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
