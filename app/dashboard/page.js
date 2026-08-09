'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDashboardRoute } from '@/lib/permissions-client'

export default function DashboardRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const route = getDashboardRoute(user.role)
      router.replace(route)
    } catch {
      router.replace('/login')
    }
  }, [router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  )
}
