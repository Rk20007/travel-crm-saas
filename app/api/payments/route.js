import connectDB from '@/lib/mongodb'
import Payment from '@/models/Payment'
import Booking from '@/models/Booking'
import { authenticate, requireRoles } from '@/lib/middleware'

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['admin', 'accounts', 'superadmin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')

    const query = { teamId: authResult.user.teamId }
    if (status) query.status = status

    const skip = (page - 1) * limit
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('leadId', 'firstName lastName email')
        .populate('bookingId', 'bookingNumber totalAmount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(query),
    ])

    return Response.json({
      payments,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    })
  } catch (error) {
    console.error('Get payments error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['admin', 'accounts'])
    if (forbidden) {
      return Response.json({ error: 'Only accounts team can mark payments' }, { status: forbidden.status })
    }

    await connectDB()
    const body = await request.json()
    const { bookingId, leadId, amount, paymentMethod, notes, transactionId } = body

    if (!bookingId || !leadId || !amount || !paymentMethod) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      teamId: authResult.user.teamId,
    })
    if (!booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`

    const payment = await Payment.create({
      paymentNumber,
      bookingId,
      leadId,
      amount: Number(amount),
      currency: booking.currency || 'INR',
      paymentMethod,
      status: 'completed',
      paidDate: new Date(),
      transactionId,
      notes,
      processedBy: authResult.user.userId,
      teamId: authResult.user.teamId,
    })

    const populated = await Payment.findById(payment._id)
      .populate('leadId', 'firstName lastName email')
      .populate('bookingId', 'bookingNumber totalAmount')

    return Response.json({ payment: populated }, { status: 201 })
  } catch (error) {
    console.error('Create payment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
