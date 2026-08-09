'use client'

import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DEFAULT_DAY } from '@/modules/itinerary/constants'
import DayCard from './DayCard'

function reindexDays(days) {
  return days.map((d, i) => ({ ...d, dayNumber: i + 1, sortOrder: i }))
}

export default function DayPlanner({ days = [], onChange }) {
  const [dragIndex, setDragIndex] = useState(null)

  const updateDays = useCallback(
    (next) => {
      onChange(reindexDays(next))
    },
    [onChange]
  )

  const addDay = () => {
    updateDays([
      ...days,
      {
        ...DEFAULT_DAY,
        dayNumber: days.length + 1,
        sortOrder: days.length,
        title: `Day ${days.length + 1}`,
      },
    ])
  }

  const updateDay = (index, patch) => {
    const next = [...days]
    next[index] = { ...next[index], ...patch }
    updateDays(next)
  }

  const removeDay = (index) => {
    updateDays(days.filter((_, i) => i !== index))
  }

  const duplicateDay = (index) => {
    const copy = { ...days[index], title: `${days[index].title || `Day ${index + 1}`} (Copy)` }
    const next = [...days]
    next.splice(index + 1, 0, copy)
    updateDays(next)
  }

  const onDragStart = (index) => setDragIndex(index)

  const onDragOver = (e, index) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const next = [...days]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(index, 0, moved)
    setDragIndex(index)
    updateDays(next)
  }

  const onDragEnd = () => setDragIndex(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Day Planner</h3>
          <p className="text-sm text-muted-foreground">
            Build unlimited days with activities, meals, hotels & timeline
          </p>
        </div>
        <Button type="button" variant="outline" onClick={addDay} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Day
        </Button>
      </div>

      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No days added. Click &quot;Add Day&quot; to start planning.
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day, index) => (
            <DayCard
              key={`day-${index}-${day.dayNumber}`}
              day={day}
              index={index}
              onChange={(patch) => updateDay(index, patch)}
              onRemove={() => removeDay(index)}
              onDuplicate={() => duplicateDay(index)}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={onDragEnd}
              isDragging={dragIndex === index}
            />
          ))}
        </div>
      )}
    </div>
  )
}
