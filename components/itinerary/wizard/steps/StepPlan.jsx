'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Plus,
  MapPin,
  Clock,
  LayoutTemplate,
  Loader2,
  Trash2,
  Search,
  ChevronsUpDown,
  ImagePlus,
  Upload,
  X,
  Bold,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarPicker } from '@/components/ui/calendar'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { toCompressedDataUrl } from '@/lib/imageCompress'
import { DEFAULT_DAY } from '@/modules/itinerary/constants'
import { PDF_THEME_OPTIONS } from '@/modules/itinerary/pdfThemes'

const TODAY_START = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
})()

export default function StepPlan({ form, update, showErrors = false }) {
  const days = form.days || []
  const theme = form.pdfTheme || 'classic'
  const isOcean = theme === 'ocean'
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState({})
  const [datePopoverOpen, setDatePopoverOpen] = useState({})
  const [gallery, setGallery] = useState([])
  const [imagePopoverOpen, setImagePopoverOpen] = useState({})
  const [uploadingIndex, setUploadingIndex] = useState(null)
  const fileInputRefs = useRef({})
  const descriptionRefs = useRef({})

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/settings/day-plan-templates', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false))
  }, [])

  // Only fetched when Ocean Blue is the active design — that's the only
  // theme whose day-wise timeline shows a per-day photo.
  useEffect(() => {
    if (!isOcean || gallery.length) return
    const token = localStorage.getItem('token')
    fetch('/api/gallery', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setGallery(d.gallery || []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOcean])

  const updateDay = (index, patch) => {
    let next = days.map((d, i) => (i === index ? { ...d, ...patch } : d))

    // Setting a day's date cascades forward — each later day auto-fills to
    // the next consecutive date, so only Day 1's date needs to be picked.
    if (patch.date) {
      const base = new Date(patch.date)
      if (!Number.isNaN(base.getTime())) {
        next = next.map((d, i) => {
          if (i <= index) return d
          const dt = new Date(base)
          dt.setDate(dt.getDate() + (i - index))
          return { ...d, date: dt.toISOString().slice(0, 10) }
        })
      }
    }

    update({ days: next })
  }

  // Wraps the currently selected text in the day's description with `**`
  // markers (or unwraps it, if the selection is already exactly a bolded
  // phrase) — the PDF and the public preview page both render these as real
  // bold text, this is just the plain-text source of truth for it.
  const toggleBold = (index) => {
    const el = descriptionRefs.current[index]
    if (!el) return
    const { selectionStart: start, selectionEnd: end, value } = el
    if (start === end) {
      toast.info('Select the text you want to bold first')
      return
    }
    const already = value.slice(start - 2, start) === '**' && value.slice(end, end + 2) === '**'
    let nextValue
    let nextStart
    let nextEnd
    if (already) {
      nextValue = value.slice(0, start - 2) + value.slice(start, end) + value.slice(end + 2)
      nextStart = start - 2
      nextEnd = end - 2
    } else {
      const selected = value.slice(start, end)
      nextValue = value.slice(0, start) + `**${selected}**` + value.slice(end)
      nextStart = start + 2
      nextEnd = end + 2
    }
    updateDay(index, { description: nextValue })
    // Restore the selection after the value updates, so bolding reads as an
    // in-place toggle instead of losing the user's place.
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(nextStart, nextEnd)
    })
  }

  const addDay = () => {
    const n = days.length + 1
    update({
      days: [
        ...days,
        {
          ...DEFAULT_DAY,
          dayNumber: n,
          sortOrder: days.length,
          title: `Day ${n}`,
        },
      ],
    })
  }

  const removeDay = (index) => {
    if (days.length <= 1) return
    const next = days
      .filter((_, i) => i !== index)
      .map((d, i) => ({ ...d, dayNumber: i + 1, sortOrder: i }))
    update({ days: next })
  }

  const setDayImage = (index, url) => {
    updateDay(index, { images: url ? [url] : [] })
    setImagePopoverOpen((s) => ({ ...s, [index]: false }))
  }

  const handleDayFilePick = async (index, e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingIndex(index)
    try {
      const dataUrl = await toCompressedDataUrl(file, 300 * 1024)
      setDayImage(index, dataUrl)
    } catch {
      toast.error('Could not process that image')
    } finally {
      setUploadingIndex(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Day-wise plan</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">Build your itinerary timeline day by day</p>
        </div>
        <Button type="button" onClick={addDay} size="sm" className="h-9 shrink-0 gap-1 px-3 shadow-sm sm:px-4">
          <Plus className="h-4 w-4" />
          <span className="sm:hidden">Day</span>
          <span className="hidden sm:inline">Add day</span>
        </Button>
      </div>

      {/* Design theme — Ocean Blue's day-wise timeline shows a photo beside
       * every day, so it needs picking before that option can appear. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
        <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Design theme:
        </span>
        {PDF_THEME_OPTIONS.filter((t) => t.available).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => update({ pdfTheme: t.id })}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              theme === t.id
                ? 'border-transparent text-white'
                : 'border-border/60 text-muted-foreground hover:border-border'
            )}
            style={theme === t.id ? { backgroundColor: t.primary } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {days.map((day, index) => {
        // Highlighted red the moment Continue was blocked on a blank day —
        // clears itself live as soon as that field is typed into.
        const titleMissing = showErrors && !day.title?.trim()
        const descriptionMissing = showErrors && !day.description?.trim()
        return (
        <Card
          key={index}
          className="overflow-hidden rounded-2xl border-border/60 shadow-[0_10px_30px_-15px_rgba(11,28,45,0.35)]"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b border-border/60 bg-linear-to-r from-primary/10 to-transparent pb-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
              <Badge className="shrink-0 bg-primary text-white hover:bg-primary">Day {day.dayNumber}</Badge>
              <CardTitle className="truncate text-sm font-medium sm:text-base">
                {day.title || `Day ${day.dayNumber}`}
              </CardTitle>
            </div>
            {days.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeDay(index)}
                className="shrink-0 text-destructive"
              >
                Remove
              </Button>
            )}
          </CardHeader>
          <CardContent className={isOcean ? 'sm:grid sm:grid-cols-[1fr_190px] sm:items-start sm:gap-5' : undefined}>
            <div className="space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                  <LayoutTemplate className="h-3.5 w-3.5" /> Search Templates:
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    updateDay(index, { title: '', distance: '', travelDuration: '', description: '' })
                  }
                  className="text-muted-foreground hover:text-destructive"
                  title="Clear day fields"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Popover
                open={!!templatePopoverOpen[index]}
                onOpenChange={(open) => setTemplatePopoverOpen((s) => ({ ...s, [index]: open }))}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between rounded-xl font-normal text-muted-foreground"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Search className="h-4 w-4 shrink-0" />
                      Type to search templates...
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Type to search templates..." />
                    <CommandList>
                      <CommandEmpty>
                        {templatesLoading
                          ? 'Loading templates…'
                          : templates.length === 0
                            ? 'No templates saved yet — add some under Settings → Day Plan Templates.'
                            : 'No templates found.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {templates.map((t) => (
                          <CommandItem
                            key={t._id}
                            value={t.title}
                            onSelect={() => {
                              updateDay(index, {
                                title: t.title,
                                distance: t.distance || '',
                                travelDuration: t.duration || '',
                                description: t.description || '',
                              })
                              setTemplatePopoverOpen((s) => ({ ...s, [index]: false }))
                            }}
                          >
                            {t.title}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wide text-primary">
                  Activity Title
                </Label>
                <Input
                  value={day.title}
                  onChange={(e) => updateDay(index, { title: e.target.value })}
                  placeholder="e.g. Arrival in Srinagar"
                  className={cn(
                    'text-lg font-extrabold uppercase tracking-wide text-foreground focus-visible:border-primary',
                    titleMissing && 'border-destructive focus-visible:border-destructive'
                  )}
                />
              </div>
              <div className="flex items-center justify-between gap-2 sm:block sm:space-y-1.5">
                <Label className="shrink-0 text-[10px] font-bold uppercase leading-tight tracking-wide text-accent-secondary sm:text-xs">
                  Schedule Date
                </Label>
                <Popover
                  open={!!datePopoverOpen[index]}
                  onOpenChange={(open) => setDatePopoverOpen((s) => ({ ...s, [index]: open }))}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="relative w-32 shrink-0 rounded-full border border-accent-secondary/30 bg-accent-secondary/10 py-2 pl-3 pr-2 text-left text-sm font-bold text-accent-secondary"
                    >
                      {day.date ? format(new Date(String(day.date).slice(0, 10)), 'dd MMM yyyy') : 'Select date'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={day.date ? new Date(String(day.date).slice(0, 10)) : undefined}
                      onSelect={(date) => {
                        if (!date) return
                        updateDay(index, { date: format(date, 'yyyy-MM-dd') })
                        setDatePopoverOpen((s) => ({ ...s, [index]: false }))
                      }}
                      disabled={{ before: TODAY_START }}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Distance in km"
                  value={day.distance || ''}
                  onChange={(e) => updateDay(index, { distance: e.target.value.replace(/[^0-9]/g, '') })}
                  className="rounded-full pl-10"
                  inputMode="numeric"
                />
              </div>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Time in hours"
                  value={day.travelDuration || ''}
                  onChange={(e) => updateDay(index, { travelDuration: e.target.value.replace(/[^0-9.]/g, '') })}
                  className="rounded-full pl-10"
                  inputMode="decimal"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wide text-primary">Description</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => toggleBold(index)}
                  title="Bold the selected text"
                >
                  <Bold className="h-3.5 w-3.5" />
                  Bold
                </Button>
              </div>
              <Textarea
                ref={(el) => {
                  descriptionRefs.current[index] = el
                }}
                placeholder="Describe the day's adventure, sightseeings, and highlights..."
                value={day.description || ''}
                onChange={(e) => updateDay(index, { description: e.target.value })}
                className={cn(
                  'min-h-[110px] rounded-xl',
                  descriptionMissing && 'border-destructive focus-visible:border-destructive'
                )}
              />
            </div>
            </div>

            {/* Ocean Blue only — its day-wise timeline shows one photo beside
             * each day, picked from the agency's own gallery. */}
            {isOcean && (
              <div className="mt-4 space-y-1.5 sm:mt-0">
                <Label className="text-xs font-bold uppercase tracking-wide text-primary">Day photo</Label>
                <Popover
                  open={!!imagePopoverOpen[index]}
                  onOpenChange={(open) => setImagePopoverOpen((s) => ({ ...s, [index]: open }))}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="relative flex aspect-square w-full max-w-[190px] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border hover:border-primary/50"
                    >
                      {day.images?.[0] ? (
                        <>
                          <Image src={day.images[0]} alt="" fill className="object-cover" unoptimized />
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              setDayImage(index, null)
                            }}
                            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                            title="Remove photo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </span>
                        </>
                      ) : (
                        <span className="flex flex-col items-center gap-1.5 text-xs text-muted-foreground">
                          <ImagePlus className="h-5 w-5" />
                          Add photo
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <input
                      ref={(el) => {
                        fileInputRefs.current[index] = el
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleDayFilePick(index, e)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mb-3 w-full gap-2"
                      disabled={uploadingIndex === index}
                      onClick={() => fileInputRefs.current[index]?.click()}
                    >
                      {uploadingIndex === index ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Upload from laptop / phone
                    </Button>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Or choose from gallery</p>
                    <div className="grid grid-cols-3 gap-2">
                      {gallery.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDayImage(index, item.url)}
                          className={cn(
                            'relative aspect-square overflow-hidden rounded-lg border-2',
                            day.images?.[0] === item.url ? 'border-primary' : 'border-transparent hover:border-border'
                          )}
                        >
                          <Image src={item.url} alt={item.label || ''} fill className="object-cover" unoptimized />
                        </button>
                      ))}
                      {gallery.length === 0 && (
                        <p className="col-span-3 text-xs text-muted-foreground">No gallery images yet.</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>
      )})}
    </div>
  )
}
