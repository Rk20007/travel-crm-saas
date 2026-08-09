'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { KeyRound, Loader2, Plus, Search, Trash2, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/crm/PageHeader'
import { TableShell } from '@/components/crm/TableShell'
import { guardSuperadmin, saFetch, formatDate } from '@/lib/superadmin-client'
import { startImpersonation } from '@/lib/impersonation'
import { ROLE_LABELS } from '@/lib/permissions-client'

const ROLES = [
  { value: 'agent', label: 'Sales Employee' },
  { value: 'manager', label: 'Sales Lead' },
  { value: 'operations', label: 'Operations' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'admin', label: 'Owner' },
  { value: 'superadmin', label: 'Platform Super Admin' },
]

const EMPTY_USER = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'agent',
  teamId: '',
  leadAssignmentWeight: 1,
}

export default function PlatformUsersPage() {
  const [rows, setRows] = useState([])
  const [agencies, setAgencies] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(EMPTY_USER)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  // Read from location rather than useSearchParams so the page needs no
  // Suspense boundary at build time.
  useEffect(() => {
    const teamId = new URLSearchParams(window.location.search).get('teamId')
    if (teamId) setTeamFilter(teamId)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '50' })
      if (search.trim()) qs.set('search', search.trim())
      if (roleFilter !== 'all') qs.set('role', roleFilter)
      if (teamFilter !== 'all') qs.set('teamId', teamFilter)
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      const data = await saFetch(`/api/superadmin/users?${qs}`)
      setRows(data.users || [])
      setAgencies(data.agencies || [])
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter, teamFilter, statusFilter])

  useEffect(() => {
    if (!guardSuperadmin()) return
    const id = setTimeout(load, 300)
    return () => clearTimeout(id)
  }, [load])

  const patchUser = async (userId, body, message = 'Updated') => {
    try {
      await saFetch('/api/superadmin/users', { method: 'PATCH', body: { userId, ...body } })
      toast.success(message)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const createUser = async () => {
    setCreating(true)
    try {
      const body = { ...draft }
      if (body.role === 'superadmin' && !body.teamId) delete body.teamId
      await saFetch('/api/superadmin/users', { method: 'POST', body })
      toast.success('User created')
      setCreateOpen(false)
      setDraft(EMPTY_USER)
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  const removeUser = async (user) => {
    const purge = confirm(
      `Remove ${user.email}?\n\nOK = permanently delete the record.\nCancel = you'll be asked to deactivate instead.`
    )
    if (!purge && !confirm(`Deactivate ${user.email} instead?`)) return
    try {
      const res = await saFetch(
        `/api/superadmin/users?userId=${user._id}${purge ? '&purge=true' : ''}`,
        { method: 'DELETE' }
      )
      toast.success(res.message)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const impersonate = async (user) => {
    if (!confirm(`Start a 30-minute support session as ${user.email}? Every action is recorded.`)) return
    try {
      const res = await saFetch('/api/superadmin/impersonate', {
        method: 'POST',
        body: { userId: user._id },
      })
      startImpersonation(res)
      window.location.href = '/dashboard'
    } catch (e) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Every account across every agency. Change roles, move users between agencies, reset passwords or suspend access."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New User
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Name, email or phone…"
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
            />
          </div>
          <Select
            value={teamFilter}
            onValueChange={(v) => {
              setPage(1)
              setTeamFilter(v)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agencies</SelectItem>
              {agencies.map((a) => (
                <SelectItem key={String(a._id)} value={String(a._id)}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={roleFilter}
            onValueChange={(v) => {
              setPage(1)
              setRoleFilter(v)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
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
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TableShell minWidth="62rem">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <Loader2 className="inline h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      No users match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((u) => (
                    <TableRow key={String(u._id)}>
                      <TableCell>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.teamId?._id ? String(u.teamId._id) : ''}
                          onValueChange={(teamId) =>
                            patchUser(u._id, { teamId }, 'Moved to a different agency')
                          }
                        >
                          <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder={u.role === 'superadmin' ? 'Platform' : 'None'} />
                          </SelectTrigger>
                          <SelectContent>
                            {agencies.map((a) => (
                              <SelectItem key={String(a._id)} value={String(a._id)}>
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={u.role} onValueChange={(role) => patchUser(u._id, { role })}>
                          <SelectTrigger className="w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.isBlocked || !u.isActive ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.lastLogin ? formatDate(u.lastLogin) : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            title="Suspend / restore"
                            onClick={() =>
                              patchUser(u._id, { isBlocked: !u.isBlocked, isActive: !!u.isBlocked })
                            }
                          >
                            {u.isBlocked ? 'Restore' : 'Suspend'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Reset password"
                            onClick={() => setResetTarget(u)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Impersonate for support"
                            disabled={u.role === 'superadmin' || u.isBlocked || !u.teamId}
                            onClick={() => impersonate(u)}
                          >
                            <UserCog className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            title="Remove"
                            onClick={() => removeUser(u)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
                Page {pagination.page} of {pagination.pages} · {pagination.total} users
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New User</DialogTitle>
            <DialogDescription>
              Creates an account inside the chosen agency. Super admins are platform-level and need
              no agency.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full name *</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </div>
            <div>
              <Label>Password * (min 8 characters)</Label>
              <Input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={draft.role} onValueChange={(role) => setDraft({ ...draft, role })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {draft.role !== 'superadmin' && (
              <div>
                <Label>Agency *</Label>
                <Select value={draft.teamId} onValueChange={(teamId) => setDraft({ ...draft, teamId })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((a) => (
                      <SelectItem key={String(a._id)} value={String(a._id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {['agent', 'manager'].includes(draft.role) && (
              <div>
                <Label>Lead distribution weight</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={draft.leadAssignmentWeight}
                  onChange={(e) =>
                    setDraft({ ...draft, leadAssignmentWeight: Number(e.target.value) })
                  }
                />
              </div>
            )}
            <Button className="w-full" onClick={createUser} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={() => setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {resetTarget?.email} will be signed out of every device immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button
              className="w-full"
              disabled={newPassword.length < 8}
              onClick={() => {
                patchUser(resetTarget._id, { resetPassword: newPassword }, 'Password reset')
                setResetTarget(null)
                setNewPassword('')
              }}
            >
              Reset password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
