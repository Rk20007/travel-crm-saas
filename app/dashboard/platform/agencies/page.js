'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Building2, Loader2, Plus, Search, UserCog, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/crm/PageHeader'
import { TableShell } from '@/components/crm/TableShell'
import { guardSuperadmin, saFetch, formatINR, formatDate } from '@/lib/superadmin-client'
import { startImpersonation } from '@/lib/impersonation'

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'past_due', label: 'Past due' },
  { value: 'cancelled', label: 'Cancelled' },
]

const EMPTY_AGENCY = {
  name: '',
  plan: 'basic',
  subscriptionStatus: 'trialing',
  ownerName: '',
  ownerEmail: '',
  ownerPassword: '',
  ownerPhone: '',
  brandName: '',
}

export default function AgenciesPage() {
  const [rows, setRows] = useState([])
  const [plans, setPlans] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(EMPTY_AGENCY)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '25' })
      if (search.trim()) qs.set('search', search.trim())
      if (planFilter !== 'all') qs.set('plan', planFilter)
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      const data = await saFetch(`/api/superadmin/agencies?${qs}`)
      setRows(data.agencies || [])
      setPlans(data.plans || [])
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, planFilter, statusFilter])

  useEffect(() => {
    if (!guardSuperadmin()) return
    // Debounced so typing in the search box doesn't fire a request per keystroke.
    const id = setTimeout(load, 300)
    return () => clearTimeout(id)
  }, [load])

  const createAgency = async () => {
    setCreating(true)
    try {
      await saFetch('/api/superadmin/agencies', { method: 'POST', body: draft })
      toast.success(`Agency "${draft.name}" created`)
      setCreateOpen(false)
      setDraft(EMPTY_AGENCY)
      setPage(1)
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  const impersonateOwner = async (agency) => {
    if (
      !confirm(
        `Start a support session as the owner of "${agency.name}"?\n\nYou will act as that user for 30 minutes and every action is recorded.`
      )
    ) {
      return
    }
    try {
      const data = await saFetch('/api/superadmin/impersonate', {
        method: 'POST',
        body: { teamId: agency._id },
      })
      startImpersonation(data)
      window.location.href = '/dashboard/owner'
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Every tenant on the platform. Create agencies, change plans, suspend access, or jump in as the owner for support."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Agency
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by agency name, email or phone…"
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
            />
          </div>
          <Select
            value={planFilter}
            onValueChange={(v) => {
              setPage(1)
              setPlanFilter(v)
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {plans.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setPage(1)
              setStatusFilter(v)
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TableShell minWidth="60rem">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center">
                      <Loader2 className="inline h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                      No agencies match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((a) => (
                    <TableRow key={String(a._id)}>
                      <TableCell>
                        <Link
                          href={`/dashboard/platform/agencies/${a._id}`}
                          className="font-medium hover:underline"
                        >
                          {a.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{a.email || '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.owner?.name || '—'}
                        <p className="text-xs text-muted-foreground">{a.owner?.email || ''}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {a.plan || 'basic'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {a.isActive === false ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : (
                          <Badge variant="secondary" className="capitalize">
                            {a.subscriptionStatus || 'active'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{a.userCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{a.leadCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(a.revenue)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(a.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            title="Log in as the owner for support"
                            onClick={() => impersonateOwner(a)}
                          >
                            <UserCog className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/dashboard/platform/agencies/${a._id}`}>
                              Manage
                              <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableShell>

          {pagination.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {pagination.page} of {pagination.pages} · {pagination.total} agencies
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              New Agency
            </DialogTitle>
            <DialogDescription>
              Creates the workspace, its owner account and a default brand in one step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Agency name *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Himalayan Trails Pvt Ltd"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Plan</Label>
                <Select value={draft.plan} onValueChange={(plan) => setDraft({ ...draft, plan })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans
                      .filter((p) => p.isActive !== false)
                      .map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.name} · {formatINR(p.priceMonthly)}/mo
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subscription</Label>
                <Select
                  value={draft.subscriptionStatus}
                  onValueChange={(subscriptionStatus) => setDraft({ ...draft, subscriptionStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="past_due">Past due</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Default brand name</Label>
              <Input
                value={draft.brandName}
                onChange={(e) => setDraft({ ...draft, brandName: e.target.value })}
                placeholder="Defaults to the agency name"
              />
            </div>

            <div className="rounded-lg border p-4">
              <p className="mb-3 text-sm font-medium">Owner account</p>
              <div className="space-y-3">
                <div>
                  <Label>Full name *</Label>
                  <Input
                    value={draft.ownerName}
                    onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={draft.ownerEmail}
                    onChange={(e) => setDraft({ ...draft, ownerEmail: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={draft.ownerPhone}
                    onChange={(e) => setDraft({ ...draft, ownerPhone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Temporary password *</Label>
                  <Input
                    type="password"
                    value={draft.ownerPassword}
                    onChange={(e) => setDraft({ ...draft, ownerPassword: e.target.value })}
                    placeholder="Minimum 8 characters"
                  />
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={createAgency} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Agency
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
