'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { leadDisplayName, LEAD_STATUSES, formatInr } from '@/utils/crm'
import { useMasters } from '@/hooks/useMasters'
import { toCompressedDataUrl, dataUrlSize } from '@/lib/imageCompress'

export default function LeadDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [lead, setLead] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [itineraries, setItineraries] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [user, setUser] = useState(null)
  const [lostForm, setLostForm] = useState({
    lostReason: '',
    nextFollowUpAt: '',
    followUpType: 'call',
    remarks: '',
  })
  const [savingLost, setSavingLost] = useState(false)
  const [showBookPanel, setShowBookPanel] = useState(false)
  const [bookForm, setBookForm] = useState({
    itineraryId: '',
    opsAssignedTo: '',
    accountsAssignedTo: '',
    advanceAmount: '',
    advanceZeroReason: '',
    advanceScreenshot: '',
  })
  const [bookSaving, setBookSaving] = useState(false)
  const [compressingScreenshot, setCompressingScreenshot] = useState(false)
  const [opsMembers, setOpsMembers] = useState([])
  const [accountsMembers, setAccountsMembers] = useState([])

  const { options: statusMasters } = useMasters('lead_status', LEAD_STATUSES)
  const { options: followUpTypes } = useMasters('follow_up_type', [
    'call', 'email', 'whatsapp', 'meeting', 'site_visit',
  ])
  const { options: lostReasons } = useMasters('lost_reason', [])

  const token = () => localStorage.getItem('token')

  const loadAll = async () => {
    setLoading(true)
    try {
      const t = token()
      const [leadRes, timelineRes, itRes, fuRes, bkRes] = await Promise.all([
        fetch(`/api/leads/${id}`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`/api/leads/${id}/timeline`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`/api/itineraries?leadId=${id}&limit=20`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`/api/follow-ups?leadId=${id}&limit=20`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`/api/bookings?limit=50`, { headers: { Authorization: `Bearer ${t}` } }),
      ])

      const leadData = await leadRes.json()
      if (!leadRes.ok) throw new Error(leadData.error || 'Lead not found')
      const l = leadData.lead || leadData
      setLead(l)
      setLostForm({
        lostReason: l.lostReason || '',
        nextFollowUpAt: l.lostDetails?.nextFollowUpAt
          ? new Date(l.lostDetails.nextFollowUpAt).toISOString().slice(0, 16)
          : '',
        followUpType: l.lostDetails?.followUpType || 'call',
        remarks: l.lostDetails?.remarks || '',
      })

      const tl = await timelineRes.json()
      setTimeline(tl.timeline || [])

      const it = await itRes.json()
      setItineraries(it.itineraries || [])

      const fu = await fuRes.json()
      setFollowUps(fu.followUps || [])

      const bk = await bkRes.json()
      setBookings((bk.bookings || []).filter((b) => String(b.leadId?._id || b.leadId) === id))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem('user') || 'null'))
    } catch {
      setUser(null)
    }
    loadAll()
  }, [id])

  useEffect(() => {
    // Lets the "Booked" panel offer a hand-picked Operations/Accounts person
    // instead of always falling back to round-robin.
    const fetchMembers = async () => {
      try {
        const res = await fetch('/api/team/members', {
          headers: { Authorization: `Bearer ${token()}` },
        })
        if (res.ok) {
          const data = await res.json()
          const all = data.members || []
          setOpsMembers(all.filter((m) => m.role === 'operations'))
          setAccountsMembers(all.filter((m) => m.role === 'accounts'))
        }
      } catch (error) {
        console.error('Error fetching team members:', error)
      }
    }
    fetchMembers()
  }, [])

  const updateStatus = async (status) => {
    // "Booked" needs an itinerary + a real Booking record, not just a status
    // flip — show the inline panel instead of silently changing the status.
    if (status === 'booked') {
      setBookForm({
        itineraryId: '',
        opsAssignedTo: '',
        accountsAssignedTo: '',
        advanceAmount: '',
        advanceZeroReason: '',
        advanceScreenshot: '',
      })
      setShowBookPanel(true)
      return
    }
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      toast.error('Failed to update status')
      return
    }
    toast.success('Status updated')
    loadAll()
  }

  const confirmBooking = async () => {
    if (!bookForm.itineraryId) {
      toast.error('Select the itinerary the client booked on')
      return
    }
    if (bookForm.advanceAmount === '') {
      toast.error('Enter the advance amount the client paid (0 if none)')
      return
    }
    const advanceAmount = Number(bookForm.advanceAmount)
    if (advanceAmount === 0 && !bookForm.advanceZeroReason.trim()) {
      toast.error('Explain why the advance is 0')
      return
    }
    if (advanceAmount > 0 && !bookForm.advanceScreenshot) {
      toast.error('Upload a screenshot of the advance payment')
      return
    }
    setBookSaving(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: id,
          itineraryId: bookForm.itineraryId,
          opsAssignedTo: bookForm.opsAssignedTo || undefined,
          accountsAssignedTo: bookForm.accountsAssignedTo || undefined,
          advanceAmount,
          advanceZeroReason: advanceAmount === 0 ? bookForm.advanceZeroReason.trim() : undefined,
          advanceScreenshot: advanceAmount > 0 ? bookForm.advanceScreenshot : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Booking failed')
        return
      }
      toast.success('Booking created')
      setShowBookPanel(false)
      loadAll()
    } finally {
      setBookSaving(false)
    }
  }

  // Advance payment screenshots are compressed client-side to under 70KB
  // before being sent to the server.
  const handleScreenshotPick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCompressingScreenshot(true)
    try {
      const dataUrl = await toCompressedDataUrl(file, 70 * 1024)
      if (dataUrlSize(dataUrl) > 70 * 1024) {
        toast.info('Screenshot compressed as much as possible, but is still a bit over 70KB')
      }
      setBookForm((f) => ({ ...f, advanceScreenshot: dataUrl }))
    } catch {
      toast.error('Could not process that image')
    } finally {
      setCompressingScreenshot(false)
    }
  }

  const addNote = async () => {
    if (!note.trim()) return
    const res = await fetch(`/api/leads/${id}/timeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'note', title: 'Note', note: note.trim() }),
    })
    if (!res.ok) {
      toast.error('Failed to add note')
      return
    }
    setNote('')
    toast.success('Note added')
    loadAll()
  }

  const saveLostDetails = async () => {
    setSavingLost(true)
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'lost',
          lostReason: lostForm.lostReason,
          lostDetails: {
            nextFollowUpAt: lostForm.nextFollowUpAt || null,
            followUpType: lostForm.followUpType,
            remarks: lostForm.remarks,
          },
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'Failed to save')
        return
      }
      // Also schedule a follow-up so it surfaces in the Follow-ups module.
      if (lostForm.nextFollowUpAt) {
        await fetch('/api/follow-ups', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: id,
            assignedTo: user?.id || user?.userId || user?._id,
            type: lostForm.followUpType,
            scheduledDate: lostForm.nextFollowUpAt,
            description: lostForm.remarks || `Lost lead follow-up (${lostForm.lostReason || 'no reason'})`,
          }),
        }).catch(() => {})
      }
      toast.success('Lost follow-up saved')
      loadAll()
    } finally {
      setSavingLost(false)
    }
  }

  const convertToBooking = async (itinerary) => {
    const total = itinerary.totalPrice || itinerary.totalCost || 0
    const advance = Math.round(total * 0.3)
    const balance = total - advance
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: id,
        itineraryId: itinerary._id,
        // Trip dates, travelers, and amount are derived from the itinerary
        // itself on the backend — only the payment split needs to be sent.
        paymentSchedule: [
          { dueDate: new Date(), amount: advance, status: 'pending' },
          ...(balance > 0
            ? [{ dueDate: itinerary.startDate, amount: balance, status: 'pending' }]
            : []),
        ],
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Booking failed')
      return
    }
    toast.success('Booking created')
    router.push('/dashboard/bookings')
  }

  // Remarks entered while actioning a follow-up are logged to the timeline
  // going forward (see PATCH /api/follow-ups/[id]), tagged with
  // metadata.followUpId. Older follow-ups predate that and only ever had
  // their remark stored on the FollowUp record itself — merge those in here
  // so past remark history still shows, without double-counting the ones
  // that already have a matching timeline entry.
  const loggedFollowUpIds = new Set(
    timeline.filter((t) => t.metadata?.followUpId).map((t) => String(t.metadata.followUpId))
  )
  const legacyFollowUpEntries = followUps
    .filter((fu) => fu.description?.trim() && !loggedFollowUpIds.has(String(fu._id)))
    .map((fu) => ({
      _id: `fu-${fu._id}`,
      title: fu.status === 'completed' ? 'Follow-up completed' : 'Follow-up remark',
      body: fu.description,
      createdAt: fu.updatedAt || fu.createdAt,
    }))
  const timelineEntries = [...timeline, ...legacyFollowUpEntries].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Lead not found</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/dashboard/leads">Back to leads</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild className="gap-2 -ml-2">
        <Link href="/dashboard/leads">
          <ArrowLeft className="h-4 w-4" />
          Back to leads
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{leadDisplayName(lead)}</h1>
          <p className="mt-1 text-muted-foreground">{lead.email}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline" className="capitalize">{lead.status}</Badge>
            <Badge variant="secondary" className="capitalize">{lead.source}</Badge>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/dashboard/itinerary-builder?leadId=${id}`}>
              <FileText className="mr-2 h-4 w-4" />
              Create itinerary
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/60 shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {lead.phone || '—'}
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              {lead.whatsapp || lead.phone || '—'}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {lead.destinationPreference?.join(', ') || '—'}
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {lead.numberOfTravelers || '—'} travelers
            </div>
            <div className="pt-2">
              <Label className="text-xs text-muted-foreground">Pipeline status</Label>
              <div className="mt-1">
                {(() => {
                  const opt = statusMasters.find((s) => s.key === lead.status)
                  const color = opt?.color || '#3b82f6'
                  return (
                    <span
                      className="inline-block rounded-full px-3 py-1.5 text-sm font-medium capitalize"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      {opt?.label || lead.status}
                    </span>
                  )
                })()}
              </div>
              {/* Status changes go through Follow-ups (each one requires a
               * remark) so there's always a reason on record — except
               * Booked, which needs the itinerary + payment panel below. */}
              {lead.status !== 'booked' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => updateStatus('booked')}
                >
                  Mark as booked
                </Button>
              )}
            </div>

            {/* Marking the lead Booked — pick which itinerary the client
             * actually closed on. Trip dates, travelers, and amount all come
             * from that itinerary; nothing else needs to be entered here. */}
            {showBookPanel && (
              <div className="mt-2 space-y-3 rounded-lg border border-success/40 bg-success/15 p-3">
                <p className="text-sm font-semibold text-success">Confirm booking</p>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Itinerary *</Label>
                  {itineraries.length === 0 ? (
                    <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      No itineraries created for this lead yet — create one before booking.
                    </p>
                  ) : (
                    <Select
                      value={bookForm.itineraryId}
                      onValueChange={(v) => setBookForm((f) => ({ ...f, itineraryId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select the itinerary the client booked on" />
                      </SelectTrigger>
                      <SelectContent>
                        {itineraries.map((it) => (
                          <SelectItem key={it._id} value={it._id}>
                            {leadDisplayName(lead)}
                            {it.destination ? ` · ${it.destination}` : ''}
                            {it.totalPrice || it.totalCost ? ` · ${formatInr(it.totalPrice || it.totalCost)}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Advance paid (₹) *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={bookForm.advanceAmount}
                    onChange={(e) => setBookForm((f) => ({ ...f, advanceAmount: e.target.value }))}
                    placeholder="e.g. 5000"
                  />
                </div>

                {bookForm.advanceAmount !== '' && Number(bookForm.advanceAmount) === 0 ? (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Why is the advance 0? *</Label>
                    <Textarea
                      value={bookForm.advanceZeroReason}
                      onChange={(e) => setBookForm((f) => ({ ...f, advanceZeroReason: e.target.value }))}
                      placeholder="e.g. Client will pay full amount on arrival"
                      className="min-h-[60px]"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Payment screenshot *</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotPick}
                      disabled={compressingScreenshot}
                    />
                    {compressingScreenshot && (
                      <p className="text-xs text-muted-foreground">Compressing…</p>
                    )}
                    {bookForm.advanceScreenshot && !compressingScreenshot && (
                      <div className="flex items-center gap-2 pt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={bookForm.advanceScreenshot}
                          alt="Advance payment screenshot"
                          className="h-14 w-14 rounded-md border object-cover"
                        />
                        <span className="text-xs text-muted-foreground">
                          {Math.round(dataUrlSize(bookForm.advanceScreenshot) / 1024)}KB
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Operations</Label>
                  <Select
                    value={bookForm.opsAssignedTo}
                    onValueChange={(v) => setBookForm((f) => ({ ...f, opsAssignedTo: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Auto-assign (round robin)" /></SelectTrigger>
                    <SelectContent>
                      {opsMembers.map((m) => (
                        <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Accounts</Label>
                  <Select
                    value={bookForm.accountsAssignedTo}
                    onValueChange={(v) => setBookForm((f) => ({ ...f, accountsAssignedTo: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Auto-assign (round robin)" /></SelectTrigger>
                    <SelectContent>
                      {accountsMembers.map((m) => (
                        <SelectItem key={m._id} value={m._id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => setShowBookPanel(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={confirmBooking}
                    disabled={
                      bookSaving ||
                      compressingScreenshot ||
                      !bookForm.itineraryId ||
                      bookForm.advanceAmount === '' ||
                      (Number(bookForm.advanceAmount) === 0 && !bookForm.advanceZeroReason.trim()) ||
                      (Number(bookForm.advanceAmount) > 0 && !bookForm.advanceScreenshot)
                    }
                  >
                    {bookSaving ? 'Booking…' : 'Confirm Booking'}
                  </Button>
                </div>
              </div>
            )}

            {/* Lost lead follow-up — only visible for lost leads */}
            {lead.status === 'lost' && (
              <div className="mt-2 space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-3">
                <p className="text-sm font-semibold text-red-700">Lost lead follow-up</p>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Lost reason</Label>
                  <Select
                    value={lostForm.lostReason}
                    onValueChange={(v) => setLostForm((f) => ({ ...f, lostReason: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {lostReasons.length === 0 ? (
                        <SelectItem value="other">Other</SelectItem>
                      ) : (
                        lostReasons.map((r) => (
                          <SelectItem key={r.key} value={r.key}>
                            {r.label}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Next follow-up date &amp; time
                  </Label>
                  <Input
                    type="datetime-local"
                    value={lostForm.nextFollowUpAt}
                    onChange={(e) =>
                      setLostForm((f) => ({ ...f, nextFollowUpAt: e.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Follow-up type</Label>
                  <Select
                    value={lostForm.followUpType}
                    onValueChange={(v) => setLostForm((f) => ({ ...f, followUpType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {followUpTypes.map((t) => (
                        <SelectItem key={t.key} value={t.key} className="capitalize">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Remarks</Label>
                  <Textarea
                    value={lostForm.remarks}
                    onChange={(e) => setLostForm((f) => ({ ...f, remarks: e.target.value }))}
                    placeholder="Why was this lead lost? Next steps..."
                    className="min-h-[70px]"
                  />
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={saveLostDetails}
                  disabled={savingLost}
                >
                  {savingLost ? 'Saving...' : 'Save lost follow-up'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Activity timeline</CardTitle>
            <CardDescription>Notes and system events for this lead</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a note..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
            <Button size="sm" onClick={addNote} disabled={!note.trim()}>
              Add note
            </Button>
            <div className="max-h-64 space-y-3 overflow-y-auto border-t pt-4">
              {timelineEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              ) : (
                timelineEntries.map((item) => (
                  <div key={item._id} className="rounded-lg border bg-muted/30 px-3 py-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    {(item.body || item.description) && (
                      <p className="text-sm text-muted-foreground">
                        {item.body || item.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Itineraries</CardTitle>
              <CardDescription>Quotations linked to this lead</CardDescription>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/dashboard/itinerary-builder?leadId=${id}`}>
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {itineraries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No itineraries yet</p>
            ) : (
              itineraries.map((it) => (
                <div
                  key={it._id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{it.tripName || it.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {it.destination} · {formatInr(it.totalPrice || 0, it.currency)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="sm" variant="outline" asChild className="w-full sm:w-auto">
                      <Link href={`/dashboard/itinerary-builder?id=${it._id}`}>Edit</Link>
                    </Button>
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => convertToBooking(it)}>
                      Book
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups scheduled</p>
            ) : (
              followUps.map((fu) => (
                <div key={fu._id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium capitalize">{fu.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(fu.scheduledDate).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">{fu.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {bookings.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bookings.map((b) => (
              <div key={b._id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{b.bookingNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatInr(b.totalAmount, b.currency)} · {b.status}
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard/bookings">View</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
