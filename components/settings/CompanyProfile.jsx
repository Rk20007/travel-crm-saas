'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Upload, X, Building2, QrCode } from 'lucide-react'

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null)

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(file)
  })

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

const dataUrlBytes = (dataUrl) => Math.floor(((dataUrl.split(',')[1] || '').length) * 0.75)

/**
 * Take any image file and return a PNG data-URL that fits within maxBytes,
 * shrinking the dimensions until it does. No size limit on the input.
 */
async function compressToPng(file, maxBytes = 600 * 1024, startDim = 1000) {
  const img = await loadImage(await readAsDataURL(file))
  let scale = Math.min(1, startDim / Math.max(img.width, img.height))
  let out = ''
  for (let i = 0; i < 12; i++) {
    const cw = Math.max(1, Math.round(img.width * scale))
    const ch = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, cw, ch)
    out = canvas.toDataURL('image/png')
    if (dataUrlBytes(out) <= maxBytes) return out
    scale *= 0.8
  }
  return out // best effort after max shrink attempts
}

const EMPTY = {
  name: '',
  logo: '',
  website: '',
  phone: '',
  email: '',
  metaLink: '',
  address: '',
  address2: '',
  scanner1: '',
  bankDetails: { bankName: '', accountName: '', accountNumber: '', ifscCode: '' },
}

export function CompanyProfile() {
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const scanner1Ref = useRef(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/settings/company', {
          headers: { Authorization: `Bearer ${token()}` },
        })
        const data = await res.json()
        if (res.ok && data.company) {
          const c = data.company
          setForm({
            name: c.name || '',
            logo: c.logo || '',
            website: c.website || '',
            phone: c.phone || '',
            email: c.email || '',
            metaLink: c.metaLink || '',
            address: c.address || '',
            address2: c.address2 || '',
            scanner1: c.scanner1 || '',
            bankDetails: {
              bankName: c.bankDetails?.bankName || '',
              accountName: c.bankDetails?.accountName || '',
              accountNumber: c.bankDetails?.accountNumber || '',
              ifscCode: c.bankDetails?.ifscCode || '',
            },
          })
        } else {
          toast.error(data.error || 'Failed to load company')
        }
      } catch {
        toast.error('Network error')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const setBank = (patch) =>
    setForm((prev) => ({ ...prev, bankDetails: { ...prev.bankDetails, ...patch } }))

  const onImageFile = async (e, field) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      e.target.value = ''
      return
    }
    try {
      // Any size in → auto-shrunk PNG under 600 KB out.
      const dataUrl = await compressToPng(file)
      set({ [field]: dataUrl })
    } catch {
      toast.error('Could not process this image')
    }
    e.target.value = '' // allow re-selecting the same file
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Company name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/company', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Save failed')
        return
      }
      toast.success('Company profile saved')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const renderScanner = (field, inputRef, label) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {form[field] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form[field]} alt={label} className="h-full w-full object-contain" />
          ) : (
            <QrCode className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onImageFile(e, field)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Upload
            </Button>
            {form[field] && (
              <Button size="sm" variant="ghost" onClick={() => set({ [field]: '' })}>
                <X className="mr-1 h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          <Input
            value={form[field]?.startsWith('data:') ? '' : form[field]}
            onChange={(e) => set({ [field]: e.target.value })}
            placeholder="or paste QR image URL"
            className="max-w-xs"
          />
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Company Profile</h3>
        <p className="text-sm text-muted-foreground">
          Your agency’s branding — this logo and these details appear on every itinerary and PDF.
        </p>
      </div>

      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {form.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logo} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onImageFile(e, 'logo')}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Upload logo
            </Button>
            {form.logo && (
              <Button size="sm" variant="ghost" onClick={() => set({ logo: '' })}>
                <X className="mr-1 h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Any image — auto-resized to PNG under 600 KB. Or paste a URL below.
          </p>
          <Input
            value={form.logo?.startsWith('data:') ? '' : form.logo}
            onChange={(e) => set({ logo: e.target.value })}
            placeholder="https://your-logo-url.png"
            className="max-w-sm"
          />
        </div>
      </div>

      {/* Basic details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Company name *</Label>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div>
          <Label>Website</Label>
          <Input value={form.website} onChange={(e) => set({ website: e.target.value })} placeholder="www.example.com" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 ..." />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="hello@example.com" />
        </div>
        <div className="sm:col-span-2">
          <Label>Meta link (Facebook / Instagram)</Label>
          <Input
            value={form.metaLink}
            onChange={(e) => set({ metaLink: e.target.value })}
            placeholder="https://facebook.com/yourpage"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Address 1</Label>
          <Textarea
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            placeholder="Primary office address shown on itineraries"
            className="min-h-[70px]"
          />
        </div>
        <div>
          <Label>Address 2 (optional)</Label>
          <Textarea
            value={form.address2}
            onChange={(e) => set({ address2: e.target.value })}
            placeholder="Second office / branch address"
            className="min-h-[70px]"
          />
        </div>
      </div>

      {/* Bank details */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Bank details (for payments on itinerary)</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Bank name</Label>
            <Input value={form.bankDetails.bankName} onChange={(e) => setBank({ bankName: e.target.value })} />
          </div>
          <div>
            <Label>Account name</Label>
            <Input value={form.bankDetails.accountName} onChange={(e) => setBank({ accountName: e.target.value })} />
          </div>
          <div>
            <Label>Account number</Label>
            <Input value={form.bankDetails.accountNumber} onChange={(e) => setBank({ accountNumber: e.target.value })} />
          </div>
          <div>
            <Label>IFSC code</Label>
            <Input value={form.bankDetails.ifscCode} onChange={(e) => setBank({ ifscCode: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Payment scanner (QR code) */}
      <div>
        <h4 className="mb-2 text-sm font-semibold">Payment scanner (QR)</h4>
        <p className="mb-3 text-xs text-muted-foreground">
          Your payment QR code (e.g. UPI / GPay) shown on the itinerary.
        </p>
        {renderScanner('scanner1', scanner1Ref, 'Scanner')}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save company profile
        </Button>
      </div>
    </div>
  )
}
