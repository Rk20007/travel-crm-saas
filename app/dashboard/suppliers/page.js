'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { mutateJson } from '@/lib/mutate'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TableShell } from '@/components/crm/TableShell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function SuppliersPage() {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })

  // Transport vendors have their own dedicated section (Drivers /
  // Transport Suppliers) — this page is hotels only.
  const load = () => {
    const token = localStorage.getItem('token')
    fetch('/api/suppliers?type=hotel', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const create = async () => {
    if (!form.name || !form.email) {
      toast.error('Name and email required')
      return
    }
    try {
      await mutateJson('/api/suppliers', {
        token: localStorage.getItem('token'),
        body: { ...form, type: 'hotel' },
      })
      toast.success('Supplier added')
      setOpen(false)
      setForm({ name: '', email: '', phone: '' })
      load()
    } catch (e) {
      toast.error(e.message || 'Failed to add')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground sm:text-base">
          Hotels and accommodation partners
        </p>
        <Button onClick={() => setOpen(true)} size="sm" className="shrink-0 gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          <span className="sm:hidden">Add</span>
          <span className="hidden sm:inline">Add supplier</span>
        </Button>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Hotel directory
          </CardTitle>
          <CardDescription>{suppliers.length} hotel supplier(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 md:hidden">
            {suppliers.map((s) => (
              <Link key={s._id} href={`/dashboard/suppliers/${s._id}`} className="block rounded-xl border p-4">
                <p className="font-semibold">{s.name}</p>
                <Badge variant="secondary" className="mt-1 capitalize">{s.type}</Badge>
                <p className="mt-2 text-sm">{s.email}</p>
                <p className="text-sm text-muted-foreground">{s.phone || s.address?.city || '—'}</p>
                {!!s.balanceDue && (
                  <p className="mt-1 text-sm font-medium text-destructive">Due: {s.balanceDue}</p>
                )}
              </Link>
            ))}
          </div>
          <TableShell className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Balance due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No hotel suppliers yet.
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map((s) => (
                  <TableRow
                    key={s._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/suppliers/${s._id}`)}
                  >
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{s.type}</Badge>
                    </TableCell>
                    <TableCell>{s.email}</TableCell>
                    <TableCell>{s.phone || '—'}</TableCell>
                    <TableCell>{s.address?.city || '—'}</TableCell>
                    <TableCell>
                      {s.balanceDue ? (
                        <Badge className="bg-destructive">{s.balanceDue}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </TableShell>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={create}>Save supplier</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
