'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Plus, MapPin, Clock, LayoutTemplate, Trash2, Search, ChevronsUpDown } from 'lucide-react'
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
import { DEFAULT_DAY } from '@/modules/itinerary/constants'

const TODAY_START = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
})()

export default function StepPlan({ form, update }) {
  const days = form.days || []
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState({})
  const [datePopoverOpen, setDatePopoverOpen] = useState({})

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/settings/day-plan-templates', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {})
      .finally(() => setTemplatesLoading(false))
  }, [])

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

      {days.map((day, index) => (
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
          <CardContent className="space-y-5">
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
                  className="text-lg font-extrabold uppercase tracking-wide text-foreground focus-visible:border-primary"
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

            <Textarea
              placeholder="Describe the day's adventure, sightseeings, and highlights..."
              value={day.description || ''}
              onChange={(e) => updateDay(index, { description: e.target.value })}
              className="min-h-[110px] rounded-xl"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
