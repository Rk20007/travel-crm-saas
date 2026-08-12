'use client'

import { use, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import ItineraryPreview from '@/components/itinerary/preview/ItineraryPreview'
import { useItinerary } from '@/hooks/useItineraries'

export default function PreviewItineraryPage({ params }) {
  const { id } = use(params)
  const { data, loading, error, fetchItinerary } = useItinerary(id)

  useEffect(() => {
    fetchItinerary()
  }, [fetchItinerary])

  const handlePdf = async () => {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/itineraries/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      toast.error('PDF export failed')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data?.itinerary?.customerName || data?.itinerary?.tripName || 'itinerary'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <Skeleton className="h-screen w-full" />
  if (error) return <p className="p-8 text-destructive">{error}</p>

  return (
    <div>
      <div className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Button variant="ghost" asChild size="sm">
          <Link href={`/dashboard/itineraries/${id}/edit`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={handlePdf} className="gap-2">
          <Download className="h-4 w-4" />
          Export PDF
        </Button>
      </div>
      <ItineraryPreview itinerary={data?.itinerary} days={data?.days} />
    </div>
  )
}
