'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/crm/PageHeader'
import { guardSuperadmin, saFetch, formatINR } from '@/lib/superadmin-client'

const NUMERIC_LIMITS = [
  { key: 'maxBrands', label: 'Max brands' },
  { key: 'maxAgents', label: 'Max staff seats' },
  { key: 'maxLeadsPerMonth', label: 'Leads per month' },
]

const FEATURE_LIMITS = [
  { key: 'automation', label: 'Automation' },
  { key: 'whatsappAutomation', label: 'WhatsApp automation' },
  { key: 'apiIngest', label: 'API lead ingest' },
]

const EMPTY_PLAN = {
  key: '',
  name: '',
  description: '',
  priceMonthly: 0,
  sortOrder: 10,
  limits: {
    maxBrands: 1,
    maxAgents: 3,
    maxLeadsPerMonth: 500,
    automation: false,
    whatsappAutomation: false,
    apiIngest: false,
  },
}

export default function PlansPage() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(EMPTY_PLAN)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await saFetch('/api/superadmin/plans')
      setPlans(data.plans || [])
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!guardSuperadmin()) return
    load()
  }, [load])

  // Edits are held locally per card so the admin can adjust several fields
  // before committing them in one PATCH.
  const editPlan = (key, patch) => {
    setPlans((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  const editLimit = (key, limitKey, value) => {
    setPlans((prev) =>
      prev.map((p) => (p.key === key ? { ...p, limits: { ...p.limits, [limitKey]: value } } : p))
    )
  }

  const savePlan = async (plan) => {
    setSavingKey(plan.key)
    try {
      await saFetch('/api/superadmin/plans', {
        method: 'PATCH',
        body: {
          key: plan.key,
          name: plan.name,
          description: plan.description,
          priceMonthly: Number(plan.priceMonthly),
          sortOrder: Number(plan.sortOrder),
          isActive: plan.isActive,
          limits: plan.limits,
        },
      })
      toast.success(`${plan.name} saved`)
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingKey(null)
    }
  }

  const createPlan = async () => {
    setCreating(true)
    try {
      await saFetch('/api/superadmin/plans', { method: 'POST', body: draft })
      toast.success('Plan created')
      setCreateOpen(false)
      setDraft(EMPTY_PLAN)
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  const deletePlan = async (plan) => {
    if (!confirm(`Delete the "${plan.name}" plan?`)) return
    try {
      await saFetch(`/api/superadmin/plans?key=${encodeURIComponent(plan.key)}`, { method: 'DELETE' })
      toast.success('Plan deleted')
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Plan pricing and the caps that gate brands, staff seats, monthly leads and automation. Individual agencies can be given overrides from their detail page."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Plan
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.key} className={plan.isActive === false ? 'opacity-70' : undefined}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate">{plan.name}</CardTitle>
                  <CardDescription className="font-mono text-xs">{plan.key}</CardDescription>
                </div>
                <Badge variant={plan.agencyCount ? 'secondary' : 'outline'}>
                  {plan.agencyCount} {plan.agencyCount === 1 ? 'agency' : 'agencies'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Display name</Label>
                <Input value={plan.name} onChange={(e) => editPlan(plan.key, { name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  rows={2}
                  value={plan.description || ''}
                  onChange={(e) => editPlan(plan.key, { description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Price / month ({plan.currency || 'INR'})</Label>
                  <Input
                    type="number"
                    min={0}
                    value={plan.priceMonthly ?? 0}
                    onChange={(e) => editPlan(plan.key, { priceMonthly: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Sort order</Label>
                  <Input
                    type="number"
                    value={plan.sortOrder ?? 0}
                    onChange={(e) => editPlan(plan.key, { sortOrder: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                {NUMERIC_LIMITS.map((l) => (
                  <div key={l.key} className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-normal">{l.label}</Label>
                    <Input
                      type="number"
                      min={0}
                      className="w-28"
                      value={plan.limits?.[l.key] ?? 0}
                      onChange={(e) => editLimit(plan.key, l.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t pt-4">
                {FEATURE_LIMITS.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-normal">{f.label}</Label>
                    <Switch
                      checked={Boolean(plan.limits?.[f.key])}
                      onCheckedChange={(v) => editLimit(plan.key, f.key, v)}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-normal">Available for new agencies</Label>
                    <p className="text-xs text-muted-foreground">
                      Existing agencies keep the plan either way.
                    </p>
                  </div>
                  <Switch
                    checked={plan.isActive !== false}
                    onCheckedChange={(v) => editPlan(plan.key, { isActive: v })}
                  />
                </div>
              </div>

              <div className="flex gap-2 border-t pt-4">
                <Button className="flex-1" onClick={() => savePlan(plan)} disabled={savingKey === plan.key}>
                  {savingKey === plan.key ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  title={
                    plan.agencyCount
                      ? 'Move its agencies to another plan first'
                      : `Delete the ${plan.name} plan`
                  }
                  disabled={plan.agencyCount > 0}
                  onClick={() => deletePlan(plan)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Currently billing {formatINR((plan.priceMonthly || 0) * (plan.agencyCount || 0))}/mo
                across this plan.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Plan</DialogTitle>
            <DialogDescription>
              The key is permanent — it is what gets stored on each agency.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Key *</Label>
                <Input
                  value={draft.key}
                  placeholder="enterprise"
                  onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                />
              </div>
              <div>
                <Label>Display name *</Label>
                <Input
                  value={draft.name}
                  placeholder="Enterprise"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Price / month (INR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={draft.priceMonthly}
                  onChange={(e) => setDraft({ ...draft, priceMonthly: e.target.value })}
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              {NUMERIC_LIMITS.map((l) => (
                <div key={l.key} className="flex items-center justify-between gap-3">
                  <Label className="font-normal">{l.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    className="w-28"
                    value={draft.limits[l.key]}
                    onChange={(e) =>
                      setDraft({ ...draft, limits: { ...draft.limits, [l.key]: e.target.value } })
                    }
                  />
                </div>
              ))}
              {FEATURE_LIMITS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <Label className="font-normal">{f.label}</Label>
                  <Switch
                    checked={Boolean(draft.limits[f.key])}
                    onCheckedChange={(v) =>
                      setDraft({ ...draft, limits: { ...draft.limits, [f.key]: v } })
                    }
                  />
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={createPlan} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
