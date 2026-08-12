'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export default function StepVisuals({ form, update }) {
  const [gallery, setGallery] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [templates, setTemplates] = useState([])
  const selected = form.gallery || []

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/gallery', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const items = d.gallery || []
        setGallery(items)
        // Gallery images are covers by default — no manual selection step needed.
        if (selected.length === 0 && items.length > 0) {
          const autoSelected = items.slice(0, 4).map((item) => item.url)
          update({ gallery: autoSelected, bannerImage: autoSelected[0] || '' })
        }
      })
      .catch(() => {})
      .finally(() => setGalleryLoading(false))
    fetch('/api/settings/marketing-templates', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleImage = (url) => {
    const current = [...selected]
    const idx = current.indexOf(url)
    if (idx >= 0) {
      current.splice(idx, 1) // deselect
    } else if (current.length < 4) {
      current.push(url) // add — only while under 4
    } else {
      return // already 4 selected → ignore extra selections
    }
    update({ gallery: current, bannerImage: current[0] || '' })
  }

  const applyTemplate = (id) => {
    if (!id || id === 'none') return
    const template = templates.find((t) => t._id === id)
    if (!template) return
    update({
      marketingTemplate: id,
      marketingOverview: template.description || '',
    })
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Cover images</CardTitle>
          <CardDescription>
            The first 4 images from your agency gallery are used as covers automatically. Click an image to remove it, or click a gallery image to add it back (up to 4). The first image is used as the primary cover.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {galleryLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading gallery…
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {gallery.map((item) => {
              const pos = selected.indexOf(item.url)
              const isSelected = pos >= 0
              const atMax = !isSelected && selected.length >= 4
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleImage(item.url)}
                  disabled={atMax}
                  title={atMax ? 'You can select only 4 images' : undefined}
                  className={cn(
                    'group relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition-all',
                    isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40',
                    atMax && 'cursor-not-allowed opacity-40 hover:border-border'
                  )}
                >
                  <Image src={item.url} alt={item.label} fill className="object-cover" unoptimized />
                  {pos === 0 && (
                    <Badge className="absolute left-2 top-2">Primary</Badge>
                  )}
                  {isSelected && pos > 0 && (
                    <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {pos + 1}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground">{selected.length}/4 cover images</p>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Marketing overview</CardTitle>
          <CardDescription>A short welcome summary for the itinerary cover and PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="shrink-0">Template</Label>
            <Select onValueChange={applyTemplate}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Write a welcoming summary that captures the traveler's imagination..."
            value={form.marketingOverview}
            onChange={(e) => update({ marketingOverview: e.target.value })}
            className="min-h-[140px]"
          />
        </CardContent>
      </Card>
    </div>
  )
}
