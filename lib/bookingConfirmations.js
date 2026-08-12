/** A booking's hotel/vehicle confirmation checklist is derived from its
 * linked itinerary (the source of what was actually quoted) merged with
 * whatever the booking itself has already recorded as confirmed — so the
 * list always reflects the current itinerary even if it changed after the
 * booking's confirmations were last saved, without losing prior confirms. */

function dedupeByKey(items) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    if (!item.key || seen.has(item.key)) continue
    seen.add(item.key)
    out.push(item)
  }
  return out
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** `itinerary.hotels[]` has real checkIn/checkOut/roomType/cost — the
 * "closed itinerary" data quoted to the client — so it's preferred whenever
 * present. `nightStays[]` only has a dayNumber (no calendar date) and
 * per-room-type pricing split across `roomLines[]`, so when that's the only
 * source we derive dates — preferring the actual day-wise plan's calendar
 * dates (`dayDates`, keyed by dayNumber) when available, since the
 * itinerary's top-level startDate can go stale if the plan is edited
 * afterward; falling back to startDate + dayNumber offset otherwise. */
function hotelFromNightStays(itinerary, dayDates) {
  const groups = new Map()
  for (const stay of itinerary.nightStays || []) {
    if (!stay.hotelName && !stay.hotelId) continue
    const key = stay.hotelId ? String(stay.hotelId) : stay.hotelName
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: stay.hotelName || '',
        location: stay.location || '',
        roomTypes: new Set(),
        minDay: stay.dayNumber,
        maxDay: stay.dayNumber,
        quotedPrice: 0,
        roomCount: 0,
        extraBeds: 0,
        extraBedCharge: 0,
        cnbCount: 0,
        cnbPrice: 0,
        nights: 0,
      })
    }
    const g = groups.get(key)
    if (typeof stay.dayNumber === 'number') {
      g.minDay = g.minDay == null ? stay.dayNumber : Math.min(g.minDay, stay.dayNumber)
      g.maxDay = g.maxDay == null ? stay.dayNumber : Math.max(g.maxDay, stay.dayNumber)
    }
    g.extraBeds += stay.extraBeds || 0
    g.extraBedCharge += stay.extraBedCharge || 0
    g.cnbCount += stay.cnbCount || 0
    g.cnbPrice += stay.cnbPrice || 0
    for (const line of stay.roomLines || []) {
      if (line.roomType) g.roomTypes.add(line.roomType)
      g.quotedPrice += (line.pricePerNight || 0) * (line.nights || 1) * (line.roomCount || 1)
      g.roomCount += line.roomCount || 0
      g.nights = Math.max(g.nights, Number(line.nights) || 0)
    }
  }

  const start = itinerary.startDate ? new Date(itinerary.startDate) : null
  const dateForDay = (dayNumber) => {
    const d = dayDates?.get ? dayDates.get(dayNumber) : dayDates?.[dayNumber]
    return d ? new Date(d) : null
  }
  return Array.from(groups.values()).map((g) => {
    const checkIn =
      (g.minDay != null && dateForDay(g.minDay)) ||
      (start && g.minDay != null ? addDays(start, g.minDay - 1) : null)
    const checkOut =
      (g.maxDay != null && dateForDay(g.maxDay + 1)) ||
      (g.maxDay != null && dateForDay(g.maxDay) ? addDays(dateForDay(g.maxDay), 1) : null) ||
      (start && g.maxDay != null ? addDays(start, g.maxDay) : null)
    return {
      key: g.key,
      name: g.name,
      location: g.location,
      roomType: Array.from(g.roomTypes).join(', '),
      checkIn,
      checkOut,
      quotedPrice: g.quotedPrice || null,
      roomCount: g.roomCount || null,
      extraBeds: g.extraBeds || 0,
      quotedExtraBedPrice: g.extraBedCharge || null,
      cnbCount: g.cnbCount || 0,
      quotedCnbPrice: g.cnbPrice || null,
      nights: g.nights || null,
      // Per-room-per-night rate — what "Room price" prefills with, since
      // negotiatedPrice = roomPrice × roomCount × nights (matches how a hotel
      // actually quotes a B2B rate on the call).
      quotedRoomPricePerNight:
        g.quotedPrice && g.roomCount && g.nights ? g.quotedPrice / (g.roomCount * g.nights) : null,
    }
  })
}

export function hotelSourceList(itinerary, dayDates) {
  if (!itinerary) return []
  const fromStays = hotelFromNightStays(itinerary, dayDates)
  if (fromStays.length) return dedupeByKey(fromStays)
  return dedupeByKey(
    (itinerary.hotels || []).map((h) => ({
      key: h.id || h.name,
      name: h.name || '',
      location: h.location || '',
      roomType: h.roomType || '',
      checkIn: h.checkIn || null,
      checkOut: h.checkOut || null,
      quotedPrice: h.cost ?? null,
      roomCount: null,
      extraBeds: 0,
      quotedExtraBedPrice: null,
      cnbCount: 0,
      quotedCnbPrice: null,
      nights:
        h.checkIn && h.checkOut
          ? Math.max(0, Math.round((new Date(h.checkOut) - new Date(h.checkIn)) / 86400000))
          : null,
      quotedRoomPricePerNight: h.cost ?? null,
    }))
  )
}

export function vehicleSourceList(itinerary) {
  if (!itinerary) return []
  const fromList = (itinerary.vehicles || []).map((v, i) => ({
    key: `${v.name || 'vehicle'}-${v.fromLocation || ''}-${v.toLocation || ''}-${i}`,
    name: v.name || '',
    route: [v.fromLocation, v.toLocation].filter(Boolean).join(' to '),
    // What the itinerary quoted for this vehicle — prefills the "Agreed
    // price" field so Operations only has to change it if the vendor's
    // actual rate differs from what was closed with the client.
    quotedPrice: v.cost ?? null,
  }))
  if (fromList.length) return fromList
  if (itinerary.vehicle) {
    return [{ key: itinerary.vehicle, name: itinerary.vehicle, route: '', quotedPrice: itinerary.vehicleCost ?? null }]
  }
  return []
}

export function activitySourceList(itinerary) {
  if (!itinerary) return []
  return dedupeByKey(
    (itinerary.activities || []).map((a, i) => ({
      key: a.activityId ? String(a.activityId) : `${a.name || 'activity'}-${i}`,
      name: a.name || '',
      quantity: a.quantity || 1,
      quotedPrice: a.cost ?? (a.price != null ? a.price * (a.quantity || 1) : null),
      quotedUnitPrice: a.price ?? null,
    }))
  )
}

/** Merges a source list (from the itinerary) with previously-saved
 * confirmations on the booking, keyed by `key`. Anything not yet saved
 * defaults to unconfirmed. */
export function mergeConfirmations(source, saved) {
  const savedByKey = Object.fromEntries((saved || []).map((c) => [c.key, c]))
  return source.map((item) => {
    const existing = savedByKey[item.key]
    return {
      ...item,
      // Room type/quoted price/room count stay fresh from the itinerary, but
      // fall back to what was last saved in case the itinerary has since changed.
      roomType: item.roomType || existing?.roomType || '',
      quotedPrice: item.quotedPrice ?? existing?.quotedPrice ?? null,
      quotedRoomPricePerNight: item.quotedRoomPricePerNight ?? existing?.quotedRoomPricePerNight ?? null,
      roomCount: item.roomCount ?? existing?.roomCount ?? null,
      nights: item.nights ?? existing?.nights ?? null,
      extraBeds: item.extraBeds ?? existing?.extraBeds ?? 0,
      quotedExtraBedPrice: item.quotedExtraBedPrice ?? existing?.quotedExtraBedPrice ?? null,
      cnbCount: item.cnbCount ?? existing?.cnbCount ?? 0,
      quotedCnbPrice: item.quotedCnbPrice ?? existing?.quotedCnbPrice ?? null,
      // Operations picks the actual check-in/check-out from a dropdown
      // (constrained to the itinerary's trip dates) — once they've saved a
      // choice it wins over the itinerary-derived default.
      checkIn: existing?.checkIn || item.checkIn || null,
      checkOut: existing?.checkOut || item.checkOut || null,
      // Only ever set by Operations on confirm — never derived from the itinerary.
      mealPlan: existing?.mealPlan || '',
      roomPrice: existing?.roomPrice ?? null,
      extraBedPrice: existing?.extraBedPrice ?? null,
      cnbPrice: existing?.cnbPrice ?? null,
      extraCharge: existing?.extraCharge ?? null,
      extraChargeRemark: existing?.extraChargeRemark || '',
      negotiatedPrice: existing?.negotiatedPrice ?? null,
      advanceRequired: existing?.advanceRequired ?? false,
      advanceAmount: existing?.advanceAmount ?? null,
      advanceSentAt: existing?.advanceSentAt || null,
      advancePaid: Boolean(existing?.advancePaid),
      advancePaidAt: existing?.advancePaidAt || null,
      advancePaidScreenshot: existing?.advancePaidScreenshot || null,
      supplierId: existing?.supplierId || null,
      // Vehicle-only fields — collected once Operations calls the transport supplier.
      driverName: existing?.driverName || '',
      driverPhone: existing?.driverPhone || '',
      vehicleNumber: existing?.vehicleNumber || '',
      licenseNumber: existing?.licenseNumber || '',
      // Activity/vehicle price — defaults from whatever the itinerary quoted
      // (per-guest rate for activities, the vehicle's agreed cost for
      // transport) but Operations can edit it once actually booking it.
      quantity: existing?.quantity ?? item.quantity ?? 1,
      price: existing?.price ?? item.quotedUnitPrice ?? item.quotedPrice ?? null,
      quotedUnitPrice: item.quotedUnitPrice ?? existing?.quotedUnitPrice ?? null,
      // Activity-only payment hand-off — same pattern as a hotel advance.
      paymentSentAt: existing?.paymentSentAt || null,
      paymentPaid: Boolean(existing?.paymentPaid),
      paymentPaidAt: existing?.paymentPaidAt || null,
      paymentPaidScreenshot: existing?.paymentPaidScreenshot || null,
      confirmed: Boolean(existing?.confirmed),
      confirmedAt: existing?.confirmedAt || null,
      confirmedBy: existing?.confirmedBy || null,
    }
  })
}

/** 'confirmed' only when there's at least one item and every item is
 * confirmed; 'confirmed' (vacuously) when there's nothing to confirm at all
 * so a hotel-less/vehicle-less booking never shows a false "pending". */
export function deriveStatus(list) {
  if (!list.length) return 'confirmed'
  return list.every((c) => c.confirmed) ? 'confirmed' : 'pending'
}

export function computeHotelConfirmations(booking, itinerary, dayDates) {
  return mergeConfirmations(hotelSourceList(itinerary, dayDates), booking?.hotelConfirmations)
}

export function computeVehicleConfirmations(booking, itinerary) {
  return mergeConfirmations(vehicleSourceList(itinerary), booking?.vehicleConfirmations)
}

export function computeActivityConfirmations(booking, itinerary) {
  return mergeConfirmations(activitySourceList(itinerary), booking?.activityConfirmations)
}
