import connectDB from '@/lib/mongodb'
import Team from '@/models/Team'
import User from '@/models/User'
import Lead from '@/models/Lead'
import Booking from '@/models/Booking'
import Payment from '@/models/Payment'
import { authenticate, requireRoles } from '@/lib/middleware'

export async function GET(request) {
  try {
    const authResult = await authenticate(request)
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status })
    }

    const forbidden = requireRoles(authResult.user.role, ['superadmin'])
    if (forbidden) {
      return Response.json({ error: forbidden.error }, { status: forbidden.status })
    }

    await connectDB()

    const agencies = await Team.find({})
      .select('name plan subscriptionStatus createdAt walletCredits')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()

    const teamIds = agencies.map((a) => a._id)
    // One grouped aggregation per collection across all agencies instead of
    // 4 queries per agency (N+1) — same total data, a fraction of the round trips.
    const [userCounts, leadCounts, bookingCounts, revenueByTeam] = await Promise.all([
      User.aggregate([{ $match: { teamId: { $in: teamIds } } }, { $group: { _id: '$teamId', n: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: { teamId: { $in: teamIds } } }, { $group: { _id: '$teamId', n: { $sum: 1 } } }]),
      Booking.aggregate([{ $match: { teamId: { $in: teamIds } } }, { $group: { _id: '$teamId', n: { $sum: 1 } } }]),
      Payment.aggregate([
        { $match: { teamId: { $in: teamIds }, status: 'completed' } },
        { $group: { _id: '$teamId', sum: { $sum: '$amount' } } },
      ]),
    ])
    const toMap = (rows, key = 'n') => new Map(rows.map((r) => [String(r._id), r[key]]))
    const usersMap = toMap(userCounts)
    const leadsMap = toMap(leadCounts)
    const bookingsMap = toMap(bookingCounts)
    const revenueMap = toMap(revenueByTeam, 'sum')

    const enriched = agencies.map((agency) => {
      const key = String(agency._id)
      return {
        ...agency,
        userCount: usersMap.get(key) || 0,
        leadCount: leadsMap.get(key) || 0,
        bookingCount: bookingsMap.get(key) || 0,
        revenue: revenueMap.get(key) || 0,
      }
    })

    const totals = {
      agencies: agencies.length,
      totalLeads: enriched.reduce((a, b) => a + b.leadCount, 0),
      totalBookings: enriched.reduce((a, b) => a + b.bookingCount, 0),
      totalRevenue: enriched.reduce((a, b) => a + b.revenue, 0),
    }

    return Response.json({ agencies: enriched, totals })
  } catch (error) {
    console.error('Platform analytics error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
