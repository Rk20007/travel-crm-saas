'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewItineraryPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/itinerary-builder')
  }, [router])
  return null
}
