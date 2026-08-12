import connectDB from '@/lib/mongodb'
import Booking from '@/models/Booking'
import { authenticate, requireRoles } from '@/lib/middleware'

/** Same scoping as the main booking endpoint — Accounts can only settle a
 * refund for a booking routed to them, Admin sees everything. */
function scopeFilter(id, user) {
  const query = { _id: id, teamId: user.teamId }
  if (user.role === 'accounts') query.accountsAssignedTo = user.userId
  return query
}

/** Accounts marks a cancelled booking's refund as paid — requires a
 * screenshot of the refund payment as proof, same pattern as every other
 * payment-proof flow in the app. */
export async function PATCH(request, { params }) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }
    const forbidden = requireRoles(authResult.user.role, ['admin', 'accounts'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const { id } = await params
    const body = await request.json()

    if (!body.screenshotUrl) {
      return Response.json({ error: 'Upload a screenshot of the refund payment' }, { status: 400 })
    }

    const booking = await Booking.findOne({ ...scopeFilter(id, authResult.user), status: 'cancelled' })
    if (!booking) {
      return Response.json({ error: 'Cancelled booking not found' }, { status: 404 })
    }
    if (booking.refundStatus !== 'pending') {
      return Response.json({ error: 'No refund pending for this booking' }, { status: 400 })
    }

    booking.refundStatus = 'paid'
    booking.refundPaidAt = new Date()
    booking.refundPaidBy = authResult.user.userId
    booking.refundScreenshot = body.screenshotUrl
    booking.refundNote = body.note || ''
    await booking.save()

    return Response.json({ booking })
  } catch (error) {
    console.error('Refund settlement error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
