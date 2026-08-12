'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import ItineraryForm from '@/components/itinerary/form/ItineraryForm'
import { useItinerary } from '@/hooks/useItineraries'

export default function EditItineraryPage({ params }) {
  const { id } = use(params)
  const { data, loading, error, fetchItinerary, saveItinerary } = useItinerary(id)
  const [members, setMembers] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchItinerary()
  }, [fetchItinerary])

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/team/members', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setMembers(d.members || []))
      .catch(() => {})
  }, [])

  const handlePreview = async () => {
    // Open synchronously on click — opening after the await below loses the
    // user-gesture context and the tab gets silently popup-blocked.
    const previewWindow = window.open('', '_blank')
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/itineraries/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      previewWindow?.close()
      toast.error('PDF preview failed')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    if (previewWindow) {
      previewWindow.location.href = url
    } else {
      window.open(url, '_blank')
    }
  }

  const onSubmit = async (payload) => {
    setSaving(true)
    try {
      await saveItinerary(payload, id)
      toast.success('Itinerary saved')
      fetchItinerary()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive">{error}</p>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" asChild className="gap-2">
        <Link href="/dashboard/itineraries">
          <ArrowLeft className="h-4 w-4" />
          Back to itineraries
        </Link>
      </Button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Edit itinerary</h1>
          <p className="mt-1 text-muted-foreground">
            {data?.itinerary?.customerName || data?.itinerary?.tripName}
          </p>
        </div>
        <Button variant="outline" onClick={handlePreview} className="w-full sm:w-auto">
          Preview
        </Button>
      </div>
      <ItineraryForm
        initialData={data}
        members={members}
        onSubmit={onSubmit}
        saving={saving}
      />
    </div>
  )
}
