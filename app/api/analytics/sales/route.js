import connectDB from '@/lib/mongodb'
import Lead from '@/models/Lead'
import Booking from '@/models/Booking'
import FollowUp from '@/models/FollowUp'
import { authenticate, requireRoles } from '@/lib/middleware'
import mongoose from 'mongoose'

function startOfDay(d) {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['agent', 'manager'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()
    const tid = new mongoose.Types.ObjectId(String(authResult.user.teamId))
    const uid = new mongoose.Types.ObjectId(String(authResult.user.userId))

    // Activity metrics (new leads, itineraries sent, bookings closed) can be
    // scoped to a date range so Sales can see how much work happened in a
    // given period — with no range given, they show all-time totals.
    // Pending follow-ups / not-contacted are current backlog snapshots, not
    // period activity, so they're never date-scoped.
    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const inRange = fromParam || toParam
      ? {
          ...(fromParam ? { $gte: startOfDay(fromParam) } : {}),
          ...(toParam
            ? { $lte: new Date(new Date(toParam).setUTCHours(23, 59, 59, 999)) }
            : {}),
        }
      : null

    const base = { teamId: tid, assignedTo: uid }

    const now = new Date()
    const todayStart = startOfDay(now)
    const todayEnd = new Date(todayStart)
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1)

    const [newLeadsInRange, pendingFollowUps, todayFollowUps, bookingsClosed, notContacted] =
      await Promise.all([
        Lead.countDocuments({ ...base, ...(inRange ? { createdAt: inRange } : {}) }),
        // Overdue: still pending from a previous day (strictly before today,
        // so it never overlaps with "today's follow-ups" below).
        FollowUp.countDocuments({
          teamId: tid,
          assignedTo: uid,
          status: 'pending',
          scheduledDate: { $lt: todayStart },
        }),
        // Pending follow-ups scheduled for today.
        FollowUp.countDocuments({
          teamId: tid,
          assignedTo: uid,
          status: 'pending',
          scheduledDate: { $gte: todayStart, $lt: todayEnd },
        }),
        // This sales person's own bookings, optionally scoped to the range.
        Booking.countDocuments({
          teamId: tid,
          assignedTo: uid,
          ...(inRange ? { createdAt: inRange } : {}),
        }),
        // Leads still sitting at 'new' — nobody's called them yet, since any
        // real contact would have moved the status forward.
        Lead.countDocuments({ ...base, status: 'new' }),
      ])

    const recentLeads = await Lead.find(base)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('firstName lastName email phone status source destination travelDate createdAt')
      .lean()

    const dueFollowUps = await FollowUp.find({
      teamId: tid,
      assignedTo: uid,
      status: 'pending',
      scheduledDate: { $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    })
      .populate('leadId', 'firstName lastName phone')
      .sort({ scheduledDate: 1 })
      .limit(5)
      .lean()

    // Performance trend — bookings this sales person closed per month, for
    // the last 6 months (always this fixed window, independent of the
    // today-range filter above, since it's meant to show a trend over time).
    const trendStart = new Date()
    trendStart.setUTCMonth(trendStart.getUTCMonth() - 5, 1)
    trendStart.setUTCHours(0, 0, 0, 0)
    const monthlyBookingsAgg = await Booking.aggregate([
      { $match: { teamId: tid, assignedTo: uid, createdAt: { $gte: trendStart } } },
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ])
    const countsByKey = new Map(monthlyBookingsAgg.map((r) => [`${r._id.y}-${r._id.m}`, r.count]))
    const monthlyBookings = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setUTCMonth(d.getUTCMonth() - i, 1)
      const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
      monthlyBookings.push({
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        count: countsByKey.get(key) || 0,
      })
    }

    return Response.json({
      today: {
        newLeads: newLeadsInRange,
        pendingFollowUps,
        todayFollowUps,
        bookingsClosed,
        notContacted,
      },
      recentLeads,
      dueFollowUps,
      monthlyBookings,
    })
  } catch (error) {
    console.error('Sales analytics error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
