import connectDB from '@/lib/mongodb'
import Voucher from '@/models/Voucher'
import Booking from '@/models/Booking'
// Required even though never called directly — .populate('itineraryId', ...)
// needs the Itinerary schema registered with mongoose before it runs.
import '@/models/Itinerary'
import '@/models/Lead'
import { authenticate, requireRoles } from '@/lib/middleware'
import { computeHotelConfirmations, computeVehicleConfirmations, deriveStatus } from '@/lib/bookingConfirmations'

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['operations', 'admin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const { searchParams } = new URL(request.url)
    const bookingId = searchParams.get('bookingId')

    const query = { teamId: authResult.user.teamId }
    if (bookingId) query.bookingId = bookingId

    const vouchers = await Voucher.find(query)
      .populate({
        path: 'bookingId',
        select: 'bookingNumber startDate endDate leadId',
        populate: { path: 'leadId', select: 'firstName lastName' },
      })
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 })
      .lean()

    return Response.json({ vouchers })
  } catch (error) {
    console.error('Get vouchers error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['operations', 'admin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const body = await request.json()
    const { bookingId, type, details, supplierId } = body

    if (!bookingId || !type) {
      return Response.json({ error: 'bookingId and type required' }, { status: 400 })
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      teamId: authResult.user.teamId,
    }).populate('itineraryId', 'nightStays hotels vehicles vehicle')
    if (!booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    // A hotel/cab voucher must never go out claiming rooms/seats are booked
    // when Operations hasn't actually confirmed them with the supplier yet —
    // that's exactly what caused clients to arrive and find nothing booked.
    if (type === 'hotel') {
      const status = deriveStatus(computeHotelConfirmations(booking, booking.itineraryId))
      if (status !== 'confirmed') {
        return Response.json(
          { error: 'Confirm all hotels for this booking before generating the hotel voucher.' },
          { status: 400 }
        )
      }
    }
    if (type === 'cab') {
      const status = deriveStatus(computeVehicleConfirmations(booking, booking.itineraryId))
      if (status !== 'confirmed') {
        return Response.json(
          { error: 'Confirm all transport/vehicles for this booking before generating the transport voucher.' },
          { status: 400 }
        )
      }
    }

    // A booking only ever gets one hotel voucher and one cab voucher —
    // generating again (e.g. after Operations edits a date) updates that
    // same document instead of leaving old duplicate vouchers lying around.
    const voucher = await Voucher.findOneAndUpdate(
      { teamId: authResult.user.teamId, bookingId, type },
      {
        teamId: authResult.user.teamId,
        bookingId,
        type,
        details: details || {},
        supplierId,
        status: 'generated',
        issuedBy: authResult.user.userId,
        issuedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    const opsStatusMap = {
      hotel: 'hotel_pending',
      cab: 'cab_pending',
    }
    if (opsStatusMap[type]) {
      booking.opsStatus = opsStatusMap[type]
      await booking.save()
    }

    return Response.json({ message: 'Voucher created', voucher }, { status: 201 })
  } catch (error) {
    console.error('Create voucher error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
