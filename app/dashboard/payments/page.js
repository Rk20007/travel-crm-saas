'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DollarSign, FileText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { formatInr, leadDisplayName } from '@/utils/crm'
import { PageHeader } from '@/components/crm/PageHeader'
import { TableShell } from '@/components/crm/TableShell'

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    Promise.all([
      fetch('/api/invoices?limit=30', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/payments?limit=30', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([inv, pay]) => {
        setInvoices(inv.invoices || [])
        setPayments(pay.payments || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const unpaid = invoices.filter((i) => i.paymentStatus !== 'paid')
  const collected = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Collections and outstanding invoices"
        actions={
          <Button asChild variant="outline" className="w-full gap-2 sm:w-auto">
            <Link href="/dashboard/invoices">
              <FileText className="h-4 w-4" />
              Manage invoices
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Collected</p>
            <p className="text-2xl font-bold">{formatInr(collected)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Unpaid invoices</p>
            <p className="text-2xl font-bold">{unpaid.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Payment records</p>
            <p className="text-2xl font-bold">{payments.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Recent payments
          </CardTitle>
          <CardDescription>Recorded against bookings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 md:hidden">
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
            ) : payments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No payments recorded yet</p>
            ) : (
              payments.map((p) => (
                <div key={p._id} className="rounded-xl border p-4">
                  <p className="font-semibold">{p.paymentNumber}</p>
                  <p className="text-sm text-muted-foreground">{leadDisplayName(p.leadId)}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-medium">{formatInr(p.amount, p.currency)}</span>
                    <Badge variant="outline" className="capitalize">{p.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
          <TableShell className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment #</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No payments recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium">{p.paymentNumber}</TableCell>
                    <TableCell>{leadDisplayName(p.leadId)}</TableCell>
                    <TableCell>{p.bookingId?.bookingNumber || '—'}</TableCell>
                    <TableCell>{formatInr(p.amount, p.currency)}</TableCell>
                    <TableCell className="capitalize">{p.paymentMethod?.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{p.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </TableShell>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Outstanding invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 md:hidden">
            {unpaid.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">All invoices paid</p>
            ) : (
              unpaid.map((inv) => (
                <div key={inv._id} className="rounded-xl border p-4">
                  <p className="font-semibold">{inv.invoiceNumber}</p>
                  <p className="text-sm text-muted-foreground">{inv.clientName}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span>{formatInr(inv.totalAmount, inv.currency)}</span>
                    <Badge variant="outline" className="capitalize">{inv.paymentStatus}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
          <TableShell className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unpaid.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    All invoices paid
                  </TableCell>
                </TableRow>
              ) : (
                unpaid.map((inv) => (
                  <TableRow key={inv._id}>
                    <TableCell>{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.clientName}</TableCell>
                    <TableCell>{formatInr(inv.totalAmount, inv.currency)}</TableCell>
                    <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{inv.paymentStatus}</Badge>
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
