'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Layers,
  ArrowRight,
  Loader2,
  AlertCircle,
  UserPlus,
  ShieldCheck,
} from 'lucide-react'
import { PageHeader } from '@/components/crm/PageHeader'
import { guardSuperadmin, saFetch, formatINR, formatDate } from '@/lib/superadmin-client'

export default function PlatformDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!guardSuperadmin()) return
    saFetch('/api/superadmin/stats')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  const t = data?.totals || {}

  const primaryStats = [
    { label: 'Agencies', value: t.agencies ?? 0, sub: `${t.newAgencies30d ?? 0} new in 30d`, icon: Building2 },
    { label: 'Platform Users', value: t.users ?? 0, sub: `${t.suspendedAgencies ?? 0} suspended agencies`, icon: Users },
    { label: 'Leads', value: (t.leads ?? 0).toLocaleString('en-IN'), sub: `${(t.leads30d ?? 0).toLocaleString('en-IN')} in 30d`, icon: TrendingUp },
    { label: 'MRR', value: formatINR(t.mrr), sub: `${formatINR(t.gmvThisMonth)} GMV this month`, icon: DollarSign },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        description="Platform-wide control: agencies, users, subscriptions and plan limits."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/platform/plans">
                <Layers className="mr-2 h-4 w-4" />
                Plans &amp; Limits
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/platform/agencies">
                <Building2 className="mr-2 h-4 w-4" />
                Manage Agencies
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {primaryStats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Newest Agencies</CardTitle>
            <CardDescription>The most recently provisioned workspaces.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.recentAgencies || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No agencies yet.</p>
            ) : (
              (data.recentAgencies || []).map((a) => (
                <Link
                  key={String(a._id)}
                  href={`/dashboard/platform/agencies/${a._id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(a.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="capitalize">{a.plan || 'basic'}</Badge>
                    {a.isActive === false ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="secondary" className="capitalize">{a.subscriptionStatus}</Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Agencies per subscription plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.plans || []).map((p) => {
              const count = data?.planCounts?.[p.key] || 0
              const pct = t.agencies ? Math.round((count / t.agencies) * 100) : 0
              return (
                <div key={p.key}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">
                      {count} · {formatINR(p.priceMonthly)}/mo
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            href: '/dashboard/platform/agencies',
            title: 'Agencies',
            body: 'Create, suspend, change plans, set per-agency limit overrides, impersonate for support.',
            icon: Building2,
          },
          {
            href: '/dashboard/platform/users',
            title: 'All Users',
            body: 'Every account across every tenant — roles, suspension, password resets, agency moves.',
            icon: UserPlus,
          },
          {
            href: '/dashboard/platform/plans',
            title: 'Plans & Limits',
            body: 'Define plans, pricing and the caps that gate brands, seats, leads and automation.',
            icon: ShieldCheck,
          },
        ].map((c) => {
          const Icon = c.icon
          return (
            <Link key={c.href} href={c.href}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4" />
                    {c.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{c.body}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
