'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShieldAlert, LogOut } from 'lucide-react'
import { getImpersonation, impersonationRemainingMs, stopImpersonation } from '@/lib/impersonation'

function formatCountdown(ms) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Persistent warning shown for the whole duration of a support session, so an
 * admin can never forget which account they are acting as.
 */
export function ImpersonationBanner() {
  const [session, setSession] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const current = getImpersonation()
    if (!current) return
    setSession(current)
    setRemaining(impersonationRemainingMs(current))

    const id = window.setInterval(() => {
      const ms = impersonationRemainingMs(current)
      setRemaining(ms)
      // The token is dead at this point; every request would 401, so hand the
      // admin their own session back instead of letting the app fail silently.
      if (ms <= 0) {
        window.clearInterval(id)
        stopImpersonation({ notifyServer: false }).finally(() => {
          window.location.href = '/dashboard/platform/agencies'
        })
      }
    }, 1000)

    return () => window.clearInterval(id)
  }, [])

  if (!session) return null

  const exit = async () => {
    setExiting(true)
    const restored = await stopImpersonation()
    window.location.href = restored ? '/dashboard/platform/agencies' : '/login'
  }

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">
          Support session — viewing as{' '}
          <strong>{session.targetName || session.targetEmail}</strong>
          {session.agencyName ? <> at <strong>{session.agencyName}</strong></> : null}. All actions
          are recorded.
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-xs tabular-nums">{formatCountdown(remaining)}</span>
        <Button size="sm" variant="outline" onClick={exit} disabled={exiting}>
          <LogOut className="mr-2 h-3.5 w-3.5" />
          {exiting ? 'Exiting…' : 'Exit'}
        </Button>
      </div>
    </div>
  )
}
