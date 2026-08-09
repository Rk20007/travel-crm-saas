'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Calendar, Clock, AlertCircle, CheckCircle2, Phone, Mail, MessageSquare, Users } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { leadDisplayName } from '@/utils/crm'
import { TableShell } from '@/components/crm/TableShell'

const FollowUpType = {
  call: { label: 'Call', icon: Phone, color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  email: { label: 'Email', icon: Mail, color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, color: 'bg-success/15 text-success dark:bg-success/15 dark:text-success' },
  meeting: { label: 'Meeting', icon: Users, color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
  site_visit: { label: 'Site Visit', icon: AlertCircle, color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
}

const StatusBadge = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-success/15 text-success dark:bg-success/15 dark:text-success',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  rescheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
}

const PriorityBadge = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [leads, setLeads] = useState([])
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({
    leadId: '',
    type: 'call',
    scheduledDate: '',
    description: '',
    priority: 'medium',
  })

  useEffect(() => {
    fetchFollowUps()
  }, [filter])

  useEffect(() => {
    const token = localStorage.getItem('token')
    try {
      setUser(JSON.parse(localStorage.getItem('user') || 'null'))
    } catch {
      setUser(null)
    }
    fetch('/api/leads?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setLeads(d.leads || []))
      .catch(() => {})
  }, [])

  const fetchFollowUps = async () => {
    try {
      const token = localStorage.getItem('token')
      const statusQuery = filter !== 'all' ? `&status=${filter}` : ''
      const response = await fetch(`/api/follow-ups?limit=50${statusQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()
      setFollowUps(data.followUps || [])
    } catch (error) {
      console.error('Error fetching follow-ups:', error)
    } finally {
      setLoading(false)
    }
  }

  const createFollowUp = async () => {
    if (!form.leadId || !form.scheduledDate) {
      toast.error('Lead and schedule date are required')
      return
    }
    const token = localStorage.getItem('token')
    const res = await fetch('/api/follow-ups', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: form.leadId,
        assignedTo: user?.id || user?.userId || user?._id,
        type: form.type,
        scheduledDate: form.scheduledDate,
        description: form.description,
        priority: form.priority,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to create follow-up')
      return
    }
    toast.success('Follow-up scheduled')
    setShowNewDialog(false)
    setForm({ leadId: '', type: 'call', scheduledDate: '', description: '', priority: 'medium' })
    fetchFollowUps()
  }

  const completeFollowUp = async (id) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/follow-ups/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    if (!res.ok) {
      toast.error('Failed to complete')
      return
    }
    toast.success('Marked complete')
    fetchFollowUps()
  }

  const filteredFollowUps = followUps.filter((fu) => {
    const name = leadDisplayName(fu.leadId).toLowerCase()
    return name.includes(searchTerm.toLowerCase()) || fu.type?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const stats = {
    total: followUps.length,
    pending: followUps.filter((f) => f.status === 'pending').length,
    completed: followUps.filter((f) => f.status === 'completed').length,
    overdue: followUps.filter((f) => f.status === 'pending' && new Date(f.scheduledDate) < new Date()).length,
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground sm:text-base">
          Manage and schedule follow-ups with your leads
        </p>
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0 gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New follow-up</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule Follow-up</DialogTitle>
              <DialogDescription>Create a new follow-up task</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Lead</Label>
                <Select value={form.leadId} onValueChange={(v) => setForm((f) => ({ ...f, leadId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead" />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => (
                      <SelectItem key={l._id} value={l._id}>
                        {leadDisplayName(l)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="site_visit">Site Visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Scheduled date</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduledDate}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <Button className="w-full" onClick={createFollowUp}>Create follow-up</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="gap-1 py-3 sm:gap-6 sm:py-6">
          <CardContent className="px-3 pt-0 sm:px-6 sm:pt-6">
            <div className="text-center">
              <div className="text-xl font-bold text-foreground sm:text-2xl">{stats.total}</div>
              <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">Total Follow-ups</p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:gap-6 sm:py-6">
          <CardContent className="px-3 pt-0 sm:px-6 sm:pt-6">
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-600 sm:text-2xl">{stats.pending}</div>
              <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:gap-6 sm:py-6">
          <CardContent className="px-3 pt-0 sm:px-6 sm:pt-6">
            <div className="text-center">
              <div className="text-xl font-bold text-red-600 sm:text-2xl">{stats.overdue}</div>
              <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-1 py-3 sm:gap-6 sm:py-6">
          <CardContent className="px-3 pt-0 sm:px-6 sm:pt-6">
            <div className="text-center">
              <div className="text-xl font-bold text-success sm:text-2xl">{stats.completed}</div>
              <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="scroll-hover-thin flex flex-nowrap gap-2 overflow-x-auto pb-1">
        {['all', 'pending', 'completed', 'cancelled'].map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'outline'}
            onClick={() => setFilter(status)}
            size="sm"
            className="shrink-0 capitalize"
          >
            {status}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div>
        <Input
          placeholder="Search follow-ups..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Follow-up Schedule</CardTitle>
          <CardDescription>{filteredFollowUps.length} follow-ups found</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 md:hidden">
            {filteredFollowUps.map((followUp) => {
              const TypeIcon = FollowUpType[followUp.type]?.icon || Clock
              const isOverdue = new Date(followUp.scheduledDate) < new Date() && followUp.status === 'pending'
              return (
                <div key={followUp._id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {followUp.leadId?._id ? (
                          <Link href={`/dashboard/leads/${followUp.leadId._id}`} className="text-primary">
                            {leadDisplayName(followUp.leadId)}
                          </Link>
                        ) : (
                          leadDisplayName(followUp.leadId)
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <TypeIcon className="h-4 w-4" />
                        <span className="capitalize">{followUp.type?.replace('_', ' ')}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(followUp.scheduledDate).toLocaleString()}
                      </p>
                    </div>
                    <Badge className={StatusBadge[followUp.status] || ''}>{followUp.status}</Badge>
                  </div>
                  {followUp.status === 'pending' && (
                    <Button size="sm" className="mt-3 w-full" variant="outline" onClick={() => completeFollowUp(followUp._id)}>
                      Mark done
                    </Button>
                  )}
                  {isOverdue && <p className="mt-2 text-xs text-destructive">Overdue</p>}
                </div>
              )
            })}
          </div>
          <TableShell className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading follow-ups...
                    </TableCell>
                  </TableRow>
                ) : filteredFollowUps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No follow-ups found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFollowUps.map((followUp) => {
                    const TypeIcon = FollowUpType[followUp.type]?.icon || Clock
                    const isOverdue = new Date(followUp.scheduledDate) < new Date() && followUp.status === 'pending'

                    return (
                      <TableRow key={followUp._id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {followUp.leadId?._id ? (
                            <Link href={`/dashboard/leads/${followUp.leadId._id}`} className="text-primary hover:underline">
                              {leadDisplayName(followUp.leadId)}
                            </Link>
                          ) : (
                            leadDisplayName(followUp.leadId)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${FollowUpType[followUp.type]?.color || ''}`}>
                            <TypeIcon className="w-4 h-4" />
                            {FollowUpType[followUp.type]?.label || followUp.type}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {new Date(followUp.scheduledDate).toLocaleDateString()} {new Date(followUp.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={PriorityBadge[followUp.priority] || 'bg-gray-100'}>
                            {followUp.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={StatusBadge[followUp.status] || 'bg-gray-100'}>
                            {followUp.status}
                            {isOverdue && <AlertCircle className="w-3 h-3 ml-1" />}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {followUp.status === 'pending' && (
                            <Button variant="ghost" size="sm" onClick={() => completeFollowUp(followUp._id)}>
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              Done
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableShell>
        </CardContent>
      </Card>
    </div>
  )
}
