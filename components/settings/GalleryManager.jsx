'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Upload, X, Images } from 'lucide-react'
import { cn } from '@/lib/utils'

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
const authH = () => ({ Authorization: `Bearer ${token()}` })

const MAX_GALLERY_IMAGES = 4

// Gallery images are stored as data URLs on the Brand document, so downscale +
// re-encode as JPEG client-side (same approach as hotel property photos).
const MAX_DIMENSION = 1600
const QUALITY = 0.72
// Whatever size the source photo is (a phone camera shot can be several MB),
// re-encode down to roughly this many bytes so the stored data URL stays small.
const TARGET_BYTES = 100 * 1024

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function dataUrlSize(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.ceil((base64.length * 3) / 4)
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      let dimension = MAX_DIMENSION
      let quality = QUALITY
      let dataUrl = ''
      // Shrink quality first (cheap, preserves detail), then dimension, until
      // the encoded size fits the target — bail out after a bounded number of
      // passes so a stubborn image can't loop forever.
      for (let attempt = 0; attempt < 8; attempt++) {
        const scale = Math.min(1, dimension / Math.max(img.width, img.height))
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        dataUrl = canvas.toDataURL('image/jpeg', quality)
        if (dataUrlSize(dataUrl) <= TARGET_BYTES || (quality <= 0.35 && dimension <= 640)) break
        if (quality > 0.35) quality -= 0.12
        else dimension = Math.round(dimension * 0.8)
      }
      resolve(dataUrl)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

async function toDataUrl(file) {
  if (!file.type?.startsWith('image/')) return readFileAsDataUrl(file)
  try {
    return await compressImage(file)
  } catch {
    return readFileAsDataUrl(file)
  }
}

export function GalleryManager() {
  const [gallery, setGallery] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const load = () => {
    setLoading(true)
    fetch('/api/settings/gallery', { headers: authH() })
      .then((r) => r.json())
      .then((d) => setGallery(d.gallery || []))
      .catch(() => toast.error('Could not load gallery'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    const remaining = MAX_GALLERY_IMAGES - gallery.length
    if (remaining <= 0) {
      toast.error(`You can only add up to ${MAX_GALLERY_IMAGES} images`)
      return
    }
    if (files.length > remaining) {
      toast.info(`Only ${remaining} more image${remaining > 1 ? 's' : ''} can be added (max ${MAX_GALLERY_IMAGES})`)
    }

    setUploading(true)
    try {
      const picked = files.slice(0, remaining)
      const existingUrls = new Set(gallery.map((g) => g.url))
      const compressed = await Promise.all(
        picked.map(async (file) => ({
          url: await toDataUrl(file),
          label: file.name.replace(/\.[^.]+$/, ''),
        }))
      )
      // Two different source files can compress down to byte-identical output
      // (or the same file gets picked twice) — dedupe here, since the backend
      // stores/removes gallery entries keyed by url and a duplicate would make
      // deleting one copy silently delete both.
      const images = compressed.filter((img) => {
        if (existingUrls.has(img.url)) return false
        existingUrls.add(img.url)
        return true
      })
      if (!images.length) {
        toast.info('That image is already in the gallery')
        return
      }
      const res = await fetch('/api/settings/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authH() },
        body: JSON.stringify({ images }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setGallery(data.gallery)
      toast.success('Gallery updated')
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = async (id) => {
    try {
      const res = await fetch(`/api/settings/gallery?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authH(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not remove image')
      setGallery(data.gallery)
    } catch (err) {
      toast.error(err.message || 'Could not remove image')
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Images className="h-4 w-4" />
          Itinerary Cover Gallery
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload up to {MAX_GALLERY_IMAGES} images. These are the only images agents can pick from as cover
          photos when building an itinerary. {gallery.length}/{MAX_GALLERY_IMAGES} added.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFiles}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {gallery.map((item, idx) => (
          <div key={item._id || idx} className="relative aspect-4/3 overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.label || ''} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(item._id)}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
              title="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {gallery.length < MAX_GALLERY_IMAGES && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex aspect-4/3 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary',
              uploading && 'pointer-events-none opacity-60'
            )}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span className="px-4 text-center text-[11px] font-semibold uppercase leading-relaxed tracking-wide">
                  Add image
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
