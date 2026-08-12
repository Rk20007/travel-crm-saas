'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import ItineraryStudio from '@/components/itinerary/wizard/ItineraryStudio'
import { useItinerary } from '@/hooks/useItineraries'
import { leadToStudioPrefill } from '@/modules/itinerary/studio'

function StudioLoader() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const leadId = searchParams.get('leadId')
  const { data, loading, fetchItinerary } = useItinerary(id)
  const [ready, setReady] = useState(!id && !leadId)
  const [leadPrefill, setLeadPrefill] = useState(null)

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('token')
      if (id) {
        await fetchItinerary()
      }
      if (leadId && !id) {
        const res = await fetch(`/api/leads/${leadId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (res.ok && json.lead) {
          setLeadPrefill(leadToStudioPrefill(json.lead))
        }
      }
      setReady(true)
    }
    load()
  }, [id, leadId, fetchItinerary])

  if (!ready || (id && loading)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <ItineraryStudio
      itineraryId={id}
      initialData={data}
      leadPrefill={leadPrefill}
    />
  )
}

export default function ItineraryBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <StudioLoader />
    </Suspense>
  )
}
