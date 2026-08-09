'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { formatInr } from '@/utils/crm'
import { TableShell } from '@/components/crm/TableShell'

function formatDate(d) {
  if (!d) return null
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return null
  }
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={null}>
      <InvoicesPageInner />
    </Suspense>
  )
}

function InvoicesPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [invoices, setInvoices] = useState([])
  const [bookings, setBookings] = useState([])
  const [dayPlanDates, setDayPlanDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [finalInvoiceAmount, setFinalInvoiceAmount] = useState(0)
  const [form, setForm] = useState({
    bookingId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    amount: '',
    dueDate: '',
    invoiceType: 'proforma',
    gstRate: 0,
  })

  const load = () => {
    const token = localStorage.getItem('token')
    Promise.all([
      fetch('/api/invoices?limit=50', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/bookings?limit=50', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([invData, bookData]) => {
        setInvoices(invData.invoices || [])
        setBookings(bookData.bookings || [])
        // Coming from the Accounts dashboard's "new advance payment" queue —
        // jump straight into the dialog with that booking pre-selected.
        const bookingId = searchParams.get('bookingId')
        if (bookingId && (bookData.bookings || []).some((b) => String(b._id) === bookingId)) {
          const invoiceType = searchParams.get('invoiceType') || 'advance'
          const amount = searchParams.get('amountReceived') || ''
          selectBooking(bookingId, { invoiceType, amount }, bookData.bookings || [])
          setOpen(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    if (!['admin', 'accounts'].includes(u.role)) {
      window.location.href = '/dashboard'
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Picking a booking (routed to this accounts person) auto-fills the
  // client's name/email/phone and the package amount from that booking —
  // no re-typing details that already live on the lead/booking. Due date
  // defaults to the client's arrival (Day 1 of the itinerary plan, falling
  // back to the booking's startDate) but stays fully editable either way.
  const selectBooking = (bookingId, overrides = {}, list = bookings) => {
    const b = list.find((x) => String(x._id) === bookingId)
    setForm((f) => ({
      ...f,
      bookingId,
      clientName: b ? [b.leadId?.firstName, b.leadId?.lastName].filter(Boolean).join(' ') : '',
      clientEmail: b?.leadId?.email || '',
      clientPhone: b?.leadId?.phone || '',
      amount: '',
      dueDate: b?.startDate ? new Date(b.startDate).toISOString().slice(0, 10) : '',
      ...overrides,
    }))

    setDayPlanDates([])
    setFinalInvoiceAmount(0)
    if (!bookingId) return
    const token = localStorage.getItem('token')

    // Full booking detail (not the summary list row) has every invoice
    // already raised — needed to work out what's left for a Final Invoice.
    // Only invoice.amountPaid counts as "received" — the Sales-side advance
    // is never added separately, since it only ever shows up here once it's
    // been billed through some invoice; adding it again would double-count
    // the same money.
    fetch(`/api/bookings/${bookingId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const booking = d.booking
        if (!booking) return
        const receivedSoFar = (booking.invoices || []).reduce((sum, i) => sum + (i.amountPaid || 0), 0)
        setFinalInvoiceAmount(Math.max(0, (booking.totalAmount || 0) - receivedSoFar))
      })
      .catch(() => setFinalInvoiceAmount(0))

    const itineraryId = b?.itineraryId?._id || b?.itineraryId
    if (!itineraryId) return
    fetch(`/api/itineraries/${itineraryId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const dates = (d.days || [])
          .filter((day) => day.date)
          .map((day) => ({
            value: new Date(day.date).toISOString().slice(0, 10),
            label: `Day ${day.dayNumber} — ${formatDate(day.date)}`,
          }))
        setDayPlanDates(dates)
        if (dates.length) {
          setForm((f) => ({ ...f, dueDate: f.dueDate || dates[0].value }))
        }
      })
      .catch(() => setDayPlanDates([]))
  }

  const createInvoice = async () => {
    // Partial and Advance invoices both bill exactly what was received; a
    // Final Invoice bills whatever's left of the package and isn't hand-typed.
    const isAdvanceLike = ['advance', 'proforma'].includes(form.invoiceType)
    const isFinal = form.invoiceType === 'tax_invoice'
    const subtotal = isFinal ? finalInvoiceAmount : Number(form.amount)
    if (!form.bookingId || !form.clientName || !subtotal || (!isFinal && !form.dueDate)) {
      toast.error('Fill all required fields')
      return
    }
    if (isAdvanceLike && subtotal > finalInvoiceAmount) {
      toast.error(`Amount cannot exceed the due balance of ${formatInr(finalInvoiceAmount)}`)
      return
    }
    const token = localStorage.getItem('token')
    const selected = bookings.find((b) => String(b._id) === form.bookingId)
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: form.bookingId,
        leadId: selected?.leadId?._id || selected?.leadId,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        clientPhone: form.clientPhone,
        subtotal,
        taxRate: Number(form.gstRate) || 0,
        dueDate: isFinal ? new Date().toISOString().slice(0, 10) : form.dueDate,
        invoiceType: form.invoiceType,
        amountPaid: isAdvanceLike ? subtotal : 0,
        items: [
          {
            description: isAdvanceLike ? 'Payment received' : isFinal ? 'Final payment' : 'Travel package',
            quantity: 1,
            rate: subtotal,
            amount: subtotal,
          },
        ],
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to create invoice')
      return
    }
    toast.success('Invoice created')
    setOpen(false)
    setForm({
      bookingId: '',
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      amount: '',
      dueDate: '',
      invoiceType: 'proforma',
      gstRate: 0,
    })
    setDayPlanDates([])
    setFinalInvoiceAmount(0)
    load()
    if (data.invoice?._id) downloadInvoicePdf(data.invoice._id)
  }

  // The PDF route needs the auth header, so it can't be a plain <a href> —
  // fetch it as a blob and trigger the browser's save-file dialog ourselves.
  const downloadInvoicePdf = async (invoiceId) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate PDF')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoiceId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.message || 'Failed to download PDF')
    }
  }

  // Same client can have several invoices (proforma, advance, tax...) — the
  // list should show one row per client/booking, not one per invoice, with
  // a combined "Due balance" against that client's package total.
  const groupedInvoices = useMemo(() => {
    const groups = new Map()
    for (const inv of invoices) {
      const bookingId = inv.bookingId?._id || inv.bookingId
      const key = bookingId ? String(bookingId) : `no-booking-${inv.clientName}-${inv.clientEmail}`
      if (!groups.has(key)) {
        const booking = bookings.find((b) => String(b._id) === String(bookingId))
        groups.set(key, {
          key,
          bookingId,
          clientName: inv.clientName,
          packageTotal: booking?.totalAmount || 0,
          startDate: booking?.startDate || null,
          endDate: booking?.endDate || null,
          bookingStatus: booking?.status || null,
          refundAmount: booking?.refundAmount || 0,
          refundStatus: booking?.refundStatus || 'none',
          invoices: [],
        })
      }
      groups.get(key).invoices.push(inv)
    }
    return Array.from(groups.values()).map((g) => {
      const amountPaidSum = g.invoices.reduce((s, i) => s + (i.amountPaid || 0), 0)
      const packageTotal = g.packageTotal || Math.max(...g.invoices.map((i) => i.totalAmount || 0), 0)
      const dueBalance = Math.max(0, packageTotal - amountPaidSum)
      const latest = [...g.invoices].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      )[0]
      // Ongoing = trip is happening right now (today between arrival and
      // departure); Upcoming = arrival hasn't happened yet; arrivingTomorrow
      // is a subset of Upcoming flagged separately for the alert filter.
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today.getTime() + 86400000)
      const arrival = g.startDate ? new Date(g.startDate) : null
      const departure = g.endDate ? new Date(g.endDate) : null
      let tripStage = null
      if (g.bookingStatus === 'cancelled') {
        tripStage = 'cancelled'
      } else if (arrival && departure) {
        if (today >= arrival && today <= departure) tripStage = 'ongoing'
        else if (today < arrival) tripStage = 'upcoming'
        else tripStage = 'past'
      }
      const arrivingTomorrow =
        g.bookingStatus !== 'cancelled' &&
        Boolean(
          arrival && arrival.getFullYear() === tomorrow.getFullYear() &&
            arrival.getMonth() === tomorrow.getMonth() &&
            arrival.getDate() === tomorrow.getDate()
        )
      const dueDate = g.invoices.reduce((min, i) => {
        if (!i.dueDate) return min
        return !min || new Date(i.dueDate) < new Date(min) ? i.dueDate : min
      }, null)
      return { ...g, amountPaidSum, packageTotal, dueBalance, latest, dueDate, tripStage, arrivingTomorrow }
    })
  }, [invoices, bookings])

  const [clientFilter, setClientFilter] = useState('all')
  useEffect(() => {
    const f = searchParams.get('filter')
    if (f === 'ongoing' || f === 'upcoming' || f === 'tomorrow') setClientFilter(f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleInvoices = useMemo(() => {
    if (clientFilter === 'all') return groupedInvoices
    if (clientFilter === 'tomorrow') return groupedInvoices.filter((g) => g.arrivingTomorrow)
    return groupedInvoices.filter((g) => g.tripStage === clientFilter)
  }, [groupedInvoices, clientFilter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground sm:text-base">
          GST invoices and payment tracking
        </p>
        <Button onClick={() => setOpen(true)} size="sm" className="shrink-0 gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" />
          <span className="sm:hidden">New</span>
          <span className="hidden sm:inline">New invoice</span>
        </Button>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All invoices
          </CardTitle>
          <CardDescription>{visibleInvoices.length} client(s)</CardDescription>
          <div className="scroll-hover-thin flex flex-nowrap gap-2 overflow-x-auto pt-1 pb-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'ongoing', label: 'Ongoing Clients' },
              { key: 'upcoming', label: 'Upcoming Clients' },
              { key: 'tomorrow', label: 'Arriving Tomorrow' },
            ].map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={clientFilter === f.key ? 'default' : 'outline'}
                className="shrink-0"
                onClick={() => setClientFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 md:hidden">
            {visibleInvoices.map((g, idx) => (
              <div
                key={g.key}
                className="rounded-xl border p-4"
                onClick={() => g.bookingId && router.push(`/dashboard/invoices/${g.bookingId}`)}
              >
                <p className="text-xs text-muted-foreground">#{idx + 1}</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold">{g.clientName}</p>
                  {g.bookingStatus === 'cancelled' && (
                    <Badge className="bg-destructive hover:bg-destructive">Cancelled</Badge>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span>{formatInr(g.packageTotal)}</span>
                  {g.bookingStatus === 'cancelled' ? (
                    g.refundAmount > 0 && (
                      <span className="text-sm">
                        Refund:{' '}
                        <span className={`font-semibold ${g.refundStatus === 'paid' ? 'text-success' : 'text-amber-600'}`}>
                          {formatInr(g.refundAmount)} {g.refundStatus === 'paid' ? '(paid)' : '(pending)'}
                        </span>
                      </span>
                    )
                  ) : (
                    <span className="text-sm">
                      Due: <span className="font-semibold text-destructive">{formatInr(g.dueBalance)}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <TableShell className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Due balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : visibleInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {clientFilter === 'all' ? (
                      <>
                        No invoices yet.{' '}
                        <Link href="/dashboard/bookings" className="text-primary hover:underline">
                          Create a booking
                        </Link>{' '}
                        first, then invoice the client.
                      </>
                    ) : (
                      `No ${clientFilter} clients right now.`
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                visibleInvoices.map((g, idx) => (
                  <TableRow
                    key={g.key}
                    className={g.bookingId ? 'cursor-pointer' : undefined}
                    onClick={() => g.bookingId && router.push(`/dashboard/invoices/${g.bookingId}`)}
                  >
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {g.clientName}
                        {g.bookingStatus === 'cancelled' && (
                          <Badge className="bg-destructive hover:bg-destructive">Cancelled</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatInr(g.packageTotal)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {g.dueDate ? new Date(g.dueDate).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      {g.bookingStatus === 'cancelled' ? (
                        g.refundAmount > 0 ? (
                          <span
                            className={`font-semibold ${g.refundStatus === 'paid' ? 'text-success' : 'text-amber-600'}`}
                          >
                            Refund {formatInr(g.refundAmount)} {g.refundStatus === 'paid' ? '(paid)' : '(pending)'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )
                      ) : (
                        <span className="font-semibold text-destructive">{formatInr(g.dueBalance)}</span>
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
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Client / Booking *</Label>
              <Select value={form.bookingId} onValueChange={selectBooking}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select booking" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((b) => (
                    <SelectItem key={b._id} value={String(b._id)}>
                      {b.bookingNumber} — {b.leadId?.firstName} {b.leadId?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Picking a booking fills in the client's name, contact, and package amount below.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Client name *</Label>
              <Input
                value={form.clientName}
                onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Client email</Label>
              <Input
                type="email"
                value={form.clientEmail}
                onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Client phone</Label>
              <Input
                value={form.clientPhone}
                onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice type *</Label>
              <select
                className="flex h-9 w-full rounded-md border-2 border-gray-400 bg-transparent px-3 text-sm dark:border-gray-500"
                value={form.invoiceType}
                onChange={(e) => setForm((f) => ({ ...f, invoiceType: e.target.value }))}
              >
                <option value="proforma">Partial Invoice</option>
                <option value="advance">Advance Invoice</option>
                <option value="tax_invoice">Final Invoice</option>
              </select>
            </div>
            {['advance', 'proforma'].includes(form.invoiceType) ? (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <Label>Amount received (₹) *</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className={
                    Number(form.amount) > finalInvoiceAmount ? 'border-destructive focus-visible:ring-destructive' : ''
                  }
                />
                {Number(form.amount) > finalInvoiceAmount && (
                  <p className="text-xs font-medium text-destructive">
                    Amount exceeds the due balance of {formatInr(finalInvoiceAmount)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  This invoice bills exactly what was received — the remaining balance is billed later via a
                  Final Invoice.
                </p>
                <div className="flex items-center justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">Total due</span>
                  <span className="font-semibold">{formatInr(finalInvoiceAmount)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <Label>Final invoice amount (₹)</Label>
                <Input type="number" value={finalInvoiceAmount} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  Auto-calculated — package total minus everything already received (advance + Partial/Advance
                  invoices). Not editable.
                </p>
              </div>
            )}
            <div className="space-y-2 rounded-md border p-3">
              <Label>GST</Label>
              <div className="grid grid-cols-3 gap-2">
                {[0, 5, 18].map((rate) => (
                  <Button
                    key={rate}
                    type="button"
                    size="sm"
                    variant={Number(form.gstRate) === rate ? 'default' : 'outline'}
                    onClick={() => setForm((f) => ({ ...f, gstRate: rate }))}
                  >
                    {rate === 0 ? 'No GST' : `${rate}%`}
                  </Button>
                ))}
              </div>
            </div>
            {form.invoiceType !== 'tax_invoice' && (
              <div className="space-y-2">
                <Label>Due date *</Label>
                {dayPlanDates.length > 0 ? (
                  <>
                    <select
                      className="flex h-9 w-full rounded-md border-2 border-gray-400 bg-transparent px-3 text-sm dark:border-gray-500"
                      value={form.dueDate}
                      onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                    >
                      <option value="">Select a date from the day plan</option>
                      {dayPlanDates.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Dates come from this booking's itinerary day plan.
                    </p>
                  </>
                ) : (
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                )}
              </div>
            )}
          </div>
          <Button
            className="w-full"
            disabled={
              ['advance', 'proforma'].includes(form.invoiceType) && Number(form.amount) > finalInvoiceAmount
            }
            onClick={createInvoice}
          >
            Create invoice
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
