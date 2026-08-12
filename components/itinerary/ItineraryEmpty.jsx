'use client'

import { Map, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function ItineraryEmpty({ hasFilters }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Map className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-xl font-semibold">
        {hasFilters ? 'No itineraries match your filters' : 'No itineraries yet'}
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {hasFilters
          ? 'Try adjusting search or filters to find what you need.'
          : 'Create your first professional travel itinerary with day-by-day planning, pricing, and PDF export.'}
      </p>
      {!hasFilters && (
        <Button asChild className="mt-6 gap-2">
          <Link href="/dashboard/itinerary-builder">
            <Plus className="h-4 w-4" />
            Create itinerary
          </Link>
        </Button>
      )}
    </div>
  )
}
