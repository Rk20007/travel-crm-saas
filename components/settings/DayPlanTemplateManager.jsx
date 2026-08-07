'use client'

import { useEffect, useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Search, Trash2, Pencil, Ruler, Clock, Loader2, Route } from 'lucide-react'

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
const authH = () => ({ Authorization: `Bearer ${token()}` })

const emptyTemplate = { title: '', distance: '', duration: '', description: '' }

export function DayPlanTemplateManager() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyTemplate)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/day-plan-templates', { headers: authH() })
      const data = await res.json()
      if (res.ok) setTemplates(data.templates || [])
      else toast.error(data.error || 'Failed to load templates')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates.filter((t) => !q || t.title?.toLowerCase().includes(q))
  }, [templates, search])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyTemplate)
    setDialogOpen(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({
      title: t.title || '',
      distance: t.distance || '',
      duration: t.duration || '',
      description: t.description || '',
    })
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.title.trim()) {
      toast.error('Template title is required')
      return
    }
    setSaving(true)
    try {
      const url = editing
        ? `/api/settings/day-plan-templates/${editing._id}`
        : '/api/settings/day-plan-templates'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Save failed')
        return
      }
      toast.success(editing ? 'Template updated' : 'Saved to master')
      setDialogOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (t) => {
    if (!confirm(`Delete "${t.title}"?`)) return
    const res = await fetch(`/api/settings/day-plan-templates/${t._id}`, {
      method: 'DELETE',
      headers: authH(),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || 'Delete failed')
      return
    }
    toast.success('Deleted')
    load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Day Plan Templates</h3>
        <p className="text-sm text-muted-foreground">
          Reusable day blocks (title, distance, time, description) — apply them in one click while building itineraries.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" className="gap-1" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add template
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border p-10 text-center">
          <Route className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No day plan templates yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div key={t._id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-primary">{t.title}</p>
                  {!t.isActive && <Badge variant="outline" className="mt-1">Inactive</Badge>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(t)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {(t.distance || t.duration) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {t.distance && (
                    <span className="flex items-center gap-1">
                      <Ruler className="h-3 w-3" /> Distance: {t.distance} km
                    </span>
                  )}
                  {t.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Time: {t.duration} hrs
                    </span>
                  )}
                </div>
              )}
              {t.description && (
                <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit day plan template' : 'Add day plan template'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update this reusable day block.'
                : 'Save a reusable day block that can be applied to any itinerary day.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Day 1: Arrival"
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Distance (km)</Label>
                <Input
                  value={form.distance}
                  onChange={(e) => setForm({ ...form, distance: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="e.g. 50"
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label>Time (hours)</Label>
                <Input
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder="e.g. 2"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div>
              <Label>Day Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Day Description..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="gap-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Save' : 'Save to Master'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
