'use client'

import { useState } from 'react'
import { ChevronDown, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export default function DayCard({
  day,
  index,
  onChange,
  onRemove,
  onDuplicate,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
}) {
  const [open, setOpen] = useState(true)

  const update = (path, value) => {
    if (path.includes('.')) {
      const [parent, child] = path.split('.')
      onChange({ [parent]: { ...day[parent], [child]: value } })
    } else {
      onChange({ [path]: value })
    }
  }

  const addTimeline = () => {
    const blocks = [...(day.timelineBlocks || []), { time: '', title: '', description: '' }]
    onChange({ timelineBlocks: blocks })
  }

  const updateTimeline = (i, field, value) => {
    const blocks = [...(day.timelineBlocks || [])]
    blocks[i] = { ...blocks[i], [field]: value }
    onChange({ timelineBlocks: blocks })
  }

  const addActivity = () => {
    const acts = [...(day.activities || []), { name: '', time: '', duration: '', description: '' }]
    onChange({ activities: acts })
  }

  const updateActivity = (i, field, value) => {
    const acts = [...(day.activities || [])]
    acts[i] = { ...acts[i], [field]: value }
    onChange({ activities: acts })
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        'rounded-xl border bg-card shadow-sm transition-opacity',
        isDragging && 'opacity-60 ring-2 ring-primary/30'
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
        <CollapsibleTrigger className="flex flex-1 items-center justify-between text-left">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-primary">
              Day {day.dayNumber}
            </span>
            <p className="font-semibold">{day.title || `Day ${day.dayNumber}`}</p>
          </div>
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </CollapsibleTrigger>
        <Button type="button" variant="ghost" size="icon" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <CollapsibleContent className="space-y-6 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Day title</Label>
            <Input value={day.title || ''} onChange={(e) => update('title', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea
              value={day.description || ''}
              onChange={(e) => update('description', e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <section className="space-y-3 rounded-lg bg-muted/30 p-4">
          <h4 className="text-sm font-semibold">Hotel</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Hotel name"
              value={day.hotel?.name || ''}
              onChange={(e) => update('hotel.name', e.target.value)}
            />
            <Input
              placeholder="Location"
              value={day.hotel?.location || ''}
              onChange={(e) => update('hotel.location', e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Timeline</h4>
            <Button type="button" variant="outline" size="sm" onClick={addTimeline}>
              <Plus className="mr-1 h-3 w-3" /> Block
            </Button>
          </div>
          {(day.timelineBlocks || []).map((block, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 md:grid-cols-3">
              <Input
                placeholder="Time"
                value={block.time || ''}
                onChange={(e) => updateTimeline(i, 'time', e.target.value)}
              />
              <Input
                placeholder="Title"
                value={block.title || ''}
                onChange={(e) => updateTimeline(i, 'title', e.target.value)}
              />
              <Input
                placeholder="Description"
                value={block.description || ''}
                onChange={(e) => updateTimeline(i, 'description', e.target.value)}
              />
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Activities</h4>
            <Button type="button" variant="outline" size="sm" onClick={addActivity}>
              <Plus className="mr-1 h-3 w-3" /> Activity
            </Button>
          </div>
          {(day.activities || []).map((act, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 md:grid-cols-4">
              <Input
                placeholder="Name"
                value={act.name || ''}
                onChange={(e) => updateActivity(i, 'name', e.target.value)}
              />
              <Input
                placeholder="Time"
                value={act.time || ''}
                onChange={(e) => updateActivity(i, 'time', e.target.value)}
              />
              <Input
                placeholder="Duration"
                value={act.duration || ''}
                onChange={(e) => updateActivity(i, 'duration', e.target.value)}
              />
              <Input
                placeholder="Location"
                value={act.location || ''}
                onChange={(e) => updateActivity(i, 'location', e.target.value)}
              />
            </div>
          ))}
        </section>

        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={day.notes || ''} onChange={(e) => update('notes', e.target.value)} rows={2} />
        </div>

        <div className="space-y-2">
          <Label>Image URLs (comma separated)</Label>
          <Input
            value={(day.images || []).join(', ')}
            onChange={(e) =>
              onChange({
                images: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="https://..."
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
