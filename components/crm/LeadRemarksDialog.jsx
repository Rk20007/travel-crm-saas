'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, Send } from 'lucide-react'
import { leadDisplayName } from '@/utils/crm'

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
const authH = () => ({ Authorization: `Bearer ${token()}` })

/**
 * Conversation / remarks log for a lead. Sales executives record what was
 * discussed with the client; entries persist to the lead activity timeline.
 */
export function LeadRemarksDialog({ lead, open, onOpenChange, onSaved }) {
  const [remarks, setRemarks] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const leadId = lead?._id

  const load = async () => {
    if (!leadId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/timeline`, { headers: authH() })
      const data = await res.json().catch(() => ({}))
      setRemarks(data.timeline || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && leadId) {
      setText('')
      load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId])

  const addRemark = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/timeline`, {
        method: 'POST',
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'note', title: 'Remark', note: text.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Failed to add remark')
        return
      }
      toast.success('Remark added')
      setText('')
      load()
      onSaved?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Remarks
          </DialogTitle>
          <DialogDescription>
            {lead ? `Conversation log for ${leadDisplayName(lead)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What did you discuss with the client? Add a remark..."
            className="min-h-[80px]"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={addRemark} disabled={saving || !text.trim()}>
              <Send className="mr-1 h-4 w-4" />
              Add remark
            </Button>
          </div>
        </div>

        <div className="border-t pt-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : remarks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No remarks yet. Add the first one above.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {remarks.map((r) => (
                <div key={r._id} className="rounded-lg border bg-muted/30 p-2.5">
                  <p className="text-sm">{r.body || r.description || r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.type ? `${String(r.type).replace('_', ' ')} · ` : ''}
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
