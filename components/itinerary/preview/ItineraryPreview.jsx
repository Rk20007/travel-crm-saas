'use client'

import { Playfair_Display, Inter } from 'next/font/google'
import { format } from 'date-fns'
import {
  Badge as BadgeIcon,
  Calendar,
  Car,
  Check,
  Coffee,
  Droplets,
  Flame,
  Globe,
  Mail,
  MapPin,
  Phone,
  ParkingCircle,
  Sparkles,
  Users,
  Utensils,
  Waves,
  Wifi,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getDefaultBanner, getDurationDays, getStatusColor } from '@/utils/itinerary'
import { cn } from '@/lib/utils'

// Day descriptions let the agent bold a phrase or two (**like this**) from
// the Itinerary Builder's editor toolbar — render those markers as real
// <strong> instead of showing the raw asterisks.
function BoldText({ text }) {
  const pieces = String(text || '').split(/\*\*(.+?)\*\*/g)
  return pieces.map((piece, i) => (i % 2 === 1 ? <strong key={i}>{piece}</strong> : piece))
}

// ---------------------------------------------------------------------------
// A dedicated, self-contained Ocean Blue luxury identity for this page —
// intentionally independent of the app's own theme tokens, exactly matching
// the requested palette everywhere below.
// ---------------------------------------------------------------------------
const OCEAN = {
  blue: '#087EA4',
  deep: '#063B4C',
  navy: '#062F3D',
  light: '#EAF8FC',
  cyan: '#42C4E8',
  white: '#FFFFFF',
  text: '#173944',
  textSecondary: '#60777F',
  border: '#D7EAF0',
}

const heading = Playfair_Display({ subsets: ['latin'], weight: ['500', '600', '700'] })
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

function formatDate(d) {
  if (!d) return '—'
  return format(new Date(d), 'MMM d, yyyy')
}

// Every hotel's total nights, summed from its matching night-stay room lines
// — mirrors the same computation used in the PDF export, so the numbers
// shown here always agree with what's printed.
function hotelNightsMap(itinerary) {
  const map = {}
  ;(itinerary.nightStays || []).forEach((stay) => {
    const key = stay.hotelName || stay.location || ''
    if (!key) return
    const lines = stay.roomLines?.length ? stay.roomLines : []
    const nights = Math.max(0, ...lines.map((l) => Number(l.nights) || 0), 0)
    map[key] = (map[key] || 0) + nights
  })
  return map
}

function roomLinesFromNightStays(itinerary) {
  return (itinerary.nightStays || []).flatMap((stay) =>
    (stay.roomLines || [])
      .filter((l) => l.roomType)
      .map((l) => ({
        hotelName: stay.hotelName || stay.location || '',
        roomType: l.roomType,
        roomCount: Number(l.roomCount) || 1,
        nights: Number(l.nights) || 0,
      }))
  )
}

const AMENITY_ICONS = [
  [/wi[- ]?fi/i, Wifi],
  [/heater|warm|bonfire/i, Flame],
  [/restaurant|dining|breakfast|dinner/i, Utensils],
  [/parking/i, ParkingCircle],
  [/lake|view|scenic/i, Waves],
  [/water|mineral/i, Droplets],
  [/coffee|tea/i, Coffee],
  [/room service|service/i, BadgeIcon],
  [/car|transport|shuttle/i, Car],
]
function amenityIcon(label) {
  const hit = AMENITY_ICONS.find(([re]) => re.test(label))
  return hit ? hit[1] : Sparkles
}

// A short, uppercase, tracked overline used above every section heading —
// the same small visual signature repeated through the whole page.
function Eyebrow({ children }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="h-[2px] w-7 shrink-0" style={{ background: OCEAN.blue }} />
      <span className="text-[14px] font-bold uppercase tracking-[0.14em]" style={{ color: OCEAN.blue }}>
        {children}
      </span>
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <h2
      className={cn(heading.className, 'text-[30px] leading-tight sm:text-[34px] md:text-[38px]')}
      style={{ color: OCEAN.navy }}
    >
      {children}
    </h2>
  )
}

export default function ItineraryPreview({ itinerary, days = [], brand = null, publicView = false }) {
  if (!itinerary) return null

  const tripName = itinerary.customerName || itinerary.tripName || itinerary.title
  const duration = getDurationDays(itinerary.startDate, itinerary.endDate)
  const durationLabel = itinerary.duration || `${Math.max(0, duration - 1)}N/${duration}D`
  const currency = itinerary.currency || 'USD'
  const travelers =
    itinerary.numberOfTravelers ||
    (itinerary.numberOfAdults || 0) + (itinerary.numberOfChildren || 0) ||
    1

  // Exactly four images, used only here in the hero — real gallery/banner
  // photos first, cycling through them (never inventing new photo URLs) if
  // fewer than four exist, and falling back to the app's own established
  // "no photo" placeholder only when the itinerary has none at all.
  const pool = [...new Set([itinerary.bannerImage, ...(itinerary.gallery || [])].filter(Boolean))]
  const fallback = getDefaultBanner(itinerary.destination)
  const heroImages = Array.from({ length: 4 }, (_, i) => pool[i % (pool.length || 1)] || fallback)

  const nightsByHotel = hotelNightsMap(itinerary)
  const priceRows = roomLinesFromNightStays(itinerary)
  const total = Number(itinerary.totalPrice ?? itinerary.totalCost ?? 0)
  const perPerson = Number(itinerary.pricePerPerson ?? itinerary.perPersonCost ?? 0)

  return (
    <div className={cn(body.className, 'min-h-screen')} style={{ background: OCEAN.light, color: OCEAN.text }}>
      {!publicView && (
        <div className="border-b px-5 py-3" style={{ borderColor: OCEAN.border }}>
          <Badge className={cn('border capitalize', getStatusColor(itinerary.status))}>{itinerary.status}</Badge>
        </div>
      )}

      {/* ============================== HERO ============================== */}
      <header
        className="relative overflow-hidden px-4 pb-6 pt-10 sm:px-8 sm:pt-14 lg:px-12"
        style={{ background: '#BEE6F2' }}
      >
        {/* Mobile/tablet: one large image on top, the three smaller ones in a
            row underneath. Desktop (md+): a true editorial collage — the
            large image left, the three smaller ones stacked in a column
            right, both filling the same fixed-height band. */}
        <div className="mx-auto flex max-w-6xl flex-col gap-2.5 sm:gap-4 md:h-[520px] md:flex-row">
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl shadow-[0_18px_40px_-20px_rgba(6,47,61,0.45)] sm:aspect-video md:aspect-auto md:h-full md:w-[64%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImages[0]} alt={tripName || itinerary.destination} className="h-full w-full object-cover" />
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 md:flex md:h-full md:w-[36%] md:flex-col">
            {heroImages.slice(1).map((src, i) => (
              <div
                key={i}
                className="relative aspect-square overflow-hidden rounded-xl shadow-[0_10px_24px_-14px_rgba(6,47,61,0.4)] md:aspect-auto md:flex-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-6xl pb-8 sm:mt-8 sm:pb-12">
          <p className={cn(heading.className, 'text-[21px] italic sm:text-[24px]')} style={{ color: OCEAN.blue }}>
            Explore
          </p>
          <h1
            className={cn(heading.className, 'text-[46px] leading-[1.02] tracking-tight sm:text-[60px] md:text-[74px]')}
            style={{ color: OCEAN.navy }}
          >
            {(itinerary.destination || tripName || 'Kashmir').toUpperCase()}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-6">
            <span
              className="rounded-full border-2 px-5 py-2.5 text-[16px] font-bold sm:text-[18px]"
              style={{ borderColor: OCEAN.cyan, color: OCEAN.deep }}
            >
              {durationLabel}
            </span>
            <span className="flex items-center gap-1.5 text-[16px] font-medium" style={{ color: OCEAN.textSecondary }}>
              <MapPin className="h-4 w-4" style={{ color: OCEAN.blue }} />
              {itinerary.destination}
              {itinerary.country ? `, ${itinerary.country}` : ''}
            </span>
          </div>

          {tripName && (
            <div
              className="mt-6 inline-flex items-center gap-3 rounded-full border py-2 pl-2 pr-5 sm:mt-8"
              style={{ background: OCEAN.white, borderColor: OCEAN.border }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                style={{ background: OCEAN.blue }}
              >
                {tripName.trim().charAt(0).toUpperCase()}
              </span>
              <div className="leading-tight">
                <p className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: OCEAN.textSecondary }}>
                  Guest
                </p>
                <p className="text-[17px] font-bold sm:text-[19px]" style={{ color: OCEAN.navy }}>
                  {tripName.toUpperCase()}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12">
        {/* ========================= PACKAGE OVERVIEW ========================= */}
        <section className="py-10 sm:py-16">
          <Eyebrow>Package Overview</Eyebrow>
          <SectionHeading>A Journey Crafted for You</SectionHeading>
          <p
            className={cn(heading.className, 'mt-5 max-w-3xl text-[20px] italic leading-[1.7] sm:text-[24px]')}
            style={{ color: OCEAN.text }}
          >
            {itinerary.marketingOverview || 'Crafted for guests seeking premium comfort and exclusive services.'}
          </p>

          <div
            className="mt-8 grid grid-cols-1 gap-4 rounded-2xl border p-6 sm:grid-cols-3 sm:p-8"
            style={{ background: OCEAN.white, borderColor: OCEAN.border }}
          >
            <Stat icon={Calendar} label="Duration" value={durationLabel} />
            <Stat icon={Users} label="Travelers" value={`${travelers} guests`} />
            <Stat
              icon={Calendar}
              label="Travel Dates"
              value={`${formatDate(itinerary.startDate)} – ${formatDate(itinerary.endDate)}`}
            />
          </div>

          {(itinerary.customerEmail || itinerary.phone) && (
            <p className="mt-4 flex flex-wrap items-center gap-4 text-[16px]" style={{ color: OCEAN.textSecondary }}>
              {itinerary.customerEmail && <span>{itinerary.customerEmail}</span>}
              {itinerary.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" /> {itinerary.phone}
                </span>
              )}
            </p>
          )}
        </section>

        {/* ========================== DAY-WISE PLAN ========================== */}
        {days.length > 0 && (
          <section className="py-10 sm:py-16">
            <Eyebrow>Itinerary</Eyebrow>
            <SectionHeading>Day-Wise Plan</SectionHeading>

            <div className="relative mt-10 border-l-2 pl-8 sm:pl-10" style={{ borderColor: OCEAN.border }}>
              {days.map((day, i) => {
                const meta = [
                  day.distance ? `${day.distance} KM` : null,
                  day.travelDuration ? `${day.travelDuration} HRS` : null,
                ].filter(Boolean)
                const photo = day.images?.[0]
                return (
                  <div key={day._id || i} className="relative pb-12 last:pb-0">
                    <span
                      className="absolute -left-[43px] top-0 flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold text-white sm:-left-[51px] sm:h-11 sm:w-11 sm:text-sm"
                      style={{ background: OCEAN.blue }}
                    >
                      {String(day.dayNumber).padStart(2, '0')}
                    </span>
                    <div className={cn('gap-6', photo && 'sm:grid sm:grid-cols-[1fr_220px] sm:items-start')}>
                      <div>
                        <p className="text-[14px] font-bold uppercase tracking-[0.12em]" style={{ color: OCEAN.textSecondary }}>
                          Day {day.dayNumber}
                          {day.date ? ` · ${formatDate(day.date)}` : ''}
                        </p>
                        <h3 className={cn(heading.className, 'mt-1 text-[24px] sm:text-[28px]')} style={{ color: OCEAN.navy }}>
                          {day.title}
                        </h3>
                        {meta.length > 0 && (
                          <p className="mt-2 text-[15px] font-bold" style={{ color: OCEAN.blue }}>
                            {meta.join('     •     ')}
                          </p>
                        )}
                        {day.description && (
                          <p className="mt-3 max-w-2xl text-[17px] leading-[1.7]" style={{ color: OCEAN.text }}>
                            <BoldText text={day.description} />
                          </p>
                        )}
                      </div>
                      {photo && (
                        <div className="relative mt-5 aspect-4/3 w-full overflow-hidden rounded-xl shadow-[0_10px_24px_-14px_rgba(6,47,61,0.4)] sm:mt-0 sm:aspect-square">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* =========================== HOTEL DETAILS ========================== */}
        {itinerary.hotels?.length > 0 && (
          <section className="py-10 sm:py-16">
            <Eyebrow>Accommodation</Eyebrow>
            <SectionHeading>Hotel Details</SectionHeading>

            <div className="mt-8 sm:mt-10">
              {itinerary.hotels.map((h, i) => {
                const nights = nightsByHotel[h.name] || nightsByHotel[h.location] || 0
                const amenities = h.amenities?.length ? h.amenities : []
                const photo = h.images?.[0]
                // Alternating white / light-ocean rows give the section a
                // gentle visual rhythm instead of every block looking identical.
                const tinted = i % 2 === 1
                return (
                  <div key={i}>
                    {i > 0 && <div className="h-px w-full" style={{ background: OCEAN.border }} />}
                    <div
                      className="rounded-2xl border p-6 sm:p-8"
                      style={{ background: tinted ? '#DCF0F7' : OCEAN.white, borderColor: OCEAN.border }}
                    >
                      <div className={cn('gap-6', photo && 'sm:grid sm:grid-cols-[1fr_220px] sm:items-start')}>
                        <div>
                          <p className="text-[14px] font-bold uppercase tracking-[0.14em]" style={{ color: OCEAN.blue }}>
                            {h.location || `Stop ${i + 1}`}
                          </p>
                          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className={cn(heading.className, 'text-[26px] sm:text-[30px]')} style={{ color: OCEAN.navy }}>
                              {h.name}
                            </h3>
                            {nights > 0 && (
                              <span className="text-[15px] font-bold" style={{ color: OCEAN.deep }}>
                                {nights} NIGHT{nights > 1 ? 'S' : ''}
                              </span>
                            )}
                          </div>
                          {h.stars > 0 && (
                            <p className="mt-1 text-[16px]" style={{ color: OCEAN.cyan }}>
                              {'★'.repeat(h.stars)}
                            </p>
                          )}
                          {amenities.length > 0 && (
                            <div
                              className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-5"
                              style={{ borderColor: OCEAN.border }}
                            >
                              {amenities.map((a, j) => {
                                const Icon = amenityIcon(a)
                                return (
                                  <div key={j} className="flex items-center gap-2.5 text-[16px]" style={{ color: OCEAN.text }}>
                                    <Icon className="h-4 w-4 shrink-0" style={{ color: OCEAN.blue }} />
                                    {a}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        {photo && (
                          <div className="relative mt-5 aspect-4/3 w-full overflow-hidden rounded-xl shadow-[0_10px_24px_-14px_rgba(6,47,61,0.4)] sm:mt-0 sm:aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo} alt={h.name || ''} className="h-full w-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ========================== PRICING & STAY ========================= */}
        <section className="py-10 sm:py-16">
          <Eyebrow>Investment</Eyebrow>
          <SectionHeading>Pricing &amp; Stay</SectionHeading>

          {priceRows.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-2xl border sm:mt-10" style={{ borderColor: OCEAN.border, background: OCEAN.white }}>
              <div
                className="hidden grid-cols-4 gap-4 border-b px-6 py-3.5 text-[13px] font-bold uppercase tracking-[0.1em] sm:grid"
                style={{ borderColor: OCEAN.border, color: OCEAN.textSecondary }}
              >
                <span>Hotel</span>
                <span>Room Type</span>
                <span>Rooms</span>
                <span className="text-right">Nights</span>
              </div>
              {priceRows.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 gap-x-4 gap-y-1 border-t px-6 py-4 text-[16px] first:border-t-0 sm:grid-cols-4 sm:items-center"
                  style={{ borderColor: OCEAN.border }}
                >
                  <span className="col-span-2 font-bold sm:col-span-1" style={{ color: OCEAN.navy }}>
                    {r.hotelName}
                  </span>
                  <span style={{ color: OCEAN.text }}>{r.roomType}</span>
                  <span style={{ color: OCEAN.text }}>
                    {r.roomCount} room{r.roomCount > 1 ? 's' : ''}
                  </span>
                  <span className="sm:text-right" style={{ color: OCEAN.text }}>
                    {r.nights}N
                  </span>
                </div>
              ))}
            </div>
          )}

          {perPerson > 0 && (
            <p className="mt-6 text-[16px] sm:mt-8" style={{ color: OCEAN.textSecondary }}>
              Per person from{' '}
              <span className="font-bold" style={{ color: OCEAN.navy }}>
                {currency} {perPerson.toLocaleString()}
              </span>
            </p>
          )}

          <div className="relative mt-4 overflow-hidden rounded-2xl p-6 sm:p-8" style={{ background: OCEAN.navy }}>
            <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: OCEAN.cyan }} />
            <p className="pl-3 text-[14px] font-bold uppercase tracking-[0.16em]" style={{ color: OCEAN.cyan }}>
              Total Package Cost
            </p>
            <p className={cn(heading.className, 'mt-2 pl-3 text-[38px] sm:text-[48px]')} style={{ color: OCEAN.white }}>
              {total > 0 ? `${currency} ${total.toLocaleString()}` : 'Price on Request'}
            </p>
          </div>

          {itinerary.assignedTo && (
            <p className="mt-6 text-[16px]" style={{ color: OCEAN.textSecondary }}>
              Your travel consultant —{' '}
              <span className="font-bold" style={{ color: OCEAN.navy }}>
                {itinerary.assignedTo.name || itinerary.assignedTo.email}
              </span>
            </p>
          )}
        </section>

        {/* ============================ INCLUSIONS =========================== */}
        {itinerary.inclusions?.length > 0 && (
          <ListSection eyebrow="What's Included" title="Inclusions" items={itinerary.inclusions} variant="include" />
        )}

        {/* ============================= EXCLUDES ============================ */}
        {itinerary.exclusions?.length > 0 && (
          <ListSection eyebrow="Please Note" title="Excludes" items={itinerary.exclusions} variant="exclude" />
        )}

        {/* ========================= SUPPLEMENT COST ========================= */}
        {itinerary.supplements?.length > 0 && (
          <ListSection eyebrow="Optional Add-ons" title="Supplement Cost" items={itinerary.supplements} variant="supplement" />
        )}

        {/* ======================= TERMS & CONDITIONS ======================== */}
        {itinerary.termsAndConditions && (
          <section className="py-10 sm:py-16">
            <Eyebrow>Please Read</Eyebrow>
            <SectionHeading>Terms &amp; Conditions</SectionHeading>
            <ol className="mt-8 space-y-5 sm:mt-10">
              {itinerary.termsAndConditions
                .split('\n')
                .filter(Boolean)
                .map((t, i) => (
                  <li key={i} className="flex gap-4 border-t pt-5 first:border-0 first:pt-0" style={{ borderColor: OCEAN.border }}>
                    <span className={cn(heading.className, 'shrink-0 text-[22px]')} style={{ color: OCEAN.blue }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[17px] leading-[1.7]" style={{ color: OCEAN.text }}>
                      {t}
                    </span>
                  </li>
                ))}
            </ol>
          </section>
        )}

        {/* ======================== CANCELLATION POLICY ====================== */}
        {itinerary.cancellationPolicy?.length > 0 && (
          <section className="py-10 sm:py-16">
            <Eyebrow>Good to Know</Eyebrow>
            <SectionHeading>Cancellation Policy</SectionHeading>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 md:grid-cols-3">
              {itinerary.cancellationPolicy.map((rule, i) => {
                const isNoRefund = /no\s*refund/i.test(rule)
                return (
                  <div
                    key={i}
                    className="rounded-2xl border p-6 text-center sm:text-left"
                    style={{
                      borderColor: isNoRefund ? OCEAN.blue : OCEAN.border,
                      background: isNoRefund ? '#DCF0F7' : OCEAN.white,
                    }}
                  >
                    <span
                      className="mx-auto flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold text-white sm:mx-0"
                      style={{ background: isNoRefund ? OCEAN.deep : OCEAN.blue }}
                    >
                      {i + 1}
                    </span>
                    <p
                      className={cn(heading.className, 'mt-4 text-[19px] leading-[1.5] sm:text-[21px]')}
                      style={{ color: isNoRefund ? OCEAN.deep : OCEAN.navy }}
                    >
                      {rule}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-8 px-5 py-12 text-center sm:px-8" style={{ background: OCEAN.deep, color: OCEAN.white }}>
        <p className={cn(heading.className, 'text-[22px]')}>
          {itinerary.destination ? `Kashmir Awaits — ${itinerary.destination}` : 'Your Journey Awaits'}
        </p>
        <p className="mt-2 text-[15px]" style={{ color: '#9FC7D2' }}>
          A premium travel experience, thoughtfully prepared for you.
        </p>

        {brand?.name && (
          <div className="mx-auto mt-8 max-w-md border-t pt-8" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
            {brand.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo} alt={brand.name} className="mx-auto mb-3 h-12 w-auto object-contain" />
            )}
            <p className={cn(heading.className, 'text-[19px]')}>{brand.name}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[14px]" style={{ color: '#BFE3EE' }}>
              {brand.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {brand.phone}
                </span>
              )}
              {brand.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {brand.email}
                </span>
              )}
              {brand.website && (
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> {brand.website}
                </span>
              )}
            </div>
            {(brand.address || brand.address2) && (
              <p className="mt-2 text-[13px]" style={{ color: '#9FC7D2' }}>
                {[brand.address, brand.address2].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}
      </footer>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: OCEAN.light }}>
        <Icon className="h-5 w-5" style={{ color: OCEAN.blue }} />
      </div>
      <div>
        <p className="text-[14px] font-medium" style={{ color: OCEAN.textSecondary }}>
          {label}
        </p>
        <p className="text-[17px] font-bold" style={{ color: OCEAN.navy }}>
          {value}
        </p>
      </div>
    </div>
  )
}

function ListSection({ eyebrow, title, items, variant }) {
  const isExclude = variant === 'exclude'
  const isSupplement = variant === 'supplement'
  const body = (
    <>
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionHeading>{title}</SectionHeading>
      <ul className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{
                background: isExclude ? '#E7EEF0' : isSupplement ? OCEAN.light : '#E3F5EC',
                color: isExclude ? OCEAN.textSecondary : isSupplement ? OCEAN.blue : '#15803D',
              }}
            >
              {isExclude ? <X className="h-4 w-4" /> : isSupplement ? <Sparkles className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </span>
            <span className="text-[17px] leading-[1.6]" style={{ color: OCEAN.text }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
  // Excludes gets its own subtle contrasting treatment — a contained white
  // panel (the ambient page background is already ocean-tinted) rather than
  // Inclusions' plain flow.
  if (isExclude) {
    return (
      <section className="py-6 sm:py-10">
        <div className="rounded-2xl border p-6 sm:p-10" style={{ background: OCEAN.white, borderColor: OCEAN.border }}>
          {body}
        </div>
      </section>
    )
  }
  return <section className="py-10 sm:py-16">{body}</section>
}
