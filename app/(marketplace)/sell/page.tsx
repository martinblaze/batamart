'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  X, Plus, AlertCircle, Camera, Upload, CheckCircle2,
  Sparkles, Tag, MapPin, Package, ChevronRight, Zap,
  Shield, Info, ArrowLeft, Loader2, Image as ImageIcon,
} from 'lucide-react'
import {
  CATEGORY_TREE, getCategoryList, getSubcategoryList,
  getVariantFields, encodeProductData, VariantField,
} from '@/lib/variants'

const SELL_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade-up { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) forwards; }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }
  .scale-in { animation: scaleIn 0.3s cubic-bezier(0.34,1.4,0.64,1) forwards; }

  @keyframes shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }

  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.3); }
    70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
    100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  }
  .pulse-ring:focus-within { animation: pulse-ring 1.5s ease-out; }

  .step-card {
    transition: box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .step-card:focus-within {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
  }

  .tag-pill {
    transition: transform 0.15s cubic-bezier(0.34,1.4,0.64,1), background 0.15s ease;
  }
  .tag-pill:hover { transform: scale(1.05); }

  .img-slot {
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s cubic-bezier(0.34,1.4,0.64,1);
  }
  .img-slot:hover { border-color: #6366f1; background: #f5f3ff; transform: scale(1.02); }

  .suggestion-chip {
    transition: all 0.15s cubic-bezier(0.34,1.4,0.64,1);
  }
  .suggestion-chip:hover {
    background: #6366f1;
    color: white;
    border-color: transparent;
    transform: scale(1.04) translateY(-1px);
    box-shadow: 0 4px 12px rgba(99,102,241,0.25);
  }
  .suggestion-chip:active { transform: scale(0.97); }

  .submit-btn {
    transition: transform 0.2s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.2s ease;
    background: linear-gradient(135deg, #6366f1 0%, #4c1d95 100%);
  }
  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 16px 40px rgba(99,102,241,0.4);
  }
  .submit-btn:active:not(:disabled) { transform: scale(0.98); }

  .section-number {
    background: linear-gradient(135deg, #6366f1, #7c3aed);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header-gradient {
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%);
  }

  .cat-card {
    transition: all 0.15s cubic-bezier(0.34,1.4,0.64,1);
    cursor: pointer;
  }
  .cat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99,102,241,0.12); }
  .cat-card-active {
    border-color: #6366f1 !important;
    background: linear-gradient(135deg, #f0f0ff, #ede9fe) !important;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
  }

  .chip {
    transition: all 0.15s cubic-bezier(0.34,1.4,0.64,1);
  }
  .chip:hover {
    background: #6366f1;
    color: white;
    border-color: transparent;
    transform: scale(1.04) translateY(-1px);
  }
`

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmListingModal({
  price,
  hasStructuredVariants,
  minVariantPrice,
  maxVariantPrice,
  onConfirm,
  onCancel,
}: {
  price: number
  hasStructuredVariants: boolean
  minVariantPrice: number
  maxVariantPrice: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const [agreed, setAgreed] = useState(false)
  const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)
  const fee = price * 0.05
  const receive = price * 0.95

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="scale-in relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 z-10 max-h-[85vh] overflow-y-auto mx-4">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900">Before you list</h3>
            <p className="text-xs text-gray-400">Review fees and confirm availability</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-4 mb-4 border border-indigo-100">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Fee Breakdown</p>
          {!hasStructuredVariants ? (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Your listed price</span>
                  <span className="font-bold text-gray-900">{fmt(price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Platform fee (5%)</span>
                  <span className="font-bold text-red-500">− {fmt(fee)}</span>
                </div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between">
                  <span className="font-bold text-gray-800">You receive</span>
                  <span className="font-black text-emerald-600 text-base">{fmt(receive)}</span>
                </div>
              </div>
              <p className="text-[11px] text-indigo-500 mt-3 bg-white/60 rounded-xl p-2.5 leading-relaxed">
                💡 To receive exactly <strong>{fmt(price)}</strong>, list at <strong>{fmt(Math.ceil(price / 0.95))}</strong>
              </p>
            </>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Lowest variant price</span>
                  <span className="font-bold text-gray-900">{fmt(minVariantPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Highest variant price</span>
                  <span className="font-bold text-gray-900">{fmt(maxVariantPrice)}</span>
                </div>
                <div className="border-t border-indigo-200 pt-2 flex justify-between">
                  <span className="font-bold text-gray-800">You receive (range)</span>
                  <span className="font-black text-emerald-600 text-base">
                    {fmt(minVariantPrice * 0.95)} – {fmt(maxVariantPrice * 0.95)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-indigo-500 mt-3 bg-white/60 rounded-xl p-2.5 leading-relaxed">
                💡 Variant rows use their own prices and stock. Base price is fallback only.
              </p>
            </>
          )}
        </div>

        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
          <div className="flex items-start gap-2.5 mb-3">
            <span className="text-xl flex-shrink-0">🚫</span>
            <div>
              <p className="text-sm font-black text-red-700 mb-1">Product Availability Policy</p>
              <p className="text-xs text-red-600 leading-relaxed">
                The product <strong>must be physically with you right now.</strong> Listing items you plan to source after sale is <strong>strictly prohibited</strong> and will result in account suspension.
              </p>
            </div>
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <div
              onClick={() => setAgreed(!agreed)}
              className={`w-5 h-5 rounded-lg flex-shrink-0 mt-0.5 cursor-pointer border-2 flex items-center justify-center transition-all ${agreed ? 'bg-red-500 border-red-500' : 'border-red-300 bg-white'}`}
            >
              {agreed && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <span className="text-xs text-red-700 font-semibold leading-relaxed">
              I confirm this product is in my possession and ready for pickup. I understand violations result in account penalties.
            </span>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={!agreed}
            className="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: agreed ? 'linear-gradient(135deg, #6366f1, #4c1d95)' : '#9ca3af' }}
          >
            List Product ✨
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Become Seller Gate ─────────────────────────────────────────────────────────
function BecomeSellerGate({ appMode }: { appMode: boolean }) {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-violet-900 to-purple-950 flex items-center justify-center px-4">
      <div className="fade-up bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full text-center border border-white/20 shadow-2xl">
        <div className="text-6xl mb-5">🛍️</div>
        <h1 className="text-2xl font-black text-white mb-2">Want to sell on BataMart?</h1>
        <p className="text-white/60 text-sm mb-7 leading-relaxed">
          You're signed in as a buyer. Upgrade to a seller account — it's free and takes 10 seconds.
        </p>
        <button
          onClick={() => router.push(appMode ? '/become-seller?app=true' : '/become-seller')}
          className="w-full py-4 rounded-2xl font-black text-white text-base shadow-xl mb-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
        >
          Become a Seller →
        </button>
        <button
          onClick={() => router.push(appMode ? '/marketplace?app=true' : '/marketplace')}
          className="w-full py-3.5 rounded-2xl border border-white/20 text-white/70 font-semibold hover:bg-white/10 transition"
        >
          Back to Marketplace
        </button>
      </div>
    </div>
  )
}

// ── Step Header ───────────────────────────────────────────────────────────────
function StepHeader({ num, title, subtitle }: { num: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
        <span className="section-number text-sm font-black">{num}</span>
      </div>
      <div>
        <h3 className="text-sm font-black text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  )
}

// ── Variant Field Row ─────────────────────────────────────────────────────────
function VariantRow({
  field,
  values,
  onChange,
}: {
  field: VariantField
  values: string[]
  onChange: (vals: string[]) => void
}) {
  const [customInput, setCustomInput] = useState('')

  const addValue = (v: string) => {
    const trimmed = v.trim()
    if (!trimmed || values.includes(trimmed)) return
    onChange([...values, trimmed])
  }
  const removeValue = (v: string) => onChange(values.filter(x => x !== v))
  const handleCustomAdd = () => { addValue(customInput); setCustomInput('') }

  return (
    <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
      <p className="text-sm font-bold text-gray-700 mb-3">{field.label}</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {field.suggestions.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => values.includes(s) ? removeValue(s) : addValue(s)}
            className={`chip text-xs px-3 py-1.5 rounded-xl border font-semibold ${
              values.includes(s)
                ? 'bg-indigo-600 text-white border-transparent'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {values.includes(s) ? '✓ ' : '+ '}{s}
          </button>
        ))}
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {values.map(v => (
            <span key={v} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
              {v}
              <button type="button" onClick={() => removeValue(v)} className="hover:text-indigo-900 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomAdd() } }}
          placeholder={`Add custom ${field.label.toLowerCase()}...`}
          className="flex-1 text-xs px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
        />
        <button
          type="button"
          onClick={handleCustomAdd}
          disabled={!customInput.trim()}
          className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold disabled:opacity-40 hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

interface CategoryAttributeDef {
  id: string
  categoryKey: string
  subcategoryKey?: string | null
  key: string
  label: string
  type: 'text' | 'select' | 'multi_select' | 'number' | 'boolean'
  options?: string[] | null
  required: boolean
  filterable: boolean
  searchable: boolean
  sortOrder: number
}

// ── Main Sell Page ────────────────────────────────────────────────────────────
export default function SellPage() {
  const router = useRouter()
  const tagInputRef = useRef<HTMLInputElement>(null)
  const skipNextCategoryResetRef = useRef(true)
  const skipNextSubcategoryResetRef = useRef(true)
  const SELL_DRAFT_KEY = 'BATAMART_SELL_DRAFT_V1'

  // Auth state
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isBuyer, setIsBuyer]           = useState(false)
  const [appMode, setAppMode]           = useState(false)
  const [hostels, setHostels]           = useState<string[]>([])
  const [deliveryAreas, setDeliveryAreas] = useState<string[]>([])

  // Form state
  const [formData, setFormData] = useState({
    name: '', price: '', quantity: '1',
    hostelName: '', roomNumber: '', landmark: '',
  })
  const [deliveryAgreementChecked, setDeliveryAgreementChecked] = useState(false)
  const [estimatedWeightKg, setEstimatedWeightKg] = useState('')
  const [dimensionL, setDimensionL] = useState('')
  const [dimensionW, setDimensionW] = useState('')
  const [dimensionH, setDimensionH] = useState('')

  // Category system
  const [categoryKey, setCategoryKey]       = useState('')
  const [subcategoryKey, setSubcategoryKey] = useState('')
  const [variantValues, setVariantValues]   = useState<Record<string, string[]>>({})
  const [variantPricing, setVariantPricing] = useState<Record<string, { price: string; stock: string }>>({})
  const [variantsEnabledToggle, setVariantsEnabledToggle] = useState(false)
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttributeDef[]>([])
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({})
  const [attributeCustomInput, setAttributeCustomInput] = useState<Record<string, string>>({})
  const [manuallyTouchedAttributes, setManuallyTouchedAttributes] = useState<Record<string, boolean>>({})

  // Images — same structure as original: preview + url + uploading flag
  const [images, setImages] = useState<{ preview: string; url: string; uploading: boolean }[]>([])

  // Tags
  const [tags, setTags]         = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // UI
  const [loading, setLoading]               = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [error, setError]                   = useState('')
  const [draftHydrated, setDraftHydrated]   = useState(false)

  const categories    = getCategoryList()
  const subcategories = categoryKey ? getSubcategoryList(categoryKey) : []
  const variantFields = (categoryKey && subcategoryKey) ? getVariantFields(categoryKey, subcategoryKey) : []

  // Restore draft after refresh/network issues
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELL_DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft?.formData) setFormData(draft.formData)
        if (draft?.categoryKey) setCategoryKey(draft.categoryKey)
        if (draft?.subcategoryKey) setSubcategoryKey(draft.subcategoryKey)
        if (draft?.variantValues) setVariantValues(draft.variantValues)
        if (draft?.variantPricing) setVariantPricing(draft.variantPricing)
        if (typeof draft?.variantsEnabledToggle === 'boolean') setVariantsEnabledToggle(draft.variantsEnabledToggle)
        if (draft?.attributeValues) setAttributeValues(draft.attributeValues)
        if (draft?.manuallyTouchedAttributes) setManuallyTouchedAttributes(draft.manuallyTouchedAttributes)
        if (Array.isArray(draft?.tags)) setTags(draft.tags)
        if (Array.isArray(draft?.images)) setImages(draft.images)
      }
    } catch {}
    finally { setDraftHydrated(true) }
  }, [])

  // Persist draft continuously
  useEffect(() => {
    if (!draftHydrated) return
    try {
      const safeImages = images
        .filter(img => !img.uploading && !!img.url)
        .map(img => ({ preview: img.url, url: img.url, uploading: false }))
      localStorage.setItem(
        SELL_DRAFT_KEY,
        JSON.stringify({
          formData,
          categoryKey,
          subcategoryKey,
          variantValues,
          variantPricing,
          variantsEnabledToggle,
          attributeValues,
          manuallyTouchedAttributes,
          tags,
          images: safeImages,
        })
      )
    } catch {}
  }, [draftHydrated, formData, categoryKey, subcategoryKey, variantValues, variantPricing, attributeValues, manuallyTouchedAttributes, tags, images])

  useEffect(() => {
    if (document.getElementById('sell-anim')) return
    const s = document.createElement('style'); s.id = 'sell-anim'; s.textContent = SELL_CSS
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    const token    = localStorage.getItem('token')
    const userRole = localStorage.getItem('userRole')
    const params   = new URLSearchParams(window.location.search)
    setAppMode(params.get('app') === 'true')
    if (!token) { router.push('/login'); return }
    if (userRole === 'BUYER') { setIsBuyer(true); setCheckingAuth(false); return }
    const loadProfile = async () => {
      try {
        const cached = localStorage.getItem('user')
        if (cached) {
          const u = JSON.parse(cached)
          const hostelsList = parseJsonArray(u?.university?.hostels)
          const areas = parseJsonArray(u?.university?.deliveryAreas)
          if (hostelsList.length > 0 || areas.length > 0) {
            setHostels(hostelsList)
            setDeliveryAreas(areas)
            const normalized = normalizeLocationFields(u.hostelName || '', u.landmark || '', areas)
            const resolvedArea = resolveDeliveryAreaValue(normalized.landmark, areas)
            if (normalized.hostelName) setFormData(f => ({ ...f, hostelName: normalized.hostelName }))
            if (u.roomNumber) setFormData(f => ({ ...f, roomNumber: u.roomNumber || '' }))
            if (resolvedArea) setFormData(f => ({ ...f, landmark: resolvedArea }))
            setCheckingAuth(false)
            return
          }
        }
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          const hostelsList = parseJsonArray(data?.user?.university?.hostels)
          const areas = parseJsonArray(data?.user?.university?.deliveryAreas)
          setHostels(hostelsList)
          setDeliveryAreas(areas)
          if (data.user) {
            const normalized = normalizeLocationFields(data.user.hostelName || '', data.user.landmark || '', areas)
            const resolvedArea = resolveDeliveryAreaValue(normalized.landmark, areas)
            setFormData(f => ({
              ...f,
              hostelName: normalized.hostelName,
              roomNumber: data.user.roomNumber || '',
              landmark: resolvedArea,
            }))
          }
        }
      } catch {}
      finally { setCheckingAuth(false) }
    }
    loadProfile()
  }, [router])

  // Reset subcategory + variants when category changes
  useEffect(() => {
    if (!draftHydrated) return
    if (skipNextCategoryResetRef.current) { skipNextCategoryResetRef.current = false; return }
    setSubcategoryKey('')
    setVariantValues({})
    setCategoryAttributes([])
    setAttributeValues({})
    setAttributeCustomInput({})
    setManuallyTouchedAttributes({})
  }, [categoryKey])
  useEffect(() => {
    if (!draftHydrated) return
    if (skipNextSubcategoryResetRef.current) { skipNextSubcategoryResetRef.current = false; return }
    setVariantValues({})
    setVariantPricing({})
    setAttributeValues({})
    setAttributeCustomInput({})
    setManuallyTouchedAttributes({})
  }, [subcategoryKey])

  useEffect(() => {
    const loadCategoryAttributes = async () => {
      if (!categoryKey) { setCategoryAttributes([]); return }
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const qs = new URLSearchParams({ categoryKey })
        if (subcategoryKey) qs.set('subcategoryKey', subcategoryKey)
        const res = await fetch(`/api/category-attributes?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) return
        setCategoryAttributes((data.attributes || []).map((a: any) => ({
          ...a,
          options: Array.isArray(a.options) ? a.options : [],
        })))
      } catch {}
    }
    loadCategoryAttributes()
  }, [categoryKey, subcategoryKey])

  // Auto-generate tags from name + category + variant values
  useEffect(() => {
    const catLabel = categoryKey ? CATEGORY_TREE[categoryKey]?.label : ''
    const subLabel = subcategoryKey ? CATEGORY_TREE[categoryKey]?.subcategories[subcategoryKey]?.label : ''
    const variantTags = Object.values(variantValues).flat()
    const nameParts = formData.name.trim().split(/\s+/).filter(w => w.length > 2)
    const generated = [...new Set([...nameParts, catLabel, subLabel, ...variantTags].filter(Boolean))]
    setTags(prev => {
      const manual = prev.filter(t => !generated.includes(t))
      return [...generated, ...manual].slice(0, 30)
    })
  }, [formData.name, categoryKey, subcategoryKey, variantValues])

  // AI-lite parse auto-fill from product title (without overriding manual inputs)
  useEffect(() => {
    const text = formData.name.trim()
    if (!text || text.length < 4 || categoryAttributes.length === 0) return

    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch('/api/parse-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text }),
        })
        const data = await res.json()
        if (!res.ok || !data?.parsed || typeof data.parsed !== 'object') return

        const attrKeys = new Set(categoryAttributes.map((a) => a.key))
        for (const [k, v] of Object.entries(data.parsed as Record<string, string>)) {
          if (!attrKeys.has(k)) continue
          const current = attributeValues[k]
          const isEmpty = current === undefined || current === null || (typeof current === 'string' && !current.trim()) || (Array.isArray(current) && current.length === 0)
          if (!isEmpty) continue
          if (manuallyTouchedAttributes[k]) continue
          setAttributeValue(k, v, false)
        }
      } catch {}
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.name, categoryAttributes, attributeValues, manuallyTouchedAttributes])

  function parseJsonArray(val: unknown): string[] {
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string')
    if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
    return []
  }

  function normalizeLocationFields(hostelName: string, landmark: string, areas: string[]) {
    const hostel = String(hostelName || '').trim()
    const mark = String(landmark || '').trim()
    const areaSet = new Set((areas || []).map(a => String(a).trim().toLowerCase()))
    const hostelLooksLikeArea = hostel && areaSet.has(hostel.toLowerCase())
    const markLooksLikeArea = mark && areaSet.has(mark.toLowerCase())

    if (hostelLooksLikeArea) {
      return {
        hostelName: markLooksLikeArea ? '' : mark,
        landmark: hostel,
      }
    }

    return { hostelName: hostel, landmark: mark }
  }

  function resolveDeliveryAreaValue(rawLandmark: string, areas: string[]) {
    const raw = String(rawLandmark || '').trim()
    if (!raw || !Array.isArray(areas) || areas.length === 0) return ''

    const canon = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const rawCanon = canon(raw)

    const exact = areas.find(a => canon(String(a)) === rawCanon)
    if (exact) return exact

    const fuzzy = areas.find(a => {
      const aCanon = canon(String(a))
      return aCanon.includes(rawCanon) || rawCanon.includes(aCanon)
    })
    return fuzzy || ''
  }

  // ── Image upload ──────────────────────────────────────────────────────────
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  const MAX_IMAGE_SIZE_MB = 8

  const uploadToCloudinary = async (base64: string): Promise<string | null> => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await response.json()
      if (!response.ok) {
        console.error('Upload error:', data.error)
        return null
      }
      return data.url ?? null
    } catch (err) {
      console.error('Upload failed:', err)
      return null
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const filesToProcess = Array.from(files).slice(0, 3 - images.length)
    for (const file of filesToProcess) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError(`"${file.name}" is not allowed. Only JPG, PNG, WEBP.`)
        continue
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        setError(`"${file.name}" exceeds ${MAX_IMAGE_SIZE_MB}MB.`)
        continue
      }
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string
        setImages(prev => [...prev, { preview: base64, url: '', uploading: true }])
        const cloudUrl = await uploadToCloudinary(base64)
        if (cloudUrl) {
          setImages(prev => prev.map(img =>
            img.preview === base64 ? { ...img, url: cloudUrl, uploading: false } : img
          ))
        } else {
          setImages(prev => prev.filter(img => img.preview !== base64))
          setError('Failed to upload image. Please try again.')
        }
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const removeImage = (i: number) => setImages(prev => prev.filter((_, j) => j !== i))
  const allUploaded = images.length > 0 && images.every(img => !img.uploading)

  // Tags
  const addTag = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || tags.includes(trimmed)) { setTagInput(''); return }
    if (tags.length >= 30) { setError('Maximum 30 tags allowed'); return }
    setTags(prev => [...prev, trimmed]); setTagInput(''); setError('')
  }
  const removeTag = (i: number) => setTags(prev => prev.filter((_, j) => j !== i))
  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) }
    else if (e.key === 'Backspace' && !tagInput && tags.length > 0) removeTag(tags.length - 1)
  }

  const setVariantField = (key: string, vals: string[]) => {
    setVariantValues(prev => ({ ...prev, [key]: vals }))
  }

  const setAttributeValue = (key: string, value: any, markTouched = true) => {
    setAttributeValues((prev) => ({ ...prev, [key]: value }))
    if (markTouched) {
      setManuallyTouchedAttributes((prev) => ({ ...prev, [key]: true }))
    }
  }

  const toggleMultiSelectAttribute = (key: string, value: string) => {
    setAttributeValues((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : []
      const next = current.includes(value) ? current.filter((v: string) => v !== value) : [...current, value]
      return { ...prev, [key]: next }
    })
    setManuallyTouchedAttributes((prev) => ({ ...prev, [key]: true }))
  }

  const toggleSelectAttributeOption = (key: string, option: string) => {
    setAttributeValues((prev) => ({ ...prev, [key]: prev[key] === option ? '' : option }))
    setManuallyTouchedAttributes((prev) => ({ ...prev, [key]: true }))
  }

  const addCustomSelectAttribute = (key: string) => {
    const raw = (attributeCustomInput[key] || '').trim()
    if (!raw) return
    setAttributeValue(key, raw)
    setAttributeCustomInput((prev) => ({ ...prev, [key]: '' }))
  }

  const variantKeysForMatrix = Object.keys(variantValues).filter(k => (variantValues[k] || []).length > 0)
  const variantCombinations = variantKeysForMatrix.reduce<Record<string, string>[]>(
    (acc, key) => {
      const values = variantValues[key] || []
      if (acc.length === 0) return values.map(v => ({ [key]: v }))
      const out: Record<string, string>[] = []
      for (const row of acc) {
        for (const v of values) out.push({ ...row, [key]: v })
      }
      return out
    },
    []
  )

  const comboKey = (combo: Record<string, string>) =>
    variantKeysForMatrix.map(k => `${k}:${combo[k]}`).join('|')

  const hasStructuredVariants = variantsEnabledToggle && variantCombinations.length > 0
  const variantPriceNumbers = hasStructuredVariants
    ? variantCombinations.map(combo => {
        const row = variantPricing[comboKey(combo)]
        const val = Number(row?.price || formData.price || 0)
        return Number.isFinite(val) ? val : 0
      }).filter(v => v > 0)
    : []
  const minVariantPrice = variantPriceNumbers.length ? Math.min(...variantPriceNumbers) : 0
  const maxVariantPrice = variantPriceNumbers.length ? Math.max(...variantPriceNumbers) : 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) { setError('Product name is required'); return }
    if (!formData.price || parseFloat(formData.price) <= 0) { setError('Enter a valid price'); return }
    if (!categoryKey) { setError('Please select a category'); return }
    if (!subcategoryKey) { setError('Please select a subcategory'); return }
    if (images.length < 1) { setError('Please add at least 1 product image'); return }
    if (!deliveryAgreementChecked) { setError('Please confirm motorcycle delivery suitability before listing'); return }
    if (!allUploaded) { setError('Please wait for all images to finish uploading'); return }
    for (const attr of categoryAttributes) {
      if (!attr.required) continue
      const value = attributeValues[attr.key]
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && value.length === 0)
      if (missing) {
        setError(`${attr.label} is required`)
        return
      }
    }
    if (hasStructuredVariants) {
      for (const combo of variantCombinations) {
        const key = comboKey(combo)
        const row = variantPricing[key]
        const rowPrice = Number(row?.price || formData.price)
        const rowStock = Number(row?.stock || formData.quantity || 0)
        if (!Number.isFinite(rowPrice) || rowPrice <= 0) { setError('Each variant must have a valid price'); return }
        if (!Number.isFinite(rowStock) || rowStock < 0) { setError('Each variant must have valid stock'); return }
      }
    }
    setError(''); setShowConfirmModal(true)
  }

  const handleConfirmListing = async () => {
    setShowConfirmModal(false); setLoading(true); setError('')
    try {
      const token = localStorage.getItem('token')
      const catLabel = CATEGORY_TREE[categoryKey]?.label ?? categoryKey
      const subLabel = CATEGORY_TREE[categoryKey]?.subcategories[subcategoryKey]?.label ?? subcategoryKey

      const description = hasStructuredVariants ? (formData.name.trim() || '') : encodeProductData(variantValues, tags)
      const attributesPayload = categoryAttributes
        .map((attr) => {
          const value = attributeValues[attr.key]
          if (value === undefined || value === null) return null
          if (typeof value === 'string' && !value.trim()) return null
          if (Array.isArray(value) && value.length === 0) return null
          return {
            key: attr.key,
            label: attr.label,
            value,
            searchable: attr.searchable,
            filterable: attr.filterable,
          }
        })
        .filter(Boolean)
      const variantsPayload = hasStructuredVariants
        ? variantCombinations.map(combo => {
            const key = comboKey(combo)
            const row = variantPricing[key]
            return {
              combination: combo,
              price: Number(row?.price || formData.price),
              stock: Number(row?.stock || formData.quantity || 0),
            }
          })
        : []

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          name:        formData.name.trim(),
          description,
          price:       parseFloat(formData.price),
          quantity:    parseInt(formData.quantity) || 1,
          category:    catLabel,
          categoryKey,
          subcategory: subLabel,
          subcategoryKey,
          attributes: attributesPayload,
          variants: variantsPayload,
          images:      images.map(img => img.url),
          productDeliveryAgreement: deliveryAgreementChecked,
          estimatedWeightKg: estimatedWeightKg ? Number(estimatedWeightKg) : undefined,
          dimensionsCm: (dimensionL && dimensionW && dimensionH)
            ? { length: Number(dimensionL), width: Number(dimensionW), height: Number(dimensionH) }
            : undefined,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        localStorage.removeItem(SELL_DRAFT_KEY)
        router.push('/my-shop')
      } else {
        setError(data.error || 'Failed to create product')
      }
    } catch { setError('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n)
  const catIcon = categoryKey ? CATEGORY_TREE[categoryKey]?.icon : ''

  if (checkingAuth) return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
        <p className="text-gray-500 font-semibold">Checking authentication…</p>
      </div>
    </div>
  )

  if (isBuyer) return <BecomeSellerGate appMode={appMode} />

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {showConfirmModal && (
        <ConfirmListingModal
          price={parseFloat(formData.price) || 0}
          hasStructuredVariants={hasStructuredVariants}
          minVariantPrice={minVariantPrice}
          maxVariantPrice={maxVariantPrice}
          onConfirm={handleConfirmListing}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}

      {/* ── Header ── */}
      <header className="header-gradient sticky top-0 z-40 shadow-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href={appMode ? '/marketplace?app=true' : '/marketplace'}
              className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4 text-white" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-black text-white leading-tight">List a Product</h1>
              <p className="text-white/50 text-xs">Sell to your campus community</p>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
              {catIcon ? <span className="text-base">{catIcon}</span> : <Sparkles className="w-3.5 h-3.5 text-violet-300" />}
              <span className="text-[11px] font-bold text-white/80">5% platform fee</span>
            </div>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-4">

        {/* Price preview banner */}
        {formData.price && parseFloat(formData.price) > 0 && (
          <div className="fade-up bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-sm">
              {!hasStructuredVariants ? (
                <>
                  <span className="text-gray-500">You'll receive </span>
                  <span className="font-black text-emerald-600">{fmt(parseFloat(formData.price) * 0.95)}</span>
                  <span className="text-gray-400 text-xs"> after 5% fee</span>
                </>
              ) : (
                <>
                  <span className="text-gray-500">Variant payout range </span>
                  <span className="font-black text-emerald-600">
                    {minVariantPrice > 0 ? fmt(minVariantPrice * 0.95) : '—'}{maxVariantPrice > 0 ? ` – ${fmt(maxVariantPrice * 0.95)}` : ''}
                  </span>
                  <span className="text-gray-400 text-xs"> after 5% fee</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 1: Basic Info ── */}
        <div className="step-card bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <StepHeader num="1" title="Product Details" subtitle="Name, price and quantity" />
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium"
                placeholder='e.g. "iPhone 13 Pro Max 256GB"'
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {hasStructuredVariants ? 'Base Price (Fallback) (₦) *' : 'Price (₦) *'}
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  required min="0" step="0.01"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium"
                  placeholder="50000"
                />
                {hasStructuredVariants && (
                  <p className="text-[11px] text-gray-400 mt-1">
                    Variant row prices are used at checkout. This is only fallback/base.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Qty in Stock *</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                  required min="1"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium"
                  placeholder="1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── STEP 2: Category ── */}
        <div className="step-card bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <StepHeader num="2" title="Category *" subtitle="Select the most relevant category" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryKey(cat.key)}
                className={`cat-card text-left p-3 rounded-xl border-2 ${
                  categoryKey === cat.key ? 'cat-card-active' : 'border-gray-100 bg-gray-50 hover:border-indigo-200'
                }`}
              >
                <div className="text-xl mb-1">{cat.icon}</div>
                <p className="text-xs font-bold text-gray-700 leading-tight">{cat.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── STEP 3: Subcategory ── */}
        {categoryKey && (
          <div className="step-card bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <StepHeader num="3" title="Subcategory *" subtitle="Get more specific" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {subcategories.map(sub => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => setSubcategoryKey(sub.key)}
                  className={`cat-card text-left px-3 py-2.5 rounded-xl border-2 text-xs font-bold ${
                    subcategoryKey === sub.key
                      ? 'bg-indigo-600 text-white border-transparent'
                      : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-indigo-200'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 4: Category Attributes ── */}
        {categoryAttributes.length > 0 && (
          <div className="step-card bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <StepHeader num="4" title="Category Details" subtitle="Structured attributes for smarter search and filters" />
            <div className="space-y-4">
              {categoryAttributes.map((attr) => {
                const options = Array.isArray(attr.options) ? attr.options : []
                const value = attributeValues[attr.key]
                return (
                  <div key={attr.id}>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                      {attr.label} {attr.required ? '*' : ''}
                    </label>
                    {attr.type === 'select' && (
                      <div className="space-y-2.5">
                        {options.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {options.map((opt) => {
                              const active = value === opt
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => toggleSelectAttributeOption(attr.key, opt)}
                                  className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                                    active
                                      ? 'bg-indigo-600 text-white border-transparent'
                                      : 'bg-white text-gray-600 border-gray-200'
                                  }`}
                                >
                                  {active ? '✓ ' : '+ '}{opt}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={attributeCustomInput[attr.key] ?? ''}
                            onChange={(e) => setAttributeCustomInput((prev) => ({ ...prev, [attr.key]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addCustomSelectAttribute(attr.key)
                              }
                            }}
                            className="flex-1 px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium"
                            placeholder={`Add custom ${attr.label.toLowerCase()}...`}
                          />
                          <button
                            type="button"
                            onClick={() => addCustomSelectAttribute(attr.key)}
                            disabled={!(attributeCustomInput[attr.key] || '').trim()}
                            className="w-12 rounded-xl bg-indigo-300 text-white font-black disabled:opacity-50 hover:bg-indigo-500 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                    {attr.type === 'multi_select' && (
                      <div className="flex flex-wrap gap-2">
                        {options.map((opt) => {
                          const active = Array.isArray(value) && value.includes(opt)
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => toggleMultiSelectAttribute(attr.key, opt)}
                              className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${
                                active ? 'bg-indigo-600 text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'
                              }`}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {attr.type === 'number' && (
                      <input
                        type="number"
                        value={value ?? ''}
                        onChange={(e) => setAttributeValue(attr.key, e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium"
                        placeholder={`Enter ${attr.label.toLowerCase()}`}
                      />
                    )}
                    {attr.type === 'boolean' && (
                      <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(e) => setAttributeValue(attr.key, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Yes
                      </label>
                    )}
                    {(attr.type === 'text' || (!['select', 'multi_select', 'number', 'boolean'].includes(attr.type))) && (
                      <input
                        type="text"
                        value={value ?? ''}
                        onChange={(e) => setAttributeValue(attr.key, e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium"
                        placeholder={`Enter ${attr.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── STEP 5: Variants ── */}
        {variantFields.length > 0 && (
          <div className="step-card bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
            <StepHeader num="5" title="Product Variants" subtitle="Turn on if this product has options like color, size or storage" />
            <button
              type="button"
              onClick={() => setVariantsEnabledToggle((v) => !v)}
              className={`w-full mb-4 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                variantsEnabledToggle ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-indigo-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">Has variants</p>
                  <p className="text-xs text-gray-500">
                    {variantsEnabledToggle ? 'Variant section expanded' : 'Tap to add variants'}
                  </p>
                </div>
                <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${variantsEnabledToggle ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                  <div className={`h-5 w-5 rounded-full bg-white transition-transform ${variantsEnabledToggle ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
            </button>
            {variantsEnabledToggle && (
              <div className="space-y-4">
                {variantFields.map(field => (
                  <VariantRow
                    key={field.key}
                    field={field}
                    values={variantValues[field.key] ?? []}
                    onChange={vals => setVariantField(field.key, vals)}
                  />
                ))}
              </div>
            )}
            {variantsEnabledToggle && variantCombinations.length > 0 && (
              <div className="mt-5 border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-600">Variant Inventory</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white border-b border-gray-100">
                        {variantKeysForMatrix.map(key => (
                          <th key={key} className="text-left px-3 py-2 font-bold text-gray-500 capitalize">{key.replace(/_/g, ' ')}</th>
                        ))}
                        <th className="text-left px-3 py-2 font-bold text-gray-500">Price</th>
                        <th className="text-left px-3 py-2 font-bold text-gray-500">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantCombinations.map((combo) => {
                        const key = comboKey(combo)
                        const row = variantPricing[key] || { price: formData.price, stock: formData.quantity || '1' }
                        return (
                          <tr key={key} className="border-b border-gray-50 last:border-0">
                            {variantKeysForMatrix.map(k => (
                              <td key={`${key}-${k}`} className="px-3 py-2 font-semibold text-gray-700">{combo[k]}</td>
                            ))}
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.price}
                                onChange={e => setVariantPricing(prev => ({ ...prev, [key]: { ...row, price: e.target.value } }))}
                                className="w-24 px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={row.stock}
                                onChange={e => setVariantPricing(prev => ({ ...prev, [key]: { ...row, stock: e.target.value } }))}
                                className="w-20 px-2 py-1 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 5: Images ── */}
        <div className="step-card bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <StepHeader
            num={variantFields.length > 0 ? '6' : '4'}
            title="Product Photos"
            subtitle="Up to 3 images · JPG, PNG, WEBP · Max 8MB each"
          />
          <div className="grid grid-cols-3 gap-3">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200">
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                {img.uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
                {!img.uploading && img.url && (
                  <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  </div>
                )}
                {!img.uploading && (
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
                {i === 0 && !img.uploading && (
                  <span className="absolute bottom-1.5 left-1.5 bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">MAIN</span>
                )}
              </div>
            ))}
            {images.length < 3 && (
              <label className="img-slot aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-50">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Camera className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="text-[11px] font-bold text-gray-400">Add Photo</span>
              </label>
            )}
            {Array.from({ length: Math.max(0, 2 - images.length) }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl border-2 border-dashed border-gray-100 bg-gray-50/50 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-gray-200" />
              </div>
            ))}
          </div>
          {images.some(img => img.uploading) && (
            <div className="flex items-center gap-2 mt-3 text-xs text-indigo-500 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading images, please wait…
            </div>
          )}
        </div>

        {/* ── STEP 6: Tags ── */}
        <div className="step-card bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <StepHeader
            num={variantFields.length > 0 ? '7' : '5'}
            title="Product Tags"
            subtitle="Auto-generated · helps buyers find your product"
          />
          <div
            className="min-h-[56px] w-full px-3 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus-within:border-indigo-400 focus-within:bg-white transition-all cursor-text flex flex-wrap gap-2 items-center mb-3"
            onClick={() => tagInputRef.current?.focus()}
          >
            {tags.map((tag, i) => (
              <span key={i} className="tag-pill inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                {tag}
                <button type="button" onClick={e => { e.stopPropagation(); removeTag(i) }} className="hover:text-red-500 transition-colors ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? 'e.g. New, 128GB, Black, XL…' : 'Add more…'}
                className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
              />
              {tagInput.trim() && (
                <button type="button" onClick={() => addTag(tagInput)}
                  className="flex items-center gap-1 px-3 py-1 text-white text-xs font-black rounded-full flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}>
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
          </div>
          {tags.length > 0 && <p className="text-xs text-gray-400">{tags.length} tag{tags.length !== 1 ? 's' : ''} added</p>}
        </div>

        {/* ── STEP 7: Location ── */}
        <div className="step-card bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <StepHeader
            num={variantFields.length > 0 ? '8' : '6'}
            title="Pickup Location"
            subtitle="Where should the rider collect this product?"
          />
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Hostel / Lodge *</label>
              <input
                type="text"
                value={formData.hostelName}
                onChange={e => setFormData({ ...formData, hostelName: e.target.value })}
                required
                className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium"
                placeholder="e.g., Python Hall, Aroma Lodge, Block C"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Room Number *</label>
              <input
                type="text"
                value={formData.roomNumber}
                onChange={e => setFormData({ ...formData, roomNumber: e.target.value })}
                required
                className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium"
                placeholder="e.g., Room 12, Block A"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Landmark / Delivery Area *
              </label>
              {deliveryAreas.length > 0 ? (
                <select
                  value={formData.landmark}
                  onChange={e => setFormData({ ...formData, landmark: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium appearance-none"
                >
                  <option value="">Select delivery area</option>
                  {deliveryAreas.map(area => <option key={area} value={area}>{area}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.landmark}
                  onChange={e => setFormData({ ...formData, landmark: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium"
                  placeholder="e.g., Near the water dispenser"
                />
              )}
              <p className="flex items-center gap-1 text-xs text-gray-400 mt-1.5">
                <MapPin className="w-3 h-3" /> The area where the rider will come to collect
              </p>
            </div>
          </div>
        </div>

        <div className="step-card bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <StepHeader
            num={variantFields.length > 0 ? '9' : '7'}
            title="Motorcycle Delivery Check"
            subtitle="Required for rider safety and reliable fulfillment"
          />
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <input type="number" min="0" step="0.1" value={estimatedWeightKg} onChange={(e) => setEstimatedWeightKg(e.target.value)} placeholder="Weight (kg, optional)" className="px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium" />
            <input type="number" min="0" value={dimensionL} onChange={(e) => setDimensionL(e.target.value)} placeholder="Length cm (optional)" className="px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium" />
            <input type="number" min="0" value={dimensionW} onChange={(e) => setDimensionW(e.target.value)} placeholder="Width cm (optional)" className="px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium" />
            <input type="number" min="0" value={dimensionH} onChange={(e) => setDimensionH(e.target.value)} placeholder="Height cm (optional)" className="px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:border-indigo-400 focus:bg-white focus:outline-none transition-all text-sm font-medium sm:col-span-3" />
          </div>
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={deliveryAgreementChecked} onChange={(e) => setDeliveryAgreementChecked(e.target.checked)} className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <span>
              I confirm this product can be safely and reasonably delivered by a motorcycle rider. Oversized items are prohibited on Batamart. Listings reported as undeliverable may be removed and repeated violations can lead to account suspension.
            </span>
          </label>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="fade-up flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3.5 rounded-2xl text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={loading || (!allUploaded && images.length > 0)}
          className="submit-btn w-full py-4 rounded-2xl font-black text-white text-base shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Listing Product…
            </span>
          ) : !allUploaded && images.length > 0 ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Uploading images…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" /> List Product on BataMart
            </span>
          )}
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">
          By listing, you agree to BataMart's seller terms and availability policy
        </p>
      </form>
    </div>
  )
}
