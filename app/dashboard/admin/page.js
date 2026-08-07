'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, KeyRound, Loader2, UserPlus, Scale } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/crm/PageHeader'
import { TableShell } from '@/components/crm/TableShell'
import { LeadIngestSetup } from '@/components/crm/LeadIngestSetup'

const ROLES = [
  { value: 'agent', label: 'Sales Employee' },
  { value: 'manager', label: 'Sales Lead' },
  { value: 'operations', label: 'Operations' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'admin', label: 'Owner' },
]

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [weights, setWeights] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(null)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent',
    leadAssignmentWeight: 1,
  })
  const [newPassword, setNewPassword] = useState('')

  const token = () => localStorage.getItem('token')

  const fetchAll = async () => {
    setError('')
    setLoading(true)
    try {
      const t = token()
      if (!t) {
        window.location.href = '/login'
        return
      }
      const [uRes, wRes] = await Promise.all([
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${t}` } }),
        fetch('/api/admin/lead-weights', { headers: { Authorization: `Bearer ${t}` } }),
      ])
      const uData = await uRes.json().catch(() => ({}))
      const wData = await wRes.json().catch(() => ({}))
      if (!uRes.ok) {
        setError(uData.error || 'Unable to load users')
        return
      }
      setUsers(Array.isArray(uData.users) ? uData.users : [])
      setWeights(Array.isArray(wData.weights) ? wData.weights : [])
    } catch {
      setError('Network error loading users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}')
      if (!['superadmin', 'admin'].includes(u.role)) {
        window.location.href = '/dashboard'
        return
      }
    } catch {}
    fetchAll()
  }, [])

  const updateUser = async (userId, patch) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...patch }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Update failed')
      return
    }
    toast.success('Updated')
    fetchAll()
  }

  const addEmployee = async () => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to add employee')
      return
    }
    toast.success('Employee added')
    setAddOpen(false)
    setNewUser({ name: '', email: '', password: '', role: 'agent', leadAssignmentWeight: 1 })
    fetchAll()
  }

  const saveWeights = async () => {
    const res = await fetch('/api/admin/lead-weights', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weights: weights.map((w) => ({ userId: w._id, weight: w.leadAssignmentWeight })),
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to save weights')
      return
    }
    toast.success('Lead distribution weights saved')
    fetchAll()
  }

  const removeEmployee = async (userId) => {
    if (!confirm('Remove this employee? They will be deactivated.')) return
    const res = await fetch(`/api/admin/users?userId=${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` },
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed')
      return
    }
    toast.success('Employee removed')
    fetchAll()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Team & Employee Management"
        description="Add/remove employees, change roles, reset passwords, and control lead distribution."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        }
      />

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <LeadIngestSetup />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Lead Distribution Control
          </CardTitle>
          <CardDescription>
            Set weights for sales employees. Weight 0 = paused (training) — no new leads assigned.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {weights.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales employees to configure.</p>
          ) : (
            weights.map((w, i) => (
              <div key={w._id} className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
                <div className="min-w-[140px] flex-1">
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-muted-foreground">{w.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Weight</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    className="w-20"
                    value={w.leadAssignmentWeight ?? 1}
                    onChange={(e) => {
                      const next = [...weights]
                      next[i] = { ...w, leadAssignmentWeight: Number(e.target.value) }
                      setWeights(next)
                    }}
                  />
                  {w.leadAssignmentWeight === 0 && (
                    <Badge variant="destructive">Paused</Badge>
                  )}
                </div>
              </div>
            ))
          )}
          {weights.length > 0 && (
            <Button onClick={saveWeights}>Save Weights</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage roles, suspend, password reset, and remove employees.</CardDescription>
        </CardHeader>
        <CardContent>
          <TableShell className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <Loader2 className="inline h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={String(u._id)}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          onValueChange={(role) => updateUser(u._id, { role })}
                        >
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
                        {!u.isActive || u.isBlocked ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : (
                          <Badge variant="outline">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateUser(u._id, { isBlocked: !u.isBlocked, isActive: u.isBlocked })
                            }
                          >
                            {u.isBlocked ? 'Unsuspend' : 'Suspend'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setResetOpen(u._id)}>
                            <KeyRound className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeEmployee(u._id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableShell>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(role) => setNewUser({ ...newUser, role })}>
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
            {['agent', 'manager'].includes(newUser.role) && (
              <div>
                <Label>Lead Weight</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={newUser.leadAssignmentWeight}
                  onChange={(e) =>
                    setNewUser({ ...newUser, leadAssignmentWeight: Number(e.target.value) })
                  }
                />
              </div>
            )}
            <Button className="w-full" onClick={addEmployee}>
              Add Employee
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetOpen} onOpenChange={() => setResetOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="New password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={() => {
                updateUser(resetOpen, { resetPassword: newPassword })
                setResetOpen(null)
                setNewPassword('')
              }}
            >
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
