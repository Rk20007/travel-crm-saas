'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Phone,
  Mail,
  MapPin,
  Users,
  Calendar,
  FileText,
  Paperclip,
  MessageSquare,
  History,
  Map as MapIcon,
  ExternalLink,
  IndianRupee,
} from 'lucide-react'
import { leadDisplayName, formatInr, displayEmail } from '@/utils/crm'

const token = () => (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
const authH = () => ({ Authorization: `Bearer ${token()}` })

function Section({ icon: Icon, title, count, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">{title}</h4>
        {count != null && <Badge variant="secondary">{count}</Badge>}
      </div>
      <div className="pl-6">{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || '—'}</span>
    </div>
  )
}

export function LeadPreviewDrawer({ leadId, open, onOpenChange }) {
  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [itineraries, setItineraries] = useState([])

  useEffect(() => {
    if (!open || !leadId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [leadRes, tlRes, fuRes, itRes] = await Promise.all([
          fetch(`/api/leads/${leadId}`, { headers: authH() }),
          fetch(`/api/leads/${leadId}/timeline`, { headers: authH() }),
          fetch(`/api/follow-ups?leadId=${leadId}&limit=50`, { headers: authH() }),
          fetch(`/api/itineraries?leadId=${leadId}&limit=50`, { headers: authH() }),
        ])
        if (cancelled) return
        const leadData = await leadRes.json().catch(() => ({}))
        setLead(leadData.lead || null)
        setTimeline((await tlRes.json().catch(() => ({}))).timeline || [])
        setFollowUps((await fuRes.json().catch(() => ({}))).followUps || [])
        setItineraries((await itRes.json().catch(() => ({}))).itineraries || [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, leadId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{lead ? leadDisplayName(lead) : 'Lead preview'}</SheetTitle>
          <SheetDescription>Complete lead profile</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 px-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !lead ? (
          <div className="px-4 py-10 text-center text-muted-foreground">Lead not found</div>
        ) : (
          <div className="space-y-6 px-4 pb-8">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="capitalize">{lead.status}</Badge>
              <Badge variant="secondary" className="capitalize">{lead.source}</Badge>
              {lead.assignedTo?.name && (
                <Badge variant="outline">Owner: {lead.assignedTo.name}</Badge>
              )}
            </div>

            <Section icon={Users} title="Personal & Contact">
              <Row label="Name" value={leadDisplayName(lead)} />
              <Row label="Email" value={displayEmail(lead.email)} />
              <Row label="Phone" value={lead.phone} />
              <Row label="WhatsApp" value={lead.whatsapp} />
              <Row label="City" value={lead.city} />
            </Section>

            <Section icon={MapPin} title="Travel Requirements">
              <Row label="Destination" value={lead.destination} />
              <Row
                label="Preferences"
                value={lead.destinationPreference?.join(', ')}
              />
              <Row label="Travelers" value={lead.numberOfTravelers} />
              <Row
                label="Travel date"
                value={lead.travelDate ? new Date(lead.travelDate).toLocaleDateString() : null}
              />
              <Row
                label="Budget"
                value={
                  lead.budget?.min || lead.budget?.max
                    ? `${formatInr(lead.budget?.min || 0)} – ${formatInr(lead.budget?.max || 0)}`
                    : null
                }
              />
            </Section>

            {lead.status === 'lost' && (lead.lostReason || lead.lostDetails?.remarks) && (
              <Section icon={History} title="Lost details">
                <Row label="Reason" value={lead.lostReason} />
                <Row label="Follow-up type" value={lead.lostDetails?.followUpType} />
                <Row
                  label="Next follow-up"
                  value={
                    lead.lostDetails?.nextFollowUpAt
                      ? new Date(lead.lostDetails.nextFollowUpAt).toLocaleString()
                      : null
                  }
                />
                <Row label="Remarks" value={lead.lostDetails?.remarks} />
              </Section>
            )}

            {lead.notes && (
              <Section icon={MessageSquare} title="Remarks / Notes">
                <p className="text-sm">{lead.notes}</p>
              </Section>
            )}

            <Section icon={MapIcon} title="Itineraries" count={itineraries.length}>
              {itineraries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No itineraries yet</p>
              ) : (
                <div className="space-y-2">
                  {itineraries.map((it) => (
                    <div
                      key={it._id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {it.tripName || it.title}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {it.destination} ·{' '}
                          <IndianRupee className="h-3 w-3" />
                          {formatInr(it.totalPrice || it.totalCost || 0, it.currency)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/itineraries/${it._id}/preview`} target="_blank">
                          <ExternalLink className="mr-1 h-3 w-3" /> View
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={Calendar} title="Follow-up history" count={followUps.length}>
              {followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No follow-ups</p>
              ) : (
                <div className="space-y-2">
                  {followUps.map((fu) => (
                    <div key={fu._id} className="rounded-lg border p-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {String(fu.type).replace('_', ' ')}
                        </span>
                        <Badge variant="outline" className="capitalize">{fu.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(fu.scheduledDate).toLocaleString()}
                      </p>
                      {fu.description && <p className="mt-1 text-xs">{fu.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={History} title="Status history" count={lead.statusHistory?.length || 0}>
              {!lead.statusHistory?.length ? (
                <p className="text-sm text-muted-foreground">No status changes recorded</p>
              ) : (
                <ol className="space-y-2 border-l pl-4">
                  {[...lead.statusHistory].reverse().map((h, i) => (
                    <li key={i} className="relative text-sm">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <span className="capitalize">
                        {h.from || '—'} → <strong>{h.to}</strong>
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {h.changedAt ? new Date(h.changedAt).toLocaleString() : ''}
                        {h.note ? ` · ${h.note}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            <Section
              icon={Paperclip}
              title="Attachments"
              count={lead.attachments?.length || 0}
            >
              {!lead.attachments?.length ? (
                <p className="text-sm text-muted-foreground">No attachments</p>
              ) : (
                <div className="space-y-1">
                  {lead.attachments.map((a, i) => (
                    <a
                      key={i}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {a.name || 'File'}
                    </a>
                  ))}
                </div>
              )}
            </Section>

            <Section icon={History} title="Activity timeline" count={timeline.length}>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {timeline.map((t) => (
                    <div key={t._id} className="rounded-lg border bg-muted/30 p-2.5">
                      <p className="text-sm font-medium">{t.title || t.type}</p>
                      {(t.description || t.body) && (
                        <p className="text-sm text-muted-foreground">
                          {t.description || t.body}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <div className="flex gap-2 pt-2">
              <Button asChild className="flex-1">
                <Link href={`/dashboard/leads/${lead._id}`}>Open full detail</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
