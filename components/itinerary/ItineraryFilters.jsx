'use client'

import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export default function ItineraryFilters({ filters, onChange }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search trip name, destination, customer..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
          className="pl-10"
        />
      </div>
    </div>
  )
}
