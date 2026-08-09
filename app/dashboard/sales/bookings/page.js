'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/crm/PageHeader'
import { TableShell } from '@/components/crm/TableShell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { leadDisplayName } from '@/utils/crm'

function formatDate(d) {
  if (!d) return '—'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Read-only view for Sales — "what's the status of the clients I closed?"
 * Status here is purely informational (Processing until Operations has
 * confirmed hotel + transport and sent both vouchers) — Sales has no action
 * to take here, just visibility into their own closed bookings. */
export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/bookings/mine', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" asChild>
        <Link href="/dashboard/sales">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </Button>

      <PageHeader
        title="My Bookings"
        description="Clients you've closed, and where Operations stands on their trip."
      />

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Closed clients</CardTitle>
          <CardDescription>{bookings.length} booking(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {loading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
            ) : bookings.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No closed bookings yet.
              </p>
            ) : (
              bookings.map((b) => (
                <div key={b._id} className="rounded-xl border p-4">
                  <p className="font-semibold">{leadDisplayName(b.leadId)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(b.startDate)} → {formatDate(b.endDate)}
                  </p>
                  <div className="mt-2">
                    <Badge className={b.opsStatus === 'done' ? 'bg-success' : ''} variant={b.opsStatus === 'done' ? undefined : 'outline'}>
                      {b.opsStatus === 'done' ? 'Done' : 'Processing'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
          <TableShell className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Arrival date</TableHead>
                  <TableHead>Departure date</TableHead>
                  <TableHead>Operations status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No closed bookings yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((b) => (
                    <TableRow key={b._id}>
                      <TableCell className="font-medium">{leadDisplayName(b.leadId)}</TableCell>
                      <TableCell>{formatDate(b.startDate)}</TableCell>
                      <TableCell>{formatDate(b.endDate)}</TableCell>
                      <TableCell>
                        <Badge
                          className={b.opsStatus === 'done' ? 'bg-success' : ''}
                          variant={b.opsStatus === 'done' ? undefined : 'outline'}
                        >
                          {b.opsStatus === 'done' ? 'Done' : 'Processing'}
                        </Badge>
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
