'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react'
import { Shell, PageHeader } from '@/components/ui/Shell'
import { authFetch } from '@/lib/auth-client'
import { parseReadyDays } from '@/lib/delivery/schedule'
import { MAX_LISTING_IMAGES } from '@/lib/listing-limits'

interface EditableProduct {
  id: string
  name: string
  description: string
  price: number
  quantity: number
  images: string[]
  deliveryEstimate: string | null
  variantsEnabled: boolean
  isActive: boolean
  moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW' | 'REMOVED'
  rejectionReason: string | null
}

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id)

  const [product, setProduct] = useState<EditableProduct | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [days, setDays] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      router.push(`/login?redirect=${encodeURIComponent(`/my-shop/edit/${id}`)}`)
      return
    }
    authFetch(`/api/products/${id}/edit`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not load this listing')
        const p: EditableProduct = data.product
        setProduct(p)
        setName(p.name)
        setDescription(p.description)
        setPrice(String(p.price))
        setQuantity(String(p.quantity))
        setDays(p.deliveryEstimate ? String(parseReadyDays(p.deliveryEstimate) || '') : '')
        setImages(p.images)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, router])

  const addImage = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return }
    if (images.length >= MAX_LISTING_IMAGES) { setError(`You can add up to ${MAX_LISTING_IMAGES} photos.`); return }
    setUploading(true)
    setError('')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await authFetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setImages(prev => [...prev, data.url])
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!product) return
    setError('')
    if (name.trim().length < 3) { setError('Give the listing a name of at least 3 characters.'); return }
    if (images.length === 0) { setError('Keep at least one photo.'); return }
    const readyDays = Number(days)
    if (!Number.isInteger(readyDays) || readyDays < 1 || readyDays > 30) {
      setError('Enter how many days it takes to be ready, from 1 to 30.')
      return
    }
    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      images,
      deliveryEstimate: `${readyDays} day${readyDays === 1 ? '' : 's'}`,
    }
    if (!product.variantsEnabled) {
      const p = Number(price)
      const q = Number(quantity)
      if (!Number.isFinite(p) || p <= 0) { setError('Enter a valid price.'); return }
      if (!Number.isInteger(q) || q < 0) { setError('Enter a valid stock quantity.'); return }
      body.price = p
      body.quantity = q
    }

    setSaving(true)
    try {
      const res = await authFetch(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save your changes')
      router.push(`/my-shop?saved=${data.needsReview ? 'review' : 'ok'}`)
    } catch (e: any) {
      setError(e.message || 'Could not save your changes')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-surface"><Loader2 className="h-6 w-6 animate-spin text-ink-muted" /></div>
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-surface pb-16">
        <Shell width="narrow" className="pt-10">
          <p className="text-sm text-danger">{error || 'Listing not found.'}</p>
          <Link href="/my-shop" className="ui-mono ui-mono-sm mt-4 inline-block text-ink">Back to my shop</Link>
        </Shell>
      </div>
    )
  }

  const field = 'h-11 w-full border border-border bg-card px-3 text-sm text-ink outline-none focus:border-ink/40'

  return (
    <div className="min-h-screen bg-surface pb-24">
      <Shell width="narrow" className="space-y-6 pt-8">
        <Link href="/my-shop" className="ui-mono ui-mono-sm inline-flex items-center gap-2 text-ink-secondary hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> My shop
        </Link>
        <PageHeader eyebrow="Listing" title="Edit listing" description="Changes to the name, photos, description or price are reviewed again before the listing goes back on the marketplace." />

        {product.moderationStatus === 'REJECTED' && product.rejectionReason && (
          <p className="border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
            Rejected: {product.rejectionReason}. Fix it and save to send it for review again.
          </p>
        )}
        {product.moderationStatus === 'PENDING' && (
          <p className="border border-warning/25 bg-warning/5 px-3 py-2 text-sm text-warning">This listing is waiting for review.</p>
        )}

        <div className="ui-panel space-y-5 p-5">
          <div>
            <label className="ui-mono ui-mono-sm mb-2 block text-ink-muted">Photos ({images.length}/{MAX_LISTING_IMAGES})</label>
            <div className="flex flex-wrap gap-3">
              {images.map(src => (
                <div key={src} className="relative h-24 w-24 border border-border bg-surface">
                  <img src={src} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setImages(prev => prev.filter(x => x !== src))}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center bg-ink text-background"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {images.length < MAX_LISTING_IMAGES && (
                <label className="flex h-24 w-24 cursor-pointer items-center justify-center border border-dashed border-border text-ink-muted hover:border-ink/40">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                  <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => addImage(e.target.files?.[0] || null)} />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="ui-mono ui-mono-sm mb-2 block text-ink-muted">Name</label>
            <input className={field} value={name} onChange={e => setName(e.target.value)} maxLength={120} />
          </div>

          <div>
            <label className="ui-mono ui-mono-sm mb-2 block text-ink-muted">Description</label>
            <textarea className={`${field} h-32 py-3`} value={description} onChange={e => setDescription(e.target.value)} maxLength={2000} />
          </div>

          {product.variantsEnabled ? (
            <p className="text-xs text-ink-secondary">This listing has variants. Price and stock for each variant are managed from the sell page.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="ui-mono ui-mono-sm mb-2 block text-ink-muted">Price (₦)</label>
                <input className={field} inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div>
                <label className="ui-mono ui-mono-sm mb-2 block text-ink-muted">In stock</label>
                <input className={field} inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="ui-mono ui-mono-sm mb-2 block text-ink-muted">Ready in (days)</label>
            <input className={field} inputMode="numeric" value={days} onChange={e => setDays(e.target.value)} placeholder="1 to 30" />
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          onClick={save}
          disabled={saving || uploading}
          className="flex h-12 w-full items-center justify-center gap-2 bg-ink font-medium text-background disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </button>
      </Shell>
    </div>
  )
}
