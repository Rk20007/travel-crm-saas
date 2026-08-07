'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, TrendingUp, DollarSign } from 'lucide-react'
import { PageHeader } from '@/components/crm/PageHeader'

function formatINR(n) {
  return `₹${(n || 0).toLocaleString('en-IN')}`
}

export default function PlatformDashboardPage() {
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
      if (u.role !== 'superadmin') {
        window.location.href = '/dashboard'
        return
      }
      const res = await fetch('/api/analytics/platform', {
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

  const totals = data?.totals || {}

  return (
    <div className="space-y-8">
      <PageHeader
        title="AAP Platform Dashboard"
        description="Monitor all agencies, subscriptions, and platform-wide metrics."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Agencies', value: totals.agencies, icon: Building2 },
          { label: 'Total Leads', value: totals.totalLeads, icon: Users },
          { label: 'Total Bookings', value: totals.totalBookings, icon: TrendingUp },
          { label: 'Platform Revenue', value: formatINR(totals.totalRevenue), icon: DollarSign },
        ].map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value ?? 0}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Agencies</CardTitle>
          <CardDescription>Create agencies, manage subscriptions, and provide support.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4">Agency</th>
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Users</th>
                  <th className="pb-3 pr-4">Leads</th>
                  <th className="pb-3 pr-4">Bookings</th>
                  <th className="pb-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(data?.agencies || []).map((a) => (
                  <tr key={String(a._id)} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{a.name || 'Unnamed'}</td>
                    <td className="py-3 pr-4 capitalize">{a.plan || 'free'}</td>
                    <td className="py-3 pr-4">
                      <Badge variant="outline">{a.subscriptionStatus || 'active'}</Badge>
                    </td>
                    <td className="py-3 pr-4">{a.userCount}</td>
                    <td className="py-3 pr-4">{a.leadCount}</td>
                    <td className="py-3 pr-4">{a.bookingCount}</td>
                    <td className="py-3">{formatINR(a.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
