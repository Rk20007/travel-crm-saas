import connectDB from '@/lib/mongodb'
import Booking from '@/models/Booking'
import { authenticate, requireRoles } from '@/lib/middleware'
import { computeActivityConfirmations, deriveStatus } from '@/lib/bookingConfirmations'

function scopeFilter(id, user) {
  const query = { _id: id, teamId: user.teamId }
  if (user.role === 'operations') query.opsAssignedTo = user.userId
  if (user.role === 'accounts') query.accountsAssignedTo = user.userId
  return query
}

/** Same hand-off pattern as a hotel advance — Operations sends the payment
 * request once price/quantity are set (before the activity is confirmed),
 * Accounts pays and uploads proof, and only then can Operations confirm it. */
export async function POST(request, { params }) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const forbidden = requireRoles(authResult.user.role, ['operations', 'admin'])
    if (forbidden) {
      return Response.json({ error: 'Only Operations can send a payment request' }, { status: forbidden.status })
    }

    await connectDB()
    const { id } = await params
    const body = await request.json()
    const { key, price, quantity } = body

    if (!key) return Response.json({ error: 'key is required' }, { status: 400 })
    if (!(Number(price) >= 0)) {
      return Response.json({ error: 'Enter the price agreed for this activity' }, { status: 400 })
    }
    if (!(Number(quantity) > 0)) {
      return Response.json({ error: 'Enter how many guests this activity is for' }, { status: 400 })
    }

    const booking = await Booking.findOne(scopeFilter(id, authResult.user)).populate('itineraryId', 'activities')
    if (!booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    const merged = computeActivityConfirmations(booking, booking.itineraryId)
    const current = merged.find((item) => item.key === key)
    if (!current) return Response.json({ error: 'Activity not found on this booking' }, { status: 404 })
    if (current.confirmed) {
      return Response.json({ error: 'This activity is already confirmed' }, { status: 400 })
    }

    const updatedList = merged.map((item) =>
      item.key === key
        ? {
            key: item.key,
            name: item.name,
            quotedPrice: item.quotedPrice,
            quotedUnitPrice: item.quotedUnitPrice,
            quantity: Number(quantity),
            price: Number(price),
            confirmed: false,
            confirmedAt: null,
            confirmedBy: null,
            paymentSentAt: new Date(),
            paymentPaid: false,
            paymentPaidAt: null,
            paymentPaidScreenshot: null,
          }
        : {
            key: item.key,
            name: item.name,
            quotedPrice: item.quotedPrice,
            quotedUnitPrice: item.quotedUnitPrice,
            quantity: item.quantity,
            price: item.price,
            confirmed: item.confirmed,
            confirmedAt: item.confirmedAt,
            confirmedBy: item.confirmedBy,
            paymentSentAt: item.paymentSentAt,
            paymentPaid: item.paymentPaid,
            paymentPaidAt: item.paymentPaidAt,
            paymentPaidScreenshot: item.paymentPaidScreenshot,
          }
    )

    booking.activityConfirmations = updatedList
    await booking.save()

    return Response.json({
      activityConfirmations: updatedList,
      status: deriveStatus(updatedList),
    })
  } catch (error) {
    console.error('Send activity payment request error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Accounts marks a sent activity payment as paid — requires a screenshot
 * of the payment made, visible to both Accounts and Operations afterward. */
export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const forbidden = requireRoles(authResult.user.role, ['accounts', 'admin'])
    if (forbidden) {
      return Response.json({ error: 'Only Accounts can mark a payment as paid' }, { status: forbidden.status })
    }

    await connectDB()
    const { id } = await params
    const { key, screenshotUrl } = await request.json()
    if (!key) return Response.json({ error: 'key is required' }, { status: 400 })
    if (!screenshotUrl) {
      return Response.json(
        { error: 'Upload a screenshot of the payment made before marking this as paid' },
        { status: 400 }
      )
    }

    const booking = await Booking.findOne(scopeFilter(id, authResult.user))
    if (!booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    const entry = booking.activityConfirmations.find((a) => a.key === key)
    if (!entry) return Response.json({ error: 'Activity not found on this booking' }, { status: 404 })
    if (!entry.paymentSentAt) {
      return Response.json({ error: 'Operations has not sent this payment request yet' }, { status: 400 })
    }
    if (entry.paymentPaid) {
      return Response.json({ error: 'This payment is already marked as paid' }, { status: 400 })
    }

    entry.paymentPaid = true
    entry.paymentPaidAt = new Date()
    entry.paymentPaidBy = authResult.user.userId
    entry.paymentPaidScreenshot = screenshotUrl
    await booking.save()

    return Response.json({
      paymentPaid: true,
      paymentPaidAt: entry.paymentPaidAt,
      paymentPaidScreenshot: entry.paymentPaidScreenshot,
    })
  } catch (error) {
    console.error('Mark activity payment paid error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
