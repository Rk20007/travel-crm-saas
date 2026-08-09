'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, ExternalLink, Plus, Map as MapIcon, Calendar } from 'lucide-react'
import { leadDisplayName, formatInr } from '@/utils/crm'

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null)

export function LeadItinerariesDialog({ lead, open, onOpenChange }) {
  const [itineraries, setItineraries] = useState([])
  const [loading, setLoading] = useState(true)
  const leadId = lead?._id

  useEffect(() => {
    if (!open || !leadId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/itineraries?leadId=${leadId}&limit=50`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setItineraries(data.itineraries || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, leadId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-primary" />
            Itineraries
          </DialogTitle>
          <DialogDescription>
            {lead ? `Itineraries created for ${leadDisplayName(lead)}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : itineraries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <MapIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No itineraries created yet.</p>
            <Button asChild size="sm" className="mt-3">
              <Link href={`/dashboard/itinerary-builder?leadId=${leadId}`}>
                <Plus className="mr-1 h-4 w-4" /> Create itinerary
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {itineraries.map((it) => (
              <div
                key={it._id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{leadDisplayName(lead)}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {it.destination || '—'}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline" className="capitalize">
                      {it.status || 'draft'}
                    </Badge>
                    <span className="font-medium">
                      {formatInr(it.totalPrice || it.totalCost || 0, it.currency)}
                    </span>
                    {it.startDate && (
                      <span className="flex items-center gap-0.5 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(it.startDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/itineraries/${it._id}/preview`} target="_blank">
                      <ExternalLink className="mr-1 h-3 w-3" /> View
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/dashboard/itinerary-builder?id=${it._id}`}>Edit</Link>
                  </Button>
                </div>
              </div>
            ))}
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href={`/dashboard/itinerary-builder?leadId=${leadId}`}>
                <Plus className="mr-1 h-4 w-4" /> Create new itinerary
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
