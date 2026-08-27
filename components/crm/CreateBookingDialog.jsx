'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { leadDisplayName } from '@/utils/crm'
import { toCompressedDataUrl, dataUrlSize } from '@/lib/imageCompress'

/**
 * Convert a lead → real Booking. Shared by the Leads list ("Booked" status
 * pick) and the Lead detail page (Book button / "Due Follow-Ups" flow) so
 * both take the exact same advance/screenshot/ops-accounts flow instead of
 * one page having a shortcut that skips it.
 */
export function CreateBookingDialog({ lead, open, onOpenChange, opsMembers = [], accountsMembers = [], onBooked }) {
  const [leadItineraries, setLeadItineraries] = useState([])
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

  useEffect(() => {
    if (!open || !lead) return
    setBookForm({
      itineraryId: '',
      opsAssignedTo: '',
      accountsAssignedTo: '',
      advanceAmount: '',
      advanceZeroReason: '',
      advanceScreenshot: '',
    })
    setLeadItineraries([])
    const loadItineraries = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/itineraries?leadId=${lead._id}&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setLeadItineraries(data.itineraries || [])
        }
      } catch (error) {
        console.error('Error fetching lead itineraries:', error)
      }
    }
    loadItineraries()
  }, [open, lead])

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

  const handleBookSubmit = async (e) => {
    e.preventDefault()
    if (!lead) return
    if (!bookForm.itineraryId) {
      alert('Select the itinerary the client booked on')
      return
    }
    if (bookForm.advanceAmount === '') {
      alert('Enter the advance amount the client paid (0 if none)')
      return
    }
    const advanceAmount = Number(bookForm.advanceAmount)
    if (advanceAmount === 0 && !bookForm.advanceZeroReason.trim()) {
      alert('Explain why the advance is 0')
      return
    }
    if (advanceAmount > 0 && !bookForm.advanceScreenshot) {
      alert('Upload a screenshot of the advance payment')
      return
    }
    setBookSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leadId: lead._id,
          itineraryId: bookForm.itineraryId,
          // Trip dates, travelers, and amount all come from the itinerary itself.
          // Leaving these blank falls back to round-robin on the backend.
          opsAssignedTo: bookForm.opsAssignedTo || undefined,
          accountsAssignedTo: bookForm.accountsAssignedTo || undefined,
          advanceAmount,
          advanceZeroReason: advanceAmount === 0 ? bookForm.advanceZeroReason.trim() : undefined,
          advanceScreenshot: advanceAmount > 0 ? bookForm.advanceScreenshot : undefined,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Booking failed')
      }
      onOpenChange(false)
      onBooked?.()
    } catch (error) {
      alert(error.message || 'Booking failed')
    } finally {
      setBookSaving(false)
    }
  }

  if (!open || !lead) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <Card className="max-h-[90vh] w-full overflow-y-auto rounded-b-none p-6 sm:max-w-md sm:rounded-xl">
        <h2 className="mb-1 text-2xl font-bold">Create Booking</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {lead.firstName} {lead.lastName} — this will mark the lead as booked and
          move it to the Bookings queue for Operations.
        </p>
        <form onSubmit={handleBookSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Itinerary *</label>
            {leadItineraries.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                No itineraries created for this lead yet — create one before booking.
              </p>
            ) : (
              <Select
                value={bookForm.itineraryId || 'none'}
                onValueChange={(v) => setBookForm({ ...bookForm, itineraryId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select the itinerary the client booked on</SelectItem>
                  {leadItineraries.map((it) => (
                    <SelectItem key={it._id} value={it._id}>
                      {leadDisplayName(lead)}
                      {it.destination ? ` · ${it.destination}` : ''}
                      {it.totalPrice || it.totalCost ? ` · ₹${it.totalPrice || it.totalCost}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Trip dates, travelers, and amount are all taken from this itinerary.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Advance paid (₹) *</label>
            <Input
              type="number"
              min="0"
              value={bookForm.advanceAmount}
              onChange={(e) => setBookForm({ ...bookForm, advanceAmount: e.target.value })}
              placeholder="e.g. 5000"
              required
            />
          </div>

          {bookForm.advanceAmount !== '' && Number(bookForm.advanceAmount) === 0 ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Why is the advance 0? *</label>
              <Textarea
                value={bookForm.advanceZeroReason}
                onChange={(e) => setBookForm({ ...bookForm, advanceZeroReason: e.target.value })}
                placeholder="e.g. Client will pay full amount on arrival"
                className="min-h-[70px]"
                required
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">Payment screenshot *</label>
              <Input type="file" accept="image/*" onChange={handleScreenshotPick} disabled={compressingScreenshot} />
              {compressingScreenshot && <p className="mt-1 text-xs text-muted-foreground">Compressing…</p>}
              {bookForm.advanceScreenshot && !compressingScreenshot && (
                <div className="mt-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bookForm.advanceScreenshot}
                    alt="Advance payment screenshot"
                    className="h-16 w-16 rounded-md border object-cover"
                  />
                  <span className="text-xs text-muted-foreground">
                    {Math.round(dataUrlSize(bookForm.advanceScreenshot) / 1024)}KB
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Operations</label>
              <Select
                value={bookForm.opsAssignedTo || 'unassigned'}
                onValueChange={(v) => setBookForm({ ...bookForm, opsAssignedTo: v === 'unassigned' ? '' : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Auto-assign (round robin)</SelectItem>
                  {opsMembers.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Accounts</label>
              <Select
                value={bookForm.accountsAssignedTo || 'unassigned'}
                onValueChange={(v) => setBookForm({ ...bookForm, accountsAssignedTo: v === 'unassigned' ? '' : v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Auto-assign (round robin)</SelectItem>
                  {accountsMembers.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave on auto-assign to route via round robin, or pick a specific person yourself.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
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
        </form>
      </Card>
    </div>
  )
}
