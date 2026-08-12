'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Package,
  FileCheck,
  Hotel,
  Car,
  Plane,
  MapPin,
  ArrowRight,
} from 'lucide-react'
import { PageHeader } from '@/components/crm/PageHeader'

const OPS_STATUS = {
  awaiting_ops: { label: 'Awaiting Ops', className: 'bg-muted-foreground/60 hover:bg-muted-foreground/60' },
  in_progress: { label: 'In Progress', className: 'bg-blue-600 hover:bg-blue-600' },
  hotel_pending: { label: 'Hotel Pending', className: 'bg-amber-500 hover:bg-amber-500' },
  cab_pending: { label: 'Cab Pending', className: 'bg-amber-500 hover:bg-amber-500' },
  activity_pending: { label: 'Activity Pending', className: 'bg-amber-500 hover:bg-amber-500' },
  vouchers_ready: { label: 'Vouchers Ready', className: 'bg-indigo-600 hover:bg-indigo-600' },
  travel_kit_sent: { label: 'Travel Kit Sent', className: 'bg-indigo-600 hover:bg-indigo-600' },
  completed: { label: 'Completed', className: 'bg-success hover:bg-success' },
}

export default function OperationsDashboardPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const token = localStorage.getItem('token')
      if (!token) {
        window.location.href = '/login'
        return
      }
      const u = JSON.parse(localStorage.getItem('user') || '{}')
      if (!['operations', 'admin'].includes(u.role)) {
        window.location.href = '/dashboard'
        return
      }
      const res = await fetch('/api/analytics/operations', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setData(await res.json())
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  const stats = [
    {
      label: 'New Bookings',
      value: data?.newBookings,
      icon: Package,
      href: '/dashboard/bookings?opsFilter=new',
      alert: (data?.newBookings || 0) > 0,
    },
    {
      label: 'Voucher Pending',
      value: data?.voucherPending,
      icon: FileCheck,
      href: '/dashboard/vouchers?status=pending',
      alert: (data?.voucherPending || 0) > 0,
    },
    {
      label: 'Hotel Confirmation Pending',
      value: data?.hotelConfirmationPending,
      icon: Hotel,
      href: '/dashboard/bookings?opsFilter=hotel_pending',
      alert: (data?.hotelConfirmationPending || 0) > 0,
    },
    {
      label: 'Cab Confirmation Pending',
      value: data?.cabConfirmationPending,
      icon: Car,
      href: '/dashboard/bookings?opsFilter=cab_pending',
      alert: (data?.cabConfirmationPending || 0) > 0,
    },
    { label: 'Upcoming Arrivals', value: data?.upcomingArrivals, icon: Plane, href: '/dashboard/bookings?opsFilter=upcoming' },
    { label: 'Running Tours', value: data?.runningTours, icon: MapPin, href: '/dashboard/bookings?opsFilter=running' },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operations Dashboard"
        description="Post-sales — vouchers, confirmations, and tour execution."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href}>
              <Card
                className={
                  s.alert
                    ? 'h-full border-amber-300 bg-amber-50/60 transition-shadow hover:shadow-md dark:border-amber-900 dark:bg-amber-950/20'
                    : 'h-full transition-shadow hover:shadow-md'
                }
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                  <Icon className={`h-4 w-4 ${s.alert ? 'text-amber-600' : 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${s.alert ? 'text-amber-600' : ''}`}>{s.value ?? 0}</div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Bookings Awaiting Ops</CardTitle>
            <CardDescription>Confirmed trips that still need hotel/cab work or a voucher.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/bookings">All bookings</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {(data?.recentBookings || []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No bookings in queue — you're all caught up.</p>
          ) : (
            data.recentBookings.map((b) => {
              const status = OPS_STATUS[b.opsStatus] || OPS_STATUS.awaiting_ops
              return (
                <Link
                  key={b._id}
                  href={`/dashboard/bookings/${b._id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">
                      {b.leadId?.firstName} {b.leadId?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.bookingNumber} · {b.startDate ? new Date(b.startDate).toLocaleDateString() : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Booked by: {b.assignedTo?.name || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={status.className}>{status.label}</Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
