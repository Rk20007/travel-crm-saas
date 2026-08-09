'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Public sign-up is retired — agencies are provisioned by a super admin
 * after a "Book a Demo" request. Anyone who still lands on /register (old
 * bookmark, shared link) gets sent to the marketing page instead of a 404.
 */
export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/?demo=1')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        <p className="text-muted-foreground">Redirecting…</p>
      </div>
    </div>
  )
}
