'use client'

import { format } from 'date-fns'
import { Calendar, Check, MapPin, Phone, Users, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getDefaultBanner, getDurationDays, getStatusColor } from '@/utils/itinerary'
import { cn } from '@/lib/utils'

export default function ItineraryPreview({ itinerary, days = [], publicView = false }) {
  if (!itinerary) return null

  const tripName = itinerary.customerName || itinerary.tripName || itinerary.title
  const banner = itinerary.bannerImage || getDefaultBanner(itinerary.destination)
  const duration = getDurationDays(itinerary.startDate, itinerary.endDate)
  const currency = itinerary.currency || 'USD'
  const travelers =
    itinerary.numberOfTravelers ||
    (itinerary.numberOfAdults || 0) + (itinerary.numberOfChildren || 0) ||
    1

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="relative h-[320px] overflow-hidden md:h-[420px]">
        <img src={banner} alt={tripName} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="mx-auto max-w-6xl">
            {!publicView && (
              <Badge className={cn('mb-3 border capitalize', getStatusColor(itinerary.status))}>
                {itinerary.status}
              </Badge>
            )}
            <h1 className="text-2xl font-bold text-white sm:text-3xl md:text-5xl">{tripName}</h1>
            <p className="mt-2 flex items-center gap-2 text-lg text-white/90">
              <MapPin className="h-5 w-5" />
              {itinerary.destination}
              {itinerary.country ? `, ${itinerary.country}` : ''}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_320px]">
        <main className="space-y-10">
          <section className="grid gap-4 sm:grid-cols-3">
            <OverviewCard icon={Calendar} label="Duration" value={`${duration} days`} />
            <OverviewCard icon={Users} label="Travelers" value={`${travelers} guests`} />
            <OverviewCard
              icon={Calendar}
              label="Dates"
              value={`${formatDate(itinerary.startDate)} – ${formatDate(itinerary.endDate)}`}
            />
          </section>

          {itinerary.customerName && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold">Prepared for</h2>
                <p className="mt-1 text-xl">{itinerary.customerName}</p>
                {itinerary.customerEmail && (
                  <p className="text-muted-foreground">{itinerary.customerEmail}</p>
                )}
                {itinerary.phone && (
                  <p className="mt-1 flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" /> {itinerary.phone}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <section>
            <h2 className="mb-6 text-2xl font-bold">Day-by-day itinerary</h2>
            <div className="relative space-y-0 border-l-2 border-primary/30 pl-8">
              {days.map((day, i) => (
                <div key={day._id || i} className="relative pb-10">
                  <span className="absolute -left-[41px] flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {day.dayNumber}
                  </span>
                  <Card className="overflow-hidden border-border/60 shadow-md">
                    {day.images?.[0] && (
                      <img
                        src={day.images[0]}
                        alt=""
                        className="h-40 w-full object-cover"
                      />
                    )}
                    <CardContent className="p-6">
                      <h3 className="text-xl font-semibold">{day.title}</h3>
                      {day.description && (
                        <p className="mt-2 text-muted-foreground">{day.description}</p>
                      )}
                      {day.hotel?.name && (
                        <div className="mt-4 rounded-lg bg-muted/50 p-4">
                          <p className="text-xs font-medium uppercase text-primary">Stay</p>
                          <p className="font-medium">{day.hotel.name}</p>
                          {day.hotel.location && (
                            <p className="text-sm text-muted-foreground">{day.hotel.location}</p>
                          )}
                        </div>
                      )}
                      {(day.timelineBlocks || []).length > 0 && (
                        <ul className="mt-4 space-y-3">
                          {day.timelineBlocks.map((b, j) => (
                            <li key={j} className="flex gap-3 text-sm">
                              <span className="w-16 shrink-0 font-medium text-primary">
                                {b.time}
                              </span>
                              <div>
                                <p className="font-medium">{b.title}</p>
                                {b.description && (
                                  <p className="text-muted-foreground">{b.description}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      {(day.activities || []).map((act, j) => (
                        <p key={j} className="mt-2 text-sm">
                          <span className="font-medium">{act.time}</span> — {act.name}
                          {act.location && (
                            <span className="text-muted-foreground"> ({act.location})</span>
                          )}
                        </p>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </section>

          {(itinerary.hotels?.length > 0) && (
            <section>
              <h2 className="mb-4 text-2xl font-bold">Hotels</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {itinerary.hotels.map((h, i) => (
                  <Card key={i}>
                    <CardContent className="p-5">
                      <p className="font-semibold">{h.name}</p>
                      {h.location && <p className="text-sm text-muted-foreground">{h.location}</p>}
                      {h.stars && <p className="mt-1 text-sm">{'★'.repeat(h.stars)}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section className="grid gap-6 md:grid-cols-2">
            <ListSection title="Inclusions" items={itinerary.inclusions} positive />
            <ListSection title="Exclusions" items={itinerary.exclusions} />
          </section>

          {itinerary.gallery?.length > 0 && (
            <section>
              <h2 className="mb-4 text-2xl font-bold">Gallery</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {itinerary.gallery.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="aspect-video rounded-xl object-cover"
                  />
                ))}
              </div>
            </section>
          )}

          {itinerary.termsAndConditions && (
            <section className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Terms & conditions</h2>
              <p className="whitespace-pre-wrap">{itinerary.termsAndConditions}</p>
            </section>
          )}
        </main>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="border-primary/20 shadow-xl">
            <CardContent className="space-y-4 p-6">
              <h3 className="text-lg font-semibold">Trip pricing</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per person</span>
                  <span className="font-semibold">
                    {currency}{' '}
                    {Number(
                      itinerary.pricePerPerson ?? itinerary.perPersonCost ?? 0
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold text-primary">
                    {currency}{' '}
                    {Number(itinerary.totalPrice ?? itinerary.totalCost ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
              {itinerary.assignedTo && (
                <div className="border-t pt-4 text-sm">
                  <p className="text-muted-foreground">Your travel consultant</p>
                  <p className="font-medium">
                    {itinerary.assignedTo.name || itinerary.assignedTo.email}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function OverviewCard({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ListSection({ title, items, positive }) {
  if (!items?.length) return null
  const Icon = positive ? Check : X
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="mb-3 font-semibold">{title}</h3>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <Icon
                className={cn('mt-0.5 h-4 w-4 shrink-0', positive ? 'text-success' : 'text-red-500')}
              />
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function formatDate(d) {
  if (!d) return '—'
  return format(new Date(d), 'MMM d, yyyy')
}
