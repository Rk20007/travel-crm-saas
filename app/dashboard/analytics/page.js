'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatInr } from '@/utils/crm'
import { PageHeader } from '@/components/crm/PageHeader'

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/analytics/summary', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sourceChart = (data?.bySource || []).map((row, i) => ({
    channel: row._id || `source_${i}`,
    leads: row.count,
  }))

  const agentChart = (data?.agentPerformance || []).map((row) => ({
    name: row.name || 'Agent',
    bookings: row.bookings || row.count || 0,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics & reports"
        description="Workspace performance and sales insights"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {[
          { label: 'Leads this month', value: data?.leadsMonth ?? '—' },
          { label: 'Leads today', value: data?.leadsToday ?? '—' },
          { label: 'Conversion rate', value: data?.conversionRate != null ? `${data.conversionRate}%` : '—' },
          { label: 'Revenue collected', value: formatInr(data?.revenueCollectedApprox ?? 0) },
        ].map((m) => (
          <Card key={m.label} className="border-border/60 shadow-sm">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">{m.label}</p>
              <p className="mt-1 text-xl font-bold sm:text-2xl">{loading ? '…' : m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Leads by source</CardTitle>
            <CardDescription>Channel attribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sourceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="channel" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="leads" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Pipeline status</CardTitle>
            <CardDescription>Lead distribution by stage</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={(data?.statusMix || []).map((r) => ({ status: r._id, count: r.count }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="status" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {agentChart.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Team performance</CardTitle>
            <CardDescription>Bookings by agent</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={agentChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="bookings" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
