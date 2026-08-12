'use client'

import { useEffect, useState } from 'react'
import { Loader2, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null)

const ACTION_COLORS = {
  create: 'bg-success/15 text-success',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  archive: 'bg-amber-100 text-amber-800',
  restore: 'bg-teal-100 text-teal-800',
  seed: 'bg-slate-100 text-slate-800',
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/settings/audit?limit=100', {
          headers: { Authorization: `Bearer ${token()}` },
        })
        const data = await res.json()
        if (res.ok) setLogs(data.logs || [])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Audit Logs</h3>
        <p className="text-sm text-muted-foreground">
          Recent changes to master data and hotels in this workspace.
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border p-10 text-center">
          <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <ul className="divide-y">
            {logs.map((l) => (
              <li key={l._id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                <Badge
                  className={`shrink-0 capitalize ${ACTION_COLORS[l.action] || ''}`}
                  variant="secondary"
                >
                  {l.action}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{l.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.actorName || l.actorEmail || 'System'} ·{' '}
                    {new Date(l.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
