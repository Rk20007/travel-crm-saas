'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { KeyRound, Copy, Webhook, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function LeadIngestSetup() {
  const [config, setConfig] = useState(null)
  const [metaPageId, setMetaPageId] = useState('')
  const [working, setWorking] = useState(false)
  const [apiKeyToast, setApiKeyToast] = useState('')

  const token = () => localStorage.getItem('token')

  const load = async () => {
    const res = await fetch('/api/admin/workspace-api-key', {
      headers: { Authorization: `Bearer ${token()}` },
    })
    if (res.ok) {
      const data = await res.json()
      setConfig(data)
      setMetaPageId(data.metaPageId || '')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const generateKey = async () => {
    setWorking(true)
    setApiKeyToast('')
    const res = await fetch('/api/admin/workspace-api-key', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    setWorking(false)
    if (!res.ok) {
      toast.error(data.error || 'Failed')
      return
    }
    try {
      await navigator.clipboard.writeText(data.apiKey)
    } catch {
      /* ok */
    }
    setApiKeyToast(data.apiKey)
    toast.success('API key generated & copied')
    load()
  }

  const saveMetaPage = async () => {
    const res = await fetch('/api/admin/workspace-api-key', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ metaPageId }),
    })
    if (res.ok) toast.success('Meta Page ID saved')
    else toast.error('Failed to save')
  }

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied'))
  }

  if (!config) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Lead Sources Setup
        </CardTitle>
        <CardDescription>
          Meta leads, API ingest, and manual entry — all use the same weight-based assignment flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span>Plan:</span>
          <Badge variant="secondary" className="capitalize">{config.plan || 'basic'}</Badge>
          <span>API Ingest:</span>
          <Badge variant={config.apiIngestEnabled ? 'default' : 'destructive'}>
            {config.apiIngestEnabled ? 'Enabled' : 'Standard+ required'}
          </Badge>
          {config.hasApiKey && (
            <Badge variant="outline">
              Key active since {new Date(config.apiKeyCreatedAt).toLocaleDateString()}
            </Badge>
          )}
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <p className="font-semibold">Process (all sources)</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Lead aati hai (Meta / API / Manual)</li>
            <li>CRM weight system check karta hai</li>
            <li>Lead assign hoti hai (Aamir:3, Adil:2, Bilal:0 paused)</li>
            <li>Sales employee ko notification 🔔</li>
            <li>Employee lead open karke call + notes + status update</li>
          </ol>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="font-semibold">Step 1 — API Key (agency ke liye)</Label>
            <Button variant="outline" size="sm" disabled={working} onClick={generateKey}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              <span className="ml-2">Generate Key</span>
            </Button>
          </div>
          {apiKeyToast && (
            <p className="text-xs text-success break-all">Key (shown once): {apiKeyToast}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Step 2 — Public API (Zapier / website / custom)</Label>
          <div className="flex gap-2">
            <Input readOnly value={config.endpoints?.publicLeads || ''} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={() => copy(config.endpoints?.publicLeads)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{`POST ${config.endpoints?.publicLeads}
Headers:
  x-api-key: crm_your_key_here
  Content-Type: application/json

Body:
{
  "firstName": "Rahul",
  "lastName": "Sharma",
  "phone": "9876543210",
  "email": "rahul@email.com",
  "city": "Delhi",
  "destination": "Kashmir Package",
  "travelDate": "2026-06-15",
  "source": "facebook_ads",
  "externalId": "meta_lead_unique_id"
}`}</pre>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Step 3 — Meta Lead Ads Webhook</Label>
          <div className="flex gap-2">
            <Input readOnly value={config.endpoints?.metaWebhook || ''} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={() => copy(config.endpoints?.metaWebhook)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Meta Business Suite → Lead Ads → Webhooks → Callback URL upar wala URL. Verify token:{' '}
            <code className="bg-muted px-1 rounded">META_WEBHOOK_VERIFY_TOKEN</code> env mein set karo.
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Meta Page ID (is agency ki page)</Label>
              <Input
                placeholder="e.g. 123456789012345"
                value={metaPageId}
                onChange={(e) => setMetaPageId(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={saveMetaPage}>
              Save Page ID
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="font-semibold">Step 4 — Manual (CRM se)</Label>
          <p className="text-muted-foreground">
            Leads page → Add Lead. Owner ya Sales employee manually bhi lead daal sakta hai — same assignment
            flow chalega.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
