'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Loader2, Building2, X } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/crm/PageHeader'
import { TableShell } from '@/components/crm/TableShell'
import { guardSuperadmin, saFetch, formatDate } from '@/lib/superadmin-client'

const STATUS_LABELS = {
  new: { label: 'New', variant: 'secondary' },
  contacted: { label: 'Contacted', variant: 'outline' },
  converted: { label: 'Converted', variant: 'default' },
  dismissed: { label: 'Dismissed', variant: 'destructive' },
}

export default function DemoRequestsPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (statusFilter !== 'all') qs.set('status', statusFilter)
      const data = await saFetch(`/api/demo-requests?${qs}`)
      setRows(data.requests || [])
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (!guardSuperadmin()) return
    load()
  }, [load])

  const setStatus = async (id, status) => {
    try {
      await saFetch(`/api/demo-requests/${id}`, { method: 'PATCH', body: { status } })
      setRows((prev) => prev.map((r) => (r._id === id ? { ...r, status } : r)))
    } catch (e) {
      toast.error(e.message)
    }
  }

  const convertToAgency = (r) => {
    const qs = new URLSearchParams({
      demoId: r._id,
      ownerName: r.name || '',
      ownerEmail: r.email || '',
      ownerPhone: r.phone || '',
      name: r.name ? `${r.name}'s Workspace` : '',
    })
    router.push(`/dashboard/platform/agencies?${qs}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Leads from the 'Book a Demo' form on the marketing site. Convert one into an agency to provision their workspace."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <TableShell minWidth="56rem">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Preferred date</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <Loader2 className="inline h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      No demo requests yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.email}</TableCell>
                      <TableCell>{r.phone}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.address || '—'}</TableCell>
                      <TableCell>{r.preferredDate ? formatDate(r.preferredDate) : '—'}</TableCell>
                      <TableCell>{formatDate(r.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_LABELS[r.status]?.variant || 'secondary'}>
                          {STATUS_LABELS[r.status]?.label || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          {r.status !== 'converted' && (
                            <Button size="sm" onClick={() => convertToAgency(r)}>
                              <Building2 className="mr-1.5 h-3.5 w-3.5" />
                              Create agency
                            </Button>
                          )}
                          {r.status === 'new' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(r._id, 'contacted')}
                            >
                              Mark contacted
                            </Button>
                          )}
                          {r.status !== 'dismissed' && r.status !== 'converted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setStatus(r._id, 'dismissed')}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
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
    </div>
  )
}
