import Supplier from '@/models/Supplier'

/** Finds or creates the Supplier record for a hotel by name — shared by the
 * advance hand-off flow (app/api/bookings/[id]/hotel-advance) and the
 * confirm flow (app/api/bookings/[id]/confirmations), since a Supplier can
 * now be created before a hotel is ever formally confirmed. */
export async function findOrCreateHotelSupplier(teamId, hotelName) {
  const name = String(hotelName || '').trim()
  return Supplier.findOneAndUpdate(
    { teamId, type: 'hotel', name: new RegExp(`^${name}$`, 'i') },
    { $setOnInsert: { name, type: 'hotel', email: '', teamId } },
    { upsert: true, new: true }
  )
}

/** Same idea as findOrCreateHotelSupplier, for the transport vendor behind a
 * confirmed vehicle — keyed by vehicle number when available (one car may
 * serve multiple clients over time) falling back to the driver's name. */
export async function findOrCreateTransportSupplier(teamId, identifier) {
  const name = String(identifier || '').trim()
  return Supplier.findOneAndUpdate(
    { teamId, type: 'transport', name: new RegExp(`^${name}$`, 'i') },
    { $setOnInsert: { name, type: 'transport', email: '', teamId } },
    { upsert: true, new: true }
  )
}

/** Room + extra bed + CNB (each × nights) + any one-off extra charge —
 * the same formula the booking detail page shows as "Total cost". */
export function computeNegotiatedPrice({
  roomPrice,
  extraBedPrice,
  cnbPrice,
  extraCharge,
  roomCount,
  nights,
  extraBeds,
  cnbCount,
}) {
  return (
    (Number(roomPrice) || 0) * (roomCount || 1) * (nights || 1) +
    (Number(extraBedPrice) || 0) * (extraBeds || 0) * (nights || 1) +
    (Number(cnbPrice) || 0) * (cnbCount || 0) * (nights || 1) +
    (Number(extraCharge) || 0)
  )
}
