'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plug, Plus, Trash2, Copy, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/auth-client'

const EMPTY_FORM = {
  brandId: '',
  ownerId: '',
  googleCampaignId: '',
  googleCampaignName: '',
  formId: '',
  landingPageId: '',
  isDefault: false,
}

/**
 * Google Ads lead integration — a self-contained second connector alongside
 * MetaLeadSync (rendered next to it on the same page), independent
 * end-to-end: its own models, its own routes, its own webhook. Covers both
 * Google entry points — Lead Form (webhook key) and Landing Page/Website
 * (the existing /api/public/leads key, already generated for Meta/Zapier) —
 * plus the campaign/form → Company/Owner mapping table.
 */
export function GoogleAdsIntegration() {
  const [status, setStatus] = useState(null)
  const [mappings, setMappings] = useState([])
  const [brands, setBrands] = useState([])
  const [owners, setOwners] = useState([])
  const [busy, setBusy] = useState('')
  const [newKey, setNewKey] = useState('')
  const [mappingOpen, setMappingOpen] = useState(false)
  const [editingMapping, setEditingMapping] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [campaigns, setCampaigns] = useState([])
  const [campaignsIntegrationId, setCampaignsIntegrationId] = useState('')
  const [unmappedCount, setUnmappedCount] = useState(0)
  const [inboundKeyStatus, setInboundKeyStatus] = useState(null)
  const [newInboundKey, setNewInboundKey] = useState('')

  const load = async () => {
    const [statusRes, mappingsRes, brandsRes, membersRes, eventsRes, inboundKeyRes] = await Promise.all([
      apiFetch('/api/integrations/google'),
      apiFetch('/api/integrations/google/mappings'),
      apiFetch('/api/brands'),
      apiFetch('/api/team/members'),
      apiFetch('/api/integrations/google/events?status=unmapped&limit=50'),
      apiFetch('/api/admin/workspace-api-key'),
    ])
    if (eventsRes.ok) setUnmappedCount((await eventsRes.json()).events?.length || 0)
    if (statusRes.ok) setStatus(await statusRes.json())
    if (mappingsRes.ok) setMappings((await mappingsRes.json()).mappings || [])
    if (brandsRes.ok) setBrands((await brandsRes.json()).brands || [])
    if (membersRes.ok) {
      const all = (await membersRes.json()).members || []
      setOwners(all.filter((m) => ['agent', 'manager', 'admin'].includes(m.role)))
    }
    if (inboundKeyRes.ok) setInboundKeyStatus(await inboundKeyRes.json())
  }

  useEffect(() => {
    load()
    // Surface the OAuth callback's redirect result (?google_connected= / ?google_error=)
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('google_connected')
    const error = params.get('google_error')
    if (connected) toast.success(`Connected ${connected} Google Ads account(s)`)
    if (error) toast.error(`Google Ads connect failed: ${error}`)
    if (connected || error) {
      params.delete('google_connected')
      params.delete('google_error')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConnect = async () => {
    setBusy('connect')
    const res = await apiFetch('/api/integrations/google/oauth/start')
    const data = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) {
      toast.error(data.error || 'Could not start Google connect')
      return
    }
    window.location.href = data.url
  }

  const handleDisconnect = async (id) => {
    if (!confirm('Disconnect this Google Ads account? Existing leads and mappings are kept.')) return
    setBusy(`disconnect-${id}`)
    const res = await apiFetch(`/api/integrations/google/${id}`, { method: 'DELETE' })
    setBusy('')
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Disconnect failed')
      return
    }
    toast.success('Disconnected')
    load()
  }

  const handleGenerateKey = async () => {
    setBusy('key')
    const res = await apiFetch('/api/integrations/google', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generateWebhookKey' }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) {
      toast.error(data.error || 'Could not generate key')
      return
    }
    setNewKey(data.googleLeadFormKey)
    toast.success('New webhook key generated — copy it now, it will not be shown again')
    load()
  }

  const handleGenerateInboundKey = async () => {
    setBusy('inboundKey')
    const res = await apiFetch('/api/admin/workspace-api-key', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) {
      toast.error(data.error || 'Could not generate key')
      return
    }
    setNewInboundKey(data.apiKey)
    toast.success('New API key generated — copy it now, it will not be shown again')
    load()
  }

  const copy = (text) => {
    navigator.clipboard?.writeText(text)
    toast.success('Copied')
  }

  const openAddMapping = () => {
    setEditingMapping(null)
    setForm(EMPTY_FORM)
    setCampaigns([])
    setMappingOpen(true)
  }

  const openEditMapping = (m) => {
    setEditingMapping(m)
    setForm({
      brandId: m.brandId?._id || m.brandId || '',
      ownerId: m.ownerId?._id || m.ownerId || '',
      googleCampaignId: m.googleCampaignId || '',
      googleCampaignName: m.googleCampaignName || '',
      formId: m.formId || '',
      landingPageId: m.landingPageId || '',
      isDefault: !!m.isDefault,
    })
    setMappingOpen(true)
  }

  const loadCampaigns = async (integrationId) => {
    setCampaignsIntegrationId(integrationId)
    if (!integrationId) {
      setCampaigns([])
      return
    }
    const res = await apiFetch(`/api/integrations/google/campaigns?integrationId=${integrationId}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // Live listing not available (e.g. developer token still pending) —
      // fall back to manual campaign-id entry below, never a dead end.
      setCampaigns([])
      return
    }
    setCampaigns(data.campaigns || [])
  }

  const saveMapping = async () => {
    setBusy('saveMapping')
    const url = editingMapping
      ? `/api/integrations/google/mappings/${editingMapping._id}`
      : '/api/integrations/google/mappings'
    const res = await apiFetch(url, {
      method: editingMapping ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) {
      toast.error(data.error || 'Save failed')
      return
    }
    toast.success(editingMapping ? 'Mapping updated' : 'Mapping created')
    setMappingOpen(false)
    load()
  }

  const toggleMappingStatus = async (m) => {
    setBusy(`status-${m._id}`)
    const res = await apiFetch(`/api/integrations/google/mappings/${m._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: m.status === 'active' ? 'inactive' : 'active' }),
    })
    setBusy('')
    if (!res.ok) {
      toast.error('Update failed')
      return
    }
    load()
  }

  const deleteMapping = async (id) => {
    if (!confirm('Delete this mapping?')) return
    setBusy(`delete-${id}`)
    const res = await apiFetch(`/api/integrations/google/mappings/${id}`, { method: 'DELETE' })
    setBusy('')
    if (!res.ok) {
      toast.error('Delete failed')
      return
    }
    toast.success('Deleted')
    load()
  }

  if (!status) return null

  // These URLs get pasted straight into Google Ads — always the real
  // production domain, never wherever this page happens to be open (e.g.
  // localhost while testing), or Google would end up webhook-ing localhost.
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                Google Ads Leads
              </CardTitle>
              <CardDescription>
                Two entry points — Google Ads Lead Form (webhook) and Landing Page/Website forms — both
                land here as CRM leads, assigned via the campaign/form mapping below.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          {unmappedCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {unmappedCount}
                {unmappedCount === 50 ? '+' : ''} Google lead{unmappedCount > 1 ? 's' : ''} arrived with no
                campaign/form/landing-page mapping — still created and round-robin assigned like any other
                lead, just without a specific owner picked here. Add a mapping below if these should always
                go to one particular person/company.
              </span>
            </div>
          )}

          {/* --- Lead Form connection --- */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Google Ads Lead Form (webhook)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status.webhookKeySet ? 'default' : 'outline'}>
                {status.webhookKeySet ? 'Key configured' : 'Not configured'}
              </Badge>
              <Button size="sm" variant="outline" onClick={handleGenerateKey} disabled={busy === 'key'}>
                {busy === 'key' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {status.webhookKeySet ? 'Regenerate key' : 'Generate key'}
              </Button>
            </div>
            {newKey && (
              <div className="flex items-center gap-2 rounded bg-muted p-2 font-mono text-xs">
                <span className="truncate">{newKey}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => copy(newKey)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              In Google Ads → Lead form asset → Delivery → Webhook, set the URL to{' '}
              <code className="rounded bg-muted px-1">{origin}/api/webhooks/google/leads</code> and paste
              the key above.
            </p>
          </div>

          {/* --- Landing page / website connection --- */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Landing Page / Website form
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={inboundKeyStatus?.hasApiKey ? 'default' : 'outline'}>
                {inboundKeyStatus?.hasApiKey ? 'Key configured' : 'Not configured'}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateInboundKey}
                disabled={busy === 'inboundKey'}
              >
                {busy === 'inboundKey' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                {inboundKeyStatus?.hasApiKey ? 'Regenerate key' : 'Generate key'}
              </Button>
            </div>
            {newInboundKey && (
              <div className="flex items-center gap-2 rounded bg-muted p-2 font-mono text-xs">
                <span className="truncate">{newInboundKey}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => copy(newInboundKey)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              This same key also authenticates Meta/Zapier relay POSTs — it's one shared inbound key per
              workspace, not Google-specific. Send it as an <code className="rounded bg-muted px-1">x-api-key</code>{' '}
              header when your website form POSTs to{' '}
              <code className="rounded bg-muted px-1">{origin}/api/public/leads</code>, along with{' '}
              <code className="rounded bg-muted px-1">gclid</code>,{' '}
              <code className="rounded bg-muted px-1">utm_source</code>,{' '}
              <code className="rounded bg-muted px-1">form_id</code> /{' '}
              <code className="rounded bg-muted px-1">landing_page_id</code> alongside the usual
              name/phone/email fields.
            </p>
          </div>

          {/* --- OAuth-connected accounts (optional, powers the live campaign picker) --- */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Connected Google Ads accounts
              </p>
              <Button size="sm" onClick={handleConnect} disabled={busy === 'connect' || !status.oauthConfigured}>
                {busy === 'connect' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Connect Google Ads
              </Button>
            </div>
            {!status.oauthConfigured && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Not configured on this server yet — campaigns can still be mapped manually by ID below.
              </p>
            )}
            {status.integrations?.length ? (
              <div className="space-y-1">
                {status.integrations.map((i) => (
                  <div key={i._id} className="flex items-center justify-between rounded border bg-background p-2 text-xs">
                    <span>
                      <strong>{i.googleCustomerName || i.googleCustomerId}</strong>{' '}
                      <span className="text-muted-foreground">({i.googleCustomerId})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={i.status === 'connected' ? 'default' : 'destructive'}>{i.status}</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => handleDisconnect(i._id)}
                        disabled={busy === `disconnect-${i._id}`}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No accounts connected yet.</p>
            )}
          </div>

          {/* --- Mapping table --- */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Campaign / Form / Landing Page → Company & Owner
              </p>
              <Button size="sm" onClick={openAddMapping}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add mapping
              </Button>
            </div>
            {mappings.length === 0 ? (
              <p className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
                No mappings yet — leads are still created and round-robin assigned like any other lead.
                Add a mapping to route a specific campaign/form/landing page to one Company/Owner instead.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left">Campaign</th>
                      <th className="p-2 text-left">Form / Landing Page</th>
                      <th className="p-2 text-left">Company</th>
                      <th className="p-2 text-left">Owner</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m) => (
                      <tr key={m._id} className="border-t">
                        <td className="p-2">
                          {m.isDefault ? (
                            <Badge variant="outline">Workspace default</Badge>
                          ) : (
                            <>
                              {m.googleCampaignName || '—'}
                              {m.googleCampaignId && (
                                <div className="font-mono text-[10px] text-muted-foreground">{m.googleCampaignId}</div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="p-2 font-mono text-[10px]">
                          {m.formId && <div>form: {m.formId}</div>}
                          {m.landingPageId && <div>page: {m.landingPageId}</div>}
                          {!m.formId && !m.landingPageId && '—'}
                        </td>
                        <td className="p-2">{m.brandId?.name || '—'}</td>
                        <td className="p-2">{m.ownerId?.name || '—'}</td>
                        <td className="p-2">
                          <button onClick={() => toggleMappingStatus(m)} disabled={busy === `status-${m._id}`}>
                            <Badge variant={m.status === 'active' ? 'default' : 'outline'} className="cursor-pointer">
                              {m.status}
                            </Badge>
                          </button>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditMapping(m)}>
                              Edit
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => deleteMapping(m._id)}
                              disabled={busy === `delete-${m._id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMapping ? 'Edit mapping' : 'Add mapping'}</DialogTitle>
            <DialogDescription>
              Priority when a lead comes in: Form ID → Landing Page ID → Campaign ID → Customer ID →
              workspace default. Fill in whichever level this mapping should catch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {status.integrations?.length > 0 && (
              <div>
                <Label className="text-xs">Connected account (optional — loads campaigns below)</Label>
                <Select value={campaignsIntegrationId} onValueChange={loadCampaigns}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {status.integrations.map((i) => (
                      <SelectItem key={i._id} value={i._id}>
                        {i.googleCustomerName || i.googleCustomerId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {campaigns.length > 0 ? (
              <div>
                <Label className="text-xs">Campaign</Label>
                <Select
                  value={form.googleCampaignId}
                  onValueChange={(v) => {
                    const c = campaigns.find((x) => x.id === v)
                    setForm((f) => ({ ...f, googleCampaignId: v, googleCampaignName: c?.name || '' }))
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Campaign ID (manual)</Label>
                  <Input
                    value={form.googleCampaignId}
                    onChange={(e) => setForm((f) => ({ ...f, googleCampaignId: e.target.value }))}
                    placeholder="e.g. 987654"
                    className="font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Campaign name</Label>
                  <Input
                    value={form.googleCampaignName}
                    onChange={(e) => setForm((f) => ({ ...f, googleCampaignName: e.target.value }))}
                    placeholder="e.g. Kashmir Tour Leads"
                  />
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Form ID</Label>
                <Input
                  value={form.formId}
                  onChange={(e) => setForm((f) => ({ ...f, formId: e.target.value }))}
                  placeholder="Lead Form asset id, or your own form id"
                  className="font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Landing Page ID</Label>
                <Input
                  value={form.landingPageId}
                  onChange={(e) => setForm((f) => ({ ...f, landingPageId: e.target.value }))}
                  placeholder="e.g. LP-KASHMIR-01"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">CRM Company *</Label>
                <Select value={form.brandId} onValueChange={(v) => setForm((f) => ({ ...f, brandId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Owner *</Label>
                <Select value={form.ownerId} onValueChange={(v) => setForm((f) => ({ ...f, ownerId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o._id} value={o._id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={form.isDefault}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v }))}
              />
              Use as this workspace's default (last-resort fallback when nothing else matches)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingOpen(false)}>Cancel</Button>
            <Button onClick={saveMapping} disabled={busy === 'saveMapping'}>
              {busy === 'saveMapping' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {editingMapping ? 'Save changes' : 'Create mapping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
