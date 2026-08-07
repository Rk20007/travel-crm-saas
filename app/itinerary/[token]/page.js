'use client'

import { use, useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import ItineraryPreview from '@/components/itinerary/preview/ItineraryPreview'

export default function PublicItineraryPage({ params }) {
  const { token } = use(params)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`/api/itineraries/public/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error || 'Not found')
        setData(json)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return <Skeleton className="h-screen w-full" />
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Itinerary unavailable</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <ItineraryPreview
      itinerary={data.itinerary}
      days={data.days}
      publicView
    />
  )
}
